import { describe, expect, it } from 'vitest';

import {
  computeCenterPosition,
  computeDistance,
  computeGeoHash,
  EARTH_RADIUS_METERS
} from './geo';

type Coordinates = Parameters<typeof computeDistance>[0];

const coordinates = (
  latitude: number,
  longitude: number,
  radius: number
): Coordinates => ({ latitude, longitude, radius });

describe('geo utilities', () => {
  describe('computeDistance', () => {
    it('returns the average of the two radii for coincident coordinates', () => {
      expect(computeDistance(
        coordinates(45, 9, 100),
        coordinates(45, 9, 300)
      )).toBe(200);
    });

    it('computes a great-circle distance and includes the average radii', () => {
      const start = coordinates(0, 0, 100);
      const end = coordinates(0, 1, 300);

      expect(computeDistance(start, end)).toBeCloseTo(
        EARTH_RADIUS_METERS * Math.PI / 180 + 200,
        6
      );
    });

    it('returns the same distance regardless of direction', () => {
      const first = coordinates(45.5, 9.2, 250);
      const second = coordinates(46, 10, 500);

      expect(computeDistance(first, second)).toBeCloseTo(
        computeDistance(second, first),
        10
      );
    });
  });

  describe('computeCenterPosition', () => {
    it('returns null when the start position is missing', () => {
      expect(computeCenterPosition(null, coordinates(46, 10, 100))).toBeNull();
      expect(computeCenterPosition(undefined, null)).toBeNull();
    });

    it('returns the start position when the end position is missing', () => {
      const start = coordinates(45.5, 9.2, 250);

      expect(computeCenterPosition(start, undefined)).toEqual(start);
    });

    it('returns the midpoint and distance when both positions are present', () => {
      const start = coordinates(44, 8, 100);
      const end = coordinates(46, 10, 300);

      expect(computeCenterPosition(start, end)).toEqual({
        latitude: 45,
        longitude: 9,
        radius: computeDistance(start, end)
      });
    });
  });

  describe('computeGeoHash', () => {
    it('returns null when coordinates are missing', () => {
      expect(computeGeoHash(null)).toBeNull();
    });

    it.each([
      [249, 'u0ndc7'],
      [250, 'u0ndc'],
      [500, 'u0nd'],
      [1000, 'u0n'],
      [2500, 'u0'],
      [10000, 'u'],
      [50000, '']
    ])('uses the expected precision at radius %i meters', (radius, expected) => {
      expect(computeGeoHash(coordinates(45.5, 9.2, radius))).toBe(expected);
    });
  });
});
