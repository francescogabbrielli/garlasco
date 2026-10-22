import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { EVENT_TYPES } from '../../data/enums';

const MODEL_ID = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});

const SYSTEM_PROMPT =
  'Sei un detective scrupoloso che genera eventi relativi al \'delitto di Garlasco\'. ' +
  'Basati sui risultati della ricerca web forniti e sulla descrizione dell\'utente. ' +
  'Non inventare fatti: quando un dettaglio è sconosciuto, fai la scelta meglio supportata dalle fonti. ' +
  'La start_date (e end_date) devono essere stringhe ISO 8601, timezone CET. Il type deve essere ESATTAMENTE (rispettando le maiuscole) uno dei seguenti tipi di evento: ' + EVENT_TYPES.join(', ') + '. ' +
  'In start_postition e end_position, latitude e longitude devono essere espresse in gradi decimali con sei cifre decimali; rappresentano o la location precisa o il centro approssimativo della località citata (normalmente Garlasco); ' +
  'radius è 0 se si tratta di una location precisa, altrimenti il raggio approssimativo in metri della località citata. ' +
  'Se si tratta di una testimonianza (type "Testimonianza") o deposizione (type deve essere "Indagine") indica la data e il luogo della testimonianza e non dell\'evento testimoniato.';

const coordinates = {
  type: 'object',
  properties: {
    latitude: { type: 'number' },
    longitude: { type: 'number' },
    radius: { type: 'number', description: 'meters' },
  },
  required: ['latitude', 'longitude', 'radius'],
};

const EVENT_TOOL = {
  name: 'save_event',
  description: 'Return the generated event',
  inputSchema: {
    json: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...EVENT_TYPES] },
        name: { type: 'string' },
        description: { type: 'string' },
        start_date: { type: 'string', description: 'ISO 8601 date-time' },
        start_position: coordinates
      },
      required: ['type', 'name', 'description', 'start_date', 'start_position'],
    },
  },
};

interface TavilyResult { title: string; url: string; content: string }

async function search(query: string): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env['TAVILY_API_KEY']}`,
    },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 6 }),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const body = await res.json() as { results?: TavilyResult[] };
  return body.results ?? [];
}

export const handler = async (event: { arguments: { description: string } }) => {
  const description = event.arguments.description;
  const results = await search(`Garlasco ${description}`);
  const sources = results
    .map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`)
    .join('\n\n');

  const out = await bedrock.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{
      role: 'user',
      content: [{ text: `Description: ${description}\n\nWeb search results:\n${sources || '(none)'}` }],
    }],
    toolConfig: {
      tools: [{ toolSpec: EVENT_TOOL as never }],
      toolChoice: { tool: { name: EVENT_TOOL.name } },
    },
  }));

  const block = out.output?.message?.content?.find((c) => c.toolUse);
  if (!block?.toolUse?.input) throw new Error('The model returned no event');
  return block.toolUse.input;
};
