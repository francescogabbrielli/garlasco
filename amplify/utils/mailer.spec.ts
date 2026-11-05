import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { s3Send, sesSend } = vi.hoisted(() => ({ s3Send: vi.fn(), sesSend: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3Send;
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    send = sesSend;
  },
  SendEmailCommand: class {
    constructor(public input: any) {}
  },
}));

import pkg from '../package.json';
import { loadEmailBody, sendEmail } from './mailer';

const admin = `${pkg.displayName} <${pkg.author.email}>`;
const adminData = { operation: 'Registrazione' };

const sent = () => sesSend.mock.calls.map(([cmd]) => cmd.input);

describe('mailer', () => {
  beforeEach(() => {
    s3Send.mockReset();
    sesSend.mockReset();
    sesSend.mockResolvedValue({});
    process.env['TEMPLATES_BUCKET_NAME'] = 'bucket';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('loadEmailBody', () => {
    it('loads the template and replaces placeholders', async () => {
      s3Send.mockResolvedValue({
        Body: Readable.from([Buffer.from('${given_name} <${email}> @ ${siteTitle} ${siteTitle} ${website}')])
      });

      const body = await loadEmailBody('registration', 'Mario Rossi <mario@example.com>', 'Site', 'https://site');

      expect(body).toBe('Mario Rossi <mario@example.com> @ Site Site https://site');
      expect(s3Send.mock.calls[0][0].input).toEqual({ Bucket: 'bucket', Key: 'mail/registration.html' });
    });

    it('uses the raw value when the email has no display name', async () => {
      s3Send.mockResolvedValue({ Body: Readable.from([Buffer.from('${given_name}|${email}')]) });

      expect(await loadEmailBody('t', 'a@b.c', 'S', 'W')).toBe('a@b.c|a@b.c');
    });
  });

  describe('sendEmail', () => {
    it('sends to the user then notifies the admin', async () => {
      await sendEmail('user@example.com', undefined, 'Subj', 'plain', adminData);

      const [first, second] = sent();
      expect(first.Destination.ToAddresses).toEqual(['user@example.com']);
      expect(first.Source).toContain('@mail.');
      expect(first.Message.Body.Text.Data).toBe('plain');
      expect(first.Message.Body.Html).toBeUndefined();
      expect(second.Destination.ToAddresses).toEqual([admin]);
      expect(second.Message.Subject.Data).toBe('Registrazione');
      expect(second.Message.Body.Text.Data).toContain('user@example.com');
    });

    it('sends HTML bodies with a stripped text alternative', async () => {
      await sendEmail('user@example.com', undefined, 'Subj', '<p>Hi <b>there</b></p>', adminData);

      const body = sent()[0].Message.Body;
      expect(body.Html.Data).toBe('<p>Hi <b>there</b></p>');
      expect(body.Text.Data).toBe('Hi there');
    });

    it('sets the reply-to address when provided', async () => {
      await sendEmail('user@example.com', 'reply@example.com', 'S', 'b', adminData);

      expect(sent()[0].ReplyToAddresses).toEqual(['reply@example.com']);
    });

    it('requires reply-to when the recipient is missing', async () => {
      await expect(sendEmail(undefined, undefined, 'S', 'b', adminData)).rejects.toThrow('Reply-to address is required');
    });

    it('requires reply-to when the recipient is the admin (case-insensitive)', async () => {
      await expect(
        sendEmail(`x <${pkg.author.email.toUpperCase()}>`, undefined, 'S', 'b', adminData)
      ).rejects.toThrow('Reply-to address is required');
    });

    it('forwards requests to the admin and confirms to the sender', async () => {
      s3Send.mockResolvedValue({ Body: Readable.from([Buffer.from('<p>received</p>')]) });

      await sendEmail(undefined, 'sender@example.com', 'Question', 'msg', adminData);

      const [toAdmin, confirmation] = sent();
      expect(toAdmin.Destination.ToAddresses).toEqual([admin]);
      expect(toAdmin.ReplyToAddresses).toEqual(['sender@example.com']);
      expect(confirmation.Destination.ToAddresses).toEqual(['sender@example.com']);
      expect(confirmation.Message.Subject.Data).toBe('La tua richiesta è stata ricevuta: Question');
    });

    it('notifies the admin when the user email fails', async () => {
      sesSend.mockRejectedValueOnce(new Error('rejected'));

      await sendEmail('user@example.com', undefined, 'S', 'b', adminData);

      const [, notice] = sent();
      expect(notice.Destination.ToAddresses).toEqual([admin]);
      expect(notice.Message.Subject.Data).toBe('Registrazione (errore invio mail)');
    });
  });
});
