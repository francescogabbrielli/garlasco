import { describe, expect, it } from 'vitest';
import { classifyTavilyError } from './tavily-error';

describe('classifyTavilyError', () => {
  it.each([
    [429, 'TAVILY_RATE_LIMITED', true],
    [432, 'TAVILY_QUOTA_EXCEEDED', false],
    [433, 'TAVILY_QUOTA_EXCEEDED', false],
    [401, 'TAVILY_ACCESS_DENIED', false],
    [403, 'TAVILY_ACCESS_DENIED', false],
    [400, 'TAVILY_REQUEST_FAILED', false],
    [500, 'TAVILY_REQUEST_FAILED', true],
    [503, 'TAVILY_REQUEST_FAILED', true],
  ])('maps status %i to %s (retryable: %s)', (status, code, retryable) => {
    const error = classifyTavilyError(status);
    expect(error.source).toBe('TAVILY');
    expect(error.code).toBe(code);
    expect(error.retryable).toBe(retryable);
  });
});
