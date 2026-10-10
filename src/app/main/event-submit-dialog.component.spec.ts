import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, Mock, Mocked } from 'vitest';

import { EventSubmitDialogComponent } from './event-submit-dialog.component';

describe('EventSubmitDialogComponent', () => {
  let fixture: ComponentFixture<EventSubmitDialogComponent>;
  let mockCreate: Mock;
  let mockCreateEventPerson: Mock;

  beforeEach(async () => {
    mockCreate = vi.fn().mockName('create').mockResolvedValue({
      data: { id: 'event-123' },
      errors: [],
    });
    mockCreateEventPerson = vi.fn().mockName('createEventPerson').mockResolvedValue({
      data: { id: 'event-person-123' },
      errors: [],
    });

    await TestBed.configureTestingModule({
      imports: [EventSubmitDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EventSubmitDialogComponent);
    vi.spyOn(fixture.componentInstance, 'createClient').mockReturnValue({
      models: {
        Event: { create: mockCreate },
        Person: {
          list: vi.fn().mockResolvedValue({
            data: [{ id: 'person-123', name: 'Mario', surname: 'Rossi', initials: 'MR' }],
            errors: [],
          }),
        },
        EventPerson: { create: mockCreateEventPerson },
      },
    } as any);
    fixture.componentRef.setInput('ownerId', 'user-123');
    fixture.componentRef.setInput('isAdmin', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function setValidFormValues(overrides: Partial<Record<string, unknown>> = {}): void {
    const form = fixture.componentInstance.eventForm;
    form.patchValue({
      owner: 'user-123',
      type: 'Indagine',
      name: 'Evento di prova',
      description: 'Descrizione di prova',
      reliability: 4,
      relevance: 3,
      ...overrides,
    });
    form.controls.start.patchValue({
      date: '2024-01-15T10:00',
      latitude: 45.1974,
      longitude: 8.9247,
      radius: 50,
    });
    form.controls.end.patchValue({
      date: '2024-01-15T11:00',
      latitude: 45.1975,
      longitude: 8.9248,
      radius: 50,
    });
  }

  function selectActor(role = 'testimone'): void {
    fixture.componentInstance.selectedActors = [{
      rowId: 0,
      personId: 'person-123',
      personQuery: 'Mario Rossi',
      role,
    }];
  }

  it('should insert a record when the form is valid', async () => {
    setValidFormValues();
    selectActor();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mockCreate).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      owner: 'user-123',
      type: 'Indagine',
      name: 'Evento di prova',
      description: 'Descrizione di prova',
      start_date: '2024-01-15T10:00',
      end_date: '2024-01-15T11:00',
      reliability: 4,
      relevance: 3,
    }));
  });

  it('should store zero ratings for non-admin submissions', async () => {
    fixture.componentRef.setInput('isAdmin', false);
    setValidFormValues({ reliability: 4, relevance: 3 });
    selectActor();

    await fixture.componentInstance.submitEvent();

    expect(vi.mocked(mockCreate).mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({
      reliability: 0,
      relevance: 0,
    }));
  });

  it('should associate a selected person with their role', async () => {
    const component = fixture.componentInstance;
    const rowId = component.selectedActors[0].rowId;
    const personInput = fixture.nativeElement.querySelector('#event-person-0') as HTMLInputElement;
    personInput.value = 'Mario';
    personInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.filteredPeople(component.selectedActors[0]).map((person) => person.id)).toContain('person-123');

    const person = component.people.find((item) => item.id === 'person-123');
    if (!person) throw new Error('Expected test person to be loaded');
    component.selectActorPerson(rowId, person);
    fixture.detectChanges();

    const roleInput = fixture.nativeElement.querySelector('#event-person-role-0') as HTMLInputElement;
    roleInput.value = 'testimone';
    roleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    setValidFormValues();

    await fixture.componentInstance.submitEvent();

    expect(mockCreateEventPerson).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-123',
      personId: 'person-123',
      role: 'testimone',
    }));
  });

  it('should require a role for each selected person', async () => {
    const component = fixture.componentInstance;
    const person = component.people.find((item) => item.id === 'person-123');
    if (!person) throw new Error('Expected test person to be loaded');
    component.selectActorPerson(component.selectedActors[0].rowId, person);
    setValidFormValues();
    fixture.detectChanges();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitError()).toContain('ruolo');
  });

  it('should add another autocomplete person and require an exact person selection', async () => {
    const addButton = fixture.nativeElement.querySelector('.actor-add-control') as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.actor-person-role-row')).toHaveLength(2);

    const personInput = fixture.nativeElement.querySelector('#event-person-0') as HTMLInputElement;
    personInput.value = 'Unknown person';
    personInput.dispatchEvent(new Event('input'));
    setValidFormValues();
    fixture.detectChanges();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitError()).toContain('persona');
  });

  it('should reject a person that is no longer in the current people list', async () => {
    setValidFormValues();
    selectActor();
    fixture.componentInstance.people = [];

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitError()).toContain('persona valida');
    expect(fixture.componentInstance.actorSelectionError).toBe(true);
  });

  it('should require at least one selected person', async () => {
    fixture.componentInstance.selectedActors = [];
    setValidFormValues();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitError()).toContain('almeno una persona');
    expect(fixture.nativeElement.textContent).toContain('Seleziona almeno una persona coinvolta.');
  });

  it('should reject zero ratings for administrators', async () => {
    setValidFormValues({ reliability: 0, relevance: 0 });
    selectActor();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitError()).toContain('da 1 a 4');
  });

  it('should show admin fields only for administrators', () => {
    const reliabilitySelect = fixture.nativeElement.querySelector('#event-reliability');
    const relevanceSelect = fixture.nativeElement.querySelector('#event-relevance');

    expect(reliabilitySelect).not.toBeNull();
    expect(relevanceSelect).not.toBeNull();
  });

  it('should open the map picker for the requested position', () => {
    fixture.componentInstance.requestPosition('start');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#map-picker-title').textContent).toContain('Posizione di inizio');
    expect(fixture.nativeElement.querySelector('.google-map')).not.toBeNull();

    fixture.nativeElement.querySelector('[aria-label="Chiudi mappa"]').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.map-picker-dialog')).toBeNull();
  });

  it('should apply the confirmed map center and radius to the requested position', () => {
    const component = fixture.componentInstance;
    component.requestPosition('end');
    fixture.detectChanges();

    const map = {
      getCenter: () => ({ lat: () => 45.1974, lng: () => 8.9247 }),
      getBounds: () => ({
        getNorthEast: () => ({ lat: () => 45.2074, lng: () => 8.9347 }),
        getSouthWest: () => ({ lat: () => 45.1874, lng: () => 8.9147 }),
      }),
    } as unknown as google.maps.Map;
    (component as unknown as { map: google.maps.Map }).map = map;

    component.confirmMapSelection();

    const endPosition = component.eventForm.controls.end.getRawValue();
    expect(endPosition.latitude).toBe(45.1974);
    expect(endPosition.longitude).toBe(8.9247);
    expect(endPosition.radius).toBeGreaterThan(0);
    expect(component.isMapPickerOpen).toBeFalsy();
  });

  it('should surface an error when the insert fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB timeout'));
    setValidFormValues();
    selectActor();

    await fixture.componentInstance.submitEvent();

    expect(fixture.componentInstance.submitError()).toContain('DB timeout');
  });
});
