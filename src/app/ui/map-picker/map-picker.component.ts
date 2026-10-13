import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';

import type { Schema } from '../../../../amplify/data/resource';

import { GeoService } from '../../geo.service';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

import { DEFAULT_COORDINATES } from '../../app.constants';

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
    center: { lat: DEFAULT_COORDINATES.latitude, lng: DEFAULT_COORDINATES.longitude },
    zoom: 15,
    clickableIcons: true,
  }

  readonly mapReady = signal(false)
  readonly mapError = signal('')
  // precise point chosen by clicking on the map
  readonly selectedPoint = signal<google.maps.LatLngLiteral | null>(null)
  readonly selectedIsPlace = signal(false)

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
      map.setZoom(16)
      this.selectedPoint.set({ lat: initial.latitude, lng: initial.longitude })
    }
  }

  async onMapClick(event: google.maps.MapMouseEvent | google.maps.IconMouseEvent): Promise<void> {
    if (!event.latLng) return
    const placeId = 'placeId' in event ? event.placeId : undefined
    if (!placeId) {
      this.selectedIsPlace.set(false)
      this.selectedPoint.set(event.latLng.toJSON())
      return
    }
    // a place of interest: select its exact location, center on it, and skip the marker and the default info window
    event.stop()
    this.selectedIsPlace.set(true)
    let point = event.latLng.toJSON()
    try {
      const place = new google.maps.places.Place({ id: placeId })
      await place.fetchFields({ fields: ['location'] })
      if (place.location) point = place.location.toJSON()
    } catch {
      // fall back to the clicked point
    }
    this.selectedPoint.set(point)
    this.mapInstance?.panTo(point)
  }

  clearSelection(): void {
    this.selectedPoint.set(null)
    this.selectedIsPlace.set(false)
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
