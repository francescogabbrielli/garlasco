import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import type { Schema } from '../../../../amplify/data/resource';
import { GeoService } from '../../geo.service';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

type Coordinates = Schema['Coordinates']['type']

@Component({
  selector: 'app-map-picker',
  imports: [GoogleMap, MapAdvancedMarker],
  templateUrl: './map-picker.component.html',
  styleUrl: './map-picker.component.css',
})
export class MapPickerComponent implements OnInit {

  private geoService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  title = input('Seleziona la posizione')
  initialPosition = input<Coordinates | null>(null)

  picked = output<Coordinates>()
  closed = output<void>()

  mapId = window.__appConfig?.googleMapsMapId ?? 'DEMO_MAP_ID'
  mapOptions: google.maps.MapOptions = {
    isFractionalZoomEnabled: true,
    renderingType: 'VECTOR' as google.maps.RenderingType,
    center: { lat: 45.0, lng: 9.0 },
    zoom: 6,
    clickableIcons: false,
  }

  readonly mapReady = signal(false)
  readonly mapError = signal('')
  // precise point chosen by clicking on the map
  readonly selectedPoint = signal<google.maps.LatLngLiteral | null>(null)

  private mapInstance?: google.maps.Map

  async ngOnInit() {
    try {
      await this.mapsLoader.load()
      this.mapReady.set(true)
    } catch {
      this.mapError.set('Impossibile caricare Google Maps.')
    }
  }

  onMapReady(map: google.maps.Map): void {
    this.mapInstance = map
    const initial = this.initialPosition()
    if (!initial) return
    if (initial.radius > 0) {
      map.fitBounds(this.geoService.toBounds(initial), 0)
    } else {
      map.setCenter({ lat: initial.latitude, lng: initial.longitude })
      map.setZoom(17)
      this.selectedPoint.set({ lat: initial.latitude, lng: initial.longitude })
    }
  }

  onMapClick(event: google.maps.MapMouseEvent | google.maps.IconMouseEvent): void {
    if (event.latLng) this.selectedPoint.set(event.latLng.toJSON())
  }

  clearSelection(): void {
    this.selectedPoint.set(null)
  }

  // exact point if one was clicked, otherwise the visible area as approximate position
  confirm(): void {
    const point = this.selectedPoint()
    if (point) {
      this.picked.emit({ latitude: point.lat, longitude: point.lng, radius: 0 })
      return
    }
    const bounds = this.mapInstance?.getBounds()
    if (bounds) this.picked.emit(this.geoService.toCoordinates(bounds))
  }

  close(): void {
    this.closed.emit()
  }
}
