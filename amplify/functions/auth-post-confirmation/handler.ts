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

        await sendEmail(
            env.MAIL_ADMIN!, 
            undefined, 
            'Richiesta nuova registrazione', 
            event.request.userAttributes.given_name + " " + event.request.userAttributes.family_name + ' (' + event.request.userAttributes.email + ') ha effettuato la registrazione.')

        console.log(`Richiesta di invio email inoltrata per: ${event.request.userAttributes.email}`)

    } catch (error) {

        console.error("Errore nell'invocazione della lambda sendMail:", error)

        try {
            await sendEmail(
                env.MAIL_ADMIN!, 
                undefined, 
                'Richiesta nuova registrazione (con errore)', 
                event.request.userAttributes.given_name + " " + event.request.userAttributes.family_name + ' (' + event.request.userAttributes.email + ') ha provato a effettuare la registrazione ma si è verificato un problema: ' + error)
        } catch (error2) {
            console.error("Errore nell'invio dell'email all'amministratore:", error2)
        }

    }

    return event
}