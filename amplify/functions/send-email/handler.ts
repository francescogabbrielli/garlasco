import type { Handler } from 'aws-lambda';
import { sendEmail } from '../../utils/mailer';

export const handler: Handler = async (event) => {
  await sendEmail(event.arguments.to, event.arguments.replyTo, event.arguments.subject, event.arguments.message, {
    mail: process.env.MAIL_ADMIN!,
    operation: event.arguments.operation || 'Operazione non specificata',
    message: event.arguments.message
  })
  return { success: true, message: (event.arguments.operation || 'Email') + ' inviata con successo a ' + event.arguments.to + ': ' + event.arguments.subject }
}