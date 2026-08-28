export type TrackBehavior = 'replace' | 'layer' | 'takeover';

export interface LocationTrack {
  src: string;
  gain?: number;         // default 1.0
  behavior?: TrackBehavior; // default 'replace'
  /**
   * HUD label, uppercase to match the others. Only read for `signature`
   * tracks — bed tracks all show as LOCATION TRACK, because naming the
   * specific recording would give away that the bed is interchangeable.
   */
  label?: string;
}

/**
 * All tracks in `tracks` should share the same behavior value. The behavior of
 * the first shuffled track applies to the entire session (v1).
 */
export interface LocationEntry {
  city: string;          // matched case-insensitively against weather.city
  /**
   * The ambient bed. Shuffled, played one at a time, advancing on end.
   */
  tracks: LocationTrack[];
  /**
   * Signature sounds — the thing you would name if someone asked what this
   * city sounds like. Played ON TOP of the bed, always, looping, never
   * shuffled into it.
   *
   * This exists because those two things are different in kind. The bed is
   * interchangeable: a busy street corner at rush hour sounds much the same
   * in three different countries, which is why the shuffle works. A signature
   * sound is the opposite — sea lions at Fisherman's Wharf are not a stand-in
   * for anything, and hearing them INSTEAD of the city would be wrong, since
   * in life you hear them over it.
   *
   * `behavior` is ignored here; these always layer. Keep the gain low — this
   * sits on top of a full mix, not in place of one.
   */
  signature?: LocationTrack[];
}

export const LOCATION_TRACKS: LocationEntry[] = [
  {
    city: 'Mexico City, Mexico',
    tracks: [
      { src: '/audio/weather-vibe/mexico-city-1.mp3', gain: 0.8, behavior: 'layer' },
    ],
  },
  {
    city: 'Paris',
    tracks: [
      { src: '/audio/weather-vibe/paris-track-1.mp3', gain: 0.8, behavior: 'layer' },
      { src: '/audio/weather-vibe/paris-track-3.mp3', gain: 0.8, behavior: 'layer' },
    ],
  },
    {
    city: 'Dublin',
    tracks: [
      { src: '/audio/weather-vibe/ireland-track-1.mp3', gain: 0.8, behavior: 'layer' },
    ],
  },
  {
    city: 'San Francisco',
    // The Mexico City and Paris recordings are deliberate, not a copy-paste
    // slip: a dense street corner sounds like a dense street corner, and three
    // beds of variety beat one that is merely accurate.
    tracks: [
      { src: '/audio/weather-vibe/san-francisco-track-1.mp3', gain: 0.8, behavior: 'replace' },
      { src: '/audio/weather-vibe/mexico-city-1.mp3', gain: 0.8, behavior: 'replace' },
      { src: '/audio/weather-vibe/paris-track-3.mp3', gain: 0.8, behavior: 'replace' },
      { src: '/audio/weather-vibe/freesound_community-muni-bus-ride-53103.mp3', gain: 0.8, behavior: 'replace' },
    ],
    // The part that could only be San Francisco. Low gain on purpose — the
    // sea lions should sound like they are a couple of piers away.
    signature: [
      {
        src: '/audio/weather-vibe/seals_fishermans_wharf_san_francisco.mp3',
        gain: 0.42,
        label: 'SEA LIONS',
      },
    ],
  }
];

function normalize(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function findEntry(city?: string): LocationEntry | null {
  if (!city) return null;
  const norm = normalize(city);
  return (
    LOCATION_TRACKS.find(e => {
      const entry = normalize(e.city);
      return norm === entry || norm.startsWith(entry + ', ');
    }) ?? null
  );
}

export function getLocationTracks(city?: string): LocationTrack[] | null {
  return findEntry(city)?.tracks ?? null;
}

/** Always-on layers for this city, or null. See LocationEntry.signature. */
export function getLocationSignature(city?: string): LocationTrack[] | null {
  const sig = findEntry(city)?.signature;
  return sig && sig.length ? sig : null;
}
