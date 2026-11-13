import {
  afterRenderEffect,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  signal,
  inject,
  model
} from '@angular/core';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { bots, BotError } from '../../../../amplify/data/bots';
import type { Schema } from '../../../../amplify/data/resource';
import { MainComponent } from '../main.component';

import { CHAT_CLIENT } from './chat-client';
import { EscapeStack } from '../../escape-stack.service';

type BotId = (typeof bots)[number]['definition'];

type Conversation = Schema[BotId]['type'];
type StreamEvent = Schema[BotId]['streamEventType'];

interface BotSession {
  conversation?: Conversation
  subscription?: { unsubscribe(): void }
  messages: ChatMessage[]
  busy: boolean
  error: string
  activeAssistantId?: string
  activeRequestId?: string
  notice?: string
  startNewConversation?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  truncated?: boolean
  timedOut?: boolean
  interrupted?: boolean
}

const EMPTY_SESSION: BotSession = { messages: [], busy: false, error: '' }

@Component({
  selector: 'app-bot-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bot-chat.component.html',
  styleUrl: './bot-chat.component.css'
})
export class BotChatComponent implements OnDestroy {

  private readonly client = inject(CHAT_CLIENT)

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
      .map(bot => [bot.definition, EMPTY_SESSION] as const)
      .reduce((acc, [key, value]) => {
        acc[key as string] = value;
        return acc;
      }, {} as Record<string, BotSession>))

  readonly session = computed(() => this.sessions()[this.botId()] ?? EMPTY_SESSION)
  readonly bots = bots
  readonly bot = computed(() => bots.find(bot => bot.definition == this.botId()))
  readonly isBotSelected = (b: typeof bots[number]) => b.definition === this.botId()

  // I frammenti possono arrivare fuori ordine o essere duplicati.
  private readonly chunks = new Map<string, Map<number, Map<number, string>>>();
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

  selectBot(id: BotId): void {
    this.shouldFollowMessages = true
    this.botId.set(id)
    this.closeBotMenu()
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
      busy: false,
      error: ''
    }
  }

  private updateSession(id: BotId, patch: Partial<BotSession>): void {
    this.sessions.update(sessions => ({
      ...sessions,
      [id]: {
        ...(sessions[id] ?? this.createSession()),
        ...patch
      }
    }))
  }

  async send(): Promise<void> {
    const id = this.botId();
    const text = this.text().trim();
    const session = this.sessions()[id] ?? this.createSession()

    if (!text || session.busy) return

    this.text.set('');
    this.shouldFollowMessages = true

    const localId = crypto.randomUUID();

    this.updateSession(id, {
      busy: true,
      error: '',
      notice: undefined,
      activeRequestId: localId,
      activeAssistantId: undefined,
      messages: [
        ...session.messages,
        { id: localId, role: 'user', text }
      ]
    })

    try {

      let conversation = session.conversation

      if (!conversation && !session.startNewConversation) {
        conversation = await this.restoreLatestConversation(id, localId)
        if (this.destroyed || !this.isActiveRequest(id, localId)) return
      }

      if (!conversation) {

        const { data, errors } =
          await this.client.conversations[id].create()

        if (errors?.length) throw new Error(errors.map(error => error.message).join('\n'))
        if (!data) throw new Error('Impossibile creare la conversazione.')
        if (this.destroyed || !this.isActiveRequest(id, localId)) return

        conversation = data

        const subscription = conversation.onStreamEvent({
          next: event => this.onStream(id, event),
          error: e => {
            if (this.destroyed) return
            const botError = this.normalizeBotError(e)
            const session = this.sessions()[id]
            if (!session?.busy) return
            const timeout = botError.code === 'RESPONSE_TIMEOUT'
            const assistantId = session?.activeAssistantId
            console.error('Errore nello streaming del messaggio.', e)
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
        content: [{ text }]
      })

      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join('\n'))
      }

      // busy viene azzerato al termine dello streaming.
    } catch (error) {
      if (this.destroyed || !this.isActiveRequest(id, localId)) return
      const botError = this.normalizeBotError(error)
      console.error('Errore invio', botError)
      this.updateSession(id, {
        busy: false,
        activeRequestId: undefined,
        error: botError.message
      })
    }
  }

  private async restoreLatestConversation(
    id: BotId,
    requestId: string
  ): Promise<Conversation | undefined> {
    const { data: conversations, errors: listErrors } =
      await this.client.conversations[id].list({ limit: 1 })

    if (listErrors?.length) {
      throw new Error(listErrors.map(error => error.message).join('\n'))
    }

    if (this.destroyed || !this.isActiveRequest(id, requestId)) return

    const latest = conversations?.[0]
    if (!latest) return

    const { data: conversation, errors: getErrors } =
      await this.client.conversations[id].get({ id: latest.id })

    if (getErrors?.length) {
      throw new Error(getErrors.map(error => error.message).join('\n'))
    }

    if (!conversation) throw new Error('Impossibile ripristinare la conversazione.')
    if (this.destroyed || !this.isActiveRequest(id, requestId)) return

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
      if (this.destroyed || !this.isActiveRequest(id, requestId)) return
    } while (nextToken)

    const messages = persistedMessages
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(message => ({
        id: message.id,
        role: message.role,
        text: message.content
          .map(content => 'text' in content && typeof content.text === 'string' ? content.text : '')
          .join('')
      }))
      .filter(message => message.text.length > 0)

    const pendingMessage = this.sessions()[id]?.messages.find(message => message.id === requestId)

    this.updateSession(id, {
      conversation,
      startNewConversation: false,
      messages: pendingMessage ? [...messages, pendingMessage] : messages
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

  ngOnDestroy(): void {

    this.destroyed = true

    Object.values(this.sessions()).forEach(session =>
      session.subscription?.unsubscribe()
    )

    this.chunks.clear()

  }

}