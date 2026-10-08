import { CommonModule } from '@angular/common'
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject, input, output, signal } from '@angular/core'
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms'
import { generateClient } from 'aws-amplify/data'

import { EVENT_TYPES } from '../../../amplify/data/enums'
import type { Schema } from '../../../amplify/data/resource'

import { GeoService } from '../geo.service'
import { RELEVANCE_LABELS, RELIABILITY_LABELS, LABEL_MAP } from '../app.constants'
import { GoogleMapsLoaderService } from '../google-maps-loader.service'

type EventType = Schema['Event']['type']['type']

export type EventSubmitPayload = {
  owner: string
  type: EventType
  name: string
  description: string
  start_date: string
  end_date?: string | null
  start_position: {
    latitude: number
    longitude: number
    radius: number
  }
  end_position?: {
    latitude: number
    longitude: number
    radius: number
  } | null
  reliability?: number
  relevance?: number
}

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-submit-dialog.component.html',
  styleUrls: ['./event-submit-dialog.component.css']
})
export class EventSubmitDialogComponent implements OnChanges {
  ownerId = input('')
  isAdmin = input(false)
  closed = output<void>()

  mapsService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  readonly relevanceOptions = RELEVANCE_LABELS.map(LABEL_MAP).slice(1)
  readonly reliabilityOptions = RELIABILITY_LABELS.map(LABEL_MAP).slice(1)

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

  readonly eventForm = new FormGroup({
    owner: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    type: new FormControl<EventType | null>(null, Validators.required),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reliability: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(4)],
    }),
    relevance: new FormControl(1, {
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
      date: new FormControl('', { nonNullable: true }),
      latitude: new FormControl<number | null>(null, { nonNullable: false }),
      longitude: new FormControl<number | null>(null, { nonNullable: false }),
      radius: new FormControl<number | null>(null, { nonNullable: false }),
    }),
  })

  public createClient(): ReturnType<typeof generateClient<Schema>> {
    return generateClient<Schema>()
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.ownerId()) {
      this.eventForm.controls.owner.setValue(this.ownerId(), { emitEvent: false })
    }
  }

  async submitEvent(): Promise<void> {
    this.eventForm.markAllAsTouched()
    this.submitError.set('')

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

    const start = this.eventForm.controls.start.getRawValue()
    const end = this.eventForm.controls.end.getRawValue()
    const type = this.eventForm.controls.type.value

    if (!type) {
      this.submitError.set('Seleziona la tipologia dell’evento.')
      return
    }

    const payload: EventSubmitPayload = {
      owner: this.eventForm.controls.owner.value,
      type,
      name: this.eventForm.controls.name.value.trim(),
      description: this.eventForm.controls.description.value.trim(),
      start_date: start.date,
      end_date: end.date || null,
      start_position: {
        latitude: Number(start.latitude),
        longitude: Number(start.longitude),
        radius: Number(start.radius),
      },
      end_position: {
        latitude: Number(end.latitude),
        longitude: Number(end.longitude),
        radius: Number(end.radius),
      },
      reliability: this.isAdmin() ? this.eventForm.controls.reliability.value : 0,
      relevance: this.isAdmin() ? this.eventForm.controls.relevance.value : 0,
    }

    this.isSaving.set(true)

    try {

      const client = this.createClient()

      const { data, errors } = await client.models.Event.create({
        owner: payload.owner,
        type: payload.type,
        name: payload.name,
        description: payload.description,
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        start_position: payload.start_position,
        end_position: payload.end_position ?? null,
        //center_position: this.mapsService.computeCenterPosition(payload.start_position, payload.end_position),
        geoHash: this.mapsService.computeGeoHash(payload.start_position),
        reliability: payload.reliability ?? 0,
        relevance: payload.relevance ?? 0,
      })

      if (errors?.length || !data?.id) {
        const message = errors?.[0]?.message ?? 'Errore durante il salvataggio dell’evento.'
        this.submitError.set(message)
        return
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
        zoom: 13,
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
    } catch {
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
        this.mapsService.computeDistance(
          centerCoord, xy2coords(northEast.lat(), center.lng())),
        this.mapsService.computeDistance(
          centerCoord, xy2coords(southWest.lat(), center.lng())))
  
      const horizontalRadius = Math.min(
        this.mapsService.computeDistance(
          centerCoord, xy2coords(center.lat(), northEast.lng())),
        this.mapsService.computeDistance(
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
