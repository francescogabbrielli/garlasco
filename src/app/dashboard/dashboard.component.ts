import { Component, signal, effect, OnInit, inject, computed } from '@angular/core';
import { DataService } from '../data.service';
import { GeoService } from '../geo.service';

import { DEFAULT_COORDINATES } from '../app.constants';
import { Schema } from '../../../amplify/data/resource';

import { PersonFilterComponent } from './person-filter/person-filter.component';
import { EventListComponent } from './event-list/event-list.component';
import { MapFilterComponent } from './map-filter/map-filter.component';
import { RangeFilterComponent } from './range-filter/range-filter.component';

type Event = Schema['Event']['type']
type Coordinates = Schema['Coordinates']['type']

type Filter = {
  peronsIds: string[],
  interval: {from: Date, to: Date, min: Date, max: Date},
  bounds: Coordinates
}

@Component({
  selector: 'app-dashboard',
  imports: [PersonFilterComponent, RangeFilterComponent, MapFilterComponent, EventListComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  protected dataService = inject(DataService)
  protected geoService = inject(GeoService)

  readonly MAX_DATE = new Date()
  readonly MIN_DATE = new Date(2007, 1, 1)

  private readonly STORAGE_FILTERS = 'dashboard_filters'

  // L'unico accumulatore locale per Mappa + Lista
  events = signal<Event[]>([])

  // Solo fatti
  actionEvents = computed<Event[]>(() => this.events().filter(e => e.type === "Fatto"))

  readonly defaultFilters:Filter = {
    peronsIds: [],
    interval: {
      from: new Date("2007-07-15T00:00"),
      to: new Date("2007-08-14T23:59"),
      min: new Date("2007-07-15T00:00"),
      max: new Date("2007-08-14T23:59")
    },
    bounds: DEFAULT_COORDINATES,
  }

  currentFilters!: Filter

  showMap = true

  constructor() {
    // Sincronizziamo il Signal 'getEvents' del Service con il nostro accumulatore locale.
    // Ogni volta che il Service completa il debounce e lo switchMap, resetta l'array iniziale.
    effect(() => this.events.set(this.dataService.getEvents()))
  }

  private triggerReload() {
    localStorage.setItem(this.STORAGE_FILTERS, JSON.stringify(this.currentFilters));
    this.dataService.setFilters(
      this.currentFilters.peronsIds,
      this.currentFilters.interval.from, 
      this.currentFilters.interval.to, 
      this.currentFilters.bounds)
  }

  ngOnInit(): void {
    // Recupera lo stato iniziale dalla cache locale
    try {
      const savedFilters = JSON.parse(localStorage.getItem(this.STORAGE_FILTERS) || 'x')
      this.currentFilters = {
        peronsIds: savedFilters.peronsIds ? savedFilters.peronsIds : this.defaultFilters.peronsIds,
        interval: {
          from: savedFilters.interval?.from ? new Date(savedFilters.interval.from) : this.defaultFilters.interval.from,
          to: savedFilters.interval?.to ? new Date(savedFilters.interval.to) : this.defaultFilters.interval.to,
          min: savedFilters.interval?.min ? new Date(savedFilters.interval.min) : this.defaultFilters.interval.min,
          max: savedFilters.interval?.max ? new Date(savedFilters.interval.max) : this.defaultFilters.interval.max,
        },
        bounds: savedFilters.bounds ? savedFilters.bounds : this.defaultFilters.bounds
      }
    } catch (error) {
      console.error('Failed to load saved filters:', error);
      this.currentFilters = {...this.defaultFilters};
    }

    // Invia i dati di partenza al servizio per innescare la prima chiamata al DB
    this.triggerReload()
  }

  handlePersonFilter(selectedIds: string[]): void {
    this.currentFilters.peronsIds = selectedIds
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
    this.dataService.loadMore()
  }

  resetFilters(): void {
    this.currentFilters = {...this.defaultFilters}
    this.triggerReload();
  }

}
