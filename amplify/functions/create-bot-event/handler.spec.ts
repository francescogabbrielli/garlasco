import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';

const { amplifyConfigure, generateClient, getAmplifyDataClientConfig } = vi.hoisted(() => ({
  amplifyConfigure: vi.fn(),
  generateClient: vi.fn(),
  getAmplifyDataClientConfig: vi.fn()
}));

vi.mock('aws-amplify', () => ({
  Amplify: { configure: amplifyConfigure }
}));
vi.mock('aws-amplify/data', () => ({ generateClient }));
vi.mock('@aws-amplify/backend/function/runtime', () => ({
  getAmplifyDataClientConfig
}));

import { createBotEvent, handler } from './handler';

const FALLBACK_PERSON_ID = '45f03321-c6f4-466b-8417-ba99fb785a86';
type CreateBotEventArgs = Parameters<typeof createBotEvent>[0];
//type CreateBotEventArgsInput = Parameters<typeof createBotEvent>[0]['input'];

function createClient() {
  const personGet = vi.fn();
  const eventCreate = vi.fn().mockResolvedValue({
    data: {
      id: 'event-1',
      owner: 'analyst',
      name: 'Evento',
      startDate: '2024-01-01T00:00:00.000Z',
      geoHash: 'u0nd'
    }
  });
  const eventPersonCreate = vi.fn().mockResolvedValue({ data: { id: 'link-1' } });

  const client = {
    models: {
      Person: { get: personGet },
      Event: { create: eventCreate },
      EventPerson: { create: eventPersonCreate }
    }
  } as unknown as Client<Schema>;

  return { client, personGet, eventCreate, eventPersonCreate };
}

function resolverEvent(args: CreateBotEventArgs) {
  return {
    arguments: args,
  };
}

function validInput(overrides: Partial<CreateBotEventArgs> = {}): CreateBotEventArgs {
  return {
    botDefinition: 'analyst',
    type: 'Fatto',
    name: 'Evento',
    description: 'Descrizione verificata',
    startDate: '2024-01-01T00:00:00.000Z',
    startPosition: { latitude: 45, longitude: 9, radius: 0 },
    sources: ['https://example.test/source'],
    actors: [{ personId: 'person-1', role: 'testimone' }],
    ...overrides
  };
}

describe('create-bot-event handler', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs and rethrows asynchronous handler failures', async () => {
    for (const key of [
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
      'AWS_REGION',
      'AMPLIFY_DATA_DEFAULT_NAME',
      'AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_BUCKET_NAME',
      'AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_KEY',
      'AMPLIFY_DATA_GRAPHQL_ENDPOINT'
    ]) {
      vi.stubEnv(key, 'test');
    }

    getAmplifyDataClientConfig.mockResolvedValue({
      resourceConfig: {},
      libraryOptions: {}
    });
    generateClient.mockReturnValue({});
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = resolverEvent(validInput({ startPosition: undefined }));

    await expect(handler(event)).rejects.toThrow('La posizione iniziale è richiesta');
    expect(getAmplifyDataClientConfig).toHaveBeenCalledWith(expect.objectContaining({
      AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_BUCKET_NAME: 'test',
      AMPLIFY_DATA_MODEL_INTROSPECTION_SCHEMA_KEY: 'test',
      AMPLIFY_DATA_GRAPHQL_ENDPOINT: 'test'
    }));
    expect(errorLog).toHaveBeenCalledWith(
      'create-bot-event failed',
      expect.objectContaining({ message: 'La posizione iniziale è richiesta per gli eventi di tipo \'Fatto\'. Ricerca la posizione dell\'evento prima di riprovare.' })
    );
  });

  it('creates an analyst-owned event and links existing people without admin fields', async () => {
    const { client, personGet, eventCreate, eventPersonCreate } = createClient();
    personGet.mockResolvedValue({ data: { id: 'person-1' } });

    const result = await createBotEvent(
      validInput(),
      client,
      FALLBACK_PERSON_ID
    );

    expect(result).toEqual({
      id: 'event-1',
      owner: 'analyst',
      name: 'Evento',
      linkedPeople: 1
    });
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'analyst',
      type: 'Fatto',
      name: 'Evento',
      geoHash: expect.any(String),
      sources: ['https://example.test/source']
    }));
    expect(eventCreate.mock.calls[0][0]).not.toHaveProperty('relevance');
    expect(eventCreate.mock.calls[0][0]).not.toHaveProperty('reliability');
    expect(eventCreate.mock.calls[0][0]).not.toHaveProperty('coldCase');
    expect(eventPersonCreate).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      personId: 'person-1',
      role: 'testimone'
    }));
  });

  it('uses the configured A A person when an actor is unknown', async () => {
    const { client, personGet, eventPersonCreate } = createClient();
    personGet
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { id: FALLBACK_PERSON_ID } });

    await createBotEvent(
      validInput({ actors: [{ personId: 'missing-person', role: 'testimone' }] }),
      client,
      `  ${FALLBACK_PERSON_ID} \n`
    );

    expect(personGet).toHaveBeenNthCalledWith(1, { id: 'missing-person' });
    expect(personGet).toHaveBeenNthCalledWith(2, { id: FALLBACK_PERSON_ID });
    expect(eventPersonCreate).toHaveBeenCalledWith(expect.objectContaining({
      personId: FALLBACK_PERSON_ID
    }));
  });

  it('rejects a Fatto without startPosition before writing anything', async () => {
    const { client, eventCreate, eventPersonCreate } = createClient();

    await expect(createBotEvent(
      validInput({ startPosition: undefined }),
      client,
      FALLBACK_PERSON_ID
    )).rejects.toThrow("La posizione iniziale è richiesta per gli eventi di tipo 'Fatto'. Ricerca la posizione dell'evento prima di riprovare.");

    expect(eventCreate).not.toHaveBeenCalled();
    expect(eventPersonCreate).not.toHaveBeenCalled();
  });

  it('rejects the import if the configured fallback person is missing', async () => {
    const { client, personGet, eventCreate } = createClient();
    personGet
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    await expect(createBotEvent(validInput({ actors: [{ role: 'testimone' }] }),
      client,
      FALLBACK_PERSON_ID
    )).rejects.toThrow(
      `La persona di fallback '${FALLBACK_PERSON_ID}' non è stata trovata. ` +
      `Richiedere la creazione della persona nel DB prima di procedere.`
    );

    expect(eventCreate).not.toHaveBeenCalled();
  });
});
