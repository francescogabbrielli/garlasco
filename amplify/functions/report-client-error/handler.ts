interface ClientErrorEvent {
  arguments?: {
    fingerprint?: unknown;
    message?: unknown;
    stack?: unknown;
    url?: unknown;
    count?: unknown;
    occurredAt?: unknown;
    lastOccurredAt?: unknown;
  };
  identity?: {
    sub?: unknown;
  };
}

function redactSensitiveValues(value: string): string {
  return value
    .replace(/\b(password|token|secret|authorization|email)\b(\s*[:=]\s*)([^\s,;]+)/gi, '$1$2[REDACTED]');
}

export const handler = async (
  event: ClientErrorEvent,
  context: { awsRequestId: string }
): Promise<boolean> => {
  const args = event.arguments;
  if (
    typeof args?.message !== 'string' ||
    args.message.trim().length === 0 ||
    args.message.length > 1000 ||
    typeof args.fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(args.fingerprint) ||
    typeof args.count !== 'number' ||
    !Number.isInteger(args.count) ||
    args.count < 1 ||
    args.count > 1_000_000
  ) {
    throw new Error('Invalid client error report');
  }

  if (args.stack !== undefined && typeof args.stack !== 'string') {
    throw new Error('Invalid client error report');
  }
  if (args.url !== undefined && typeof args.url !== 'string') {
    throw new Error('Invalid client error report');
  }
  if (
    typeof args.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(args.occurredAt)) ||
    typeof args.lastOccurredAt !== 'string' ||
    !Number.isFinite(Date.parse(args.lastOccurredAt))
  ) {
    throw new Error('Invalid client error report');
  }

  console.error('Client application error', JSON.stringify({
    requestId: context.awsRequestId,
    fingerprint: args.fingerprint,
    count: args.count,
    userSub: typeof event.identity?.sub === 'string' ? event.identity.sub : undefined,
    occurredAt: new Date(args.occurredAt).toISOString(),
    lastOccurredAt: new Date(args.lastOccurredAt).toISOString(),
    message: redactSensitiveValues(args.message).slice(0, 1000),
    stack: typeof args.stack === 'string'
      ? redactSensitiveValues(args.stack).slice(0, 4000)
      : undefined,
    url: typeof args.url === 'string' ? args.url.slice(0, 256) : undefined
  }));

  return true;
};
