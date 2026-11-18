import { Injectable } from "@angular/core"

import type { Schema } from '../../amplify/data/resource'
import { computeCenterPosition, computeDistance, computeGeoHash, EARTH_RADIUS_METERS } from "../../amplify/utils/geo"

type Coordinates = Schema['Coordinates']['type']


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
        computeDistance(
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getNorthEast().lng()),
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getSouthWest().lng())
        ),
        computeDistance(
          this.xy2coords(bounds.getNorthEast().lat(), bounds.getNorthEast().lng()),
          this.xy2coords(bounds.getSouthWest().lat(), bounds.getNorthEast().lng())
        )
      ) / 2)
    } 
  }

  private xy2coords = (x: number, y: number) => {
    return { latitude: x, longitude: y, radius: 0 }
  }

  computeGeoHash(start:Coordinates | null, end: Coordinates | null = null): string | null {
    return computeGeoHash(computeCenterPosition(start, end))
  }
}