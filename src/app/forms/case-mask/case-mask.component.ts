import { computed, effect, inject, Injector, Signal, signal } from '@angular/core';
import { UserProfileService } from '../../user-profile.service';
import { FormGroup, PristineChangeEvent, } from '@angular/forms';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';

import { Schema } from '../../../../amplify/data/resource';
import { distinctUntilChanged, filter, map } from 'rxjs';

type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

type SelectedActor = {
  rowId: number;
  personId: string;
  personQuery: string;
  role: string
}

export interface PersonCaseEvent {
  personSaved: Person[]
  personDeleted: string[]
}

export abstract class CaseMaskComponent {

  protected COORDS_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })

  userService = inject(UserProfileService)
  private injector = inject(Injector)

  isAdmin = computed(() => this.userService.user().isAdmin())

  isLoading = signal(true)

  protected loadingComplete():void {
    this.isLoading.set(false)
    this.getForm().markAsPristine()
    this.getForm().events.pipe(
      filter((event) => event instanceof PristineChangeEvent),
      map(event => !event.pristine),
      distinctUntilChanged()).subscribe(val => this.maskModified(val))
    return
  }

  onKeyDown(event: KeyboardEvent) {
    // Verifica se è stato premuto il tasto Invio
    if (event.key === 'Enter') {
      const target = event.target as HTMLElement;

      // Se l'utente NON si trova sopra il pulsante di submit, blocca l'evento
      if (target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA' && target.getAttribute('type') !== 'submit') {
        event.preventDefault();
      }
    }
  }

  protected abstract allPeople(): Person[]

  protected abstract getForm(): FormGroup

  protected abstract maskModified(value: boolean): void

  protected abstract showSplash(message: string): void

  protected abstract setError(message: string): void
  
  isPersonDialogOpen = signal(false)

  openPersonDialog(): void {
    this.isPersonDialogOpen.set(true)
  }

  closePersonDialog(): void {
    this.isPersonDialogOpen.set(false)
  }

  protected dateToLocalInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  personName(personId: string): string {
    const person = this.allPeople().find(p => p.id === personId)
    return person ? `${person.name} ${person.surname}` : ''
  }
  
  personFullName(personId: string): string {
    const person = this.allPeople().find(p => p.id === personId)
    return person ? `${person.surname} ${person.name}` : ''
  }

  checkForm():boolean {

    this.getForm().markAllAsTouched()
    this.setError('')

    if (this.getForm().invalid) {
      this.setError('Completa tutti i campi obbligatori prima di salvare l’evento.')
      return false
    }

    this.actorStatus.selectionError.set(this.selectedActors().length === 0
      || this.selectedActors().some((actor) => !this.isActorPersonValid(actor)))

    if (this.actorStatus.selectionError()) {
      this.setError(
        this.selectedActors().length === 0
          ? 'Seleziona almeno una persona coinvolta.'
          : this.selectedActors().some((actor) => this.isActorPersonValid(actor))
            ? 'Seleziona una persona in ogni riga.'
            : 'Seleziona una persona valida dall’elenco in ogni riga.',
      )
      return false
    }

    this.actorStatus.roleError.set(this.selectedActors().some((actor) => !actor.role.trim()))
    if (this.actorStatus.roleError()) {
      this.setError('Indica il ruolo per ogni persona selezionata.')
      return false
    }

    this.sourceStatus.error.set(this.sources().findIndex((source) => !source.trim()))
    if (this.sourceStatus.error() !== -1) {
      this.setError('Specifica la fonte per ogni riga.')
      return false
    }

    return true
  }

  //-----------------------------------------------------------------------------
  // | ACTORS MANAGEMENT
  // |
  // V

  personCaseEvent = computed(() => ({ 
    personSaved: this.savedPeople(), 
    personDeleted: this.deletedPeopleIds() 
  } as PersonCaseEvent))
  
  protected savedPeople = signal<Person[]>([])
  protected deletedPeopleIds = signal<string[]>([])
  
  readonly NEW_PERSON_OPTION = '__new_person__'

  readonly displayPerson = (person: Person | string | null): string => {
    if (person === this.NEW_PERSON_OPTION) return ''
    if (typeof person === 'string') return person
    return person ? `${person.name} ${person.surname}` : ''
  }

  // actors involved in the case
  readonly selectedActors = signal<SelectedActor[]>([{ rowId: 0, personId: '', personQuery: '', role: '' }])

  actorStatus = {
    selectionError: signal(false),
    roleError: signal(false),
    nextRowId: 1 
  }

  filteredPeople(actor: SelectedActor): Person[] {
    const query = actor.personQuery.trim().toLocaleLowerCase()
    return this.allPeople().filter((person) => {
      const alreadySelected = this.selectedActors().some(
        (selectedActor) => selectedActor.rowId !== actor.rowId && selectedActor.personId === person.id,
      )
      const name = `${person.name} ${person.surname}`.toLocaleLowerCase()
      return !alreadySelected && name.includes(query)
    })
  }  

  isActorPersonValid(actor: SelectedActor): boolean {
    const person = this.allPeople().find((item) => item.id === actor.personId)
    return !!person
      && actor.personQuery.trim().toLocaleLowerCase()
        === this.displayPerson(person).trim().toLocaleLowerCase()
  }
  
  addActor(): void {
    this.selectedActors.update(actors => [
      ...actors,
      { rowId: this.actorStatus.nextRowId++, personId: '', personQuery: '', role: '' },
    ])
    this.actorStatus.selectionError.set(false)
    this.actorStatus.roleError.set(false)
  }

  updateActorPersonQuery(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: '', personQuery: target.value }
        : actor,
    ))
    this.actorStatus.selectionError.set(false)
  }

  selectActorPerson(rowId: number, personId: string): void {
    const person = this.allPeople().find((item) => item.id === personId)
    if (!person || rowId < 0) return
    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: person.id, personQuery: this.displayPerson(person) }
        : actor,
    ))
    this.actorStatus.selectionError.set(false)
    this.maskModified(true)
  }

  removeActor(rowId: number): void {
    if (this.selectedActors().length <= 1) return
    this.selectedActors.update(actors => actors.filter((actor) => actor.rowId !== rowId))
    this.actorStatus.selectionError.set(false)
    this.actorStatus.roleError.set(false)
    this.maskModified(true)
  }

  updateActorRole(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId ? { ...actor, role: target.value } : actor,
    ))
    this.actorStatus.roleError.set(false)
  }

  onPersonOptionSelected(rowId: number, value: Person | string): void {
    if (value === this.NEW_PERSON_OPTION) {
      this.selectedActors.update(actors => actors.map((actor) =>
        actor.rowId === rowId ? { ...actor, personId: '', personQuery: '' } : actor,
      ))
      this.openPersonDialogFor(rowId)
    } else
      this.selectActorPerson(rowId, (value as Person).id)
  }

  editPerson = {
    person: signal<Person | null>(null),
    rowId: -1
  }

  openPersonDialogFor(rowId: number): void {
    if (!this.isAdmin()) {
      this.showSplash('Operazione non consentita! Inviare una richiesta per modifica/inserimento persona')
      return
    }
    const editPerson = this.allPeople()
      .find(p => this.selectedActors().find(a => a.rowId == rowId)?.personId == p.id)
    this.editPerson.person.set(editPerson || null)
    this.editPerson.rowId = rowId
    this.openPersonDialog()
  }

  onPersonSaved(person: Person): void {
    this.savedPeople.update(list => {
      const existing = list.find(p => p.id === person.id)
      if (existing) {
        return list.map(p => p.id === person.id ? person : p)
      }
      return [...list, person]
    })
    this.selectActorPerson(this.editPerson.rowId, person.id)
    this.closePersonDialog()
  }

  onPersonDeleted(personId: string): void {
    this.savedPeople.update(list => list.filter(p => p.id !== personId))
    this.deletedPeopleIds.update(ids => ids.includes(personId) ? ids : [...ids, personId])
    this.selectedActors.update(actors => {
      const filtered = actors.filter(a => a.personId !== personId)
      return filtered.length ? filtered : [{ rowId: this.actorStatus.nextRowId++, personId: '', personQuery: '', role: '' }]
    })
    this.closePersonDialog()
  }


  //-----------------------------------------------------------------------------
  // | SOURCES MANAGEMENT 
  // |
  // V

  sources = signal<string[]>([])
  sourceStatus = {
    cannotAdd: signal(false),
    error: signal(-1)
  }

  addSource(): void {
    this.sources.update(a => [...a, ""])
    this.sourceStatus.cannotAdd.set(true)
  }

  private cannotAddTrigger = () => {
      if (!this.sources().length) return false
      if (this.sources().some((s) => s === '')) return true
      if (this.sources().length > new Set(this.sources()).size) return true
      return false
    }

  updateSource(i:number, event: Event): void {
    if (this.sources().length <= i) return
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    this.sources.update(a => [...a.slice(0, i), target.value, ...a.slice(i+1)])
    this.sourceStatus.cannotAdd.update(this.cannotAddTrigger)
    this.maskModified(true)
  }

  removeSource(i: number): void {
    this.sources.update(a => [...a.slice(0, i), ...a.slice(i+1)])
    this.sourceStatus.cannotAdd.update(this.cannotAddTrigger)
    this.maskModified(true)
  }


  //-----------------------------------------------------------------------------
  // | MAPS MANAGEMENT
  // |
  // V
  readonly pickerTarget = signal<'start' | 'end' | null>(null)

  requestPosition(target: 'start' | 'end'): void {
    this.pickerTarget.set(target)
  }

  pickerInitialPosition(): Coordinates | null {
    const target = this.pickerTarget()
    if (!target) return null
    const value = this.getForm().controls[target].getRawValue()
    return value.latitude != null && value.longitude != null
      ? { latitude: Number(value.latitude), longitude: Number(value.longitude), radius: Number(value.radius ?? 0) }
      : null
  }

  onPositionPicked(position: Coordinates): void {
    const target = this.pickerTarget()
    if (target) {
      this.getForm().controls[target].patchValue({
        latitude: this.COORDS_FORMAT.format(position.latitude),
        longitude: this.COORDS_FORMAT.format(position.longitude),
        radius: String(position.radius),
      })
      this.getForm().controls[target].markAsDirty()
    }
    this.pickerTarget.set(null)
    this.maskModified(true)
  }

  cancelPosition(target: 'start' | 'end'): void {
    this.getForm().controls[target].patchValue({
      latitude: null,
      longitude: null,
      radius: null,
    })
    this.getForm().controls[target].markAsDirty()
    this.maskModified(true)
  }

  closePicker(): void {
    this.pickerTarget.set(null)
  }

  // Trucco per chiudere il pannello dell'autocomplete dopo che l'input perde il focus
  closeAutocomplete(trigger: MatAutocompleteTrigger): void {
    setTimeout(() => trigger.closePanel(), 250)
  }

}
