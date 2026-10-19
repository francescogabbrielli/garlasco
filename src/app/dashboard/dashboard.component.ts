import { Component, signal, effect, OnInit, inject, computed, Signal } from '@angular/core';
import { DataService } from '../data.service';
import { GeoService } from '../geo.service';

import { DEFAULT_COORDINATES } from '../app.constants';
import { Schema } from '../../../amplify/data/resource';
import { generateClient } from 'aws-amplify/api';

import { PersonFilterComponent } from './person-filter/person-filter.component';
import { EventListComponent } from './event-list/event-list.component';
import { MapFilterComponent } from './map-filter/map-filter.component';
import { TimelineSliderComponent } from '../ui/timeline-slider/timeline-slider.component';
import { EventPopupComponent } from './event-popup/event-popup.component';
import { UserProfileService } from '../user-profile.service';

import { MainComponent } from '../main/main.component';
import { toObservable } from '@angular/core/rxjs-interop';

const client = generateClient<Schema>()

type Person = Schema['Person']['type']
type Event = Schema['Event']['type']
type Coordinates = Schema['Coordinates']['type']

type Filter = {
  personIds: string[],
  interval: {from: Date, to: Date, min: Date, max: Date},
  bounds: Coordinates,
  showTimeline: boolean,
  showMap: boolean
}

@Component({
  selector: 'app-dashboard',
  imports: [PersonFilterComponent, TimelineSliderComponent, MapFilterComponent, EventListComponent, EventPopupComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  protected dataService = inject(DataService)
  protected geoService = inject(GeoService)
  protected userService = inject(UserProfileService)

  protected mainComponent = inject(MainComponent)

  readonly MAX_DATE = new Date()
  readonly MIN_DATE = new Date(2007, 1, 1)

  private readonly STORAGE_FILTERS = 'dashboard_filters'

  // L'unico accumulatore locale per Mappa + Lista
  events = signal<Event[]>([])

  // Solo fatti
  facts = computed<Event[]>(() => this.events().filter(e => e.type === "Fatto"))

  readonly defaultFilters:Filter = {
    personIds: [],
    interval: {
      from: new Date("2007-07-15T00:00"),
      to: new Date("2007-08-14T23:59"),
      min: new Date("2007-07-01T00:00"),
      max: new Date("2007-08-31T23:59")
    },
    bounds: DEFAULT_COORDINATES,
    showTimeline: true,
    showMap: true
  }

  currentFilters!: Filter

  showTimeline = signal( true )
  showMap = signal( true )
  private initialized = false

  // People are loaded once here and shared with the filter and the map
  people = signal<Person[]>([])
  peopleLoading = signal(true)
  peopleError = signal('')
  selectedIds = signal<string[]>([])
  hoveredEventId = signal<string | null>(null)
  openedEvent = signal<Event | null>(null)

  openEventById(id: string): void {
    const event = this.events().find(e => e.id === id)
    if (event) this.openedEvent.set(event)
  }

  createNewEvent(): void { 
    this.openedEvent.set({owner: this.userService.user().getId()} as Event)
  }

  private async loadPeople(): Promise<void> {
    try {
      const response = await client.models.Person.list()
      this.people.set(response.data
        .sort((a, b) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name)) 
        ?? [])
    } catch {
      this.peopleError.set('Impossibile caricare le persone.')
    } finally {
      this.peopleLoading.set(false)
    }
  }

  constructor() {
    // Sincronizziamo il Signal 'getEvents' del Service con il nostro accumulatore locale.
    // Ogni volta che il Service completa il debounce e lo switchMap, resetta l'array iniziale.
    effect(() => this.events.set(this.dataService.getEvents()))

    // ricarica i dati ogni volta che lo stato di visibiltà dei filtri cambia 
    // (gestione separata dagli handler per poter essere spostata da altre parti del codice in futuro)
    toObservable(this.showTimeline).subscribe(value => {
      if (!this.initialized) return
      this.currentFilters.showTimeline = value
      this.triggerReload()  
    })
    toObservable(this.showMap).subscribe(value => {
      if (!this.initialized) return
      this.currentFilters.showMap = value
      this.triggerReload()
    })
    
  }

  triggerReload() {
    localStorage.setItem(this.STORAGE_FILTERS, JSON.stringify(this.currentFilters));
    this.dataService.setFilters(
      this.currentFilters.personIds,
      this.showTimeline() ? this.currentFilters.interval.from : this.MIN_DATE, 
      this.showTimeline() ? this.currentFilters.interval.to : this.MAX_DATE, 
      this.showMap() ? this.currentFilters.bounds : null)
  }

  ngOnInit(): void {

    this.loadPeople()

    // Recupera lo stato iniziale dalla cache locale
    const savedFilters = JSON.parse(localStorage.getItem(this.STORAGE_FILTERS) || '{}')
    
    this.currentFilters = savedFilters ? {
      personIds: savedFilters.personIds ? savedFilters.personIds : this.defaultFilters.personIds,
      interval: {
        from: savedFilters.interval?.from ? new Date(savedFilters.interval.from) : this.defaultFilters.interval.from,
        to: savedFilters.interval?.to ? new Date(savedFilters.interval.to) : this.defaultFilters.interval.to,
        min: savedFilters.interval?.min ? new Date(savedFilters.interval.min) : this.defaultFilters.interval.min,
        max: savedFilters.interval?.max ? new Date(savedFilters.interval.max) : this.defaultFilters.interval.max,
      },
      bounds: savedFilters.bounds ? savedFilters.bounds : this.defaultFilters.bounds,
      showTimeline: savedFilters.showTimeline !== undefined ? savedFilters.showTimeline : this.defaultFilters.showTimeline,
      showMap: savedFilters.showMap !== undefined ? savedFilters.showMap : this.defaultFilters.showMap
    } : this.currentFilters = {...this.defaultFilters}

    this.showTimeline.set(this.currentFilters.showTimeline)
    this.showMap.set(this.currentFilters.showMap)

    this.selectedIds.set(this.currentFilters.personIds)
    this.triggerReload()
    this.initialized = true

  }

  handlePersonFilter(selectedIds: string[]): void {
    this.currentFilters.personIds = selectedIds
    this.selectedIds.set(selectedIds)
    this.triggerReload()
  }

  handleTimeFilter(interval: {from: Date, to: Date, min: Date, max: Date}): void {
    this.currentFilters.interval = interval
    this.triggerReload()
  }

  handleMapFilter(coords: Coordinates): void {
    this.currentFilters.bounds = coords
    this.triggerReload()
  }

  /**
   * Richiamata quando l'utente arriva in fondo alla lista di dettaglio
   */
  onScrollBottom(): void {
    if (this.dataService.isLoading() || !this.dataService.hasMore()) return
    this.dataService.loadMore()
  }

  resetFilters(): void {
    this.currentFilters = {...this.defaultFilters}
    this.selectedIds.set(this.currentFilters.personIds)
    this.triggerReload()
  }

}
