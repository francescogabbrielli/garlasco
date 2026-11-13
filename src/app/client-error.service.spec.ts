import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_ERROR_CLIENT, ClientErrorService } from './client-error.service';
import { UserData, UserProfileService } from './user-profile.service';
import { signal } from '@angular/core';

describe('ClientErrorService', () => {
  const reportClientError = vi.fn()

  const userData = new UserData(
    { sub: 'user-123', given_name: 'Mario', family_name: 'Rossi' },
    ['Member'],
  );

  beforeEach(() => {
    vi.useFakeTimers();
    reportClientError.mockReset().mockResolvedValue({ data: true });
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(new ArrayBuffer(32));
    TestBed.configureTestingModule({
      providers: [{
        provide: CLIENT_ERROR_CLIENT,
        useValue: { mutations: { reportClientError } }
      }, {
        provide: UserProfileService,
        useValue: { user: signal(userData) }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends one report with the cumulative count for matching errors in one minute', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = TestBed.inject(ClientErrorService);
    service.report(new Error('same failure'));
    service.report(new Error('same failure'));

    await vi.advanceTimersByTimeAsync(59_999);
    expect(reportClientError).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(reportClientError).toHaveBeenCalledOnce();
    expect(reportClientError.mock.calls[0][0]).toMatchObject({
      fingerprint: '0'.repeat(64),
      message: 'Error: same failure',
      count: 2
    });
    expect(consoleError).toHaveBeenCalledTimes(2);
  });

  it('starts a new count window after the previous report is sent', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = TestBed.inject(ClientErrorService);
    service.report(new Error('same failure'));
    await vi.advanceTimersByTimeAsync(60_000);
    service.report(new Error('same failure'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(reportClientError).toHaveBeenCalledTimes(2);
    expect(reportClientError.mock.calls.map(([report]) => report.count)).toEqual([1, 1]);
  });

  it('allows local error logging to be disabled', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = TestBed.inject(ClientErrorService);
    service.setConsoleLoggingEnabled(false);

    service.report(new Error('local-only setting'));

    expect(consoleError).not.toHaveBeenCalled();
  });
});
