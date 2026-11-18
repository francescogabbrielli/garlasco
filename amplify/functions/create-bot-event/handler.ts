import { env } from 'process';
import { Amplify } from 'aws-amplify';
import { generateClient, type Client } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

import { EVENT_TYPES } from '../../data/enums';
import type { Schema } from '../../data/resource';
import { computeCenterPosition, computeGeoHash } from '../../utils/geo';

type DataClient = Client<Schema>
type Coordinates = Schema['Coordinates']['type']
type EventType = Schema['Event']['type']['type']

interface DataClientEnv {
  [key: string]: unknown
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  AWS_SESSION_TOKEN: string
  AWS_REGION: string
  AMPLIFY_DATA_DEFAULT_NAME: string
}

interface BotEventActor {
  personId?: string
  role: string
}

interface ResolvedBotEventActor {
  personId: string
  role: string
}

interface CreateBotEventInput {
  botDefinition: string
  type: EventType
  name: string
  description: string
  startDate: string
  endDate?: string
  startPosition?: Coordinates
  endPosition?: Coordinates
  actors: BotEventActor[]
  sources?: string[]
}

const MAX_ACTORS = 5
const MAX_SOURCES = 5

let dataClientPromise: Promise<DataClient> | undefined

function getDataClientEnvironment(): DataClientEnv {
  const required = (key: string): string => {
    const value = env[key]
    if (!value) throw new Error(`Manca la viariabile di ambiente: ${key}`)
    return value
  }
  return {
    AWS_ACCESS_KEY_ID: required('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: required('AWS_SECRET_ACCESS_KEY'),
    AWS_SESSION_TOKEN: required('AWS_SESSION_TOKEN'),
    AWS_REGION: required('AWS_REGION'),
    AMPLIFY_DATA_DEFAULT_NAME: required('AMPLIFY_DATA_DEFAULT_NAME')
  }
}

function getDataClient(): Promise<DataClient> {
  dataClientPromise ??= getAmplifyDataClientConfig(getDataClientEnvironment()).then(({ resourceConfig, libraryOptions }) => {
    Amplify.configure(resourceConfig, libraryOptions)
    return generateClient<Schema>()
  });
  return dataClientPromise
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Campo '${field}' non valido: atteso testo non vuoto di al massimo ${maxLength} caratteri.`)
  }
  return value.trim()
}

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Data non valida '${field}': attesa in formato ISO date-time.`)
  }
  return new Date(value).toISOString()
}

function normalizeOptionalDate(value: unknown, field: string): string | undefined {
  return value == null ? undefined : normalizeDate(value, field)
}

function normalizeCoordinates(value: unknown, field: string): Coordinates | undefined {
  if (value == null) return undefined
  if (!isRecord(value)) throw new Error(`Invalid ${field}.`)

  const { latitude, longitude, radius } = value;
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0
  ) {
    throw new Error(`Campo '${field}' non valido: latitude, longitudine, e raggio non-negativo sono richiesti.`);
  }

  return { latitude, longitude, radius };
}

function normalizeActors(value: unknown): BotEventActor[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ACTORS) {
    throw new Error(`Attori non validi: attesi al massimo ${MAX_ACTORS}.`);
  }

  return value.map((actor, index) => {
    if (!isRecord(actor)) throw new Error(`Attore n. ${index + 1} non valido`);
    const personId = actor['personId'];
    const role = requireText(actor['role'], `actors[${index}].role`, 200);
    if (personId !== undefined && (typeof personId !== 'string' || !personId.trim())) {
      throw new Error(`Invalid personId at position ${index + 1}.`);
    }
    return { ...(typeof personId === 'string' ? { personId: personId.trim() } : {}), role };
  });
}

function normalizeSources(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_SOURCES) {
    throw new Error(`Fonti non valide: al massimo sono permessi ${MAX_SOURCES} URLs.`)
  }

  return value.map((source, index) => {
    if (typeof source !== 'string' || source.length > 2000) {
      throw new Error(`Fonte n. ${index + 1} non valida.`)
    }
    return source.trim()
  });
}

function isEventType(value: unknown): value is typeof EVENT_TYPES[number] {
  return typeof value === 'string' && EVENT_TYPES.some(type => type === value)
}

function validateInput(input: CreateBotEventInput) {
  if (!isEventType(input.type)) {
    throw new Error(`Tipo di evento non valido. Atteso uno fra: ${EVENT_TYPES.join(', ')}.`)
  }

  const startPosition = normalizeCoordinates(input.startPosition, 'startPosition')
  const endPosition = normalizeCoordinates(input.endPosition, 'endPosition')
  if (input.type === 'Fatto' && !startPosition) {
    throw new Error('La posizione iniziale è richiesta per gli eventi di tipo \'Fatto\'. Ricerca la posizione dell\'evento prima di riprovare.')
  }

  return {
    type: input.type,
    name: requireText(input.name, 'name', 200),
    description: requireText(input.description, 'description', 10000),
    startDate: normalizeDate(input.startDate, 'startDate'),
    endDate: normalizeOptionalDate(input.endDate, 'endDate'),
    startPosition,
    endPosition,
    sources: normalizeSources(input.sources),
    actors: normalizeActors(input.actors)
  }
}

async function resolveActorIds(
  client: DataClient,
  actors: BotEventActor[],
  fallbackPersonId: string
): Promise<ResolvedBotEventActor[]> {
  
  if (!fallbackPersonId)
    throw new Error("BOT_FALLBACK_PERSON_ID non è configurata.")

  const resolved: ResolvedBotEventActor[] = [];
  let fallbackExists: boolean | undefined;

  for (const actor of actors) {
    let personId = actor.personId;
    if (personId) {
      const { data, errors } = await client.models.Person.get({ id: personId });
      if (errors?.length) {
        throw new Error(`Impossibile verificare la persona ${personId}: ${errors.map(error => error.message).join(', ')}`);
      }
      if (!data) personId = undefined;
    }

    if (!personId) {
      if (fallbackExists === undefined) {
        const { data, errors } = await client.models.Person.get({ id: fallbackPersonId });
        if (errors?.length) {
          throw new Error(`Impossibile verificare la persona di fallback: ${errors.map(error => error.message).join(', ')}`);
        }
        fallbackExists = Boolean(data);
      }
      if (!fallbackExists) {
        throw new Error(`La persona di fallback ${fallbackPersonId} non è stata trovata. Richiedere la creazione della persona nel DB prima di procedere.`);
      }
      personId = fallbackPersonId;
    }

    resolved.push({ personId, role: actor.role });
  }

  return resolved;
}

export async function createBotEvent(
  input: CreateBotEventInput,
  client: DataClient,
  fallbackPersonId: string
): Promise<{ id: string; owner: string; name: string; linkedPeople: number }> {

  const normalized = validateInput(input)
  const actors = await resolveActorIds(client, normalized.actors, fallbackPersonId)

  const geoHash = computeGeoHash(
    computeCenterPosition(normalized.startPosition, normalized.endPosition))
  
  const { data: createdEvent, errors: createErrors } = await client.models.Event.create({
    owner: input.botDefinition,
    type: normalized.type,
    name: normalized.name,
    description: normalized.description,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    startPosition: normalized.startPosition,
    endPosition: normalized.endPosition,
    geoHash,
    sources: normalized.sources
  })

  if (createErrors?.length || !createdEvent?.id) {
    throw new Error(`Impossibile creare l'evento: ${createErrors?.map(error => error.message).join(', ') || 'nessun evento restituito'}`)
  }

  let createdLinks = 0;
  for (const actor of actors) {
    const { errors } = await client.models.EventPerson.create({
      eventId: createdEvent.id,
      eventName: createdEvent.name,
      eventStartDate: createdEvent.startDate,
      eventGeoHash: createdEvent.geoHash,
      personId: actor.personId,
      role: actor.role
    })
    if (errors?.length) {
      throw new Error(
        `L'evento ${createdEvent.id} è stato creato, ma l'associazione della persona ${actor.personId} è fallita ` +
        `dopo ${createdLinks} link(s): ${errors.map(error => error.message).join(', ')}`
      )
    }
    createdLinks++
  }

  return {
    id: createdEvent.id,
    owner: createdEvent.owner,
    name: createdEvent.name,
    linkedPeople: createdLinks
  }
}

export const handler = async (event: { arguments: CreateBotEventInput}) => {
  try {
    const client = await getDataClient()
    return await createBotEvent(event.arguments, client, env.BOT_FALLBACK_PERSON_ID ?? '')
  } catch (error) {
    console.error('create-bot-event failed', error)
    throw error
  }
}
