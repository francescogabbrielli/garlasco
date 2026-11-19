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

describe('extract-web handler', () => {
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

  it('extracts page content and includes the optional query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      results: [{ url: 'https://example.com/page', raw_content: 'Page content' }],
      failed_results: [{ url: 'https://example.com/missing', error: 'Page unavailable' }]
    }));

    const result = await handler({
      arguments: {
        url: 'https://example.com/page',
        query: 'Find the relevant details'
      }
    }, context);

    expect(result).toBe('Page content');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.tavily.com/extract');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      urls: 'https://example.com/page',
      extract_depth: 'basic',
      format: 'markdown',
      query: 'Find the relevant details',
      chunks_per_source: 3
    });
  });

  it('rejects invalid URLs without calling Tavily', async () => {
    const details = await failure(handler({
      arguments: { url: 'file:///etc/passwd' }
    }, context));

    expect(details.code).toBe('INVALID_EXTRACT_URL');
    expect(details.requestId).toBe('req-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects queries longer than 1000 characters', async () => {
    const details = await failure(handler({
      arguments: {
        url: 'https://example.com/page',
        query: 'x'.repeat(1001)
      }
    }, context));

    expect(details.code).toBe('INVALID_EXTRACT_QUERY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
