import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core'
import { FormControl, FormGroup, PristineChangeEvent, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete'

import { UserProfileService } from '../../user-profile.service'
import { DataService, type SelectedActor } from '../../data.service'
import { GeoService } from '../../geo.service'

import { RELEVANCE_LABELS, RELIABILITY_LABELS, LABEL_MAP } from '../../app.constants'
import { EVENT_TYPES } from '../../../../amplify/data/enums'
import type { Schema } from '../../../../amplify/data/resource'

import { MapPickerComponent } from '../../ui/map-picker/map-picker.component'
import { PersonDialogComponent } from '../person-popup/person-popup.component'
import { toSignal } from '@angular/core/rxjs-interop'
import { distinctUntilChanged, filter, map } from 'rxjs'

type EventModel = Schema['Event']['type']
type EventType = Schema['Event']['type']['type']
type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

export interface EventMaskEvent {
  personCreated: Person[]
}

@Component({
  selector: 'app-event-mask',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MapPickerComponent, PersonDialogComponent],
  templateUrl: './event-mask.component.html',
  styleUrl: './event-mask.component.css',
})
export class EventMaskComponent {

  private readonly COORDS_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })

  private readonly dataService = inject(DataService)

  people = input<Person[]>([])
  event = input<EventModel | null>(null)
  saved = output<EventMaskEvent>()
  modified = output<boolean>()

  eventMaskEvent = computed(() => ({ personCreated: this.createdPeople() }))

  // people created from this mask, merged with the ones received as input
  private createdPeople = signal<Person[]>([])
  readonly allPeople = computed(() => {
    const base = this.people()
    return [...base, ...this.createdPeople().filter(p => !base.some(b => b.id === p.id))]
  })
  readonly personDialogOpen = signal(false)
  private personDialogRowId: number | null = null

  sources: string[] = []

  dialogOpen = output<boolean>()


  constructor() {
    effect(() => {
      // re-run once the people list is available so actor names can be resolved
      if (this.people().length === 0) return
      this.loadEvent() 
    })
    effect(() => this.modified.emit(this.isModified()))
  }

  private toLocalInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  private async loadEvent(): Promise<void> {
    const id = this.event()?.id
    if (!id) return
    const e = await this.dataService.loadEvent(id)
    this.eventForm.patchValue({
      owner: e.owner,
      type: e.type,
      name: e.name,
      description: e.description,
      reliability: e.reliability ?? this.reliabilityOptions.length,
      relevance: e.relevance,
      start: {
        date: this.toLocalInput(e.start_date),
        latitude: e.start_position?.latitude ? this.COORDS_FORMAT.format(e.start_position.latitude) : null,
        longitude: e.start_position?.longitude ? this.COORDS_FORMAT.format(e.start_position.longitude) : null,
        radius: e.start_position?.radius == null ? null : String(e.start_position?.radius),
      },
      end: {
        date: this.toLocalInput(e.end_date),
        latitude: e.end_position?.latitude ? this.COORDS_FORMAT.format(e.end_position.latitude) : null,
        longitude: e.end_position?.longitude ? this.COORDS_FORMAT.format(e.end_position.longitude) : null,
        radius: e.end_position?.radius == null ? null : String(e.end_position?.radius),
      },
    })

    if (this.event()?.id !== e.id) return

    // load persons
    this.nextActorRowId = 0
    const data = await this.dataService.loadEventActors(e)
    this.loadedEventActors = data.map(a => a.id)
    this.selectedActors.set(
      data
        .map(a => ({
          rowId: this.nextActorRowId++,
          personId: a.personId,
          personQuery: this.personName(a.personId),
          role: a.role,
        }))
        .sort((a, b) => this.personFullName(a.personId).localeCompare(this.personFullName(b.personId))),
    )

    this.sources = e.sources ?? []

    this.eventForm.markAsPristine()
  }

  userService = inject(UserProfileService)
  geoService = inject(GeoService)

  readonly relevanceOptions = RELEVANCE_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly reliabilityOptions = RELIABILITY_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly typeOptions: readonly EventType[] = EVENT_TYPES

  readonly isSaving = signal(false)
  readonly submitError = model('')

  // actors involved in the event
  readonly selectedActors = signal<SelectedActor[]>([{ rowId: 0, personId: '', personQuery: '', role: '' }])
  actorSelectionError = false
  actorRoleError = false
  private nextActorRowId = 1
  private loadedEventActors: string[] = []
  readonly newPersonOption = '__new_person__'
  readonly displayPerson = (person: Person | string | null): string => {
    if (person === this.newPersonOption) return ''
    if (typeof person === 'string') return person
    return person ? `${person.name} ${person.surname}` : ''
  }

  readonly eventForm = new FormGroup({
    owner: new FormControl(''),
    type: new FormControl<EventType | null>(null, Validators.required),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reliability: new FormControl(this.reliabilityOptions.length, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    relevance: new FormControl(this.relevanceOptions.length, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    start: new FormGroup({
      date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      latitude: new FormControl<string | null>(null, { nonNullable: false }),
      longitude: new FormControl<string | null>(null, { nonNullable: false }),
      radius: new FormControl<string | null>(null, { nonNullable: false }),
    }),
    end: new FormGroup({
      date: new FormControl('', { nonNullable: false }),
      latitude: new FormControl<string | null>(null, { nonNullable: false }),
      longitude: new FormControl<string | null>(null, { nonNullable: false }),
      radius: new FormControl<string | null>(null, { nonNullable: false }),
    }),
  })

  isModified = toSignal(this.eventForm.events.pipe(
      filter((event) => event instanceof PristineChangeEvent),
      map(event => !event.pristine),
      distinctUntilChanged()
    ), {initialValue: this.eventForm.dirty})

  isAdmin = () => this.userService.user().isAdmin()

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
        === `${person.name} ${person.surname}`.trim().toLocaleLowerCase()
  }

  addActor(): void {
    this.selectedActors.update(actors => [
      ...actors,
      { rowId: this.nextActorRowId++, personId: '', personQuery: '', role: '' },
    ])
    this.actorSelectionError = false
    this.actorRoleError = false
  }

  updateActorPersonQuery(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: '', personQuery: target.value }
        : actor,
    ))
    this.actorSelectionError = false
  }

  selectActorPerson(rowId: number, person: Person): void {
    if (!this.allPeople().some((currentPerson) => currentPerson.id === person.id)) return

    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: person.id, personQuery: this.personName(person.id) }
        : actor,
    ))
    this.actorSelectionError = false
    this.modified.emit(true)
  }

  removeActor(rowId: number): void {
    if (this.selectedActors().length <= 1) return

    this.selectedActors.update(actors => actors.filter((actor) => actor.rowId !== rowId))
    this.actorSelectionError = false
    this.actorRoleError = false
    this.modified.emit(true)
  }

  personName(personId: string): string {
    const person = this.allPeople().find((item) => item.id === personId)
    return person ? `${person.name} ${person.surname}` : ''
  }

  personFullName(personId: string): string {
    const person = this.allPeople().find((item) => item.id === personId)
    return person ? `${person.surname} ${person.name}` : ''
  } 

  addSource(): void {
    this.sources.push("")
    this.cannotAddSource.set(true)
  }

  cannotAddSource = signal(false)
  sourceError = -1
  cannotAddTrigger = () => {
      if (!this.sources.length) return false
      if (this.sources.some((s) => s === '')) return true
      if (this.sources.length > new Set(this.sources).size) return true
      return false
    }

  updateSource(i:number, event: Event): void {
    if (this.sources.length <= i) return
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    this.sources[i] = target.value
    this.cannotAddSource.update(this.cannotAddTrigger)
    this.modified.emit(true)
  }

  removeSource(i: number): void {
    this.sources.splice(i, 1)
    this.cannotAddSource.update(this.cannotAddTrigger)
    this.modified.emit(true)
  }

  applyGenerated(g: { [K in 'type' | 'name' | 'description' | 'start_date' | 'end_date' | 'start_position' | 'end_position' | 'reliability' | 'relevance' | 'sources']?: EventModel[K] | null }): void {
    const clamp = (n: number | null | undefined, def: number) =>
      n && n >= 1 && n <= 4 ? n : def
    const type = this.typeOptions.find(t => t === g.type) ?? null
    this.eventForm.patchValue({
      type,
      name: g.name ?? '',
      description: g.description ?? '',
      reliability: clamp(g.reliability, this.reliabilityOptions.length),
      relevance: clamp(g.relevance, this.relevanceOptions.length),
      start: {
        date: this.toLocalInput(g.start_date),
        latitude: g.start_position?.latitude ? this.COORDS_FORMAT.format(g.start_position.latitude) : null,
        longitude: g.start_position?.longitude ? this.COORDS_FORMAT.format(g.start_position.longitude) : null,
        radius: g.start_position?.latitude ? String(g.start_position?.radius || 0) : null,
      },
      end: {
        date: this.toLocalInput(g.end_date),
        latitude: g.end_position?.latitude ? this.COORDS_FORMAT.format(g.end_position.latitude) : null,
        longitude: g.end_position?.longitude ? this.COORDS_FORMAT.format(g.end_position.longitude) : null,
        radius: g.end_position?.latitude ? String(g.end_position?.radius || 0) : null,
      }
    })
    this.sources = g.sources ?? []
    this.modified.emit(true)
    this.eventForm.markAsTouched()
  }

  onPersonOptionSelected(rowId: number, value: Person | string): void {
    if (value !== this.newPersonOption) {
      this.selectActorPerson(rowId, value as Person)
      return
    }
    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId ? { ...actor, personId: '', personQuery: '' } : actor,
    ))
    this.openPersonDialog(rowId)
  }

  openPersonDialog(rowId: number): void {
    this.personDialogRowId = rowId
    this.personDialogOpen.set(true)
    this.dialogOpen.emit(true)
  }

  closePersonDialog(): void {
    this.personDialogOpen.set(false)
    this.personDialogRowId = null
    this.dialogOpen.emit(false)
  }

  onPersonCreated(person: Person): void {
    this.createdPeople.update(list => [...list, person])
    if (this.personDialogRowId !== null) this.selectActorPerson(this.personDialogRowId, person)
    this.closePersonDialog()
  }

  updateActorRole(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors.update(actors => actors.map((actor) =>
      actor.rowId === rowId ? { ...actor, role: target.value } : actor,
    ))
    this.actorRoleError = false
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

  async submitEvent(): Promise<void> {

    const user = this.userService.user()
    if (!user)
      return

    this.eventForm.markAllAsTouched()
    this.submitError.set('')
    this.actorSelectionError = this.selectedActors().length === 0
      || this.selectedActors().some((actor) => !this.isActorPersonValid(actor))

    if (this.eventForm.invalid) {
      this.submitError.set(
        this.isAdmin() && (
          this.eventForm.controls.reliability.invalid
          || this.eventForm.controls.relevance.invalid
        )
          ? 'Per attendibilità e rilevanza scegli un valore da 1 a 4.'
          : 'Completa tutti i campi obbligatori prima di salvare l’evento.',
      )
      return
    }

    if (this.actorSelectionError) {
      this.submitError.set(
        this.selectedActors().length === 0
          ? 'Seleziona almeno una persona coinvolta.'
          : this.selectedActors().some((actor) => this.isActorPersonValid(actor))
            ? 'Seleziona una persona in ogni riga.'
            : 'Seleziona una persona valida dall’elenco in ogni riga.',
      )
      return
    }

    this.actorRoleError = this.selectedActors().some((actor) => !actor.role.trim())
    if (this.actorRoleError) {
      this.submitError.set('Indica il ruolo per ogni persona selezionata.')
      return
    }

    this.sourceError = this.sources.findIndex((source) => !source.trim())
    if (this.sourceError !== -1) {
      this.submitError.set('Specifica la fonte per ogni riga.')
      return
    }

    const start = this.eventForm.controls.start.getRawValue()
    const end = this.eventForm.controls.end.getRawValue()
    const type = this.eventForm.controls.type.value

    if (!type) {
      this.submitError.set('Seleziona la tipologia dell’evento.')
      return
    }

    this.isSaving.set(true)

    const startPosition:Coordinates | null = start.latitude ? {
      latitude: Number(start.latitude),
      longitude: Number(start.longitude),
      radius: Number(start.radius),
    } : null

    const endPosition:Coordinates | null = end.latitude ? {
      latitude: Number(end.latitude),
      longitude: Number(end.longitude),
      radius: Number(end.radius),
    } : null

    if (type === 'Fatto' && !startPosition) {
      this.eventForm.controls.start.controls.latitude.setErrors({ required: true })
      this.submitError.set('Specifica la posizione di partenza per gli eventi di tipo "Fatto".')
      return
    }

    const payload = {
      id: this.event()?.id,
      owner: this.eventForm.controls.owner.value || user.getId(),
      type,
      name: this.eventForm.controls.name.value.trim(),
      description: this.eventForm.controls.description.value.trim(),
      start_date: new Date(start.date).toISOString(),
      end_date: end.date ? new Date(end.date).toISOString() : null,
      start_position: startPosition,
      end_position: endPosition,
      geoHash: this.geoService.computeGeoHash(
        this.geoService.computeCenterPosition(startPosition, endPosition)),
      sources: this.sources,
      reliability: this.isAdmin() ? this.eventForm.controls.reliability.value : 0,
      relevance: this.isAdmin() ? this.eventForm.controls.relevance.value : 0
    }

    try {
      
      const data = await this.dataService.saveEvent(payload, this.loadedEventActors, this.selectedActors())

      if (!payload.id && !user.isAdmin()) {
        this.userService.sendAdminEmail(
            `Evento creato: ${data.name} con id '${data.id}'`,
            `<p>Un nuovo evento <i>${data.name}</i> è stato creato con successo da <b>${user?.getName()} ${user?.getSurname()}</b>.</p>`)
      }

      this.saved.emit(this.eventMaskEvent())

    } catch (error) {
      console.error('Error saving Event', payload, error)
      const message = error instanceof Error ? error.message : 'Errore durante il salvataggio dell’evento.';
      this.submitError.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  async deleteEvent(): Promise<void> {
    const existingId = this.event()?.id
    if (!existingId) return

    //show confirm popup
    const confirmed = window.confirm('Sei sicuro di voler eliminare questo evento?')
    if (!confirmed) return

    this.isSaving.set(true)

    try {
      await this.dataService.deleteEvent(existingId, this.loadedEventActors)
      this.saved.emit(this.eventMaskEvent())
    } catch(error) {
      this.submitError.set('Errore durante l’eliminazione dell’evento! Contattare l’amministratore.')
    } finally {
      this.isSaving.set(false)
    }
  }

  readonly pickerTarget = signal<'start' | 'end' | null>(null)

  requestPosition(target: 'start' | 'end'): void {
    this.pickerTarget.set(target)
    this.dialogOpen.emit(true)
  }

  pickerInitialPosition(): Coordinates | null {
    const target = this.pickerTarget()
    if (!target) return null
    const value = this.eventForm.controls[target].getRawValue()
    return value.latitude != null && value.longitude != null
      ? { latitude: Number(value.latitude), longitude: Number(value.longitude), radius: Number(value.radius ?? 0) }
      : null
  }

  onPositionPicked(position: Coordinates): void {
    const target = this.pickerTarget()
    if (target) {
      this.eventForm.controls[target].patchValue({
        latitude: this.COORDS_FORMAT.format(position.latitude),
        longitude: this.COORDS_FORMAT.format(position.longitude),
        radius: String(position.radius),
      })
      this.eventForm.controls[target].markAsDirty()
    }
    this.pickerTarget.set(null)
    this.modified.emit(true)
    this.dialogOpen.emit(false)
  }

  cancelPosition(target: 'start' | 'end'): void {
    this.eventForm.controls[target].patchValue({
      latitude: null,
      longitude: null,
      radius: null,
    })
    this.eventForm.controls[target].markAsDirty()
    this.modified.emit(true)
  }

  closePicker(): void {
    this.pickerTarget.set(null)
    this.dialogOpen.emit(false)
  }

  // Trucco per chiudere il pannello dell'autocomplete dopo che l'input perde il focus
  closeAutocomplete(trigger: MatAutocompleteTrigger): void {
    setTimeout(() => trigger.closePanel(), 250)
  }
  
}
