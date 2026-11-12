import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { GeoService } from '../../geo.service';
import { UserProfileService } from '../../user-profile.service';
import { IMPORT_CLIENT, ImportService } from './import.service';

describe('ImportService', () => {
  const personCreate = vi.fn();
  const personGet = vi.fn();
  const eventCreate = vi.fn();
  const eventGet = vi.fn();
  const eventPersonCreate = vi.fn();
  const hypothesisCreate = vi.fn();
  const hypothesisPersonCreate = vi.fn();
  const logIn = vi.fn();
  const computeGeoHash = vi.fn();
  const computeCenterPosition = vi.fn();

  beforeEach(() => {
    personCreate.mockReset().mockResolvedValue({ data: { id: 'person-1' } });
    personGet.mockReset().mockResolvedValue({ data: { id: 'person-1' } });
    eventCreate.mockReset().mockResolvedValue({
      data: { id: 'event-1', name: 'Evento', startDate: '2024-01-01', geoHash: 'hash' }
    });
    eventGet.mockReset().mockResolvedValue({ data: { id: 'event-1' } });
    eventPersonCreate.mockReset().mockResolvedValue({ data: { id: 'link-1' } });
    hypothesisCreate.mockReset().mockResolvedValue({
      data: { id: 'hypothesis-1', name: 'Ipotesi' }
    });
    hypothesisPersonCreate.mockReset().mockResolvedValue({ data: { id: 'link-1' } });
    logIn.mockReset().mockResolvedValue({ getId: () => 'current-user' });
    computeGeoHash.mockReset().mockReturnValue('hash');
    computeCenterPosition.mockReset().mockReturnValue(null);

    const client = {
      models: {
        Person: { create: personCreate, get: personGet },
        Event: { create: eventCreate, get: eventGet },
        EventPerson: { create: eventPersonCreate },
        Hypothesis: { create: hypothesisCreate },
        HypothesisPerson: { create: hypothesisPersonCreate }
      }
    } as unknown as Client<Schema>;

    TestBed.configureTestingModule({
      providers: [
        ImportService,
        { provide: IMPORT_CLIENT, useValue: client },
        { provide: UserProfileService, useValue: { logIn } },
        { provide: GeoService, useValue: { computeGeoHash, computeCenterPosition } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
  });

  it('reports progress and counts imported and skipped people', async () => {
    const service = TestBed.inject(ImportService);

    const result = await service.importPeople(JSON.stringify([
      { name: 'Mario', surname: 'Rossi', initials: 'MR', type: 'Cronista' },
      { name: 'Incomplete' }
    ]));

    expect(result).toMatchObject({ total: 2, imported: 1, skipped: 1, failed: 0 });
    expect(service.progress()).toMatchObject({
      active: false,
      kind: 'people',
      processed: 2,
      imported: 1,
      skipped: 1
    });
    expect(personCreate).toHaveBeenCalledOnce();
  });

  it('exposes an active progress state while a record is being written', async () => {
    let finishCreate!: (result: { data: { id: string } }) => void;
    personCreate.mockImplementationOnce(() => new Promise(resolve => {
      finishCreate = resolve;
    }));
    const service = TestBed.inject(ImportService);

    const pending = service.importPeople(JSON.stringify([{
      name: 'Mario',
      surname: 'Rossi',
      initials: 'MR',
      type: 'Cronista'
    }]));

    expect(service.progress()).toMatchObject({
      active: true,
      total: 1,
      processed: 0,
      currentItem: 'Mario'
    });

    finishCreate({ data: { id: 'person-1' } });
    await pending;
    expect(service.progress().active).toBe(false);
  });

  it('imports events with their owner, geohash, and existing person links', async () => {
    const service = TestBed.inject(ImportService);

    const result = await service.importEvents(JSON.stringify([{
      name: 'Evento',
      description: 'Descrizione',
      type: 'Fatto',
      startDate: '2024-01-01T00:00:00.000Z',
      startPosition: { latitude: 45, longitude: 9, radius: 0 },
      sources: ['https://example.test/source'],
      actors: [{ personId: 'person-1', role: 'testimone' }]
    }]));

    expect(result.imported).toBe(1);
    expect(logIn).toHaveBeenCalledOnce();
    expect(computeGeoHash).toHaveBeenCalledWith(null);
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'current-user',
      name: 'Evento',
      geoHash: 'hash'
    }));
    expect(eventPersonCreate).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      personId: 'person-1',
      role: 'testimone'
    }));
  });

  it('preserves hypothesis owner IDs and imports actor links', async () => {
    const service = TestBed.inject(ImportService);

    const result = await service.importHypotheses(JSON.stringify([{
      id: 'hypothesis-1',
      owner: 'original-owner',
      name: 'Ipotesi',
      description: 'Descrizione',
      startDate: '2024-01-01T00:00:00.000Z',
      sources: [],
      eventId: 'event-1',
      actors: [{ personId: 'person-1', role: 'testimone' }]
    }]));

    expect(result.imported).toBe(1);
    expect(eventGet).toHaveBeenCalledWith({ id: 'event-1' });
    expect(hypothesisCreate).toHaveBeenCalledWith(expect.objectContaining({
      owner: 'original-owner',
      eventId: 'event-1'
    }));
    expect(hypothesisPersonCreate).toHaveBeenCalledWith({
      hypothesisId: 'hypothesis-1',
      hypothesisName: 'Ipotesi',
      personId: 'person-1',
      role: 'testimone'
    });
  });

  it('rejects malformed JSON before starting an import', async () => {
    const service = TestBed.inject(ImportService);

    await expect(service.importPeople('not json')).rejects.toThrow('JSON persone non valido.');

    expect(service.progress().active).toBe(false);
    expect(personCreate).not.toHaveBeenCalled();
  });
});
