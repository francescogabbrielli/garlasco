import { SendEmailCommand } from "@aws-sdk/client-ses";
import { SESClient } from "@aws-sdk/client-ses";
import { env } from "process";

const sesClient = new SESClient({ region: env.AWS_REGION })

export async function sendEmail(to: string, replyTo: string | undefined, subject: string, body: string) {

    const command = new SendEmailCommand({
        Source: env.MAIL_SENDER!,
        Destination: {
            ToAddresses: [to],
        },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Message: {
            Subject: { Data: subject },
            Body: {
                Text: { Data: body },
            },
        },
    })

    console.log(`Invio email a ${to}: ${subject} - ${body}`)

    return await sesClient.send(command)
}