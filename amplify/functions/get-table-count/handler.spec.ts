import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class {
    send = send;
  },
  DescribeTableCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { handler } from './handler';

describe('get-table-count handler', () => {
  beforeEach(() => {
    send.mockReset();
    process.env['EVENT_TABLE_NAME'] = 'events';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the table item count', async () => {
    send.mockResolvedValue({ Table: { ItemCount: 42 } });

    expect(await handler()).toBe(42);
    expect(send.mock.calls[0][0].input).toEqual({ TableName: 'events' });
  });

  it('returns 0 when the count is missing', async () => {
    send.mockResolvedValue({});

    expect(await handler()).toBe(0);
  });

  it('throws a friendly error on failure', async () => {
    send.mockRejectedValue(new Error('boom'));

    await expect(handler()).rejects.toThrow('Impossibile recuperare il conteggio della tabella');
  });
});
