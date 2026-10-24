import {
  Component,
  OnDestroy,
  computed,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { generateClient } from 'aws-amplify/data';

import { bots } from '../../../../amplify/data/bots';
import type { Schema } from '../../../../amplify/data/resource';

type Conversation = Schema['analyst']['type']
type StreamEvent = Schema['analyst']['streamEventType']

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type BotId = 'analyst' | 'researcher' | 'detective'

interface BotSession {
  conversation?: Conversation;
  subscription?: { unsubscribe(): void };
  messages: ChatMessage[];
  busy: boolean;
  error: string;
}

@Component({
  selector: 'app-bot-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bot-chat.component.html',
  styleUrl: './bot-chat.component.scss'
})
export class BotChatComponent implements OnDestroy {
  private readonly client = generateClient<Schema>()

  readonly opened = signal(false)
  readonly botId = signal<BotId>('analyst')
  readonly testo = signal('')

  private readonly sessions = signal<Record<BotId, BotSession>>({
    analyst: { messages: [], busy: false, error: '' },
    researcher: { messages: [], busy: false, error: '' },
    detective: { messages: [], busy: false, error: '' }
  })

  readonly session = computed(() => this.sessions()[this.botId()]);
  readonly bots = bots
  readonly bot = computed(
    () => bots.find(bot => bot.definition == this.botId())
  );

  // I frammenti possono arrivare fuori ordine o essere duplicati.
  private readonly chunks = new Map<string, Map<number, Map<number, string>>>();
  private destroyed = false;

  private updateSession(id: BotId, patch: Partial<BotSession>): void {
    this.sessions.update(sessions => ({
      ...sessions,
      [id]: { ...sessions[id], ...patch }
    }));
  }

  async invia(): Promise<void> {
    const id = this.botId();
    const text = this.testo().trim();

    if (!text || this.sessions()[id].busy) return;

    this.testo.set('');
    this.updateSession(id, { busy: true, error: '' });

    const localId = crypto.randomUUID();

    this.updateSession(id, {
      messages: [
        ...this.sessions()[id].messages,
        { id: localId, role: 'user', text }
      ]
    });

    try {
      let conversation = this.sessions()[id].conversation;

      if (!conversation) {
        const { data, errors } =
          await this.client.conversations[id].create();

        if (errors?.length) {
          throw new Error(errors.map(error => error.message).join('\n'));
        }
        if (!data) throw new Error('Impossibile creare la conversazione.');
        if (this.destroyed) return;

        conversation = data;

        const subscription = conversation.onStreamEvent({
          next: event => this.onStream(id, event),
          error: (e) => {
            console.error('Errore nello streaming del messaggio.', e)
            this.updateSession(id, {
              busy: false,
              error: 'Errore [' + e?.errors.map(error => error.message).join(' - ') + ']'
            });
          }
        });

        this.updateSession(id, { conversation, subscription });
      }

      const { errors } = await conversation.sendMessage({
        content: [{ text }]
      });

      if (errors?.length) {
        throw new Error(errors.map(error => error.message).join('\n'));
      }

      // busy viene azzerato al termine dello streaming.
    } catch (error) {
      if (this.destroyed) return;

      this.updateSession(id, {
        busy: false,
        error: error instanceof Error ? error.message : 'Invio non riuscito.'
      });
    }
  }

  private onStream(botId: BotId, event: StreamEvent): void {
    if (this.destroyed) return;

    const messageId = `assistant:${event.associatedUserMessageId}`;
    const key = `${botId}:${messageId}`;

if (
  'text' in event &&
  typeof event.text === 'string' &&
  typeof event.contentBlockIndex === 'number' &&
  typeof event.contentBlockDeltaIndex === 'number'
) {
      let blocks = this.chunks.get(key);

      if (!blocks) {
        blocks = new Map();
        this.chunks.set(key, blocks);
      }

      let deltas = blocks.get(event.contentBlockIndex);

      if (!deltas) {
        deltas = new Map();
        blocks.set(event.contentBlockIndex, deltas);
      }

      deltas.set(event.contentBlockDeltaIndex, event.text);

      const text = [...blocks.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, block]) =>
          [...block.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, value]) => value)
            .join('')
        )
        .join('\n\n');

      const messages = this.sessions()[botId].messages;
      const exists = messages.some(message => message.id === messageId);

      this.updateSession(botId, {
        messages: exists
          ? messages.map(message =>
              message.id === messageId ? { ...message, text } : message
            )
          : [...messages, { id: messageId, role: 'assistant', text }]
      });
    }

    if ('stopReason' in event) {
      this.updateSession(botId, { busy: false });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    Object.values(this.sessions()).forEach(session =>
      session.subscription?.unsubscribe()
    );

    this.chunks.clear();
  }
}