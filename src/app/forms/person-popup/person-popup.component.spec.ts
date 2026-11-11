import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import type { Schema } from '../../../../amplify/data/resource';
import { DataService } from '../../data.service';
import { EscapeStack } from '../../escape-stack.service';
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';
import { PersonDialogComponent } from './person-popup.component';

type Person = Schema['Person']['type'];

const existingPerson = {
  id: 'person-123',
  name: 'Mario',
  surname: 'Rossi',
  type: 'Cronista',
  profession: 'Giornalista',
  initials: 'MR',
} as Person;

describe('PersonDialogComponent', () => {
  let fixture: ComponentFixture<PersonDialogComponent>;
  let dataService: {
    savePerson: ReturnType<typeof vi.fn>;
    deletePerson: ReturnType<typeof vi.fn>;
  };
  let escapeStack: EscapeStack;
  let showSplash: MockInstance<(text?: string | null) => Promise<void>>;

  beforeEach(async () => {
    dataService = {
      savePerson: vi.fn(),
      deletePerson: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PersonDialogComponent],
      providers: [{ provide: DataService, useValue: dataService }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  function createComponent(person?: Person): PersonDialogComponent {
    fixture = TestBed.createComponent(PersonDialogComponent);
    if (person) fixture.componentRef.setInput('edited', person);
    fixture.detectChanges();

    escapeStack = TestBed.inject(EscapeStack);
    showSplash = vi.spyOn(
      fixture.debugElement.query(By.directive(SplashDialogComponent)).componentInstance as SplashDialogComponent,
      'show',
    ).mockResolvedValue();

    return fixture.componentInstance;
  }

  it('renders the create form and marks required fields touched when submitted empty', async () => {
    const component = createComponent();

    await component.submit();

    expect(fixture.nativeElement.querySelector('#person-dialog-title').textContent).toContain('Persona');
    expect(component.form.controls.name.touched).toBe(true);
    expect(component.form.controls.surname.touched).toBe(true);
    expect(component.form.controls.type.touched).toBe(true);
    expect(component.error()).toBe('Compila tutti i campi obbligatori.');
    expect(dataService.savePerson).not.toHaveBeenCalled();
  });

  it('trims and creates a person with generated initials', async () => {
    const component = createComponent();
    const savedPerson = { ...existingPerson, id: 'person-new' };
    dataService.savePerson.mockResolvedValue(savedPerson);
    component.form.setValue({
      name: '  Mario ',
      surname: ' Rossi  ',
      type: 'Cronista',
      profession: '  ',
      initials: '',
    });
    const saved = vi.fn();
    component.saved.subscribe(saved);

    await component.submit();

    expect(dataService.savePerson).toHaveBeenCalledWith({
      id: undefined,
      name: 'Mario',
      surname: 'Rossi',
      type: 'Cronista',
      profession: undefined,
      initials: 'MRos.',
    });
    expect(showSplash).toHaveBeenCalledWith('Persona creata con successo!');
    expect(saved).toHaveBeenCalledWith(savedPerson);
    expect(component.isSaving()).toBe(false);
    expect(component.error()).toBe('');
  });

  it('loads an existing person and saves edits with its ID', async () => {
    const component = createComponent(existingPerson);
    const savedPerson = { ...existingPerson, surname: 'Bianchi' };
    dataService.savePerson.mockResolvedValue(savedPerson);
    expect(component.form.getRawValue()).toEqual({
      name: 'Mario',
      surname: 'Rossi',
      type: 'Cronista',
      profession: 'Giornalista',
      initials: 'MR',
    });
    component.form.patchValue({ surname: ' Bianchi ', initials: ' MB ' });
    const saved = vi.fn();
    component.saved.subscribe(saved);

    await component.submit();

    expect(dataService.savePerson).toHaveBeenCalledWith({
      id: 'person-123',
      name: 'Mario',
      surname: 'Bianchi',
      type: 'Cronista',
      profession: 'Giornalista',
      initials: 'MB',
    });
    expect(showSplash).toHaveBeenCalledWith('Persona modificata con successo!');
    expect(saved).toHaveBeenCalledWith(savedPerson);
  });

  it('shows save errors and resets the saving state', async () => {
    const component = createComponent();
    dataService.savePerson.mockRejectedValue(new Error('Save failed'));
    component.form.patchValue({ name: 'Mario', surname: 'Rossi', type: 'Cronista' });

    await component.submit();

    expect(component.error()).toBe('Save failed');
    expect(component.isSaving()).toBe(false);
    expect(showSplash).not.toHaveBeenCalled();
  });

  it('does not delete when confirmation is declined', async () => {
    const component = createComponent(existingPerson);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    await component.deletePerson();

    expect(dataService.deletePerson).not.toHaveBeenCalled();
    expect(component.isSaving()).toBe(false);
  });

  it('deletes a confirmed person and emits its ID', async () => {
    const component = createComponent(existingPerson);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    dataService.deletePerson.mockResolvedValue(undefined);
    const deleted = vi.fn();
    component.deleted.subscribe(deleted);

    await component.deletePerson();

    expect(dataService.deletePerson).toHaveBeenCalledWith('person-123');
    expect(showSplash).toHaveBeenCalledWith('Persona eliminata!');
    expect(deleted).toHaveBeenCalledWith('person-123');
    expect(component.isSaving()).toBe(false);
  });

  it('shows delete errors and resets the saving state', async () => {
    const component = createComponent(existingPerson);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    dataService.deletePerson.mockRejectedValue(new Error('Delete failed'));

    await component.deletePerson();

    expect(component.error()).toBe('Delete failed');
    expect(component.isSaving()).toBe(false);
    expect(showSplash).not.toHaveBeenCalled();
  });

  it('closes from the close button and handles Escape through the stack', () => {
    const component = createComponent();
    const closed = vi.fn();
    component.closed.subscribe(closed);

    fixture.nativeElement.querySelector('button[aria-label="Chiudi"]').click();
    expect(closed).toHaveBeenCalledOnce();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).toHaveBeenCalledTimes(2);

    fixture.destroy();
    expect(escapeStack.isEmpty()).toBe(true);
  });
});
