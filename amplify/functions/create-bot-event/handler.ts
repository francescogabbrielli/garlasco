import { env } from 'process';
import { Amplify } from 'aws-amplify';
import { generateClient, type Client } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import geohash from 'ngeohash';

import { EVENT_TYPES } from '../../data/enums';
import type { Schema } from '../../data/resource';

type DataClient = Client<Schema>;
type Coordinates = Schema['Coordinates']['type'];

interface DataClientEnv {
  [key: string]: unknown;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SESSION_TOKEN: string;
  AWS_REGION: string;
  AMPLIFY_DATA_DEFAULT_NAME: string;
}

interface BotEventActor {
  personId?: string;
  role: string;
}

interface ResolvedBotEventActor {
  personId: string;
  role: string;
}

interface CreateBotEventInput {
  type: unknown;
  name: unknown;
  description: unknown;
  startDate: unknown;
  endDate?: unknown;
  startPosition?: unknown;
  endPosition?: unknown;
  sources: unknown;
  actors?: unknown;
}

interface BotEventResolverEvent {
  arguments: CreateBotEventInput;
  info: { fieldName: string };
}

const BOT_OWNER_BY_FIELD: Record<string, string> = {
  createEventByAnalyst: 'analyst'
};

const MAX_ACTORS = 25;
const MAX_SOURCES = 30;

let dataClientPromise: Promise<DataClient> | undefined;

function getDataClientEnvironment(): DataClientEnv {
  const required = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Missing Lambda environment variable: ${key}`);
    return value;
  };
  return {
    AWS_ACCESS_KEY_ID: required('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: required('AWS_SECRET_ACCESS_KEY'),
    AWS_SESSION_TOKEN: required('AWS_SESSION_TOKEN'),
    AWS_REGION: required('AWS_REGION'),
    AMPLIFY_DATA_DEFAULT_NAME: required('AMPLIFY_DATA_DEFAULT_NAME')
  };
}

function getDataClient(): Promise<DataClient> {
  dataClientPromise ??= getAmplifyDataClientConfig(getDataClientEnvironment()).then(({ resourceConfig, libraryOptions }) => {
    Amplify.configure(resourceConfig, libraryOptions);
    return generateClient<Schema>();
  });
  return dataClientPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${field}: expected non-empty text up to ${maxLength} characters.`);
  }
  return value.trim();
}

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${field}: expected an ISO date-time.`);
  }
  return new Date(value).toISOString();
}

function normalizeOptionalDate(value: unknown, field: string): string | undefined {
  return value == null ? undefined : normalizeDate(value, field);
}

function normalizeCoordinates(value: unknown, field: string): Coordinates | undefined {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error(`Invalid ${field}.`);

  const { latitude, longitude, radius } = value;
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
    typeof radius !== 'number' || !Number.isFinite(radius) || radius < 0
  ) {
    throw new Error(`Invalid ${field}: latitude, longitude, and non-negative radius are required.`);
  }

  return { latitude, longitude, radius };
}

function normalizeActors(value: unknown): BotEventActor[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_ACTORS) {
    throw new Error(`Invalid actors: expected at most ${MAX_ACTORS} entries.`);
  }

  return value.map((actor, index) => {
    if (!isRecord(actor)) throw new Error(`Invalid actor at position ${index + 1}.`);
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
    throw new Error(`Invalid sources: expected at most ${MAX_SOURCES} URLs.`);
  }

  return value.map((source, index) => {
    if (typeof source !== 'string' || source.length > 2000) {
      throw new Error(`Invalid source at position ${index + 1}.`);
    }
    return source.trim();
  });
}

function isEventType(value: unknown): value is typeof EVENT_TYPES[number] {
  return typeof value === 'string' && EVENT_TYPES.some(type => type === value);
}

function validateInput(input: CreateBotEventInput) {
  if (!isEventType(input.type)) {
    throw new Error(`Invalid event type. Expected one of: ${EVENT_TYPES.join(', ')}.`);
  }

  const startPosition = normalizeCoordinates(input.startPosition, 'startPosition');
  const endPosition = normalizeCoordinates(input.endPosition, 'endPosition');
  if (input.type === 'Fatto' && !startPosition) {
    throw new Error('A startPosition is required for type Fatto. Research the event location before retrying.');
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
  };
}

async function resolveActorIds(
  client: DataClient,
  actors: BotEventActor[],
  fallbackPersonId: string
): Promise<ResolvedBotEventActor[]> {
  if (!fallbackPersonId) throw new Error('BOT_FALLBACK_PERSON_ID is not configured.');

  const resolved: ResolvedBotEventActor[] = [];
  let fallbackExists: boolean | undefined;

  for (const actor of actors) {
    let personId = actor.personId;
    if (personId) {
      const { data, errors } = await client.models.Person.get({ id: personId });
      if (errors?.length) {
        throw new Error(`Unable to verify person ${personId}: ${errors.map(error => error.message).join(', ')}`);
      }
      if (!data) personId = undefined;
    }

    if (!personId) {
      if (fallbackExists === undefined) {
        const { data, errors } = await client.models.Person.get({ id: fallbackPersonId });
        if (errors?.length) {
          throw new Error(`Unable to verify fallback person: ${errors.map(error => error.message).join(', ')}`);
        }
        fallbackExists = Boolean(data);
      }
      if (!fallbackExists) {
        throw new Error(`Fallback person ${fallbackPersonId} was not found. Create the A A person before retrying.`);
      }
      personId = fallbackPersonId;
    }

    resolved.push({ personId, role: actor.role });
  }

  return resolved;
}

function getGeoHash(start?: Coordinates, end?: Coordinates): string | undefined {
  if (!start) return undefined;

  const latitude = end ? (start.latitude + end.latitude) / 2 : start.latitude;
  const longitude = end ? (start.longitude + end.longitude) / 2 : start.longitude;
  const radius = end
    ? haversineDistance(start.latitude, start.longitude, end.latitude, end.longitude) +
      (start.radius + end.radius) / 2
    : start.radius;
  const precision = radius < 250 ? 6
    : radius < 500 ? 5
    : radius < 1000 ? 4
    : radius < 2500 ? 3
    : radius < 10000 ? 2
    : radius < 50000 ? 1
    : 0;

  return precision ? geohash.encode(latitude, longitude, precision) : undefined;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createBotEvent(
  event: BotEventResolverEvent,
  client: DataClient,
  fallbackPersonId: string
): Promise<{ id: string; owner: string; name: string; linkedPeople: number }> {
  const owner = BOT_OWNER_BY_FIELD[event.info.fieldName];
  if (!owner) throw new Error('Event creation is not enabled for this bot.');

  const normalized = validateInput(event.arguments);
  const actors = await resolveActorIds(client, normalized.actors, fallbackPersonId);

  const geoHash = getGeoHash(normalized.startPosition, normalized.endPosition);
  const { data: createdEvent, errors: createErrors } = await client.models.Event.create({
    owner,
    type: normalized.type,
    name: normalized.name,
    description: normalized.description,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    startPosition: normalized.startPosition,
    endPosition: normalized.endPosition,
    geoHash,
    sources: normalized.sources
  });

  if (createErrors?.length || !createdEvent?.id) {
    throw new Error(`Unable to create event: ${createErrors?.map(error => error.message).join(', ') || 'no event returned'}`);
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
    });
    if (errors?.length) {
      throw new Error(
        `Event ${createdEvent.id} was created, but linking person ${actor.personId} failed ` +
        `after ${createdLinks} link(s): ${errors.map(error => error.message).join(', ')}`
      );
    }
    createdLinks++;
  }

  return {
    id: createdEvent.id,
    owner,
    name: createdEvent.name,
    linkedPeople: createdLinks
  };
}

export const handler = async (event: BotEventResolverEvent) => {
  const client = await getDataClient();
  return createBotEvent(event, client, env.BOT_FALLBACK_PERSON_ID ?? '');
};
