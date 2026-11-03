import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { sendEmail, loadEmailBody } from '../../utils/mailer';

export const handler: PostConfirmationTriggerHandler = async (event) => {
 
    const pkg = await import("../../package.json")

    try {
        
        const email = `${event.request.userAttributes.given_name} ${event.request.userAttributes.family_name} <${event.request.userAttributes.email}>`

        await sendEmail(
            email,
            undefined,
            "Benvenuti!",
            await loadEmailBody('registration', email, pkg.displayName, pkg.website),
            {
                operation: 'Richiesta nuova registrazione',
                message: event.request.userAttributes.given_name + " " + event.request.userAttributes.family_name + ' (' + event.request.userAttributes.email + ') ha effettuato la registrazione.'
            }
        )

    } catch (error) {

        console.error("Errore nell'invocazione della lambda sendMail nel trigger auth-post-confirmation:", error)

    }

    return event
}