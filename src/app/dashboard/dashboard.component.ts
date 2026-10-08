import { Component, signal, effect, OnInit, inject, computed } from '@angular/core';
import { DataService } from '../data.service';
import { GeoService } from '../geo.service';

import { Schema } from '../../../amplify/data/resource';
import { EventListComponent } from './detail-list/detail-list.component';
import { MapFilterComponent } from './map-filter/map-filter.component';
import { RangeFilterComponent } from './range-filter/range-filter.component';

type Event = Schema['Event']['type']
type Coordinates = Schema['Coordinates']['type']

@Component({
  selector: 'app-dashboard',
  imports: [RangeFilterComponent, MapFilterComponent, EventListComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  protected dataService = inject(DataService)
  protected geoService = inject(GeoService)

  readonly MAX_DATE = new Date()
  readonly MIN_DATE = new Date(2007, 1, 1)

  private readonly STORAGE_TIME_FROM_KEY = 'dashboard_time_from_filter'
  private readonly STORAGE_TIME_TO_KEY = 'dashboard_time_to_filter'
  private readonly STORAGE_MAP_KEY = 'dashboard_map_filter'

  // L'unico accumulatore locale per Mappa + Lista
  events = signal<Event[]>([])

  // Solo fatti
  actionEvents = computed<Event[]>(() => this.events().filter(e => e.type === "Fatto"))

  readonly defaultFilters = {
    from: new Date("2007-07-15T00:00"),
    to: new Date("2007-08-14T23:59"),
    bounds: { latitude: 45.1974, longitude: 8.9247, radius: 1000 }
  }

  currentFilters!: {
    from: Date,
    to: Date,
    bounds: Coordinates
  }

  // Filtri correnti istantanei
  currentDateFrom!: Date
  currentDateTo!: Date
  currentBounds!: Coordinates

  showMap = true

  constructor() {
    // Sincronizziamo il Signal 'getEvents' del Service con il nostro accumulatore locale.
    // Ogni volta che il Service completa il debounce e lo switchMap, resetta l'array iniziale.
    effect(() => this.events.set(this.dataService.getEvents()))
  }

  private triggerReload() {
    this.dataService.setFilters(["1622d102-6df4-4f93-bc32-9e1850827194"], this.currentDateFrom, this.currentDateTo, this.currentBounds)
  }

  ngOnInit(): void {
    // Recupera lo stato iniziale dalla cache locale
    const savedTimeFrom = localStorage.getItem(this.STORAGE_TIME_FROM_KEY)
    const savedTimeTo = localStorage.getItem(this.STORAGE_TIME_TO_KEY)
    this.currentDateFrom = savedTimeFrom ? JSON.parse(savedTimeFrom) : this.defaultFilters.from
    this.currentDateTo = savedTimeTo ? JSON.parse(savedTimeTo) : this.defaultFilters.to

    const savedMap = localStorage.getItem(this.STORAGE_MAP_KEY)
    this.currentBounds = savedMap ? JSON.parse(savedMap) : this.defaultFilters.bounds

    // Invia i dati di partenza al servizio per innescare la prima chiamata al DB
    this.triggerReload()
  }

  handleTimeFilter(interval: {from: Date, to: Date}): void {
    this.currentDateFrom = interval.from
    this.currentDateTo = interval.to
    //localStorage.setItem(this.STORAGE_TIME_FROM_KEY, JSON.stringify(interval.from));
    //localStorage.setItem(this.STORAGE_TIME_TO_KEY, JSON.stringify(interval.to));
    
    // Notifica il servizio in tempo reale: il debounce se ne occuperà internamente
    this.triggerReload()
  }

  handleMapFilter(coords: Coordinates): void {
    this.currentBounds = coords
    //localStorage.setItem(this.STORAGE_MAP_KEY, JSON.stringify(coords))
    
    // Notifica il servizio
    this.triggerReload()
  }

  /**
   * Richiamata quando l'utente arriva in fondo alla lista di dettaglio
   */
  onScrollBottom(): void {
    this.dataService.loadMore()
  }

  resetFilters(): void {
    this.currentDateFrom = this.defaultFilters.from;
    this.currentDateTo = this.defaultFilters.to;
    this.currentBounds = this.defaultFilters.bounds;
    //localStorage.setItem(this.STORAGE_TIME_FROM_KEY, JSON.stringify(this.currentDateFrom));
    //localStorage.setItem(this.STORAGE_TIME_TO_KEY, JSON.stringify(this.currentDateTo));
    //localStorage.setItem(this.STORAGE_MAP_KEY, JSON.stringify(this.currentBounds));
    this.triggerReload();
  }

}
