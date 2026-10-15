import { ComponentFixture, TestBed } from '@angular/core/testing';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { Schema } from '../../../../amplify/data/resource';
import { EventListComponent } from './event-list.component';
import { vi } from 'vitest';

type Event = Schema['Event']['type'];

function event(id: string, type: string, name: string): Event {
  return {
    id,
    owner: 'owner',
    type,
    name,
    description: '',
    start_date: '2024-01-01T00:00:00.000Z',
    end_date: null,
    start_position: { latitude: 45, longitude: 9, radius: 0 },
    end_position: null,
    geoHash: 'sr63',
    reliability: 1,
    relevance: 2
  } as Event;
}

describe('EventListComponent', () => {
  let component: EventListComponent;
  let fixture: ComponentFixture<EventListComponent>;

  beforeEach(async () => {
    registerLocaleData(localeIt);

    await TestBed.configureTestingModule({
      imports: [EventListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EventListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('groups related items with their fact and emits a click for that fact', () => {
    const communication = event('communication', 'Comunicazione', 'Telefonata');
    const document = event('document', 'Sentenza', 'Documento');
    const fact = event('fact', 'Fatto', 'Evento principale');
    fixture.componentRef.setInput('items', [communication, document, fact]);
    fixture.detectChanges();
    const eventClick = vi.fn();
    component.eventClick.subscribe(eventClick);

    const factLine = component.displayedItems().find(line => line.fact);
    expect(factLine?.communications).toEqual([communication]);
    expect(factLine?.documents).toEqual([document]);
    expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Evento principale');

    fixture.nativeElement.querySelector('li.event-item').click();

    expect(eventClick).toHaveBeenCalledWith(fact);
  });
});
