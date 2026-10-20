import { Injectable } from "@angular/core"

import type { Schema } from '../../amplify/data/resource'

import geohash from 'ngeohash'

type Coordinates = Schema['Coordinates']['type']

// Raggio medio della Terra in metri
const EARTH_RADIUS_METERS = 6371000 

@Injectable({ providedIn: 'root' })
export class GeoService {

  toBounds(coords: Coordinates): google.maps.LatLngBounds {
    const deltaLatitude = coords.radius / EARTH_RADIUS_METERS * (180 / Math.PI)
    const deltaLongitude = coords.radius / (EARTH_RADIUS_METERS * Math.cos(coords.latitude * (Math.PI / 180))) * (180 / Math.PI)
    return new google.maps.LatLngBounds(
      new google.maps.LatLng(coords.latitude - deltaLatitude, coords.longitude - deltaLongitude),
      new google.maps.LatLng(coords.latitude + deltaLatitude, coords.longitude + deltaLongitude),
    )
  }

  toCoordinates(bounds: google.maps.LatLngBounds):Coordinates {
    return {
      latitude: (bounds.getNorthEast().lat() + bounds.getSouthWest().lat()) / 2,
      longitude: (bounds.getNorthEast().lng() + bounds.getSouthWest().lng()) / 2,
      radius: Math.round(Math.min(
        this.computeDistance(
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getNorthEast().lng()),
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getSouthWest().lng())
        ),
        this.computeDistance(
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getNorthEast().lng()),
          this.xy2coords(bounds.getSouthWest().lat(), bounds.getNorthEast().lng())
        )
      ) / 2)
    } 
  }

  private xy2coords = (x: number, y: number) => {
    return { latitude: x, longitude: y, radius: 0 }
  }

  computeDistance(start: Coordinates, end: Coordinates):number {

    // Conversione dei gradi in radianti
    const dLat = (end.latitude - start.latitude) * Math.PI / 180;
    const dLng = (end.longitude - start.longitude) * Math.PI / 180;

    const rLat1 = start.latitude * Math.PI / 180;
    const rLat2 = end.latitude * Math.PI / 180;

    // Formula dell'emisenoverso
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rLat1) * Math.cos(rLat2) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
      
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Distanza finale in metri (includendo i raggi dei due cerchi)
    return EARTH_RADIUS_METERS * c + ( start.radius + end.radius) / 2
  }

  computeCenterPosition(start:Coordinates, end:Coordinates | null | undefined): Coordinates {
    return {
      latitude: end 
        ? (start.latitude + end.latitude) / 2 
        : start.latitude,
      longitude: end 
        ? (start.longitude + end.longitude) / 2 
        : start.longitude,
      radius: end 
        ? this.computeDistance(start, end)
        : start.radius
    }
  }

  computeGeoHash(coords:Coordinates): string {
    //migliori risultati con misure empiriche...
    let len = 0 
    if (coords.radius < 250) len = 6
    else if (coords.radius < 500) len = 5
    else if (coords.radius < 1000) len = 4
    else if (coords.radius < 2500) len = 3
    else if (coords.radius < 10000) len = 2
    else if (coords.radius < 50000) len = 1
    
    return geohash.encode(
      coords.latitude, 
      coords.longitude, 
      len
      //Math.max(6, 1.33 * Math.log10(Math.PI * EARTH_RADIUS_METERS/Math.max(coords.radius, 1)))
    )
  }

}