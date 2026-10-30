 import { SendEmailCommand } from "@aws-sdk/client-ses";
import { SESClient } from "@aws-sdk/client-ses";
import { env, send } from "process";

const sesClient = new SESClient({ region: env.AWS_REGION })

export interface AdminData {
    mail: string
    operation: string
    message?: string
}

export async function sendEmail(to: string, replyTo: string | undefined, subject: string, body: string, adminData: AdminData = { mail: env.MAIL_ADMIN!, operation: 'Operazione non specificata' }) {

    const adminMessage = adminData.message || `L'utente ${to} ha effettuato l'operazione '${adminData.operation}'`

    return sendEmailInternal(to, replyTo, subject, body)
        .then(() => sendEmailInternal(adminData.mail, undefined, adminData.operation, adminMessage))
        .catch(async (e) => {
            console.error(`Errore nell'invio dell'email per l'operazione ${adminData.operation}:`, e)
            return sendEmailInternal(adminData.mail, undefined, adminData.operation + ' (errore invio mail)', adminMessage)
                .catch(e => {throw e})
        })

}

async function sendEmailInternal(to: string, replyTo: string | undefined, subject: string, body: string) {

    const pkg = await import("../../package.json")
    const sender = `${pkg.displayName} <${pkg.author.email.replace('@', '@mail.')}>`

    const command = new SendEmailCommand({
        Source: sender,
        Destination: {
            ToAddresses: [to],
        },
        ReplyToAddresses: replyTo ? [replyTo] : [pkg.author.email],
        Message: {
            Subject: { Data: subject },
            Body: {
                Text: { Data: body },
            },
        },
    })

    console.log(`Invio email a ${to}: ${subject}`)

    return sesClient.send(command)

}