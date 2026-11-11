import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from './handler';

describe('report-client-error handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a sanitized report with the authenticated user and request id', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(handler({
      arguments: {
        fingerprint: 'a'.repeat(64),
        message: 'Error: password=hunter2',
        stack: 'Error: token=abc123',
        url: '/dashboard',
        count: 3,
        occurredAt: '2026-11-11T12:00:00.000Z',
        lastOccurredAt: '2026-11-11T12:01:00.000Z'
      },
      identity: { sub: 'user-1' }
    }, { awsRequestId: 'request-1' })).resolves.toBe(true);

    expect(logError).toHaveBeenCalledOnce();
    expect(logError.mock.calls[0][1]).toContain('"requestId":"request-1"');
    expect(logError.mock.calls[0][1]).toContain('"userSub":"user-1"');
    expect(logError.mock.calls[0][1]).toContain('"count":3');
    expect(logError.mock.calls[0][1]).toContain('password=[REDACTED]');
    expect(logError.mock.calls[0][1]).toContain('token=[REDACTED]');
    expect(logError.mock.calls[0][1]).not.toContain('hunter2');
    expect(logError.mock.calls[0][1]).not.toContain('abc123');
  });

  it('rejects empty or oversized messages', async () => {
    await expect(handler({
      arguments: {
        fingerprint: 'a'.repeat(64),
        message: ' ',
        count: 1,
        occurredAt: '2026-11-11T12:00:00.000Z',
        lastOccurredAt: '2026-11-11T12:00:00.000Z'
      }
    }, { awsRequestId: 'request-1' })).rejects.toThrow('Invalid client error report');

    await expect(handler({
      arguments: {
        fingerprint: 'a'.repeat(64),
        message: 'x'.repeat(1001),
        count: 1,
        occurredAt: '2026-11-11T12:00:00.000Z',
        lastOccurredAt: '2026-11-11T12:00:00.000Z'
      }
    }, { awsRequestId: 'request-1' })).rejects.toThrow('Invalid client error report');
  });

  it('rejects invalid timestamps and optional field types', async () => {
    await expect(handler({
      arguments: {
        fingerprint: 'a'.repeat(64),
        message: 'failure',
        count: 1,
        occurredAt: 'invalid',
        lastOccurredAt: '2026-11-11T12:00:00.000Z'
      }
    }, { awsRequestId: 'request-1' })).rejects.toThrow('Invalid client error report');

    await expect(handler({
      arguments: {
        fingerprint: 'a'.repeat(64),
        message: 'failure',
        stack: 42,
        count: 1,
        occurredAt: '2026-11-11T12:00:00.000Z',
        lastOccurredAt: '2026-11-11T12:00:00.000Z'
      }
    }, { awsRequestId: 'request-1' })).rejects.toThrow('Invalid client error report');
  });
});
