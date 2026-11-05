import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('../../utils/mailer', () => ({ sendEmail }));

import { handler } from './handler';

const call = (event: unknown) => (handler as any)(event, {}, () => {});

describe('send-email handler', () => {
  beforeEach(() => {
    sendEmail.mockReset();
  });

  it('forwards arguments to sendEmail and reports success', async () => {
    sendEmail.mockResolvedValue(undefined);

    const result = await call({
      arguments: { to: 'a@b.c', replyTo: 'r@b.c', subject: 'Hi', message: 'Body', operation: 'Contatto' }
    });

    expect(sendEmail).toHaveBeenCalledWith('a@b.c', 'r@b.c', 'Hi', 'Body', { operation: 'Contatto', message: 'Body' });
    expect(result).toEqual({ success: true, message: 'Contatto inviata con successo: Hi' });
  });

  it('uses default operation and message labels', async () => {
    sendEmail.mockResolvedValue(undefined);

    const result = await call({ arguments: { subject: 'Hi', message: 'Body' } });

    expect(sendEmail.mock.calls[0][4].operation).toBe('Operazione non specificata');
    expect(result.message).toBe('Mail inviata con successo: Hi');
  });

  it('propagates sendEmail errors', async () => {
    sendEmail.mockRejectedValue(new Error('ses down'));

    let error: Error | undefined;
    try {
      await call({ arguments: { subject: 's', message: 'm' } });
    } catch (e) {
      error = e as Error;
    }

    expect(error?.message).toBe('ses down');
  });
});
