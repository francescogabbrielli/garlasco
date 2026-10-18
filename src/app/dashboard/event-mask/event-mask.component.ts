import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete'
import { generateClient } from 'aws-amplify/data'

import { UserProfileService } from '../../user-profile.service'
import { GeoService } from '../../geo.service'

import { RELEVANCE_LABELS, RELIABILITY_LABELS, LABEL_MAP } from '../../app.constants'
import { EVENT_TYPES } from '../../../../amplify/data/enums'
import type { Schema } from '../../../../amplify/data/resource'

import { MapPickerComponent } from '../../ui/map-picker/map-picker.component'
import { PersonDialogComponent } from '../person-popup/person-popup.component'

type EventModel = Schema['Event']['type']
type EventType = Schema['Event']['type']['type']
type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

type SelectedActor = { 
  rowId: number;
  personId: string;
  personQuery: string;
  role: string
}

const client = generateClient<Schema>()

@Component({
  selector: 'app-event-mask',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MapPickerComponent, PersonDialogComponent],
  templateUrl: './event-mask.component.html',
  styleUrl: './event-mask.component.css',
})
export class EventMaskComponent {

  people = input<Person[]>([])
  event = input<EventModel | null>(null)
  saved = output<void>()
  personCreated = output<Person>()

  // people created from this mask, merged with the ones received as input
  private createdPeople = signal<Person[]>([])
  readonly allPeople = computed(() => {
    const base = this.people()
    return [...base, ...this.createdPeople().filter(p => !base.some(b => b.id === p.id))]
  })
  readonly personDialogOpen = signal(false)
  private personDialogRowId: number | null = null

  isHelpDialogOpen = model(false)
  isFormTouched = model(false)

  constructor() {
    effect(() => {
      // re-run once the people list is available so actor names can be resolved
      if (this.people().length === 0) return
      this.loadEvent()
      this.eventForm.events.subscribe((event) => this.isFormTouched.set(event.source.touched))
    })
  }

  private toLocalInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  private async loadEvent(): Promise<void> {
    const e = this.event()
    if (!e?.id) return
    this.eventForm.patchValue({
      owner: e.owner,
      type: e.type,
      name: e.name,
      description: e.description,
      reliability: e.reliability ?? this.reliabilityOptions.length,
      relevance: e.relevance,
      start: {
        date: this.toLocalInput(e.start_date),
        latitude: e.start_position.latitude,
        longitude: e.start_position.longitude,
        radius: e.start_position.radius,
      },
      end: {
        date: this.toLocalInput(e.end_date),
        latitude: e.end_position?.latitude ?? null,
        longitude: e.end_position?.longitude ?? null,
        radius: e.end_position?.radius ?? null,
      },
    })

    const { data } = await client.models.EventPerson.list({ filter: { eventId: { eq: e.id } } })
    if (this.event()?.id !== e.id) return
    this.existingActorIds = data.map(a => a.id)
    if (data.length) {
      this.nextActorRowId = data.length
      this.selectedActors = data.map((a, i) => ({
        rowId: i,
        personId: a.personId,
        personQuery: this.personName(a.personId),
        role: a.role,
      }))
    }
  }

  private existingActorIds: string[] = []

  userService = inject(UserProfileService)
  geoService = inject(GeoService)

  readonly relevanceOptions = RELEVANCE_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly reliabilityOptions = RELIABILITY_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly typeOptions: readonly EventType[] = EVENT_TYPES

  readonly isSaving = signal(false)
  readonly submitError = model('')

  // actors involved in the event
  selectedActors: SelectedActor[] = [{ rowId: 0, personId: '', personQuery: '', role: '' }]
  actorSelectionError = false
  actorRoleError = false
  private nextActorRowId = 1
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
      latitude: new FormControl<number | null>(null, { nonNullable: true, validators: [Validators.required] }),
      longitude: new FormControl<number | null>(null, { nonNullable: true }),
      radius: new FormControl<number | null>(null, { nonNullable: true }),
    }),
    end: new FormGroup({
      date: new FormControl('', { nonNullable: false }),
      latitude: new FormControl<number | null>(null, { nonNullable: false }),
      longitude: new FormControl<number | null>(null, { nonNullable: false }),
      radius: new FormControl<number | null>(null, { nonNullable: false }),
    }),
  })

  isAdmin = () => this.userService.user().isAdmin()

  filteredPeople(actor: SelectedActor): Person[] {
    const query = actor.personQuery.trim().toLocaleLowerCase()
    return this.allPeople().filter((person) => {
      const alreadySelected = this.selectedActors.some(
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
    this.selectedActors = [
      ...this.selectedActors,
      { rowId: this.nextActorRowId++, personId: '', personQuery: '', role: '' },
    ]
    this.actorSelectionError = false
    this.actorRoleError = false
  }

  updateActorPersonQuery(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors = this.selectedActors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: '', personQuery: target.value }
        : actor,
    )
    this.actorSelectionError = false
  }

  selectActorPerson(rowId: number, person: Person): void {
    if (!this.allPeople().some((currentPerson) => currentPerson.id === person.id)) return

    this.selectedActors = this.selectedActors.map((actor) =>
      actor.rowId === rowId
        ? { ...actor, personId: person.id, personQuery: this.personName(person.id) }
        : actor,
    )
    this.actorSelectionError = false
  }

  removeActor(rowId: number): void {
    if (this.selectedActors.length <= 1) return

    this.selectedActors = this.selectedActors.filter((actor) => actor.rowId !== rowId)
    this.actorSelectionError = false
    this.actorRoleError = false
  }

  personName(personId: string): string {
    const person = this.allPeople().find((item) => item.id === personId)
    return person ? `${person.name} ${person.surname}` : ''
  }

  applyGenerated(g: { [K in 'type' | 'name' | 'description' | 'start_date' | 'end_date' | 'start_position' | 'end_position' | 'reliability' | 'relevance']?: EventModel[K] | null }): void {
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
        latitude: g.start_position?.latitude ?? null,
        longitude: g.start_position?.longitude ?? null,
        radius: g.start_position?.radius ?? null,
      },
      end: {
        date: this.toLocalInput(g.end_date),
        latitude: g.end_position?.latitude ?? null,
        longitude: g.end_position?.longitude ?? null,
        radius: g.end_position?.radius ?? null,
      },
    })
    this.eventForm.markAsTouched()
    this.isFormTouched.set(true)
  }

  onPersonOptionSelected(rowId: number, value: Person | string): void {
    if (value !== this.newPersonOption) {
      this.selectActorPerson(rowId, value as Person)
      return
    }
    this.selectedActors = this.selectedActors.map((actor) =>
      actor.rowId === rowId ? { ...actor, personId: '', personQuery: '' } : actor,
    )
    this.openPersonDialog(rowId)
  }

  openPersonDialog(rowId: number): void {
    this.personDialogRowId = rowId
    this.personDialogOpen.set(true)
  }

  closePersonDialog(): void {
    this.personDialogOpen.set(false)
    this.personDialogRowId = null
  }

  onPersonCreated(person: Person): void {
    this.createdPeople.update(list => [...list, person])
    if (this.personDialogRowId !== null) this.selectActorPerson(this.personDialogRowId, person)
    this.personCreated.emit(person)
    this.closePersonDialog()
  }

  updateActorRole(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors = this.selectedActors.map((actor) =>
      actor.rowId === rowId ? { ...actor, role: target.value } : actor,
    )
    this.actorRoleError = false
  }

  private logInvalidControls() {
    const controls = this.eventForm.controls
    Object.keys(controls).forEach(key => {
      // Usiamo il casting "as keyof typeof controls" per rassicurare TypeScript
      const control = controls[key as keyof typeof controls];
      
      if (control.invalid) {
        console.log(`Campo invalido: ${key}`, control.errors);
      }
    })
  }

  async submitEvent(): Promise<void> {

    this.eventForm.markAllAsTouched()
    this.submitError.set('')
    this.actorSelectionError = this.selectedActors.length === 0
      || this.selectedActors.some((actor) => !this.isActorPersonValid(actor))

    if (this.eventForm.invalid) {
      this.submitError.set(
        this.isAdmin() && (
          this.eventForm.controls.reliability.invalid
          || this.eventForm.controls.relevance.invalid
        )
          ? 'Per attendibilità e rilevanza scegli un valore da 1 a 4.'
          : 'Completa tutti i campi obbligatori prima di salvare l’evento.',
      )
      this.logInvalidControls()
      return
    }

    if (this.actorSelectionError) {
      this.submitError.set(
        this.selectedActors.length === 0
          ? 'Seleziona almeno una persona coinvolta.'
          : this.selectedActors.some((actor) => this.isActorPersonValid(actor))
            ? 'Seleziona una persona in ogni riga.'
            : 'Seleziona una persona valida dall’elenco in ogni riga.',
      )
      return
    }

    this.actorRoleError = this.selectedActors.some((actor) => !actor.role.trim())
    if (this.actorRoleError) {
      this.submitError.set('Indica il ruolo per ogni persona selezionata.')
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

    try {

      const startPosition:Coordinates = {
        latitude: Number(start.latitude),
        longitude: Number(start.longitude),
        radius: Number(start.radius),
      }

      const endPosition:Coordinates | null = end.latitude ? {
        latitude: Number(end.latitude),
        longitude: Number(end.longitude),
        radius: Number(end.radius),
      } : null

      const payload = {
        owner: this.eventForm.controls.owner.value || this.userService.user().getId(),
        type,
        name: this.eventForm.controls.name.value.trim(),
        description: this.eventForm.controls.description.value.trim(),
        start_date: new Date(start.date).toISOString(),
        end_date: end.date ? new Date(end.date).toISOString() : null,
        start_position: startPosition,
        end_position: endPosition,
        geoHash: this.geoService.computeGeoHash(
          this.geoService.computeCenterPosition(startPosition, endPosition)),
        reliability: this.isAdmin() ? this.eventForm.controls.reliability.value : 0,
        relevance: this.isAdmin() ? this.eventForm.controls.relevance.value : 0,
      }

      const existingId = this.event()?.id
      const { data, errors } = existingId
        ? await client.models.Event.update({ id: existingId, ...payload })
        : await client.models.Event.create(payload)

      if (errors?.length || !data?.id) {
        console.error('Error saving Event', payload, errors)
        this.submitError.set('Errore durante il salvataggio dell’evento! Contattare l’amministratore.')
        return
      }

      // refresh associated actors
      if (existingId) {
        for (const id of this.existingActorIds) {
          await client.models.EventPerson.delete({ id })
        }
        this.existingActorIds = []
      }

      for (const actor of this.selectedActors) {
        const { errors: actorErrors } = await client.models.EventPerson.create({
          eventId: data.id,
          eventName: data.name,
          eventStartDate: data.start_date,
          eventGeoHash: data.geoHash,
          personId: actor.personId,
          role: actor.role.trim(),
        })
        if (actorErrors?.length) {
          this.submitError.set(`L’evento è stato creato, ma non è stato possibile associare ${this.personName(actor.personId)}: ${actorErrors[0].message}`)
          return
        }
      }

      this.saved.emit()

    // } catch (error) {
      // const message = error instanceof Error ? error.message : 'Errore durante il salvataggio dell’evento.';
      // this.submitError.set(message);
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
      const { errors } = await client.models.Event.delete({ id: existingId })
      if (errors?.length) {
        console.error('Error deleting Event', errors)
        this.submitError.set('Errore durante l’eliminazione dell’evento! Contattare l’amministratore.')
        return
      }
      //TODO: gestire eventuali errori durante l'eliminazione degli attori associati all'evento
      for (const id of this.existingActorIds) {
        await client.models.EventPerson.delete({ id })
      }
      this.saved.emit()
    } finally {
      this.isSaving.set(false)
    }
  }

  readonly pickerTarget = signal<'start' | 'end' | null>(null)

  requestPosition(target: 'start' | 'end'): void {
    this.pickerTarget.set(target)
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
        latitude: position.latitude,
        longitude: position.longitude,
        radius: position.radius,
      })
      this.eventForm.controls[target].markAsDirty()
    }
    this.pickerTarget.set(null)
  }

  closePicker(): void {
    this.pickerTarget.set(null)
  }
  
  openHelpDialog(): void {
    this.isHelpDialogOpen.set(true)
  }

  closeHelpDialog(): void {
    this.isHelpDialogOpen.set(false)
  }

  // Trucco per chiudere il pannello dell'autocomplete dopo che l'input perde il focus
  closeAutocomplete(trigger: MatAutocompleteTrigger): void {
    setTimeout(() => trigger.closePanel(), 250)
  }
}
