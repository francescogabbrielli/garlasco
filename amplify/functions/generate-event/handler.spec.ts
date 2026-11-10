import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send = send;
  },
  ConverseCommand: class {
    constructor(public input: any) {}
  },
}));

import { handler } from './handler';

const event = { arguments: { description: 'Il ritrovamento del corpo' } };

describe('generate-event handler', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      results: [{ title: 'T', url: 'http://u', content: 'C' }]
    })));
    send.mockReset();
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('returns the event produced by the model tool call', async () => {
    const generated = { type: 'Fatto', name: 'n', description: 'd', startDate: '2007-08-13T00:00:00+01:00', sources: [] };
    send.mockResolvedValue({ output: { message: { content: [{ text: 'x' }, { toolUse: { input: generated } }] } } });

    expect(await handler(event)).toEqual(generated);

    const input = send.mock.calls[0][0].input;
    expect(input.toolConfig.toolChoice).toEqual({ tool: { name: 'save_event' } });
    expect(input.messages[0].content[0].text).toContain('Il ritrovamento del corpo');
    expect(input.messages[0].content[0].text).toContain('[1] T (http://u)');
  });

  it('tells the model when no search results are available', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({})));
    send.mockResolvedValue({ output: { message: { content: [{ toolUse: { input: {} } }] } } });

    await handler(event);

    expect(send.mock.calls[0][0].input.messages[0].content[0].text).toContain('(none)');
  });

  it('fails when the search request is rejected', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(handler(event)).rejects.toThrow('Tavily search failed: 500');
    expect(send).not.toHaveBeenCalled();
  });

  it('fails when the model returns no tool use', async () => {
    send.mockResolvedValue({ output: { message: { content: [{ text: 'no' }] } } });

    await expect(handler(event)).rejects.toThrow('The model returned no event');
  });
});
