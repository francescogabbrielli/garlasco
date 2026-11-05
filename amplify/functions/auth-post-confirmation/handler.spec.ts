import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendEmail, loadEmailBody } = vi.hoisted(() => ({ sendEmail: vi.fn(), loadEmailBody: vi.fn() }));

vi.mock('../../utils/mailer', () => ({ sendEmail, loadEmailBody }));

import { handler } from './handler';

const event = {
  request: { userAttributes: { given_name: 'Mario', family_name: 'Rossi', email: 'mario@example.com' } }
};

const call = (e: unknown) => (handler as any)(e, {}, () => {});

describe('auth-post-confirmation handler', () => {
  beforeEach(() => {
    sendEmail.mockReset();
    loadEmailBody.mockReset();
    loadEmailBody.mockResolvedValue('<p>welcome</p>');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends the welcome email and returns the event', async () => {
    sendEmail.mockResolvedValue(undefined);

    const result = await call(event);

    expect(result).toBe(event);
    const [to, replyTo, subject, body, admin] = sendEmail.mock.calls[0];
    expect(to).toBe('Mario Rossi <mario@example.com>');
    expect(replyTo).toBeUndefined();
    expect(subject).toBe('Benvenuti!');
    expect(body).toBe('<p>welcome</p>');
    expect(admin.operation).toBe('Richiesta nuova registrazione');
    expect(admin.message).toContain('mario@example.com');
    expect(loadEmailBody.mock.calls[0][0]).toBe('registration');
  });

  it('does not fail the sign-up when mailing fails', async () => {
    sendEmail.mockRejectedValue(new Error('ses down'));

    await expect(call(event)).resolves.toBe(event);
  });
});
