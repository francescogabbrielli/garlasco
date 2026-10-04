import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventSubmitDialogComponent } from './event-submit-dialog.component';

describe('EventSubmitDialogComponent', () => {
  let fixture: ComponentFixture<EventSubmitDialogComponent>;
  let mockCreate: jasmine.Spy;

  beforeEach(async () => {
    mockCreate = jasmine.createSpy('create').and.resolveTo({
      data: { id: 'event-123' },
      errors: [],
    });

    await TestBed.configureTestingModule({
      imports: [EventSubmitDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EventSubmitDialogComponent);
    spyOn(fixture.componentInstance, 'createClient').and.returnValue({
      models: {
        Event: { create: mockCreate },
      },
    } as any);
    fixture.componentInstance.ownerId = 'user-123';
    fixture.componentInstance.isAdmin = true;
    fixture.detectChanges();
  });

  function setValidFormValues(overrides: Partial<Record<string, unknown>> = {}): void {
    const form = fixture.componentInstance.eventForm;
    form.patchValue({
      owner: 'user-123',
      name: 'Evento di prova',
      description: 'Descrizione di prova',
      reliability: 4,
      relevance: 3,
      ...overrides,
    });
    form.controls.start_position.patchValue({
      start_date: '2024-01-15T10:00',
      latitude: 45.1974,
      longitude: 8.9247,
      radius: 50,
    });
    form.controls.end_position.patchValue({
      end_date: '2024-01-15T11:00',
      latitude: 45.1975,
      longitude: 8.9248,
      radius: 50,
    });
  }

  it('should insert a record when the form is valid', async () => {
    setValidFormValues();

    await fixture.componentInstance.submitEvent();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      owner: 'user-123',
      name: 'Evento di prova',
      description: 'Descrizione di prova',
      start_date: '2024-01-15T10:00',
      end_date: '2024-01-15T11:00',
      reliability: 4,
      relevance: 3,
    }));
  });

  it('should store zero ratings for non-admin submissions', async () => {
    fixture.componentInstance.isAdmin = false;
    setValidFormValues({ reliability: 4, relevance: 3 });

    await fixture.componentInstance.submitEvent();

    expect(mockCreate.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      reliability: 0,
      relevance: 0,
    }));
  });

  it('should reject zero ratings for administrators', async () => {
    setValidFormValues({ reliability: 0, relevance: 0 });

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

  it('should request map selection for the requested position', () => {
    const positionRequested = jasmine.createSpy('positionRequested');
    fixture.componentInstance.positionRequested.subscribe(positionRequested);

    fixture.componentInstance.requestPosition('start');

    expect(positionRequested).toHaveBeenCalledOnceWith('start');
  });

  it('should apply the selected map position to its matching position fields', () => {
    fixture.componentInstance.positionSelection = {
      target: 'end',
      latitude: 45.1975,
      longitude: 8.9248,
      radius: 50,
    };
    fixture.componentInstance.ngOnChanges({
      positionSelection: {
        currentValue: fixture.componentInstance.positionSelection,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(fixture.componentInstance.eventForm.controls.end_position.getRawValue()).toEqual({
      end_date: '',
      latitude: 45.1975,
      longitude: 8.9248,
      radius: 50,
    });
  });

  it('should surface an error when the insert fails', async () => {
    mockCreate.and.rejectWith(new Error('DB timeout'));
    setValidFormValues();

    await fixture.componentInstance.submitEvent();

    expect(fixture.componentInstance.submitError()).toContain('DB timeout');
  });
});
