import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler } from './handler';

const context = { awsRequestId: 'req-1' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error: any) {
    return error.details;
  }
  throw new Error('expected rejection');
}

describe('map-website handler', () => {
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

  it('maps a site and requests URLs from the supplied host', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      base_url: 'https://example.com/',
      results: [
        'https://example.com/page-1',
        'https://example.com/page-2'
      ]
    }));

    const result = await handler({
      arguments: {
        url: 'https://example.com',
        query: 'Find pages about the event',
        maxDepth: 3,
        maxResults: 8
      }
    }, context);

    expect(result).toEqual({
      baseUrl: 'https://example.com/',
      urls: ['https://example.com/page-1', 'https://example.com/page-2']
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.tavily.com/map');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      url: 'https://example.com/',
      max_depth: 3,
      limit: 8,
      select_domains: ['^example\\.com$'],
      allow_external: false,
      timeout: 90,
      instructions: 'Find pages about the event'
    });
  });

  it('rejects invalid URLs without calling Tavily', async () => {
    const details = await failure(handler({
      arguments: { url: 'file:///etc/passwd' }
    }, context));

    expect(details.code).toBe('INVALID_MAP_URL');
    expect(details.requestId).toBe('req-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects instructions longer than 1000 characters', async () => {
    const details = await failure(handler({
      arguments: {
        url: 'https://example.com',
        query: 'x'.repeat(1001)
      }
    }, context));

    expect(details.code).toBe('INVALID_MAP_INSTRUCTIONS');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
