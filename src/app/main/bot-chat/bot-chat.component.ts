import { OnDestroy, computed, effect, signal, inject, model, OnInit } from '@angular/core';
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
  conversation?: Conversation;
  subscription?: { unsubscribe(): void };
  messages: ChatMessage[];
  busy: boolean;
  error: string;
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const EMPTY_SESSION: BotSession = { messages: [], busy: false, error: '' }

@Component({
  selector: 'app-bot-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bot-chat.component.html',
  styleUrl: './bot-chat.component.css'
})
export class BotChatComponent implements OnInit, OnDestroy {

  private readonly client = inject(CHAT_CLIENT)

  private readonly escapeStack = inject(EscapeStack)

  readonly opened = model(false)
  readonly botId = signal<BotId>(bots ? bots[0].definition : '' as BotId)
  readonly text = signal('')

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
    this.isBotMenuOpen.set(!this.isBotMenuOpen())
  }

  selectBot(id: BotId): void {
    this.botId.set(id)
    this.isBotMenuOpen.set(false)
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

    const localId = crypto.randomUUID();

    this.updateSession(id, {
      busy: true,
      error: '',
      messages: [
        ...session.messages,
        { id: localId, role: 'user', text }
      ]
    })

    try {

      let conversation = session.conversation

      if (!conversation) {

        const { data, errors } =
          await this.client.conversations[id].create()

        if (errors?.length) throw new Error(errors.map(error => error.message).join('\n'))
        if (!data) throw new Error('Impossibile creare la conversazione.')
        if (this.destroyed) return

        conversation = data

        const subscription = conversation.onStreamEvent({
          next: event => this.onStream(id, event),
          error: e => {
            if (this.destroyed) return
            const botError = this.normalizeBotError(e)
            console.error('Errore nello streaming del messaggio.', e)
            this.updateSession(id, {
              busy: false,
              error: botError.message
            })
          }
        })

        this.updateSession(id, { conversation, subscription })
        
      }

      const { errors } = await conversation.sendMessage({
        content: [{ text }]
      })

      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join('\n'))
      }

      // busy viene azzerato al termine dello streaming.
    } catch (error) {
      if (this.destroyed) return
      const botError = this.normalizeBotError(error)
      console.error('Errore invio', botError)
      this.updateSession(id, {
        busy: false,
        error: botError.message
      })
    }
  }

  private onStream(botId: BotId, event: StreamEvent): void {
    if (this.destroyed) return

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
        messages: exists
          ? messages.map(message =>
              message.id === messageId ? { ...message, text } : message
            )
          : [...messages, { id: messageId, role: 'assistant', text }]
      })
    }

    if ('stopReason' in event) {
      this.updateSession(botId, { busy: false })
    }
  }

  ngOnInit(): void {
    effect(() => (this.opened() ? this.escapeStack.push(() => this.opened.set(false)) : null))
  }

  ngOnDestroy(): void {

    this.destroyed = true

    Object.values(this.sessions()).forEach(session =>
      session.subscription?.unsubscribe()
    )

    this.chunks.clear()

  }

}