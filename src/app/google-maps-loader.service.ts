import { Injectable } from '@angular/core';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise?: Promise<void>;

  load(): Promise<void> {
    if (!this.loadPromise) {
      const apiKey = window.__appConfig?.googleMapsApiKey;
      if (!apiKey) {
        return Promise.reject(new Error('GOOGLE_MAPS_API_KEY is not configured.'));
      }

      setOptions({ key: apiKey, v: 'weekly' });
      this.loadPromise = Promise.all([
        importLibrary('maps'),
        importLibrary('marker')
      ]).then(() => undefined);
    }

    return this.loadPromise;
  }
}
