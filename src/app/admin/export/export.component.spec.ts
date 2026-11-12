import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Schema } from '../../../../amplify/data/resource';

import { ExportComponent, toHypothesisExportRecords } from './export.component';

describe('ExportComponent', () => {
  let component: ExportComponent;
  let fixture: ComponentFixture<ExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exports hypothesis owner, event link, and person relationships', () => {
    const hypothesis = {
      id: 'hypothesis-1',
      owner: 'owner-1',
      name: 'Ipotesi',
      description: 'Descrizione',
      startDate: '2024-01-01T00:00:00.000Z',
      endDate: null,
      startPosition: null,
      endPosition: null,
      sources: ['https://example.test/source'],
      eventId: 'event-1',
      eventName: 'Evento',
      eventRelevance: 3
    } as Schema['Hypothesis']['type'];
    const actors = new Map([
      ['hypothesis-1', [{ personId: 'person-1', role: 'testimone' }]]
    ]);

    expect(toHypothesisExportRecords([hypothesis], actors)[0]).toMatchObject({
      owner: 'owner-1',
      eventId: 'event-1',
      actors: [{ personId: 'person-1', role: 'testimone' }]
    });
  });
});
