import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { createBotEvent } from './handler';

const FALLBACK_PERSON_ID = '45f03321-c6f4-466b-8417-ba99fb785a86';
type CreateBotEventArgs = Parameters<typeof createBotEvent>[0]['arguments'];
type CreateBotEventResolverEvent = Parameters<typeof createBotEvent>[0];

function createClient() {
  const personGet = vi.fn();
  const eventCreate = vi.fn().mockResolvedValue({
    data: {
      id: 'event-1',
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

function resolverEvent(
  args: CreateBotEventArgs,
  fieldName = 'createEventByAnalyst'
): CreateBotEventResolverEvent {
  return {
    arguments: args,
    info: { fieldName }
  };
}

function validInput(overrides: Partial<CreateBotEventArgs> = {}): CreateBotEventArgs {
  return {
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
    vi.restoreAllMocks();
  });

  it('creates an analyst-owned event and links existing people without admin fields', async () => {
    const { client, personGet, eventCreate, eventPersonCreate } = createClient();
    personGet.mockResolvedValue({ data: { id: 'person-1' } });

    const result = await createBotEvent(
      resolverEvent(validInput()),
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
      geoHash: expect.any(String)
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
      resolverEvent(validInput({ actors: [{ personId: 'missing-person', role: 'testimone' }] })),
      client,
      FALLBACK_PERSON_ID
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
      resolverEvent(validInput({ startPosition: undefined })),
      client,
      FALLBACK_PERSON_ID
    )).rejects.toThrow('A startPosition is required for type Fatto');

    expect(eventCreate).not.toHaveBeenCalled();
    expect(eventPersonCreate).not.toHaveBeenCalled();
  });

  it('does not create events for other bots', async () => {
    const { client, eventCreate } = createClient();

    await expect(createBotEvent(
      resolverEvent(validInput(), 'createEventByDetective'),
      client,
      FALLBACK_PERSON_ID
    )).rejects.toThrow('Event creation is not enabled for this bot');

    expect(eventCreate).not.toHaveBeenCalled();
  });

  it('rejects the import if the configured fallback person is missing', async () => {
    const { client, personGet, eventCreate } = createClient();
    personGet
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: null });

    await expect(createBotEvent(
      resolverEvent(validInput({ actors: [{ role: 'testimone' }] })),
      client,
      FALLBACK_PERSON_ID
    )).rejects.toThrow(`Fallback person ${FALLBACK_PERSON_ID} was not found`);

    expect(eventCreate).not.toHaveBeenCalled();
  });
});
