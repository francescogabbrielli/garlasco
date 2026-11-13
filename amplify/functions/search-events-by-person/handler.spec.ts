import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'aws-amplify/data';
import type { Schema } from '../../data/resource';
import { searchEventsByPerson } from './handler';

type SearchArguments = Parameters<typeof searchEventsByPerson>[0]['arguments'];
type SearchEvent = Parameters<typeof searchEventsByPerson>[0];

function createClient() {
  const indexedQuery = vi.fn().mockResolvedValue({
    data: [{
      eventId: 'event-1',
      role: 'testimone',
      event: {
        id: 'event-1',
        owner: 'analyst',
        type: 'Fatto',
        name: 'Evento',
        description: 'Descrizione',
        startDate: '2024-01-02T00:00:00.000Z',
        sources: ['https://example.test/source']
      }
    }],
    nextToken: 'next-page'
  });
  const client = {
    models: {
      EventPerson: {
        listEventPersonByPersonIdAndEventStartDate: indexedQuery
      }
    }
  } as unknown as Client<Schema>;

  return { client, indexedQuery };
}

function resolverEvent(args: SearchArguments): SearchEvent {
  return { arguments: args };
}

describe('search-events-by-person handler', () => {
  it('uses the person/date index and returns flattened event details', async () => {
    const { client, indexedQuery } = createClient();

    await expect(searchEventsByPerson(resolverEvent({
      personId: 'person-1',
      eventStartDate: {
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.999Z'
      },
      limit: 10
    }), client)).resolves.toEqual({
      events: [{
        eventId: 'event-1',
        role: 'testimone',
        owner: 'analyst',
        type: 'Fatto',
        name: 'Evento',
        description: 'Descrizione',
        startDate: '2024-01-02T00:00:00.000Z',
        endDate: undefined,
        startPosition: undefined,
        endPosition: undefined,
        sources: ['https://example.test/source']
      }],
      nextToken: 'next-page'
    });

    expect(indexedQuery).toHaveBeenCalledWith(
      { personId: 'person-1' },
      expect.objectContaining({
        eventStartDate: {
          between: ['2024-01-01T00:00:00.000Z', '2024-01-31T23:59:59.999Z']
        },
        limit: 10,
        selectionSet: expect.arrayContaining(['event.id', 'event.name'])
      })
    );
  });

  it('rejects invalid date ranges before querying', async () => {
    const { client, indexedQuery } = createClient();

    await expect(searchEventsByPerson(resolverEvent({
      personId: 'person-1',
      eventStartDate: {
        from: '2024-02-01T00:00:00.000Z',
        to: '2024-01-01T00:00:00.000Z'
      }
    }), client)).rejects.toThrow('eventStartDate range: from must not be later than to');

    expect(indexedQuery).not.toHaveBeenCalled();
  });

  it('omits the date condition when the prompt provides no date range', async () => {
    const { client, indexedQuery } = createClient();

    await searchEventsByPerson(resolverEvent({
      personId: 'person-1'
    }), client);

    expect(indexedQuery).toHaveBeenCalledWith(
      { personId: 'person-1' },
      expect.not.objectContaining({ eventStartDate: expect.anything() })
    );
  });

  it('rejects a partial eventStartDate range', async () => {
    const { client, indexedQuery } = createClient();

    await expect(searchEventsByPerson(resolverEvent({
      personId: 'person-1',
      eventStartDate: { from: '2024-01-01T00:00:00.000Z' }
    }), client)).rejects.toThrow('eventStartDate.from and eventStartDate.to are required together');

    expect(indexedQuery).not.toHaveBeenCalled();
  });

  it('rejects invalid page sizes before querying', async () => {
    const { client, indexedQuery } = createClient();

    await expect(searchEventsByPerson(resolverEvent({
      personId: 'person-1',
      limit: 101
    }), client)).rejects.toThrow('expected an integer from 1 to 100');

    expect(indexedQuery).not.toHaveBeenCalled();
  });

  it('surfaces index query errors', async () => {
    const { client, indexedQuery } = createClient();
    indexedQuery.mockResolvedValue({
      data: null,
      errors: [{ message: 'permission denied' }]
    });

    await expect(searchEventsByPerson(resolverEvent({
      personId: 'person-1'
    }), client)).rejects.toThrow('Unable to search events by person: permission denied');
  });
});
