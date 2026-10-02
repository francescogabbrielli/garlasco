export interface SearchArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface EventSearchFilters {
  actorIds: string[];
  from: string;
  to: string;
  area: SearchArea | null;
}

export const EMPTY_EVENT_SEARCH: EventSearchFilters = {
  actorIds: [],
  from: '',
  to: '',
  area: null,
};