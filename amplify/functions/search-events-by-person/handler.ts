import { env } from 'process';
import { Amplify } from 'aws-amplify';
import { generateClient, type Client } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

import { EVENT_TYPES } from '../../data/enums';
import type { Schema } from '../../data/resource';

type DataClient = Client<Schema>;
type EventType = typeof EVENT_TYPES[number];
type Coordinates = Schema['Coordinates']['type'];

interface DataClientEnv {
  [key: string]: unknown;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_SESSION_TOKEN: string;
  AWS_REGION: string;
  AMPLIFY_DATA_DEFAULT_NAME: string;
}

interface SearchEventsByPersonInput {
  personId: unknown;
  eventStartDate?: unknown;
  limit?: unknown;
  nextToken?: unknown;
}

interface SearchEventsByPersonEvent {
  arguments: SearchEventsByPersonInput;
}

interface EventPersonIndexItem {
  eventId?: string | null;
  role?: string | null;
  event?: {
    id?: string | null;
    owner?: string | null;
    type?: EventType | null;
    name?: string | null;
    description?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    startPosition?: Coordinates | null;
    endPosition?: Coordinates | null;
    sources?: (string | null)[] | null;
  } | null;
}

interface EventPersonIndexModel {
  listEventPersonByPersonIdAndEventStartDate(
    key: { personId: string },
    options: {
      eventStartDate?: { between: [string, string] };
      limit: number;
      nextToken?: string;
      selectionSet: readonly string[];
    }
  ): Promise<{
    data?: EventPersonIndexItem[] | null;
    errors?: { message: string }[];
    nextToken?: string | null;
  }>;
}

function isEventPersonIndexModel(value: unknown): value is EventPersonIndexModel {
  return isRecord(value) &&
    typeof value['listEventPersonByPersonIdAndEventStartDate'] === 'function';
}

interface PersonEventSearchItem {
  eventId: string;
  role: string;
  owner?: string | null;
  type?: EventType | null;
  name?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  startPosition?: Coordinates | null;
  endPosition?: Coordinates | null;
  sources?: (string | null)[] | null;
}

interface PersonEventSearchResponse {
  events: PersonEventSearchItem[];
  nextToken?: string | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SELECTION_SET = [
  'eventId',
  'role',
  'event.id',
  'event.owner',
  'event.type',
  'event.name',
  'event.description',
  'event.startDate',
  'event.endDate',
  'event.startPosition.*',
  'event.endPosition.*',
  'event.sources'
] as const;

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

function normalizeDate(value: unknown, field: string): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${field}: expected an ISO date-time.`);
  }
  return new Date(value).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeInput(input: SearchEventsByPersonInput) {
  if (typeof input.personId !== 'string' || input.personId.trim().length === 0) {
    throw new Error('Invalid personId: expected a non-empty ID.');
  }

  let eventStartDate: { from: string; to: string } | undefined;
  if (input.eventStartDate != null) {
    if (!isRecord(input.eventStartDate)) {
      throw new Error('Invalid eventStartDate: expected an object with from and to dates.');
    }
    const from = normalizeDate(input.eventStartDate['from'], 'eventStartDate.from');
    const to = normalizeDate(input.eventStartDate['to'], 'eventStartDate.to');
    if (!from || !to) {
      throw new Error('eventStartDate.from and eventStartDate.to are required together.');
    }
    if (from > to) {
      throw new Error('Invalid eventStartDate range: from must not be later than to.');
    }
    eventStartDate = { from, to };
  }

  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`Invalid limit: expected an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }

  const nextToken = input.nextToken;
  if (nextToken != null && (typeof nextToken !== 'string' || nextToken.length > 5000)) {
    throw new Error('Invalid nextToken.');
  }

  return {
    personId: input.personId.trim(),
    eventStartDate,
    limit,
    nextToken: typeof nextToken === 'string' ? nextToken : undefined
  };
}

export async function searchEventsByPerson(
  event: SearchEventsByPersonEvent,
  client: DataClient
): Promise<PersonEventSearchResponse> {
  const input = normalizeInput(event.arguments);
  const eventPersonModel: unknown = client.models.EventPerson;
  if (!isEventPersonIndexModel(eventPersonModel)) {
    throw new Error('The EventPerson person/date index query is unavailable.');
  }
  const result = await eventPersonModel.listEventPersonByPersonIdAndEventStartDate(
    { personId: input.personId },
    {
      ...(input.eventStartDate
        ? { eventStartDate: { between: [input.eventStartDate.from, input.eventStartDate.to] as [string, string] } }
        : {}),
      limit: input.limit,
      nextToken: input.nextToken,
      selectionSet: SELECTION_SET
    }
  );

  if (result.errors?.length) {
    throw new Error(`Unable to search events by person: ${result.errors.map(error => error.message).join(', ')}`);
  }

  const events = (result.data ?? []).map(item => {
    if (!item.eventId || !item.role) {
      throw new Error('The indexed event-person query returned a record without eventId or role.');
    }
    const relatedEvent: EventPersonIndexItem['event'] = item.event;
    return {
      eventId: item.eventId,
      role: item.role,
      owner: relatedEvent?.owner,
      type: relatedEvent?.type,
      name: relatedEvent?.name,
      description: relatedEvent?.description,
      startDate: relatedEvent?.startDate,
      endDate: relatedEvent?.endDate,
      startPosition: relatedEvent?.startPosition,
      endPosition: relatedEvent?.endPosition,
      sources: relatedEvent?.sources
    };
  });

  return {
    events,
    nextToken: result.nextToken
  };
}

export const handler = async (event: SearchEventsByPersonEvent) => {
  const client = await getDataClient();
  return searchEventsByPerson(event, client);
};
