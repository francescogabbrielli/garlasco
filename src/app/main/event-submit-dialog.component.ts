import { CommonModule } from '@angular/common'
import { Component, ElementRef, OnInit, ViewChild, inject, input, output, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { MatAutocompleteModule } from '@angular/material/autocomplete'
import { generateClient } from 'aws-amplify/data'

import { EVENT_TYPES } from '../../../amplify/data/enums'
import type { Schema } from '../../../amplify/data/resource'

import { GeoService } from '../geo.service'
import { RELEVANCE_LABELS, RELIABILITY_LABELS, LABEL_MAP } from '../app.constants'
import { GoogleMapsLoaderService } from '../google-maps-loader.service'

type EventType = Schema['Event']['type']['type']
type PersonRecord = Schema['Person']['type']
type Coordinates = Schema['Coordinates']['type']
type SelectedActor = { rowId: number; personId: string; personQuery: string; role: string }

declare global {
  interface Window {
    __appConfig?: {
      googleMapsApiKey?: string;
      googleMapsMapId?: string;
    }
  }
}

@Component({
  selector: 'app-event-submit-dialog',
  standalone: true,
  imports: [CommonModule, MatAutocompleteModule, ReactiveFormsModule],
  templateUrl: './event-submit-dialog.component.html',
  styleUrls: ['./event-submit-dialog.component.css']
})
export class EventSubmitDialogComponent implements OnInit {
  
  ownerId = input.required()
  isAdmin = input(false)
  closed = output<void>()

  geoService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  readonly relevanceOptions = RELEVANCE_LABELS.map(LABEL_MAP).slice(1).reverse()
  readonly reliabilityOptions = RELIABILITY_LABELS.map(LABEL_MAP).slice(1).reverse()

  readonly isSaving = signal(false)
  readonly submitError = signal('')
  readonly typeOptions: readonly EventType[] = EVENT_TYPES
  isMapPickerOpen = false
  isMapReady = false
  mapError = ''
  mapPickerTarget: 'start' | 'end' | null = null
  private mapSelection: google.maps.LatLngLiteral | null = null
  private hasPreciseMapSelection = false
  private map?: google.maps.Map
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLDivElement>

  isHelpDialogOpen = false
  people: PersonRecord[] = []
  peopleLoading = true
  peopleLoadError = ''
  selectedActors: SelectedActor[] = [{ rowId: 0, personId: '', personQuery: '', role: '' }]
  actorSelectionError = false
  actorRoleError = false
  private nextActorRowId = 1

  readonly displayPerson = (person: PersonRecord | string | null): string => {
    if (typeof person === 'string') return person
    return person ? `${person.name} ${person.surname}` : ''
  }

  readonly eventForm = new FormGroup({
    owner: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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

  public createClient(): ReturnType<typeof generateClient<Schema>> {
    return generateClient<Schema>()
  }

  async ngOnInit(): Promise<void> {
    try {
      const { data, errors } = await this.createClient().models.Person.list()
      if (errors?.length) {
        throw new Error(errors[0].message)
      }
      this.people = data.sort((a, b) =>
        a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name),
      ) ?? []
    } catch (error) {
      this.peopleLoadError = error instanceof Error
        ? `Impossibile caricare le persone: ${error.message}`
        : 'Impossibile caricare le persone.'
    } finally {
      this.peopleLoading = false
    }
  }

  filteredPeople(actor: SelectedActor): PersonRecord[] {
    const query = actor.personQuery.trim().toLocaleLowerCase()
    return this.people.filter((person) => {
      const alreadySelected = this.selectedActors.some(
        (selectedActor) => selectedActor.rowId !== actor.rowId && selectedActor.personId === person.id,
      )
      const name = `${person.name} ${person.surname}`.toLocaleLowerCase()
      return !alreadySelected && name.includes(query)
    })
  }

  isActorPersonValid(actor: SelectedActor): boolean {
    const person = this.people.find((item) => item.id === actor.personId)
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

  selectActorPerson(rowId: number, person: PersonRecord): void {
    if (!this.people.some((currentPerson) => currentPerson.id === person.id)) return

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
    const person = this.people.find((item) => item.id === personId)
    return person ? `${person.name} ${person.surname}` : ''
  }

  updateActorRole(rowId: number, event: Event): void {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return

    this.selectedActors = this.selectedActors.map((actor) =>
      actor.rowId === rowId ? { ...actor, role: target.value } : actor,
    )
    this.actorRoleError = false
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

      const client = this.createClient()

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
        owner: this.eventForm.controls.owner.value,
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

      const { data, errors } = await client.models.Event.create(payload)

      if (errors?.length || !data?.id) {
        console.error('Error creating Event', payload, errors)
        this.submitError.set('Errore durante il salvataggio dell’evento! Contattare l’amministratore.')
        return
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

      this.closeDialog()

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore durante il salvataggio dell’evento.';
      this.submitError.set(message);
    } finally {
      this.isSaving.set(false);
    }
  }

  closeDialog(): void {
    this.closeMapPicker();
    this.closed.emit();
  }

  requestPosition(target: 'start' | 'end'): void {
    this.mapPickerTarget = target;
    this.mapError = '';
    this.mapSelection = null;
    this.hasPreciseMapSelection = false;
    this.isMapReady = false;
    this.isMapPickerOpen = true;
    setTimeout(() => void this.initializeMap(), 0);
  }

  closeMapPicker(): void {
    this.isMapPickerOpen = false;
    this.isMapReady = false;
    this.mapPickerTarget = null;
    this.map = undefined;
    this.mapSelection = null;
    this.hasPreciseMapSelection = false;
  }

  confirmMapSelection(): void {
    if (!this.mapPickerTarget || !this.map) {
      return;
    }

    const center = this.mapSelection ?? this.map.getCenter();
    if (!center) {
      return;
    }

    const latitude = typeof center.lat === 'function' ? center.lat() : center.lat;
    const longitude = typeof center.lng === 'function' ? center.lng() : center.lng;
    const positionGroup = this.mapPickerTarget === 'start'
      ? this.eventForm.controls.start
      : this.eventForm.controls.end;
    const radius = this.hasPreciseMapSelection ? 0 : this.getMapRadiusMeters();
    positionGroup.patchValue({ latitude, longitude, radius });
    this.closeMapPicker();
  }

  private async initializeMap(): Promise<void> {
    const apiKey = window.__appConfig?.googleMapsApiKey;

    if (!apiKey || !this.mapCanvas) {
      this.mapError = 'Configura GOOGLE_MAPS_API_KEY per visualizzare la mappa.';
      return;
    }

    try {
      await this.mapsLoader.load();

      if (!this.mapCanvas || !this.isMapPickerOpen) {
        return;
      }

      const garlasco = { lat: 45.1974, lng: 8.9247 };
      this.map = new google.maps.Map(this.mapCanvas.nativeElement, {
        center: garlasco,
        zoom: 14,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      this.isMapReady = true;
      this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          this.selectMapPosition(event.latLng.lat(), event.latLng.lng());
        }
      });
    } catch (err) {
      console.error('Error loading Google Maps:', err);
      this.mapError = 'Impossibile caricare Google Maps.';
    }
  }

  private selectMapPosition(latitude: number, longitude: number): void {
    this.mapSelection = { lat: latitude, lng: longitude };
    this.hasPreciseMapSelection = true;
    this.map?.panTo(this.mapSelection);
  }

  private getMapRadiusMeters(): number {
    if (!this.map)
      return 0

    const center = this.map.getCenter();
    const bounds = this.map.getBounds();

    if (!center)
      return 0

    const xy2coords = (x: number, y: number) => {
      return { latitude: x, longitude: y, radius: 0 }
    }
    
    const centerCoord = xy2coords(center.lat(), center.lng())

    if (center && bounds) {
      const northEast = bounds.getNorthEast()
      const southWest = bounds.getSouthWest()
  
      const verticalRadius = Math.min(
        this.geoService.computeDistance(
          centerCoord, xy2coords(northEast.lat(), center.lng())),
        this.geoService.computeDistance(
          centerCoord, xy2coords(southWest.lat(), center.lng())))
  
      const horizontalRadius = Math.min(
        this.geoService.computeDistance(
          centerCoord, xy2coords(center.lat(), northEast.lng())),
        this.geoService.computeDistance(
          centerCoord, xy2coords(center.lat(), southWest.lng())))

      return Math.round(Math.min(verticalRadius, horizontalRadius))
    }

    const zoom = this.map.getZoom() ?? 13
    const latitude = center?.lat() ?? 45.1974
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom
    const mapElement = this.map.getDiv()
    return Math.round(Math.min(mapElement.clientWidth, mapElement.clientHeight) * metersPerPixel / 2)
  }

  openHelpDialog(): void {
    this.isHelpDialogOpen = true
  }

  closeHelpDialog(): void {
    this.isHelpDialogOpen = false
  }
}
