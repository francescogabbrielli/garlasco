import type { Handler } from 'aws-lambda';
import { sendEmail } from '../../utils/mailer';

export const handler: Handler = async (event) => {
  await sendEmail(event.arguments.to, event.arguments.replyTo, event.arguments.subject, event.arguments.message)
  return { success: true, message: 'Email inviata con successo!' }
}