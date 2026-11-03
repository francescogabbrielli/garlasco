import { ComponentFixture, TestBed } from '@angular/core/testing';
import {  expect, vi } from 'vitest';

import { BotChatComponent } from './bot-chat.component';
import { MainComponent } from '../main.component';
import { signal } from '@angular/core';

import { CHAT_CLIENT } from './chat-client';
import type { BotDefinition } from '../../../../amplify/data/bots';

const bots = [
  { definition: 'analyst', name: 'Analista', capabilities: 'Analizza eventi nel database' },
  { definition: 'researcher', name: 'Ricercatore', capabilities: 'Cerca riscontri sul web' },
  { definition: 'detective', name: 'Detective', capabilities: 'Analizza eventi e cerca riscontri sul web' }
] as const satisfies readonly BotDefinition[]

type BotId = (typeof bots)[number]['definition']

interface MockStreamEvent {
  associatedUserMessageId: string
  contentBlockIndex?: number
  contentBlockDeltaIndex?: number
  text?: string
  stopReason?: string
}

interface StreamCallbacks {
  next: (event: MockStreamEvent) => void
  error: (error: Error) => void
}

function createRouteMock() {
  let callbacks: StreamCallbacks | undefined

  const unsubscribe = vi.fn()

  const sendMessage = vi.fn().mockResolvedValue({
    data: { id: 'user-message' },
    errors: undefined
  })

  const onStreamEvent = vi.fn((value: StreamCallbacks) => {
    callbacks = value;
    return { unsubscribe }
  })

  const conversation = {
    id: 'conversation-id',
    sendMessage,
    onStreamEvent
  }

  const create = vi.fn().mockResolvedValue({
    data: conversation,
    errors: undefined
  })

  return {
    create,
    sendMessage,
    onStreamEvent,
    unsubscribe,

    emit(event: MockStreamEvent) {
      if (!callbacks) throw new Error('Subscription non inizializzata')
      callbacks.next(event);
    },

    fail(error: Error) {
      if (!callbacks) throw new Error('Subscription non inizializzata')
      callbacks.error(error);
    }
  }
}

describe('BotChatComponent', () => {
  let fixture: ComponentFixture<BotChatComponent>
  let component: BotChatComponent
  let element: HTMLElement
  let routes: Record<BotId, ReturnType<typeof createRouteMock>>

  beforeEach(async () => {
    routes = {
      analyst: createRouteMock(),
      researcher: createRouteMock(),
      detective: createRouteMock()
    }

    await TestBed.configureTestingModule({
      imports: [BotChatComponent],
      providers: [
        {
          provide: CHAT_CLIENT,
          useValue: { conversations: routes }
        },
        {
          provide: MainComponent,
          useValue: {
            help: signal(null),
            isLoading: signal(false)
          }
        }
      ]
    }).compileComponents()

    fixture = TestBed.createComponent(BotChatComponent)
    
    component = fixture.componentInstance
    element = fixture.nativeElement
    fixture.detectChanges()
  })

  afterEach(() => {
    fixture.destroy()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  // "open" button moved outside component
  // function launcher(): HTMLButtonElement {
  //   return element.querySelector('button[title="Chat IA"]')!
  // }

  function panel(): HTMLElement {
    return element.querySelector('.chat-window')!
  }

  async function send(text = 'Analizza gli eventi'): Promise<void> {
    component.text.set(text)
    await component.send()
    fixture.detectChanges()
  }

  function finish(bot: BotId = 'analyst', userId = 'u1'): void {
    routes[bot].emit({
      associatedUserMessageId: userId,
      contentBlockIndex: 0,
      stopReason: 'end_turn'
    })
    fixture.detectChanges()
  }

  it.each(bots)(
    'sends message to the route of bot $definition',
    async bot => {
      component.selectBot(bot.definition)
      component.text.set('Formula una ipotesi')

      await component.send()

      expect(component.session().error).toBe('')
      expect(routes[bot.definition].create).toHaveBeenCalledTimes(1)

      expect(routes[bot.definition].sendMessage).toHaveBeenCalledWith({
        content: [{ text: 'Formula una ipotesi' }]
      })
    }
  )

  it('starts closed with the Analyst bot selected', () => {
    expect(component.opened()).toBe(false);
    expect(component.botId()).toBe('analyst');

    expect(panel().classList.contains('is-open')).toBe(false);
    expect(panel().hasAttribute('inert')).toBe(true);
    //expect(launcher().getAttribute('aria-expanded')).toBe('false');

    expect(routes.analyst.create).not.toHaveBeenCalled();
  })

  it('opens and closes the panel from the button', () => {
    //launcher().click()
    component.opened.set(true)
    fixture.detectChanges()

    expect(component.opened()).toBe(true)
    expect(panel().classList.contains('is-open')).toBe(true)
    expect(panel().hasAttribute('inert')).toBe(false)
    //expect(launcher().getAttribute('aria-expanded')).toBe('true')

    //launcher().click()
    component.opened.set(false)
    fixture.detectChanges()

    expect(component.opened()).toBe(false)
    expect(panel().classList.contains('is-open')).toBe(false)
    expect(panel().hasAttribute('inert')).toBe(true)
  })

  /** TODO: Conflicts with other keyboard shortcuts, review all Escape key handling
  it('closes the panel by pressing Escape', () => {
    launcher().click()
    fixture.detectChanges()

    panel().dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })
    )
    fixture.detectChanges() 

    expect(component.opened()).toBe(false)
  })
  */

  it('changes bot via the selector', async () => {
    const selected = element.querySelector('button[id="btn-detective"]') as HTMLButtonElement

    selected.click()
    fixture.detectChanges()
    await fixture.whenStable()

    expect(component.botId()).toBe('detective');
    expect(component.bot()?.capabilities).toBe('Analizza eventi e cerca riscontri sul web')

    // Changing bot does not create a conversation yet.
    expect(routes.detective.create).not.toHaveBeenCalled()
  })

  it('does not send empty messages or messages composed of spaces', async () => {
    await send('   ');

    expect(routes.analyst.create).not.toHaveBeenCalled();
    expect(component.session().messages).toEqual([]);
    expect(component.session().busy).toBe(false);
  });

  it('creates the conversation, subscribes to streaming and sends', async () => {
    await send('  Analizza gli eventi  ');

    expect(routes.analyst.create).toHaveBeenCalledTimes(1);
    expect(routes.analyst.onStreamEvent).toHaveBeenCalledTimes(1);

    expect(
      routes.analyst.onStreamEvent.mock.invocationCallOrder[0]
    ).toBeLessThan(
      routes.analyst.sendMessage.mock.invocationCallOrder[0]
    );

    expect(routes.analyst.sendMessage).toHaveBeenCalledWith({
      content: [{ text: 'Analizza gli eventi' }]
    });

    expect(component.text()).toBe('');
    expect(component.session().busy).toBe(true);

    expect(component.session().messages).toEqual([
      expect.objectContaining({
        role: 'user',
        text: 'Analizza gli eventi'
      })
    ]);

    expect(element.querySelector('.message.user')?.textContent)
      .toContain('Analizza gli eventi');
  });

  it('does not allow a second send while the bot is responding', async () => {
    await send('Prima domanda');
    await send('Seconda domanda');

    expect(routes.analyst.sendMessage).toHaveBeenCalledTimes(1);
    expect(component.session().messages).toHaveLength(1);
  });

  it('reorders fragments and ignores duplicates', async () => {
    await send();

    const emit = (
      block: number,
      delta: number,
      text: string
    ) => routes.analyst.emit({
      associatedUserMessageId: 'u1',
      contentBlockIndex: block,
      contentBlockDeltaIndex: delta,
      text
    });

    // Arrivo intenzionalmente fuori ordine.
    emit(0, 1, 'mondo');
    emit(1, 0, 'Secondo paragrafo');
    emit(0, 0, 'Ciao ');
    emit(0, 1, 'mondo'); // Duplicato

    fixture.detectChanges();

    const replies = component.session().messages.filter(
      message => message.role === 'assistant'
    );

    expect(replies).toHaveLength(1);
    expect(replies[0].text)
      .toBe('Ciao mondo\n\nSecondo paragrafo');

    expect(element.querySelector('.message:not(.user)')?.textContent)
      .toContain('Secondo paragrafo');
  });

  it('ignores fragments with missing indices', async () => {
    await send();

    routes.analyst.emit({
      associatedUserMessageId: 'u1',
      contentBlockIndex: 0,
      text: 'Frammento senza delta index'
    });

    expect(component.session().messages).toHaveLength(1);
  });

  it('unblocks the form at the end of the response', async () => {
    await send()

    expect(component.session().busy).toBe(true)

    finish()

    expect(component.session().busy).toBe(false)
    
    await fixture.whenStable()
    fixture.detectChanges()

    const input = element.querySelector<HTMLInputElement>('input[name="message"]')
    expect(input!.disabled).toBe(false)
  })

  it('reuses the conversation for subsequent messages', async () => {
    await send('Prima domanda');
    finish();

    await send('Seconda domanda');

    expect(routes.analyst.create).toHaveBeenCalledTimes(1);
    expect(routes.analyst.onStreamEvent).toHaveBeenCalledTimes(1);
    expect(routes.analyst.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps messages and answers separate for each bot', async () => {
    await send('Domanda per Analista');

    component.botId.set('researcher');
    await send('Domanda per Ricercatore');

    // Analista risponde mentre è visibile Ricercatore.
    routes.analyst.emit({
      associatedUserMessageId: 'u1',
      contentBlockIndex: 0,
      contentBlockDeltaIndex: 0,
      text: 'Risposta Analista'
    });
    finish('analyst');

    expect(component.session().messages.map(message => message.text))
      .toEqual(['Domanda per Ricercatore']);

    component.botId.set('analyst');

    expect(component.session().messages.map(message => message.text))
      .toEqual(['Domanda per Analista', 'Risposta Analista']);

    expect(component.session().busy).toBe(false);

    component.botId.set('researcher');
    expect(component.session().busy).toBe(true);
  });

  it('keeps receiving the response when the panel is closed', async () => {
    component.opened.set(true);
    await send();

    component.opened.set(false);

    routes.analyst.emit({
      associatedUserMessageId: 'u1',
      contentBlockIndex: 0,
      contentBlockDeltaIndex: 0,
      text: 'Risposta ricevuta a pannello chiuso'
    });
    finish();

    expect(component.session().messages.at(-1)?.text)
      .toBe('Risposta ricevuta a pannello chiuso');
    expect(routes.analyst.unsubscribe).not.toHaveBeenCalled();
  });

  it('handles an error in conversation creation', async () => {
    routes.analyst.create.mockResolvedValueOnce({
      data: null,
      errors: [{ message: 'Accesso negato' }]
    });

    await send();

    expect(component.session().busy).toBe(false);
    expect(component.session().error).toContain('Impossibile completare la risposta');
    expect(routes.analyst.sendMessage).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent)
      .toContain('Impossibile completare la risposta');
  });

  it('handles an error returned by sendMessage', async () => {
    routes.analyst.sendMessage.mockResolvedValueOnce({
      data: null,
      errors: [{ message: 'Invio rifiutato' }]
    });

    await send();

    expect(component.session().busy).toBe(false);
    expect(component.session().error).toContain('Impossibile completare la risposta');
  });

  it('handles a network error during sending', async () => {
    routes.analyst.sendMessage.mockRejectedValueOnce(
      new Error('Network error')
    );

    await send();

    expect(component.session().busy).toBe(false);
    expect(component.session().error).toContain('Impossibile completare la risposta');
  });

  it('unblocks the form and shows an error if streaming fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await send();

    routes.analyst.fail(new Error('Bedrock error'));
    fixture.detectChanges();

    expect(component.session().busy).toBe(false);
    expect(component.session().error).not.toBe('');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('cancels all subscriptions when destroyed', async () => {
    await send();

    component.botId.set('researcher');
    await send();

    fixture.destroy();

    expect(routes.analyst.unsubscribe).toHaveBeenCalledTimes(1);
    expect(routes.researcher.unsubscribe).toHaveBeenCalledTimes(1);
    expect(routes.detective.unsubscribe).not.toHaveBeenCalled();
  });

  it('does not open subscription if creation finishes after destruction', async () => {
    let resolveCreate!: (
      value: Awaited<ReturnType<typeof routes.analyst.create>>
    ) => void;

    routes.analyst.create.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveCreate = resolve;
      })
    );

    component.text.set('Domanda');
    const sending = component.send();

    fixture.destroy();

    resolveCreate({
      data: {
        id: 'late-conversation',
        sendMessage: routes.analyst.sendMessage,
        onStreamEvent: routes.analyst.onStreamEvent
      },
      errors: undefined
    });

    await sending;

    expect(routes.analyst.onStreamEvent).not.toHaveBeenCalled();
    expect(routes.analyst.sendMessage).not.toHaveBeenCalled();
  });
});