import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { env } from 'process';
import { sendEmail } from '../../utils/mailer';

export const handler: PostConfirmationTriggerHandler = async (event) => {
   
    try {
        
        await sendEmail(
            event.request.userAttributes.email, 
            undefined, 
            env.WELCOME_SUBJECT!,
            env.WELCOME_MESSAGE!
                .replace('${given_name}', event.request.userAttributes.given_name)
                .replace('${email}', event.request.userAttributes.email)
                .replaceAll('${title}', 'I fatti di Garlasco'),
            {
                mail: env.MAIL_ADMIN!,
                operation: 'Richiesta nuova registrazione',
                message: event.request.userAttributes.given_name + " " + event.request.userAttributes.family_name + ' (' + event.request.userAttributes.email + ') ha effettuato la registrazione.'
            }
        )

    } catch (error) {

        console.error("Errore nell'invocazione della lambda sendMail nel trigger auth-post-confirmation:", error)

    }

    return event
}