import { Component, computed, inject, input, OnInit, output, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, PristineChangeEvent, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';

import type { Schema } from '../../../../amplify/data/resource';
import { DataService, type SelectedActor, type HypothesisActor } from '../../data.service';
import { GeoService } from '../../geo.service';
import { UserProfileService } from '../../user-profile.service';
import { MapPickerComponent } from '../../ui/map-picker/map-picker.component';
import { PersonDialogComponent } from '../../dashboard/person-popup/person-popup.component';
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component';

import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, distinctUntilChanged } from 'rxjs';

type Hypothesis = Schema['Hypothesis']['type']
type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

export interface HypothesisMaskEvent {
  hypothesis: Hypothesis
  personSaved: Person[]
  personDeleted: string[]
}

@Component({
  selector: 'app-hypothesis-mask',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MapPickerComponent, PersonDialogComponent, SplashDialogComponent],
  templateUrl: './hypothesis-mask.component.html',
  styleUrl: './hypothesis-mask.component.css',
})
export class HypothesisMaskComponent implements OnInit {

  private dataService = inject(DataService)
  private geoService = inject(GeoService)
  private userService = inject(UserProfileService)

  private readonly COORDS_FORMAT = new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })

  hypothesis = input<Hypothesis | null>(null)
  people = input<Person[]>([])
  eventId = input<string | null>(null)

  saved = output<HypothesisMaskEvent>()
  deleted = output<string>()
  modified = output<boolean>()

  @ViewChild('hypothesisSplash')
  private splash!: SplashDialogComponent

  // people created or updated from this mask
  private savedPeople = signal<Person[]>([])
  private deletedPersonIds = signal<string[]>([])
  readonly allPeople = computed(() => {
    const base = this.people()
    const saved = this.savedPeople()
    const deleted = new Set(this.deletedPersonIds())
    const savedMap = new Map(saved.map(p => [p.id, p]))
    return [
      ...base.filter(p => !deleted.has(p.id)).map(p => savedMap.get(p.id) || p),
      ...saved.filter(p => !base.some(b => b.id === p.id)),
    ]
  })

  readonly isSaving = signal(false)
  readonly submitError = signal('')
  readonly personDialogOpen = signal(false)

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    start: new FormGroup({
      date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      latitude: new FormControl<string | null>(null),
      longitude: new FormControl<string | null>(null),
      radius: new FormControl<string | null>(null),
    }),
    end: new FormGroup({
      date: new FormControl('', { nonNullable: false }),
      latitude: new FormControl<string | null>(null),
      longitude: new FormControl<string | null>(null),
      radius: new FormControl<string | null>(null),
    }),
  })

  isModified = toSignal(this.form.events.pipe(
    filter((event) => event instanceof PristineChangeEvent),
    map(event => !event.pristine),
    distinctUntilChanged(),
  ), { initialValue: this.form.dirty })

  // ── Actors ──
  readonly selectedActors = signal<SelectedActor[]>([{ rowId: 0, personId: '', personQuery: '', role: '' }])
  private nextActorRowId = 1
  private loadedActors: string[] = []
  actorSelectionError = false
  actorRoleError = false
  readonly newPersonOption = '__new_person__'
  private personDialogRowId: number | null = null

  // ── Sources ──
  sources: string[] = []
  cannotAddSource = signal(false)
  sourceError = -1

  // ── Map picker ──
  readonly pickerTarget = signal<'start' | 'end' | null>(null)

  readonly isAdmin = computed(() => this.userService.user().isAdmin())

  ngOnInit(): void {
    const h = this.hypothesis()
    if (h) {
      this.form.patchValue({
        name: h.name,
        description: h.description,
        start: h.startPosition ? {
          date: this.toLocalInput(h.startDate),
          latitude: this.COORDS_FORMAT.format(h.startPosition.latitude),
          longitude: this.COORDS_FORMAT.format(h.startPosition.longitude),
          radius: String(h.startPosition.radius),
        } : undefined,
        end: h.endPosition ? {
          date: this.toLocalInput(h.endDate),
          latitude: this.COORDS_FORMAT.format(h.endPosition.latitude),
          longitude: this.COORDS_FORMAT.format(h.endPosition.longitude),
          radius: String(h.endPosition.radius),
        } : undefined,
      })
      this.sources = h.sources ? [...h.sources] : []
      this.loadActors(h.id)
    }
  }

  private async loadActors(hypothesisId: string): Promise<void> {
    try {
      const actors = await this.dataService.loadHypothesisActors(hypothesisId)
      this.loadedActors = actors.map(a => a.id)
      this.selectedActors.set(
        actors.map(a => ({
          rowId: this.nextActorRowId++,
          personId: a.personId,
          personQuery: this.personName(a.personId),
          role: a.role,
        })),
      )
    } catch {
      // silently fail
    }
  }

  private toLocalInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // ── Person helpers ──
  readonly displayPerson = (person: Person | string | null): string => {
    if (person === this.newPersonOption) return ''
    if (typeof person === 'string') return person
    return person ? `${person.name} ${person.surname}` : ''
  }

  personName(personId: string): string {
    const person = this.allPeople().find(p => p.id === personId)
    return person ? `${person.name} ${person.surname}` : ''
  }

  filteredPeople(actor: SelectedActor): Person[] {
    const query = actor.personQuery.trim().toLocaleLowerCase()
    return this.allPeople().filter(person => {
      const alreadySelected = this.selectedActors().some(
        a => a.rowId !== actor.rowId && a.personId === person.id,
      )
      const name = `${person.name} ${person.surname}`.toLocaleLowerCase()
      return !alreadySelected && name.includes(query)
    })
  }

  isActorPersonValid(actor: SelectedActor): boolean {
    const person = this.allPeople().find(p => p.id === actor.personId)
    return !!person && actor.personQuery.trim().toLocaleLowerCase() === `${person.name} ${person.surname}`.trim().toLocaleLowerCase()
  }

  addActor(): void {
    this.selectedActors.update(actors => [...actors, { rowId: this.nextActorRowId++, personId: '', personQuery: '', role: '' }])
    this.actorSelectionError = false
    this.actorRoleError = false
  }

  updateActorPersonQuery(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    this.selectedActors.update(actors => actors.map(a =>
      a.rowId === rowId ? { ...a, personId: '', personQuery: target.value } : a,
    ))
    this.actorSelectionError = false
  }

  selectActorPerson(rowId: number, person: Person): void {
    if (!this.allPeople().some(p => p.id === person.id)) return
    this.selectedActors.update(actors => actors.map(a =>
      a.rowId === rowId ? { ...a, personId: person.id, personQuery: this.personName(person.id) } : a,
    ))
    this.actorSelectionError = false
    this.modified.emit(true)
  }

  removeActor(rowId: number): void {
    if (this.selectedActors().length <= 1) return
    this.selectedActors.update(actors => actors.filter(a => a.rowId !== rowId))
    this.actorSelectionError = false
    this.actorRoleError = false
    this.modified.emit(true)
  }

  updateActorRole(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    this.selectedActors.update(actors => actors.map(a =>
      a.rowId === rowId ? { ...a, role: target.value } : a,
    ))
    this.actorRoleError = false
  }

  onPersonOptionSelected(rowId: number, value: Person | string): void {
    if (value !== this.newPersonOption) {
      this.selectActorPerson(rowId, value as Person)
      return
    }
    this.selectedActors.update(actors => actors.map(a =>
      a.rowId === rowId ? { ...a, personId: '', personQuery: '' } : a,
    ))
    this.openPersonDialog(rowId)
  }

  // ── Person dialog ──
  openPersonDialog(rowId: number): void {
    const editPerson = this.allPeople().find(p =>
      this.selectedActors().find(a => a.rowId === rowId)?.personId === p.id,
    )
    this.editPerson.set(editPerson || null)
    this.personDialogRowId = rowId
    this.personDialogOpen.set(true)
  }

  closePersonDialog(): void {
    this.personDialogOpen.set(false)
    this.personDialogRowId = null
  }

  onPersonSaved(person: Person): void {
    this.savedPeople.update(list => {
      const existing = list.find(p => p.id === person.id)
      return existing ? list.map(p => p.id === person.id ? person : p) : [...list, person]
    })
    if (this.personDialogRowId !== null) this.selectActorPerson(this.personDialogRowId, person)
    this.closePersonDialog()
  }

  onPersonDeleted(personId: string): void {
    this.savedPeople.update(list => list.filter(p => p.id !== personId))
    this.deletedPersonIds.update(ids => ids.includes(personId) ? ids : [...ids, personId])
    this.selectedActors.update(actors => {
      const filtered = actors.filter(a => a.personId !== personId)
      return filtered.length ? filtered : [{ rowId: this.nextActorRowId++, personId: '', personQuery: '', role: '' }]
    })
    this.closePersonDialog()
  }

  editPerson = signal<Person | null>(null)

  // ── Sources ──
  private cannotAddTrigger = () => {
    if (!this.sources.length) return false
    if (this.sources.some(s => s === '')) return true
    if (this.sources.length > new Set(this.sources).size) return true
    return false
  }

  addSource(): void {
    this.sources.push('')
    this.cannotAddSource.update(this.cannotAddTrigger)
  }

  updateSource(i: number, event: Event): void {
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

  // ── Map picker ──
  requestPosition(target: 'start' | 'end'): void {
    this.pickerTarget.set(target)
  }

  pickerInitialPosition(): Coordinates | null {
    const target = this.pickerTarget()
    if (!target) return null
    const value = this.form.controls[target].getRawValue()
    return value.latitude != null && value.longitude != null
      ? { latitude: Number(value.latitude), longitude: Number(value.longitude), radius: Number(value.radius ?? 0) }
      : null
  }

  onPositionPicked(position: Coordinates): void {
    const target = this.pickerTarget()
    if (target) {
      this.form.controls[target].patchValue({
        latitude: this.COORDS_FORMAT.format(position.latitude),
        longitude: this.COORDS_FORMAT.format(position.longitude),
        radius: String(position.radius),
      })
      this.form.controls[target].markAsDirty()
    }
    this.pickerTarget.set(null)
    this.modified.emit(true)
  }

  cancelPosition(target: 'start' | 'end'): void {
    this.form.controls[target].patchValue({ latitude: null, longitude: null, radius: null })
    this.form.controls[target].markAsDirty()
    this.modified.emit(true)
  }

  closePicker(): void {
    this.pickerTarget.set(null)
  }

  closeAutocomplete(trigger: MatAutocompleteTrigger): void {
    setTimeout(() => trigger.closePanel(), 250)
  }

  // ── Submit ──
  async submit(): Promise<void> {
    this.form.markAllAsTouched()
    this.submitError.set('')

    if (this.form.invalid) {
      this.submitError.set('Compila tutti i campi obbligatori.')
      return
    }

    this.actorSelectionError = this.selectedActors().length === 0 || this.selectedActors().some(a => !this.isActorPersonValid(a))
    if (this.actorSelectionError) {
      this.submitError.set('Seleziona una persona valida in ogni riga.')
      return
    }

    this.actorRoleError = this.selectedActors().some(a => !a.role.trim())
    if (this.actorRoleError) {
      this.submitError.set('Indica il ruolo per ogni persona.')
      return
    }

    this.sourceError = this.sources.findIndex(s => !s.trim())
    if (this.sourceError !== -1) {
      this.submitError.set('Specifica la fonte per ogni riga.')
      return
    }

    const start = this.form.controls.start.getRawValue()
    const end = this.form.controls.end.getRawValue()

    if (!start.latitude) {
      this.submitError.set('Seleziona la posizione di partenza.')
      return
    }

    const payload = {
      ...(this.hypothesis()?.id ? { id: this.hypothesis()!.id } : {}),
      ...(this.eventId() ? { eventId: this.eventId() } : {}),
      name: this.form.controls.name.value.trim(),
      description: this.form.controls.description.value.trim(),
      startDate: new Date(this.form.controls.start.controls.date.value).toISOString(),
      endDate: this.form.controls.end.controls.date.value ? new Date(this.form.controls.end.controls.date.value).toISOString() : null,
      startPosition: start.latitude ? {
        latitude: Number(start.latitude),
        longitude: Number(start.longitude),
        radius: Number(start.radius),
      } : null,
      endPosition: end.latitude ? {
        latitude: Number(end.latitude),
        longitude: Number(end.longitude),
        radius: Number(end.radius),
      } : null,
      sources: this.sources.filter(s => s.trim()),
    }

    this.isSaving.set(true)
    try {
      const saved = await this.dataService.saveHypothesis(payload, this.loadedActors, this.selectedActors())
      this.loadedActors = []
      await this.splash.show(`Ipotesi ${this.hypothesis()?.id ? 'modificata' : 'creata'} con successo!`)
      this.saved.emit({
        hypothesis: saved,
        personSaved: this.savedPeople(),
        personDeleted: this.deletedPersonIds(),
      })
    } catch (e) {
      this.submitError.set(e instanceof Error ? e.message : 'Errore durante il salvataggio dell’ipotesi.')
    } finally {
      this.isSaving.set(false)
    }
  }

  async deleteHypothesis(): Promise<void> {
    const id = this.hypothesis()?.id
    if (!id) return
    if (!confirm('Sei sicuro di voler eliminare questa ipotesi?')) return

    this.isSaving.set(true)
    try {
      await this.dataService.deleteHypothesis(id, this.loadedActors)
      await this.splash.show('Ipotesi eliminata!')
      this.deleted.emit(id)
    } catch (e) {
      this.submitError.set(e instanceof Error ? e.message : 'Errore durante l’eliminazione.')
    } finally {
      this.isSaving.set(false)
    }
  }

  async submitForPublication(): Promise<void> {
    const id = this.hypothesis()?.id
    if (!id) return
    try {
      await this.dataService.submitPublicationRequest(id)
      await this.splash.show('Richiesta di pubblicazione inviata!')
    } catch (e) {
      this.submitError.set(e instanceof Error ? e.message : 'Errore durante l’invio della richiesta.')
    }
  }

}
