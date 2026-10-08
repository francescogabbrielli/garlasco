// map-filter.component.ts
import { Component, output, input, inject, AfterViewInit, computed } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps'; 
import { Schema } from '../../../../amplify/data/resource';
import { GeoService } from '../../geo.service';
import { GoogleMapsLoaderService } from '../../google-maps-loader.service';

type Coordinates = Schema['Coordinates']['type']
type Event = Schema['Event']['type']

@Component({
  selector: 'app-map-filter',
  imports: [GoogleMap, MapAdvancedMarker],
  templateUrl: './map-filter.component.html',
  styleUrl: './map-filter.component.css'
})
export class MapFilterComponent implements AfterViewInit {

  geoService = inject(GeoService)
  private mapsLoader = inject(GoogleMapsLoaderService)

  initialBounds = input<Coordinates | null>(null);
  mapId = window.__appConfig?.googleMapsMapId ?? 'DEMO_MAP_ID';
  // Fractional zoom only works on vector maps
  mapOptions: google.maps.MapOptions = { isFractionalZoomEnabled: true, renderingType: 'VECTOR' as google.maps.RenderingType };
  
  // Riceve la lista dei marker reattivi filtrati dal componente padre
  markers = input<Event[]>([])

  mapChange = output<Coordinates>()

  logger = computed(() => {
    console.log('Current markers:', this.markers())
  })

  private mapInstance?: google.maps.Map

  mapError: string = ''
  mapReady = false

  async ngAfterViewInit(): Promise<void> {
    const apiKey = window.__appConfig?.googleMapsApiKey
    if (!apiKey) {
      this.mapError = 'Mappa non disponibile: configura GOOGLE_MAPS_API_KEY.'
      return
    }

    try {
      await this.mapsLoader.load()
      this.mapReady = true
    } catch {
      this.mapError = 'Impossibile caricare Google Maps.'
    }

  }

  onMapReady(map: google.maps.Map): void {
    this.mapInstance = map;
    const boundsToApply = this.initialBounds()
    if (boundsToApply) {
      this.mapInstance.fitBounds(this.geoService.toBounds(boundsToApply), 0)
    }
  }

  onBoundsChanged(): void {
    const bounds = this.mapInstance?.getBounds()
    if (!bounds) return
    this.mapChange.emit(this.geoService.toCoordinates(bounds))
  }

}
