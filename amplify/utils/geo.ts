import { Schema } from "../data/resource";
import geohash from 'ngeohash'

type Coordinates = Schema['Coordinates']['type']

// Raggio medio della Terra in metri
export const EARTH_RADIUS_METERS = 6371000 

export function computeDistance(start: Coordinates, end: Coordinates):number {

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

  export function computeCenterPosition(start:Coordinates | null | undefined, end:Coordinates | null | undefined): Coordinates | null {
    return start ? {
      latitude: end 
        ? (start.latitude + end.latitude) / 2 
        : start.latitude,
      longitude: end 
        ? (start.longitude + end.longitude) / 2 
        : start.longitude,
      radius: end 
        ? computeDistance(start, end)
        : start.radius
    } : null
  }

  export function computeGeoHash(coords:Coordinates | null): string | null {
    if (!coords) return null
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
