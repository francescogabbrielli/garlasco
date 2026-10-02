import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportComponent, isValidEventActors, toPersonCreateInput } from './import.component';

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
      initials: 'MR',
      profession: 'Studente',
      events: ['event-person-link-123'],
    };

    expect(toPersonCreateInput(person)).toEqual({
      id: 'person-123',
      name: 'Mario',
      surname: 'Rossi',
      initials: 'MR',
      profession: 'Studente',
    });
  });

  it('accepts actors as person ID and role pairs', () => {
    expect(isValidEventActors([['person-123', 'testimone'], ['person-456', 'indagato']])).toBeTrue();
  });

  it('rejects actors that are not non-empty person ID and role pairs', () => {
    expect(isValidEventActors({ personId: 'person-123', role: 'testimone' })).toBeFalse();
    expect(isValidEventActors([['person-123']])).toBeFalse();
    expect(isValidEventActors([['', 'testimone']])).toBeFalse();
    expect(isValidEventActors([['person-123', '']])).toBeFalse();
    expect(isValidEventActors([['person-123', 1]])).toBeFalse();
  });
});
