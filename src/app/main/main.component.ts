import { Component, ElementRef, inject, Output, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AmplifyAuthenticatorModule, AuthenticatorService } from '@aws-amplify/ui-angular';

import { UserProfileService } from '../user-profile.service';

declare global {
  interface Window {
    __appConfig?: {
      googleMapsApiKey?: string;
    };
  }
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [
    AmplifyAuthenticatorModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ReactiveFormsModule,
  ],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css',
})
export class MainComponent {
  isSubmitDialogOpen = false;
  isUserMenuOpen = false;
  isAdminVisible = false;
  isMapPickerOpen = false;
  isMapReady = false;
  mapError = '';
  mapSelection: google.maps.LatLngLiteral | null = null;
  private hasPreciseMapSelection = false;
  isHelpDialogOpen = false;
  mapPickerTarget: 'start' | 'end' | null = null;
  eventFormSubmitted = false;
  @Output() ownerId = '';
  private givenName = '';
  private familyName = '';
  private map?: google.maps.Map;
  @ViewChild('mapCanvas') private mapCanvas?: ElementRef<HTMLDivElement>;

  readonly eventForm = new FormGroup({
    owner: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    start_position: new FormGroup({
      start_date: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      latitude: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      longitude: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      radius: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    }),
    end_position: new FormGroup({
      end_date: new FormControl('', { nonNullable: true }),
      latitude: new FormControl('', { nonNullable: true }),
      longitude: new FormControl('', { nonNullable: true }),
      radius: new FormControl('', { nonNullable: true }),
    }),
  });

  constructor(
    public readonly authenticator: AuthenticatorService,
    private readonly userProfile: UserProfileService,
  ) {}

  async ngOnInit(): Promise<void> {
    const user = await this.userProfile.logIn()
    this.isAdminVisible = user.isAdmin()
    this.ownerId = user.getId()
    this.eventForm.controls.owner.setValue(this.ownerId)
    this.givenName = user.getName() ?? ''
    this.familyName = user.getSurname() ?? ''
  }

  get loggedIn(): string {
    return `${this.givenName} ${this.familyName}`.trim() || 'Utente';
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  logout(): void {
    if (confirm('Sei sicuro di voler uscire? Tutte le operazioni non salvate andranno perse.')) {
      this.isUserMenuOpen = false;
      this.authenticator.signOut();
    }
  }

  openSubmitDialog(): void {
    this.isUserMenuOpen = false;
    this.eventForm.reset();
    this.eventForm.controls.owner.setValue(this.ownerId);
    this.eventFormSubmitted = false;
    this.isSubmitDialogOpen = true;
  }

  closeSubmitDialog(): void {
    this.isSubmitDialogOpen = false;
    this.closeMapPicker();
    this.closeHelpDialog();
  }

  openHelpDialog(): void {
    this.isHelpDialogOpen = true;
  }

  closeHelpDialog(): void {
    this.isHelpDialogOpen = false;
  }

  openMapPicker(target: 'start' | 'end'): void {
    this.mapPickerTarget = target;
    this.mapError = '';
    this.mapSelection = null;
    this.hasPreciseMapSelection = false;
    this.isMapReady = false;
    this.isMapPickerOpen = true;
    setTimeout(() => void this.initializeMap(), 0);
  }

  closeMapPicker(): void {
    this.isMapPickerOpen = false;
    this.isMapReady = false;
    this.mapPickerTarget = null;
    this.map = undefined;
    this.mapSelection = null;
    this.hasPreciseMapSelection = false;
  }

  clearPosition() {
    throw new Error('Method not implemented.');
  }


  private async initializeMap(): Promise<void> {
    const apiKey = window.__appConfig?.googleMapsApiKey;

    if (!apiKey || !this.mapCanvas) {
      this.mapError = 'Configura GOOGLE_MAPS_API_KEY per visualizzare la mappa.';
      return;
    }

    try {
      setOptions({ key: apiKey, v: 'weekly' });
      const { Map } = await importLibrary('maps');

      if (!this.mapCanvas || !this.isMapPickerOpen) {
        return;
      }

      const garlasco = { lat: 45.1974, lng: 8.9247 };
      this.map = new google.maps.Map(this.mapCanvas.nativeElement, {
        center: garlasco,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      this.isMapReady = true;
      this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          this.selectMapPosition(event.latLng.lat(), event.latLng.lng());
        }
      });
    } catch {
      this.mapError = 'Impossibile caricare Google Maps.';
    }
  }

  private selectMapPosition(latitude: number, longitude: number): void {
    this.mapSelection = { lat: latitude, lng: longitude };
    this.hasPreciseMapSelection = true;
    this.map?.panTo(this.mapSelection);
  }

  confirmMapSelection(): void {
    if (!this.mapPickerTarget || !this.map) {
      return;
    }

    const center = this.mapSelection ?? this.map.getCenter();

    if (!center) {
      return;
    }

    const latitude = typeof center.lat === 'function' ? center.lat() : center.lat;
    const longitude = typeof center.lng === 'function' ? center.lng() : center.lng;
    const positionGroup = this.mapPickerTarget === 'start'
      ? this.eventForm.controls.start_position
      : this.eventForm.controls.end_position;
    positionGroup.patchValue({
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      radius: String(this.hasPreciseMapSelection ? 0 : this.getMapRadiusMeters()),
    });
    this.closeMapPicker();
  }

  private getMapRadiusMeters(): number {
    if (!this.map) {
      return 0;
    }

    const center = this.map.getCenter();
    const bounds = this.map.getBounds();

    if (center && bounds) {
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
      const verticalRadius = Math.min(
        this.distanceInMeters(center.lat(), center.lng(), northEast.lat(), center.lng()),
        this.distanceInMeters(center.lat(), center.lng(), southWest.lat(), center.lng()),
      );
      const horizontalRadius = Math.min(
        this.distanceInMeters(center.lat(), center.lng(), center.lat(), northEast.lng()),
        this.distanceInMeters(center.lat(), center.lng(), center.lat(), southWest.lng()),
      );

      return Math.round(Math.min(verticalRadius, horizontalRadius));
    }

    const zoom = this.map.getZoom() ?? 13;
    const latitude = center?.lat() ?? 45.1974;
    const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / 2 ** zoom;
    const mapElement = this.map.getDiv();
    return Math.round(Math.min(mapElement.clientWidth, mapElement.clientHeight) * metersPerPixel / 2);
  }

  private distanceInMeters(
    firstLatitude: number,
    firstLongitude: number,
    secondLatitude: number,
    secondLongitude: number,
  ): number {
    const earthRadius = 6371000;
    const latitudeDelta = (secondLatitude - firstLatitude) * Math.PI / 180;
    const longitudeDelta = (secondLongitude - firstLongitude) * Math.PI / 180;
    const latitudeFactor = Math.sin(latitudeDelta / 2) ** 2;
    const longitudeFactor = Math.cos(firstLatitude * Math.PI / 180)
      * Math.cos(secondLatitude * Math.PI / 180)
      * Math.sin(longitudeDelta / 2) ** 2;

    return earthRadius * 2 * Math.atan2(
      Math.sqrt(latitudeFactor + longitudeFactor),
      Math.sqrt(1 - latitudeFactor - longitudeFactor),
    );
  }

  submitEvent(): void {
    this.eventFormSubmitted = true;
    this.eventForm.markAllAsTouched();
  }
}