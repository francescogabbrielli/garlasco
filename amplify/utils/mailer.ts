import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from 'process';

const s3Client = new S3Client();

const sesClient = new SESClient({ region: env.AWS_REGION })

const EMAIL_PATTERN = /^(.*?)\s*<([^<>]+)>$/

async function streamToString(stream: any): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on("data", (chunk: any) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
}

export interface AdminData {
    operation: string
    message?: string
}

export async function loadEmailBody(template: string, emailField: string, title: string, website: string) {

    const s3command = new GetObjectCommand({
        Bucket: env.TEMPLATES_BUCKET_NAME,
        Key: `mail/${template}.html`
    });

    const matchEmail = emailField.match(EMAIL_PATTERN)
    const s3response = await s3Client.send(s3command)
    const body = await streamToString(s3response.Body)
    return body
        .replace('${given_name}', matchEmail ? matchEmail[1].trim() : emailField)
        .replace('${email}', matchEmail ? matchEmail[2].trim() : emailField)
        .replaceAll('${siteTitle}', title)
        .replaceAll('${website}', website)
}

function isSameEmail(email1: string, email2: string) {
    const match1 = email1.trim().match(EMAIL_PATTERN)
    const match2 = email2.trim().match(EMAIL_PATTERN)
    if (match1) email1 = match1[2]
    if (match2) email2 = match2[2]
    return email1.trim().toLowerCase() === email2.trim().toLowerCase()
}

export async function sendEmail(to: string | undefined, replyTo: string | undefined, subject: string, body: string, adminData: AdminData) {
    const pkg = await import("../package.json")
    const adminEmail = `${pkg.displayName} <${pkg.author.email}>`

    if (!to || isSameEmail(to, adminEmail)) {
        if (!replyTo)
            throw new Error("Reply-to address is required when sending to the admin email!");
        return sendEmailInternal(adminEmail, replyTo, subject, body)
            .then(() => loadEmailBody('request', replyTo, pkg.displayName, pkg.website))
            .then((requestBody) => sendEmailInternal(replyTo, undefined, "La tua richiesta è stata ricevuta: " + subject, requestBody))
    }

    const adminMessage = adminData.message || `L'utente ${to} ha effettuato l'operazione '${adminData.operation}'`

    return sendEmailInternal(to, replyTo, subject, body)
        .then(() => sendEmailInternal(adminEmail, undefined, adminData.operation, adminMessage))
        .catch(async (e) => {
            console.error(`Errore nell'invio dell'email a '${to}' per l'operazione '${adminData.operation}':`, e)
            return sendEmailInternal(adminEmail, undefined, adminData.operation + ' (errore invio mail)', adminMessage)
                .catch(e => {throw e})
        })

}

async function sendEmailInternal(to: string, replyTo: string | undefined, subject: string, body: string) {

    const pkg = await import("../package.json")
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