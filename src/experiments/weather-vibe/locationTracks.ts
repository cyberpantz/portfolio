export type TrackBehavior = 'replace' | 'layer' | 'takeover';

export interface LocationTrack {
  src: string;
  gain?: number;         // default 1.0
  behavior?: TrackBehavior; // default 'replace'
}

/**
 * All tracks in a single entry should share the same behavior value.
 * The behavior of the first shuffled track applies to the entire session (v1).
 */
export interface LocationEntry {
  city: string;          // matched case-insensitively against weather.city
  tracks: LocationTrack[];
}

export const LOCATION_TRACKS: LocationEntry[] = [];

export function getLocationTracks(city?: string): LocationTrack[] | null {
  if (!city) return null;
  const norm = city.trim().toLowerCase();
  return LOCATION_TRACKS.find(e => e.city.toLowerCase() === norm)?.tracks ?? null;
}
