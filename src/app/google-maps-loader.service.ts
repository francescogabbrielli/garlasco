import { computed, inject, Injectable, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService implements OnDestroy {

  private loadPromise?: Promise<void>

  private platformId = inject(PLATFORM_ID)
  private themeObserver!: MutationObserver

  // Signal reattivo che contiene la stringa 'LIGHT' o 'DARK' di Google Maps
  private _colorScheme = signal<google.maps.ColorScheme | undefined>(undefined);
  public colorScheme = computed(() => this._colorScheme());

  constructor() {
    this.initThemeTracking()
  }  

  private initThemeTracking(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkTheme();

      const targetNode = document.documentElement;
      this.themeObserver = new MutationObserver(() => this.checkTheme());
      this.themeObserver.observe(targetNode, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    }
  }

  private checkTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    // Assegniamo i valori ENUM nativi di Google Maps in base al tuo data-theme
    if (currentTheme === 'dark') {
      this._colorScheme.set('DARK' as google.maps.ColorScheme);
    } else {
      this._colorScheme.set('LIGHT' as google.maps.ColorScheme);
    }
  }

  load(): Promise<void> {
    if (!this.loadPromise) {
      const apiKey = window.__appConfig?.googleMapsApiKey;
      if (!apiKey) {
        return Promise.reject(new Error('GOOGLE_MAPS_API_KEY is not configured.'));
      }
      const mapId = window.__appConfig?.googleMapsMapId
      if (!mapId) {
        return Promise.reject(new Error('GOOGLE_MAPS_ID is not configured.'));
      }

      setOptions({ key: apiKey, v: 'weekly', mapIds: [mapId] })
      this.loadPromise = Promise.all([
        importLibrary('maps'),
        importLibrary('marker'),
        importLibrary('places'),
      ]).then(() => undefined)
    }

    return this.loadPromise
  }

  ngOnDestroy(): void {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
  }

}
