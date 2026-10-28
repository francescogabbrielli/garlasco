import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { MainComponent } from '../../main/main.component';
import { GoogleMap } from '@angular/google-maps';
import { generateClient } from 'aws-amplify/data';

import { Schema } from '../../../../amplify/data/resource';

import { UserProfileService } from '../../user-profile.service';
import { GeoService } from '../../geo.service';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

import { EventMaskComponent } from '../event-mask/event-mask.component';
import { TickbarComponent } from '../../ui/tickbar/tickbar.component';
import { PersonMarkerComponent } from '../../ui/person-marker/person-marker.component';

import { DEFAULT_COORDINATES } from '../../app.constants';

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']
type Person = Schema['Person']['type']

const client = generateClient<Schema>();

@Component({
  selector: 'app-event-popup',
  imports: [DatePipe, DecimalPipe, TickbarComponent, PersonMarkerComponent, EventMaskComponent, GoogleMap],
  templateUrl: './event-popup.component.html',
  styleUrl: './event-popup.component.css',
})
export class EventPopupComponent implements OnInit {

  private userService = inject(UserProfileService)
  private geoService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  main = inject(MainComponent)

  readonly submitError = signal('')
  readonly generating = signal(false)
  private mask = viewChild(EventMaskComponent)

  async generate(): Promise<void> {
    const description = prompt('Descrivi l\'evento da generare con IA')?.trim()
    if (!description) return
    this.generating.set(true)
    this.submitError.set('')
    try {
      this.main.isLoading.set(true)
      const { data, errors } = await client.queries.generateEvent({ description })
      console.error("AI ERROR?", errors)
      if (errors?.length || !data) throw new Error(errors?.[0]?.message ?? 'Nessun risultato')
      this.mask()?.applyGenerated(data)
    } catch (e) {
      this.submitError.set('Generazione evento non riuscita (' + (e instanceof Error ? e.message : String(e)) + ')')
    } finally {
      this.generating.set(false)
      this.main.isLoading.set(false)
    }
  }

  event = input.required<Event>()
  closed = output<void>()
  saved = output<void>()

  maskTouched = signal(false)
  dialogOpen = signal(false)

  isEditor = computed(() => {
    const edit = this.userService.user().editEnabled()
    const isOwner = this.userService.user().isMember() && this.userService.user().getId() === this.event().owner
    const isNew = !this.event().id
    return edit && (isOwner || isNew)
  })
  
  people = input.required<Person[]>()

  actors = signal<Person[]>([])
  personsLoading = signal(false)

  constructor() {
    effect(() => {
      const id = this.event().id
      this.loadPersons(id)
    })
  }

  private async loadPersons(eventId: string): Promise<void> {
    this.actors.set([])
    this.personsLoading.set(true)
    try {
      const { data } = await client.models.Event.get(
        { id: eventId },
        { selectionSet: ['id', 'actors.person.*'] }
      )
      if (this.event().id !== eventId) return
      this.actors.set(
        (data?.actors ?? []).map(a => a.person as Person).filter(p => !!p)
      )
    } catch (e) {
      console.error('Errore nel caricamento delle persone', e)
    } finally {
      if (this.event().id === eventId) this.personsLoading.set(false)
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mapLocation()) {
      this.mapClose()
      return
    }
    this.close(true)
  }

  close(disabledOnEdit = false) {
    // Quando l'utente può modificare, non chiude!
    if ((disabledOnEdit && this.userService.user().editEnabled()) && (this.maskTouched() || this.dialogOpen()))
      return

    if (!this.maskTouched() || confirm('Sei sicuro di voler chiudere? Potrebbero esserci modifiche non salvate.'))
      this.closed.emit()
  }


  /*********************** MAP PREVIEW  *************************/

  @ViewChild('mapDialog', { static: true })
  private mapDialog!: ElementRef<HTMLDialogElement>;

  async ngOnInit() {
    try {
      await this.mapsLoader.load()
      this.isMapReady.set(true)
    } catch {
      //this.mapError.set('Impossibile caricare Google Maps.')
    }
  }
  
  isMapReady = signal(false)

  mapLocation = signal<Coordinates | null>(null) // null means no map is visible

  mapId = window.__appConfig?.googleMapsMapId ?? 'DEMO_MAP_ID'
  mapOptions: google.maps.MapOptions = {
    isFractionalZoomEnabled: true,
    renderingType: 'VECTOR' as google.maps.RenderingType,
    center: { lat: DEFAULT_COORDINATES.latitude, lng: DEFAULT_COORDINATES.longitude },
    zoom: 15,
    disableDefaultUI: true,
    disableDoubleClickZoom: true,
    keyboardShortcuts: false,
    clickableIcons: false,
  }

  mapOpen(which: Coordinates) {
    this.mapLocation.set(which)
    this.mapDialog.nativeElement.showModal()
  }

  mapClose() {
    this.mapDialog.nativeElement.close()
  }

  mapReady(map: google.maps.Map) {
    const p = this.mapLocation()
    if (!p) return
    if (p.radius > 0) {
      map.fitBounds(this.geoService.toBounds(p), 0)
    } else {
      map.setCenter({ lat: p.latitude, lng: p.longitude })
      map.setZoom(16)
    }

  }

}
