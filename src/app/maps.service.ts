import { Injectable } from "@angular/core"

import type { Schema } from '../../amplify/data/resource'

import geohash from 'ngeohash'

type Coordinates = Schema['Coordinates']['type']

// Raggio medio della Terra in metri
const EARTH_RADIUS_METERS = 6371000 

@Injectable({ providedIn: 'root' })
export class MapsService {

  computeDistance(start: Coordinates, end: Coordinates) {

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

    // Distanza finale in metri
    return EARTH_RADIUS_METERS * c;
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
        ? this.computeDistance(start, end) + (start.radius+end.radius)/2 
        : start.radius
    }
  }

  computeGeoHash(coords:Coordinates): string {
    return geohash.encode(coords.latitude, coords.longitude, 6)
  }

}