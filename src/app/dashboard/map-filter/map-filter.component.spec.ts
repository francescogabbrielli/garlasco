import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Schema } from '../../../../amplify/data/resource';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';
import { MapFilterComponent } from './map-filter.component';
import { vi } from 'vitest';

type Event = Schema['Event']['type'];

function eventWithRoute(): Event {
  return {
    id: 'event-1',
    owner: 'owner',
    type: 'Fatto',
    name: 'Evento di prova',
    description: '',
    start_date: '2024-01-01T00:00:00.000Z',
    end_date: null,
    start_position: { latitude: 45, longitude: 9, radius: 0 },
    end_position: { latitude: 46, longitude: 10, radius: 0 },
    geoHash: 'sr63',
    reliability: 1,
    relevance: 1
  } as Event;
}

describe('MapFilterComponent', () => {
  let component: MapFilterComponent;
  let fixture: ComponentFixture<MapFilterComponent>;
  let load: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    load = vi.fn(() => new Promise<void>(() => undefined));

    await TestBed.configureTestingModule({
      imports: [MapFilterComponent],
      providers: [{ provide: GoogleMapsLoaderService, useValue: { load } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('converts event start and end positions into a displayed route', () => {
    fixture.componentRef.setInput('markers', [eventWithRoute()]);

    expect(component.tracks()).toEqual([{
      id: 'event-1',
      path: [{ lat: 45, lng: 9 }, { lat: 46, lng: 10 }]
    }]);
  });

  it('emits hover and click events from a marker', () => {
    const hovered = vi.fn();
    const clicked = vi.fn();
    component.eventHover.subscribe(hovered);
    component.eventClick.subscribe(clicked);
    const pin = component.createPin('event-1');

    pin.dispatchEvent(new MouseEvent('mouseenter'));
    pin.click();

    expect(hovered).toHaveBeenCalledWith('event-1');
    expect(clicked).toHaveBeenCalledWith('event-1');
  });
});
