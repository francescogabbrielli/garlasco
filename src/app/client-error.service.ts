import { InjectionToken, Injectable, inject, signal } from '@angular/core';
import { generateClient, type Client } from 'aws-amplify/data';

import type { Schema } from '../../amplify/data/resource';
import { UserProfileService } from './user-profile.service';

export const CLIENT_ERROR_CLIENT = new InjectionToken<Client<Schema>>(
  'CLIENT_ERROR_CLIENT',
  {
    providedIn: 'root',
    factory: () => generateClient<Schema>()
  }
);

const DEDUPLICATION_WINDOW_MS = 60_000

interface ClientErrorDetails {
  message: string;
  stack?: string;
}

interface PendingReport {
  details: ClientErrorDetails;
  url?: string;
  count: number;
  occurredAt: string;
  lastOccurredAt: string;
}

function redactSensitiveValues(value: string): string {
  return value
    .replace(/\b(password|token|secret|authorization|email)\b(\s*[:=]\s*)([^\s,;]+)/gi, '$1$2[REDACTED]')
    .slice(0, 4000);
}

async function hashMessage(message: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function getErrorDetails(error: unknown): ClientErrorDetails {
  const originalError =
    typeof error === 'object' && error !== null && 'ngOriginalError' in error
      ? error.ngOriginalError
      : error;
  const errorObject =
    typeof originalError === 'object' && originalError !== null
      ? originalError as { message?: unknown; stack?: unknown; name?: unknown }
      : undefined;

  const message = typeof originalError === 'string'
    ? originalError
    : typeof errorObject?.message === 'string'
      ? `${typeof errorObject.name === 'string' ? `${errorObject.name}: ` : ''}${errorObject.message}`
      : Object.prototype.toString.call(originalError);

  return {
    message: redactSensitiveValues(message).slice(0, 1000),
    ...(typeof errorObject?.stack === 'string'
      ? { stack: redactSensitiveValues(errorObject.stack) }
      : {})
  };
}

@Injectable({ providedIn: 'root' })
export class ClientErrorService {
  private readonly client = inject(CLIENT_ERROR_CLIENT)
  private readonly userService = inject(UserProfileService)
  private readonly pendingReports = new Map<string, PendingReport>()
  readonly consoleLoggingEnabled = signal(true)

  setConsoleLoggingEnabled(enabled: boolean): void {
    this.consoleLoggingEnabled.set(enabled)
  }

  report(error: unknown): void {
    const details = getErrorDetails(error)

    if (this.consoleLoggingEnabled()) {
      console.error('[Application error]', error)
    }

    if (!this.userService.user()?.getId())
      return

    void this.queueReport(details).catch((hashError: unknown) => {
      console.warn('Unable to hash application error for reporting.', hashError)
    })
  }

  private async queueReport(details: ClientErrorDetails): Promise<void> {
    const fingerprint = await hashMessage(details.message)
    const now = new Date().toISOString()
    const pending = this.pendingReports.get(fingerprint)

    if (pending) {
      pending.count += 1
      pending.lastOccurredAt = now
      return
    }

    const report: PendingReport = {
      details,
      url: typeof window === 'undefined' ? undefined : window.location.pathname,
      count: 1,
      occurredAt: now,
      lastOccurredAt: now
    }
    this.pendingReports.set(fingerprint, report)
    setTimeout(() => {
      this.pendingReports.delete(fingerprint)
      void this.sendReport(fingerprint, report)
    }, DEDUPLICATION_WINDOW_MS)
  }

  private async sendReport(fingerprint: string, report: PendingReport): Promise<void> {
    try {
      const { errors } = await this.client.mutations.reportClientError({
        fingerprint,
        message: report.details.message,
        stack: report.details.stack,
        url: report.url,
        count: report.count,
        occurredAt: report.occurredAt,
        lastOccurredAt: report.lastOccurredAt
      })

      if (errors?.length) {
        console.warn('Unable to report application error to CloudWatch.', errors)
      }
    } catch (reportingError: unknown) {
      console.warn('Unable to report application error to CloudWatch.', reportingError)
    }
  }
}
