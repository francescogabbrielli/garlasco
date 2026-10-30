import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { env } from "process";

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
    const email = `${pkg.displayName} <${pkg.author.email}>`
    const isHTML = body.startsWith('<')
    const command = new SendEmailCommand({
        Source: email.replace('@', '@mail.'),
        Destination: {
            ToAddresses: [to],
        },
        ReplyToAddresses: replyTo ? [replyTo] : [email],
        Message: {
            Subject: { 
                Charset: "UTF-8",
                Data: subject 
            },
            Body: {
                Html: isHTML ? { 
                    Charset: "UTF-8",
                    Data: body 
                } : undefined,
                Text: !isHTML ? { 
                    Charset: "UTF-8",
                    Data: body 
                } : {
                    Charset: "UTF-8",
                    //strip body of HTML tags for plain text version
                    Data: body.replace(/<[^>]*>/g, '')
                },
            },
        },
    })

    console.log(`Invio email`, command)

    return sesClient.send(command)

}