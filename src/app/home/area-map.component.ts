import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import type { SearchArea } from './search.models';
import { GoogleMapsLoaderService } from '../google-maps-loader.service';

declare global {
  interface Window {
    __appConfig?: {
      googleMapsApiKey?: string;
      googleMapsMapId?: string;
    };
  }
}

@Component({
  selector: 'app-area-map',
  standalone: true,
  template: `
    <section class="control-section" aria-labelledby="area-map-title">
      <div class="section-heading">
        <div>
          <h3 id="area-map-title">Area geografica</h3>
          <p>Seleziona il centro sulla mappa</p>
        </div>
        @if (area) {
          <button class="clear-control" type="button" (click)="clear()">Rimuovi area</button>
        }
      </div>
      @if (mapError) {
        <div class="map-placeholder" role="status">{{ mapError }}</div>
      } @else {
        <div #mapCanvas class="map-canvas" role="application" aria-label="Mappa per selezionare un'area"></div>
        @if (area) {
          <label class="radius-control">
            <span>Raggio <strong>{{ formatRadius(area.radiusMeters) }}</strong></span>
            <input
              type="range"
              min="250"
              max="20000"
              step="250"
              [value]="area.radiusMeters"
              aria-label="Raggio dell'area"
              (input)="updateRadius($event)"
            />
          </label>
        } @else if (mapReady) {
          <p class="map-hint">Fai clic sulla mappa per impostare il centro dell'area.</p>
        } @else {
          <p class="map-hint" aria-live="polite">Caricamento mappa…</p>
        }
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .control-section { padding: 1.1rem 0 0; }
    .section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: .8rem; }
    h3 { margin: 0; color: #1d3332; font: 600 1rem/1.25 Georgia, 'Times New Roman', serif; }
    .section-heading p, .map-hint { margin: .22rem 0 0; color: #62706d; font-size: .82rem; }
    .map-canvas, .map-placeholder { height: 13rem; overflow: hidden; border: 1px solid #cbd5d2; border-radius: 4px; background: #e6ece8; }
    .map-placeholder { display: grid; place-items: center; padding: 1rem; color: #53645e; text-align: center; font-size: .85rem; }
    .map-hint { margin-top: .55rem; }
    .radius-control { display: grid; gap: .35rem; margin-top: .75rem; color: #50615d; font-size: .78rem; }
    .radius-control strong { color: #1d3332; font-weight: 600; }
    .radius-control input { width: 100%; accent-color: #167c72; }
    .clear-control { border: 0; padding: .2rem 0; background: transparent; color: #167c72; cursor: pointer; font: inherit; font-size: .78rem; }
  `],
})
export class AreaMapComponent implements AfterViewInit {
  constructor(private mapsLoader: GoogleMapsLoaderService) {}

  @Input() area: SearchArea | null = null;
  @Output() areaChange = new EventEmitter<SearchArea | null>();
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLDivElement>;

  mapError = '';
  mapReady = false;
  private map?: google.maps.Map;
  private marker?: google.maps.Marker;

  async ngAfterViewInit(): Promise<void> {
    const apiKey = window.__appConfig?.googleMapsApiKey;
    if (!apiKey || !this.mapCanvas) {
      this.mapError = 'Mappa non disponibile: configura GOOGLE_MAPS_API_KEY.';
      return;
    }

    try {
      await this.mapsLoader.load();
      if (!this.mapCanvas) return;

      const center = { lat: this.area?.latitude ?? 45.1974, lng: this.area?.longitude ?? 8.9247 };
      this.map = new google.maps.Map(this.mapCanvas.nativeElement, {
        center,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          this.setArea(event.latLng.lat(), event.latLng.lng());
        }
      });
      this.mapReady = true;
      if (this.area) this.drawArea();
    } catch {
      this.mapError = 'Impossibile caricare Google Maps.';
    }
  }

  updateRadius(event: Event): void {
    if (!this.area) return;
    this.areaChange.emit({ ...this.area, radiusMeters: Number((event.target as HTMLInputElement).value) });
    this.drawArea();
  }

  clear(): void {
    this.marker?.setMap(null);
    this.area = null;
    this.areaChange.emit(null);
  }

  formatRadius(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toLocaleString('it-IT')} km` : `${meters} m`;
  }

  private setArea(latitude: number, longitude: number): void {
    const radiusMeters = this.area?.radiusMeters ?? 250;
    this.areaChange.emit({ latitude, longitude, radiusMeters });
    this.area = { latitude, longitude, radiusMeters };
    this.drawArea();
  }

  private drawArea(): void {
    if (!this.map || !this.area) return;
    if (!this.marker) {
      this.marker = new google.maps.Marker({
        map: this.map,
        clickable: false,
        title: 'Centro dell’area selezionata',
      });
    }
    this.marker.setPosition({ lat: this.area.latitude, lng: this.area.longitude });
    this.marker.setMap(this.map);
  }
}