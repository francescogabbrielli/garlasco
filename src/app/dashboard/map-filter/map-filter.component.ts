// map-filter.component.ts
import { Component, output, input, inject, OnInit, computed, effect, signal } from '@angular/core';
import { GoogleMap, MapAdvancedMarker, MapPolyline } from '@angular/google-maps'; 
import { Schema } from '../../../../amplify/data/resource';
import { GeoService } from '../../geo.service';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

@Component({
  selector: 'app-map-filter',
  imports: [GoogleMap, MapAdvancedMarker, MapPolyline],
  templateUrl: './map-filter.component.html',
  styleUrl: './map-filter.component.css'
})
export class MapFilterComponent implements OnInit {

  private geoService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  initialBounds = input<Coordinates | null>(null)
  mapId = window.__appConfig?.googleMapsMapId

  mapOptions: google.maps.MapOptions = { 
    isFractionalZoomEnabled: false, 
    renderingType: 'RASTER' as google.maps.RenderingType, // Fractional zoom only works on vector maps
  }

  computedMapOptions = computed(() => ({
    ...this.mapOptions,
    colorScheme: this.mapsLoader.colorScheme()
  }))
  
  // Riceve la lista dei marker reattivi filtrati dal componente padre
  markers = input<Event[]>([])

  highlightedId = input<string | null>(null)

  mapChange = output<Coordinates>()
  eventHover = output<string | null>()
  eventClick = output<string>()

  constructor() {
    // L'effect monitora il tema globale e tocca CHIRURGICAMENTE la mappa nativa
    effect(() => {
      this.mapReady.set(false)      
      this.mapsLoader.colorScheme()
      setTimeout(() => {
        this.mapReady.set(true)
      }, 100)
    })
  }  

  private pinElements = new Map<string, HTMLElement[]>()

  // Circular badge in the style of the person filter, slightly smaller
  createPin(eventId: string, ended = false): HTMLElement {
    const pin = document.createElement('div')
    pin.style.cssText = 'display:grid;place-items:center;width:1.9rem;height:1.9rem;box-sizing:border-box;'
      + 'border-radius:50%;border:1px solid var(--highlight);box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .12s;'
      + (ended ? 'background:#fff;' : 'background:#e3f3ed;')
    const icon = document.createElement('div')
    icon.style.cssText = 'display:grid;place-items:center;width:100%;height:100%;border-radius:50%;'
      + `background:${ended ? '#e9eee8' : 'var(--highlight)'};color:${ended ? '#35524b' : '#fff'};`
      + 'font:700 .62rem/1 system-ui,sans-serif;'
    pin.appendChild(icon)
    pin.addEventListener('mouseenter', () => this.eventHover.emit(eventId))
    pin.addEventListener('mouseleave', () => this.eventHover.emit(null))
    pin.addEventListener('click', () => this.eventClick.emit(eventId))
    const list = this.pinElements.get(eventId) ?? []
    list.push(pin)
    this.pinElements.set(eventId, list)
    return pin
  }

  private applyHighlight = effect(() => {
    const active = this.highlightedId()
    this.pins()
    this.pinElements.forEach((elements, id) => elements.forEach(el => {
      const on = id === active
      el.style.transform = on ? 'scale(1.35)' : ''
      el.style.boxShadow = on ? '0 0 0 3px rgba(22,124,114,.35), 0 2px 8px rgba(0,0,0,.4)' : '0 1px 4px rgba(0,0,0,.3)'
      el.style.zIndex = on ? '10' : ''
    }))
  })

  trackOptions = computed(() => {
    const active = this.highlightedId()
    const byId: Record<string, google.maps.PolylineOptions> = {}
    this.tracks().forEach(t => byId[t.id] = t.id === active
      ? { ...this.polylineOptions, strokeWeight: 5, strokeOpacity: 1, zIndex: 5 }
      : this.polylineOptions)
    return byId
  })

  private toLatLng(c: Coordinates | null): google.maps.LatLngLiteral {
    if (!c) throw new Error('Coordinates cannot be null')
    return { lat: c.latitude, lng: c.longitude }
  }

  // Events that have an end position, drawn as a line between start and end
  tracks = computed(() => this.markers()
    .filter(e => !!e.startPosition)
    .filter(e => !!e.endPosition)
    .map(e => ({
      id: e.id,
      path: [this.toLatLng(e.startPosition!), this.toLatLng(e.endPosition!)],
    })))

  polylineOptions: google.maps.PolylineOptions = { strokeColor: 'var(--highlight)', strokeOpacity: .8, strokeWeight: 3 }

  pins = computed(() => {
    this.pinElements.clear()
    return this.markers()
      .map(e => {
        return {
          id: e.id,
          title: e.name,
          start: this.toLatLng(e.startPosition!),
          startContent: this.createPin(e.id),
          end: e.endPosition ? this.toLatLng(e.endPosition) : null,
          endContent: e.endPosition ? this.createPin(e.id, true) : null,
        }
    })
  })

  private mapInstance?: google.maps.Map
  mapError: string = ''
  mapReady = signal(false)

  async ngOnInit() {
 
    try {
      await this.mapsLoader.load()
      this.mapReady.set(true)
    } catch {
      this.mapError = 'Impossibile caricare Google Maps.'
    }

  }

  onMapReady(map: google.maps.Map): void {
    const boundsToApply = this.initialBounds()
    if (boundsToApply) {
      map.fitBounds(this.geoService.toBounds(boundsToApply), 0)
    }
    this.mapInstance = map
  }

  onBoundsChanged(): void {
    const bounds = this.mapInstance?.getBounds()
    if (!bounds || !this.mapInstance) return
    this.mapChange.emit(this.geoService.toCoordinates(bounds))
  }

}
