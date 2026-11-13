import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './handler';

const context = { awsRequestId: 'req-1' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e: any) {
    return e.details;
  }
  throw new Error('expected rejection');
}

describe('search-web handler', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns trimmed query and mapped results', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      results: [{ title: 't', url: 'u', content: 'c', extra: 'ignored' }]
    }));

    const result = await handler({ arguments: { query: '  garlasco  ' } }, context);

    expect(result).toEqual({ query: 'garlasco', results: [{ title: 't', url: 'u', content: 'c' }] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.query).toBe('garlasco');
    expect(body.max_results).toBe(5);
  });

  it('crawls a requested site and maps page content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      base_url: 'https://example.com/',
      results: [
        { url: 'https://example.com/page', raw_content: 'Page content', extra: 'ignored' }
      ]
    }));

    const result = await handler({
      arguments: {
        url: 'https://example.com',
        instructions: 'Find pages about the event',
        maxDepth: 3,
        maxPages: 8
      }
    }, context);

    expect(result).toEqual({
      baseUrl: 'https://example.com/',
      pages: [{ url: 'https://example.com/page', content: 'Page content' }]
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.tavily.com/crawl');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      url: 'https://example.com/',
      instructions: 'Find pages about the event',
      max_depth: 3,
      limit: 8,
      allow_external: false,
      extract_depth: 'basic',
      format: 'markdown',
      timeout: 45,
      chunks_per_source: 3
    });
  });

  it('bounds crawl depth and page count and rejects invalid URLs', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      base_url: 'https://example.com/',
      results: []
    }));

    await handler({
      arguments: { url: 'https://example.com', maxDepth: 8, maxPages: 50 }
    }, context);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      max_depth: 3,
      limit: 10
    });

    const details = await failure(handler({ arguments: { url: 'file:///etc/passwd' } }, context));

    expect(details.code).toBe('INVALID_CRAWL_URL');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, 5],
    [0, 1],
    [50, 10],
    [3, 3],
  ])('clamps maxResults %s to %i', async (input, expected) => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));

    await handler({ arguments: { query: 'q', maxResults: input } }, context);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_results).toBe(expected);
  });

  it('limits the number of returned results', async () => {
    const results = Array.from({ length: 4 }, (_, i) => ({ title: `${i}`, url: 'u', content: 'c' }));
    fetchMock.mockResolvedValue(jsonResponse({ results }));

    const out: any = await handler({ arguments: { query: 'q', maxResults: 2 } }, context);

    expect(out.results).toHaveLength(2);
  });

  it.each(['', '   ', 'x'.repeat(1001)])('rejects invalid query %#', async (query) => {
    const details = await failure(handler({ arguments: { query } }, context));

    expect(details.code).toBe('INVALID_SEARCH_QUERY');
    expect(details.requestId).toBe('req-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies non-OK responses', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 429 }));

    const details = await failure(handler({ arguments: { query: 'q' } }, context));

    expect(details.code).toBe('TAVILY_RATE_LIMITED');
    expect(details.retryable).toBe(true);
    expect(details.requestId).toBe('req-1');
  });

  it('maps timeouts', async () => {
    const timeout = new Error('timeout');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValue(timeout);

    const details = await failure(handler({ arguments: { query: 'q' } }, context));

    expect(details.code).toBe('TAVILY_TIMEOUT');
  });

  it('maps network errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const details = await failure(handler({ arguments: { query: 'q' } }, context));

    expect(details.code).toBe('TAVILY_NETWORK_ERROR');
    expect(details.retryable).toBe(true);
  });

  it('rejects unparsable responses', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));

    const details = await failure(handler({ arguments: { query: 'q' } }, context));

    expect(details.code).toBe('TAVILY_INVALID_RESPONSE');
  });

  it('rejects responses with unexpected shape', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [{ title: 1 }] }));

    const details = await failure(handler({ arguments: { query: 'q' } }, context));

    expect(details.code).toBe('TAVILY_INVALID_RESPONSE');
  });

  it('wraps unexpected errors as SEARCH_INTERNAL_ERROR', async () => {
    const details = await failure(handler({ arguments: { query: undefined as any } }, context));

    expect(details.code).toBe('SEARCH_INTERNAL_ERROR');
    expect(details.source).toBe('APPLICATION');
    expect(details.requestId).toBe('req-1');
  });
});
