import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  ImportComponent,
  isValidEventActors,
  isValidEventType,
  isValidPersonType,
  toPersonCreateInput,
} from './import.component';

describe('ImportComponent', () => {
  let component: ImportComponent;
  let fixture: ComponentFixture<ImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render independent event and person JSON inputs', () => {
    expect(fixture.nativeElement.querySelector('#events-json')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#people-json')).not.toBeNull();
  });

  it('should clear the JSON input', () => {
    component.jsonInput.set('[{"name":"Evento"}]');

    component.cleanInputData();

    expect(component.jsonInput()).toBe('');
  });

  it('should clear the people JSON input independently', () => {
    component.jsonInput.set('[{"name":"Evento"}]');
    component.peopleJsonInput.set('[{"name":"Mario","surname":"Rossi"}]');

    component.cleanPeopleInput();

    expect(component.peopleJsonInput()).toBe('');
    expect(component.jsonInput()).toBe('[{"name":"Evento"}]');
  });

  it('should ignore relation data when building a person create payload', () => {
    const person = {
      id: 'person-123',
      name: 'Mario',
      surname: 'Rossi',
      type: 'Cronista' as const,
      initials: 'MR',
      profession: 'Studente',
      events: ['event-person-link-123'],
    };

    expect(toPersonCreateInput(person)).toEqual({
      id: 'person-123',
      name: 'Mario',
      surname: 'Rossi',
      type: 'Cronista',
      initials: 'MR',
      profession: 'Studente',
    });
  });

  it('accepts actors as person ID and role objects', () => {
    expect(isValidEventActors([
      { personId: 'person-123', role: 'testimone' },
      { personId: 'person-456', role: 'indagato' },
    ])).toBe(true);
  });

  it('rejects actors without non-empty person IDs and roles', () => {
    expect(isValidEventActors([['person-123', 'testimone']])).toBe(false);
    expect(isValidEventActors([{ personId: 'person-123' }])).toBe(false);
    expect(isValidEventActors([{ personId: '', role: 'testimone' }])).toBe(false);
    expect(isValidEventActors([{ personId: 'person-123', role: '' }])).toBe(false);
    expect(isValidEventActors([{ personId: 'person-123', role: 1 }])).toBe(false);
  });

  it('accepts only supported event types', () => {
    expect(isValidEventType('Indagine', null)).toBe(true);
    expect(isValidEventType('Comunicazione', null)).toBe(true);
    expect(isValidEventType('Fatto', 'a position')).toBe(true);
    expect(isValidEventType('Intercettazione', null)).toBe(true);
    expect(isValidEventType('Sentenza', null)).toBe(true);
    expect(isValidEventType('Altro', null)).toBe(false);
    expect(isValidEventType('Fatto', null)).toBe(false);
    expect(isValidEventType(undefined, null)).toBe(false);
  });

  it('accepts only supported person types', () => {
    expect(isValidPersonType('Cronista')).toBe(true);
    expect(isValidPersonType('Autorita')).toBe(true);
    expect(isValidPersonType('Protagonista')).toBe(true);
    expect(isValidPersonType('Testimone')).toBe(true);
    expect(isValidPersonType('Altro')).toBe(false);
    expect(isValidPersonType(undefined)).toBe(false);
  });
});
