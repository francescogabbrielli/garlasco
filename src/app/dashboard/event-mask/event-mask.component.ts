import { Component, computed, effect, inject, input, model, output, signal, ViewChild } from '@angular/core'
import { FormControl, FormGroup, PristineChangeEvent, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatAutocompleteModule } from '@angular/material/autocomplete'

import { DataService } from '../../data.service'
import { GeoService } from '../../geo.service'

import { RELEVANCE_LABELS, RELIABILITY_LABELS, LABEL_MAP } from '../../app.constants'
import { EVENT_TYPES } from '../../../../amplify/data/enums'
import type { Schema } from '../../../../amplify/data/resource'

import { MapPickerComponent } from '../../ui/map-picker/map-picker.component'
import { PersonDialogComponent } from '../../forms/person-popup/person-popup.component'
import { SplashDialogComponent } from '../../ui/splash-dialog/splash-dialog.component'

import { CaseMaskComponent, PersonCaseEvent } from '../../forms/case-mask/case-mask.component'
import { ClientErrorService } from '../../client-error.service'

type EventModel = Schema['Event']['type']
type EventType = Schema['Event']['type']['type']
type Person = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']

@Component({
  selector: 'app-event-mask',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MapPickerComponent, PersonDialogComponent, SplashDialogComponent],
  templateUrl: './event-mask.component.html',
  styleUrls: ['../../forms/case-mask/case-mask.component.css', './event-mask.component.css'],
})
export class EventMaskComponent extends CaseMaskComponent {

  private readonly dataService = inject(DataService)
  private readonly logService = inject(ClientErrorService)

  people = input<Person[]>([])
  event = input<EventModel | null>(null)
  saved = output<PersonCaseEvent>()
  modified = output<boolean>()

  submitError = model('')

  @ViewChild('eventSplash')
  private splash!: SplashDialogComponent

  constructor() {
    super()
    const delayed = effect(() => {
      // re-run once the people list is available so actor names can be resolved
      if (this.people().length === 0) return
      this.loadEvent() 
      delayed.destroy()
    })
  }

  loadedEventActors = [] as string[]
  override allPeople = computed(() => {
    const base = this.people()
    const saved = this.savedPeople()
    const deleted = new Set(this.deletedPeopleIds())
    const savedMap = new Map(saved.map(p => [p.id, p]))
    return [
      ...base.filter(p => !deleted.has(p.id)).map(p => savedMap.get(p.id) || p),
      ...saved.filter(p => !base.some(b => b.id === p.id)),
    ]
  })

  override getForm(): FormGroup {
    return this.eventForm
  }

  override setError(message:string): void {
    this.submitError.set(message)
  }

  override showSplash(message: string): void {
    this.splash.show(message)
  }

  override maskModified(val: boolean): void {
    this.modified.emit(val)
  }

  private async loadEvent(): Promise<void> {
    const id = this.event()?.id    
    if (!id) return this.loadingComplete()
    const e = await this.dataService.getEvent(id)
    this.eventForm.patchValue({
      owner: e.owner,
      type: e.type,
      name: e.name,
      description: e.description,
      start: {
        date: this.dateToLocalInput(e.startDate),
        latitude: e.startPosition?.latitude ? this.COORDS_FORMAT.format(e.startPosition.latitude) : null,
        longitude: e.startPosition?.longitude ? this.COORDS_FORMAT.format(e.startPosition.longitude) : null,
        radius: e.startPosition?.radius == null ? null : String(e.startPosition?.radius),
      },
      end: {
        date: this.dateToLocalInput(e.endDate),
        latitude: e.endPosition?.latitude ? this.COORDS_FORMAT.format(e.endPosition.latitude) : null,
        longitude: e.endPosition?.longitude ? this.COORDS_FORMAT.format(e.endPosition.longitude) : null,
        radius: e.endPosition?.radius == null ? null : String(e.endPosition?.radius),
      },
      reliability: e.reliability ?? this.reliabilityOptions.length,
      relevance: e.relevance || 0,
      coldCase: e.coldCase ? true : false
    })

    if (this.event()?.id !== e.id) return

    // load persons
    this.actorStatus.nextRowId = 0
    const data = await this.dataService.loadEventActors(e)
    this.loadedEventActors = data.map(a => a.id)
    this.selectedActors.set(
      data
        .map(a => ({
          rowId: this.actorStatus.nextRowId++,
          personId: a.personId,
          personQuery: this.personName(a.personId),
          role: a.role,
        }))
        .sort((a, b) => this.personFullName(a.personId).localeCompare(this.personFullName(b.personId))),
    )

    this.sources.set(e.sources ?? [])
    
    this.loadingComplete()
  }

  geoService = inject(GeoService)

  readonly relevanceOptions = RELEVANCE_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly reliabilityOptions = RELIABILITY_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly typeOptions: readonly EventType[] = EVENT_TYPES

  readonly eventForm = new FormGroup({
    owner: new FormControl(''),
    type: new FormControl<EventType | null>(null, Validators.required),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
    reliability: new FormControl(this.reliabilityOptions.length, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    relevance: new FormControl(this.relevanceOptions.length, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    coldCase: new FormControl(false, { nonNullable: true })
  })

  readonly isSaving = signal(false)

  applyGenerated(g: { [K in 'type' | 'name' | 'description' | 'startDate' | 'endDate' | 'startPosition' | 'endPosition' | 'reliability' | 'relevance' | 'sources']?: EventModel[K] | null }): void {
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
        date: this.dateToLocalInput(g.startDate),
        latitude: g.startPosition?.latitude ? this.COORDS_FORMAT.format(g.startPosition.latitude) : null,
        longitude: g.startPosition?.longitude ? this.COORDS_FORMAT.format(g.startPosition.longitude) : null,
        radius: g.startPosition?.latitude ? String(g.startPosition?.radius || 0) : null,
      },
      end: {
        date: this.dateToLocalInput(g.endDate),
        latitude: g.endPosition?.latitude ? this.COORDS_FORMAT.format(g.endPosition.latitude) : null,
        longitude: g.endPosition?.longitude ? this.COORDS_FORMAT.format(g.endPosition.longitude) : null,
        radius: g.endPosition?.latitude ? String(g.endPosition?.radius || 0) : null,
      }
    })
    this.sources.set(g.sources ?? [])
    this.maskModified(true)
    this.eventForm.markAsTouched()
  }
  
  async submitEvent(): Promise<void> {

    const user = this.userService.user()
    if (!user) return
    if (!super.checkForm()) return

    const start = this.eventForm.controls.start.getRawValue()
    const end = this.eventForm.controls.end.getRawValue()
    const type = this.eventForm.controls.type.value

    if (!type) {
      this.setError('Seleziona la tipologia dell’evento.')
      return
    }

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
      this.setError('Specifica la posizione di partenza per gli eventi di tipo "Fatto".')
      return
    }

    const payload = {
      id: this.event()?.id,
      owner: this.eventForm.controls.owner.value || user.getId(),
      type,
      name: this.eventForm.controls.name.value.trim(),
      description: this.eventForm.controls.description.value.trim(),
      startDate: new Date(start.date).toISOString(),
      endDate: end.date ? new Date(end.date).toISOString() : null,
      startPosition: startPosition,
      endPosition: endPosition,
      geoHash: this.geoService.computeGeoHash(
        this.geoService.computeCenterPosition(startPosition, endPosition)),
      sources: this.sources(),
      reliability: this.isAdmin() ? this.eventForm.controls.reliability.value : 0,
      relevance: this.isAdmin() ? this.eventForm.controls.relevance.value : 0,
      coldCase: this.isAdmin() ? (this.eventForm.controls.coldCase.value ? 'true' : null) : undefined
    }

    this.isSaving.set(true)

    try {
      
      const data = await this.dataService.saveEvent(payload, this.loadedEventActors, this.selectedActors())

      if (!payload.id && !this.isAdmin()) {
        this.userService.sendAdminEmail(
            `Evento creato: ${data.name} con id '${data.id}'`,
            `<p>Un nuovo evento <i>${data.name}</i> è stato creato con successo da <b>${user?.getFullName()}</b>.</p>`)
      }

      this.splash
        .show("Evento " + (payload.id ? "modificato" : "creato")  + " con successo!")
        .finally(() => this.saved.emit(this.personCaseEvent()))

    } catch (error) {
      console.error('Error saving Event', payload, error)
      const message = error instanceof Error ? error.message : 'Errore durante il salvataggio dell’evento.';
      this.setError(message)
      this.logService.report(error)
    } finally {
      this.isSaving.set(false)
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
      await this.splash.show("Evento eliminato!")
      this.saved.emit(this.personCaseEvent())
    } catch(error) {
      this.submitError.set('Errore durante l’eliminazione dell’evento! Contattare l’amministratore.')
      this.logService.report(error)
    } finally {
      this.isSaving.set(false)
    }
  }

}
