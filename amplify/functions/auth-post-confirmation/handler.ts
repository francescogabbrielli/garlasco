import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { env } from 'process';
import { sendEmail } from '../../utils/mailer';

export const handler: PostConfirmationTriggerHandler = async (event) => {
   
    try {
        
        await sendEmail(
            event.request.userAttributes.email, 
            undefined, 
            env.WELCOME_SUBJECT!, 
            'Salve ' + event.request.userAttributes.given_name + '.\n\n' + env.WELCOME_MESSAGE)

        console.log(`Richiesta di invio email inoltrata per: ${event.request.userAttributes.email}`)

    } catch (error) {
        console.error("Errore nell'invocazione della lambda sendMail:", error)
    }

    return event
};