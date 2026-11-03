import { DynamoDBClient, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({})

export const handler = async () => {

    const tableName = process.env.EVENT_TABLE_NAME!

    try {
        const command = new DescribeTableCommand({ TableName: tableName });
        const response = await dynamoClient.send(command);

        // Ritorna l'ItemCount memorizzato nei metadati (aggiornato ogni ~6 ore)
        return response.Table?.ItemCount || 0;
    } catch (error) {
        console.error("Errore nel recupero dei metadati di DynamoDB:", error);
        throw new Error("Impossibile recuperare il conteggio della tabella");
    }

}
