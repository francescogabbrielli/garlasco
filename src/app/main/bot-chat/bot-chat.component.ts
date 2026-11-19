import {
  afterRenderEffect,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  signal,
  inject,
  model,
  OnInit
} from '@angular/core';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { bots, BotError } from '../../../../amplify/data/bots';
import type { Schema } from '../../../../amplify/data/resource';
import { MainComponent } from '../main.component';

import { CHAT_CLIENT } from './chat-client';
import { EscapeStack } from '../../escape-stack.service';
import { ClientErrorService } from '../../client-error.service';

type BotId = (typeof bots)[number]['definition'];

type Conversation = Schema[BotId]['type'];
type StreamEvent = Schema[BotId]['streamEventType'];

const INTRODUCTION_PROMPT =
  "Presentati brevemente all'utente in italiano: spiega chi sei e in cosa puoi aiutarlo. Non menzionare questo messaggio interno.";

interface BotSession {
  conversation?: Conversation
  subscription?: { unsubscribe(): void }
  messages: ChatMessage[]
  busy: boolean
  error: string
  introductionSent?: boolean
  restored: boolean
  activeAssistantId?: string
  activeRequestId?: string
  notice?: string
  startNewConversation?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  hidden?: boolean
  truncated?: boolean
  timedOut?: boolean
  interrupted?: boolean
}

@Component({
  selector: 'app-bot-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bot-chat.component.html',
  styleUrl: './bot-chat.component.css'
})
export class BotChatComponent implements OnInit, OnDestroy {

  private readonly client = inject(CHAT_CLIENT)
  private readonly logService = inject(ClientErrorService)
  private readonly escapeStack = inject(EscapeStack)

  @ViewChild('messages') private messagesContainer?: ElementRef<HTMLDivElement>
  @ViewChild('botMenuToggle') private botMenuToggle?: ElementRef<HTMLButtonElement>
  @ViewChild('botDropdown') private botDropdown?: ElementRef<HTMLDivElement>

  private shouldFollowMessages = true

  readonly opened = model(false)
  readonly botId = signal<BotId>(bots ? bots[0].definition : '' as BotId)
  readonly text = signal('')

  offEscape?: () => void

  constructor() {
    effect(onCleanup => {
      if (!this.opened()) {
        this.offEscape?.()
      } else {
        this.offEscape = this.escapeStack.push(() => this.opened.set(false))
      }
      // if (!this.opened()) return
      // const unregister = this.escapeStack.push(() => this.opened.set(false))
      // onCleanup(unregister)
    })

    afterRenderEffect(() => {
      const messages = this.session().messages
      messages.at(-1)?.text

      if (!this.opened() || !this.shouldFollowMessages) return

      const container = this.messagesContainer?.nativeElement
      if (container) container.scrollTop = container.scrollHeight
    })
  }

  private readonly sessions = signal<Record<string, BotSession>>(
    bots
      .map(bot => [bot.definition, this.createSession()] as const)
      .reduce((acc, [key, value]) => {
        acc[key as string] = value;
        return acc;
      }, {} as Record<string, BotSession>))

  readonly session = computed(() => this.sessions()[this.botId()])
  readonly visibleMessages = computed(() => this.session().messages.filter(message => !message.hidden))
  readonly bots = bots
  readonly bot = computed(() => bots.find(bot => bot.definition == this.botId()))
  readonly isBotSelected = (b: typeof bots[number]) => b.definition === this.botId()

  // I frammenti possono arrivare fuori ordine o essere duplicati.
  private readonly chunks = new Map<string, Map<number, Map<number, string>>>();
  // private readonly introductionsRequested = new Set<BotId>()
  private destroyed = false;  

  main = inject(MainComponent)

  isBotMenuOpen = signal(false)

  isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  isBotError(value: unknown): value is BotError {
    return (
      this.isRecord(value) &&
      ['BEDROCK', 'TAVILY', 'APPLICATION', 'UNKNOWN'].includes(
        String(value['source'])
      ) &&
      typeof value['code'] === 'string' &&
      typeof value['message'] === 'string' &&
      typeof value['retryable'] === 'boolean'
    );
  }

  formatMarkdown(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    const escaped = text.replace(/[&<>"']/g, character => htmlEntities[character])

    return escaped
      .split(/(`[^`\n]+`)/g)
      .map(part => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return `<code>${part.slice(1, -1)}</code>`
        }

        return part
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/__(.+?)__/g, '<strong>$1</strong>')
          .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
          .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
      })
      .join('')
      .replace(/\r\n?|\n/g, '<br>')
  }

  normalizeBotError(error: unknown): BotError {
    const root = this.isRecord(error) ? error : {};

    const entries = Array.isArray(root['errors'])
      ? root['errors']
      : [error];

    for (const entry of entries) {
      if (!this.isRecord(entry)) continue;

      const message =
        typeof entry['message'] === 'string' ? entry['message'] : '';

      // Eventuale BotError serializzato dal nostro backend.
      try {
        const parsed: unknown = JSON.parse(message);
        if (this.isBotError(parsed)) return parsed;
      } catch {
        // Un normale messaggio di errore non è JSON.
      }

      const type = entry['errorType'] ?? entry['name'];

      // Nel percorso della conversazione è il tipico errore
      // di throttling restituito dall'invocazione Bedrock.
      if (type === 'ThrottlingException') {
        return {
          source: 'BEDROCK',
          code: 'BEDROCK_THROTTLED',
          message: 'Il servizio AI è al limite. Riprova tra poco.',
          retryable: true
        };
      } else if (type === 'TimeoutError' || type === 'ModelTimeoutException') {
        return {
          source: type ==='ModelTimeoutException' ? 'BEDROCK' : 'UNKNOWN',
          code: 'RESPONSE_TIMEOUT',
          message: 'Tempo massimo di attesa superato.',
          retryable: true
        };
      }
    }

    return {
      source: 'UNKNOWN',
      code: 'CONVERSATION_FAILED',
      message: 'Impossibile completare la risposta.',
      retryable: false
    }
  }

  toggleBotSelect(): void {
    if (this.isBotMenuOpen()) {
      this.closeBotMenu()
    } else {
      this.isBotMenuOpen.set(true)
    }
  }

  closeBotMenu(): void {
    if (!this.isBotMenuOpen()) return

    const dropdown = this.botDropdown?.nativeElement
    const activeElement = dropdown?.ownerDocument.activeElement
    if (dropdown && activeElement && dropdown.contains(activeElement)) {
      this.botMenuToggle?.nativeElement.focus()
    }

    this.isBotMenuOpen.set(false)
  }

  async selectBot(id: BotId): Promise<void> {

    this.shouldFollowMessages = true
    this.botId.set(id)
    this.closeBotMenu()

    try {
      if (!this.session().restored) {
        this.updateSession(id, {
          busy: false,
          error: '',
          notice: undefined,
          activeRequestId: crypto.randomUUID(),
          activeAssistantId: undefined,
          conversation: await this.restoreLatestConversation(id)
        })
      }
    } finally {
      if (!this.session().introductionSent)
        this.sendMessage(id, INTRODUCTION_PROMPT, true)
    }
  }

  onMessagesScroll(event: Event): void {
    const container = event.currentTarget
    if (!(container instanceof HTMLElement)) return

    this.shouldFollowMessages =
      container.scrollHeight - container.scrollTop - container.clientHeight <= 50
  }

  private createSession(): BotSession {
    return {
      messages: [],
      busy: true,
      error: '',
      restored: false
    }
  }

  private updateSession(id: BotId, patch: Partial<BotSession>): void {
    this.sessions.update(sessions => ({
      ...sessions,
      [id]: {
        ...(sessions[id]),
        ...patch
      }
    }))
    // console.log("UPDATE CHAT SESSION " + id, this.sessions()[id], patch)
  }

  async send(): Promise<void> {
    const id = this.botId();
    const text = this.text().trim();
    const session = this.sessions()[id]

    if (!text || session.busy) return

    this.text.set('');
    this.shouldFollowMessages = true
    await this.sendMessage(id, text, false)
  }

  private async sendMessage(id: BotId, text: string, hidden: boolean): Promise<void> {
    const session = this.sessions()[id]
    // console.log("MSG CHAT " + id, { text, busy: session.busy, hidden })
    if (session.busy) return
    const localId = crypto.randomUUID()

    this.updateSession(id, {
      busy: true,
      error: '',
      notice: undefined,
      activeRequestId: localId,
      activeAssistantId: undefined,
      messages: [
        ...session.messages,
        { id: localId, role: 'user', text, hidden }
      ]
    })

    try {

      let conversation = session.conversation

      // if (hidden && this.sessions()[id]?.introductionSent) {
      //   this.updateSession(id, {
      //     busy: false,
      //     activeRequestId: undefined,
      //     messages: this.sessions()[id].messages.filter(message => message.id !== localId)
      //   })
      //   return
      // }

      if (!conversation) {

        const { data, errors } =
          await this.client.conversations[id].create()

        if (errors?.length) throw new Error(errors.map(error => error.message).join('\n'))
        if (!data) throw new Error('Impossibile creare la conversazione.')
        if (this.destroyed || !this.isActiveRequest(id, localId)) return

        conversation = data
      }

      if (!session.subscription) {

        const subscription = conversation.onStreamEvent({
          next: event => this.onStream(id, event),
          error: e => {
            if (this.destroyed) return
            const botError = this.normalizeBotError(e)
            const session = this.sessions()[id]
            if (!session?.busy) return
            const timeout = botError.code === 'RESPONSE_TIMEOUT'
            const assistantId = session?.activeAssistantId
            this.logService.report(e)
            this.updateSession(id, {
              busy: false,
              activeRequestId: undefined,
              activeAssistantId: undefined,
              error: timeout && assistantId ? '' : botError.message,
              messages: (session?.messages ?? []).map(message =>
                timeout && message.id === assistantId ? { ...message, timedOut: true } : message
              )
            })
          }
        })

        this.updateSession(id, {
          conversation,
          subscription,
          startNewConversation: false
        })
        
      }

      const { errors } = await conversation.sendMessage({
        content: [{ text }],
        aiContext: { botDefinition: id }
      })

      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join('\n'))
      }

      if (hidden) this.updateSession(id, { introductionSent: true })

      // busy viene azzerato al termine dello streaming.
    } catch (error) {
      if (this.destroyed || !this.isActiveRequest(id, localId)) return
      const botError = this.normalizeBotError(error)
      this.logService.report(error)
      this.updateSession(id, {
        busy: false,
        activeRequestId: undefined,
        error: botError.message,
        messages: hidden
          ? this.sessions()[id].messages.filter(message => message.id !== localId)
          : this.sessions()[id].messages,
      })
      // if (hidden) this.introductionsRequested.delete(id)
    }
  }

  private async restoreLatestConversation(
    id: BotId
  ): Promise<Conversation | undefined> {
  
    // console.log("RESTORE CHAT", id)

    const { data: conversations, errors: listErrors } =
      await this.client.conversations[id].list({ limit: 1 })

    if (listErrors?.length) {
      throw new Error(listErrors.map(error => error.message).join('\n'))
    }

    if (this.destroyed) return

    const latest = conversations?.[0]
    if (!latest) {
      this.updateSession(id, { busy: false, restored: true, messages: []})
      return
    }

    const { data: conversation, errors: getErrors } =
      await this.client.conversations[id].get({ id: latest.id })

    if (getErrors?.length) {
      throw new Error(getErrors.map(error => error.message).join('\n'))
    }

    if (!conversation) throw new Error('Impossibile ripristinare la conversazione.')
    if (this.destroyed) return

    const persistedMessages: Schema[BotId]['messageType'][] = []
    let nextToken: string | null | undefined

    do {
      const {
        data,
        errors: messageErrors,
        nextToken: pageToken
      } = await conversation.listMessages({ limit: 100, nextToken })

      if (messageErrors?.length) {
        throw new Error(messageErrors.map(error => error.message).join('\n'))
      }

      persistedMessages.push(...data)
      nextToken = pageToken
      if (this.destroyed) return
    } while (nextToken)

    const messages = persistedMessages
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(message => {
        const text = message.content
          .map(content => 'text' in content && typeof content.text === 'string' ? content.text : '')
          .join('')
        return {
          id: message.id,
          role: message.role,
          text,
          hidden: message.role === 'user' && text === INTRODUCTION_PROMPT
        }
      })
      .filter(message => message.text.length > 0)

      this.updateSession(id, {
        conversation,
        startNewConversation: false,
        introductionSent: this.sessions()[id]?.introductionSent || messages.some(message => message.hidden),
        messages,
        busy: false,
        restored: true
      })

      return conversation
    }

    stopResponse(): void {
      const id = this.botId()
      const session = this.sessions()[id]
      if (!session?.busy) return

      session.subscription?.unsubscribe()
      if (session.activeAssistantId) {
        this.chunks.delete(`${id}:${session.activeAssistantId}`)
      }

      this.updateSession(id, {
        conversation: undefined,
        subscription: undefined,
        startNewConversation: true,
        busy: false,
        activeRequestId: undefined,
        activeAssistantId: undefined,
        notice: 'La prossima domanda inizierà una nuova conversazione.',
        messages: session.messages.map(message =>
          message.id === session.activeAssistantId
            ? { ...message, interrupted: true }
            : message
        )
      })

  }

  private isActiveRequest(id: BotId, requestId: string): boolean {
    return this.sessions()[id]?.activeRequestId === requestId
  }

  private onStream(botId: BotId, event: StreamEvent): void {
    // console.log("ON STREAM "+ botId, event.associatedUserMessageId)
    if (this.destroyed) return
    if (!this.sessions()[botId]?.busy) return

    const messageId = `assistant:${event.associatedUserMessageId}`
    const key = `${botId}:${messageId}`

    if (
      'text' in event &&
      typeof event.text === 'string' &&
      typeof event.contentBlockIndex === 'number' &&
      typeof event.contentBlockDeltaIndex === 'number'
    ) {
      let blocks = this.chunks.get(key)

      if (!blocks) {
        blocks = new Map()
        this.chunks.set(key, blocks)
      }

      let deltas = blocks.get(event.contentBlockIndex)

      if (!deltas) {
        deltas = new Map()
        blocks.set(event.contentBlockIndex, deltas)
      }

      deltas.set(event.contentBlockDeltaIndex, event.text)

      const text = [...blocks.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, block]) =>
          [...block.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, value]) => value)
            .join('')
        )
        .join('\n\n')

      const messages = this.sessions()[botId].messages
      const exists = messages.some(message => message.id === messageId)

      this.updateSession(botId, {
        activeAssistantId: messageId,
        messages: exists
          ? messages.map(message =>
              message.id === messageId ? { ...message, text } : message
            )
          : [...messages, { id: messageId, role: 'assistant', text }]
      })
    }

    if ('stopReason' in event) {
      const truncated = event.stopReason === 'max_tokens'
      this.updateSession(botId, { 
        busy: false,
        activeRequestId: undefined,
        activeAssistantId: undefined,
        messages: (this.sessions()[botId].messages ?? []).map(message =>
          message.id === messageId ? { ...message, truncated } : message
        )
      })
    }
  }

  ngOnInit(): void {
    const id = this.bots[0]?.definition
    if (id) this.selectBot(id)
  }

  ngOnDestroy(): void {

    this.destroyed = true

    Object.values(this.sessions()).forEach(session =>
      session.subscription?.unsubscribe()
    )

    this.chunks.clear()

  }

}