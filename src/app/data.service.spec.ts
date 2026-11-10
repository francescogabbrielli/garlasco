import { TestBed } from '@angular/core/testing';
import { GeoService } from './geo.service';
import { DataService } from './data.service';
import { Schema } from '../../amplify/data/resource';
import { vi } from 'vitest';

type Coordinates = Schema['Coordinates']['type'];

describe('DataService', () => {
  let service: DataService;
  let computeGeoHash: ReturnType<typeof vi.fn>;
  const coordinates: Coordinates = { latitude: 45, longitude: 9, radius: 100 };
  const from = new Date('2024-01-01T00:00:00.000Z');
  const to = new Date('2024-02-01T00:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    computeGeoHash = vi.fn().mockReturnValue('sr63');

    TestBed.configureTestingModule({
      providers: [
        DataService,
        { provide: GeoService, useValue: { computeGeoHash } }
      ]
    });
    service = TestBed.inject(DataService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no events and no pending load', () => {
    expect(service.getEvents()).toEqual([]);
    expect(service.isLoadingEvents()).toBe(false);
    expect(service.hasMore()).toBe(false);
  });

  it('stores selected people, date bounds, and the computed map filter', () => {
    service.setEventFilters(['person-1'], from, to, coordinates);

    expect(service.eventFilterSubject.value).toEqual({
      personIds: ['person-1'],
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      geoHash: 'sr63'
    });
    expect(computeGeoHash).toHaveBeenCalledWith(coordinates);
    expect(service.isLoadingEvents()).toBe(true);
  });

  it('ignores load-more requests when no additional pages are available', () => {
    service.loadMoreEvents();

    expect(service.hasMore()).toBe(false);
    expect(service.isLoadingEvents()).toBe(false);
    expect(service.getEvents()).toEqual([]);
  });

  it('clears the loading state after an empty filter result', async () => {
    service.setEventFilters([], from, to, coordinates);
    await vi.advanceTimersByTimeAsync(750);

    expect(service.isLoadingEvents()).toBe(false);
    expect(service.getEvents()).toEqual([]);
    expect(service.hasMore()).toBe(false);
  });
});
