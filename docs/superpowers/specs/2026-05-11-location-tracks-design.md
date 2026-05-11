# Location-Specific Track Arrays Design

## Overview

Allow specific cities to have curated arrays of ambient tracks or music that shuffle randomly. Most locations fall through to the existing procedural + recording audio. Matched cities get a shuffled playlist that advances automatically when each track ends.

---

## Data Model — `locationTracks.ts`

New file. Pure data, no engine logic.

```ts
export type TrackBehavior = 'replace' | 'layer' | 'takeover';

export interface LocationTrack {
  src: string;           // e.g. '/audio/weather-vibe/locations/new-orleans-jazz.mp3'
  gain?: number;         // volume multiplier, default 1.0
  behavior?: TrackBehavior; // default 'replace'
}

export interface LocationEntry {
  city: string;          // matched case-insensitively against weather.city
  tracks: LocationTrack[];
}

export const LOCATION_TRACKS: LocationEntry[] = [
  // Add entries here — ships empty
];
```

**Matching helper:**

```ts
export function getLocationTracks(city?: string): LocationTrack[] | null {
  if (!city) return null;
  const norm = city.trim().toLowerCase();
  return LOCATION_TRACKS.find(e => e.city.toLowerCase() === norm)?.tracks ?? null;
}
```

Returns `null` if no match — the engine falls through to default behavior for that weather state.

**Behavior semantics:**

| Behavior | Procedural synths (wind, city hum, fog drone) | Normal ambient recordings | Location track |
|----------|-----------------------------------------------|--------------------------|----------------|
| `replace` (default) | play as normal | skipped | plays via `ambientGain` |
| `layer` | play as normal | play as normal | plays via `ambientGain` on top |
| `takeover` | skipped | skipped | plays via `userMasterGain` directly |

**v1 simplification:** the behavior of the first track in the shuffled queue applies to the entire location visit. Per-track behavior is read and honored only for the first track; subsequent tracks in the playlist inherit that behavior. This avoids mid-session routing teardown and is the right tradeoff for v1.

---

## Audio Engine Changes — `audio.ts`

### State key includes city

```ts
const key = `${state}:${urbanDensity ?? 'rural'}:${weatherData.city?.toLowerCase().trim() ?? ''}`;
```

Ensures switching between two cities with the same weather state/urbanDensity always triggers a full audio rebuild and playlist reset.

### New private state

```ts
private playlistQueue:  LocationTrack[] = [];
private playlistIndex:  number = 0;
private playlistSource: AudioBufferSourceNode | null = null;
```

### `stopAll()` additions

```ts
if (this.playlistSource) {
  try { this.playlistSource.stop(); } catch {}
  this.playlistSource = null;
}
this.playlistQueue = [];
this.playlistIndex = 0;
```

### New `shuffle` helper (private static)

Fisher-Yates, returns a new array:

```ts
private static shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

### New `loadPlaylistTrack(track, dest)` (private async)

Like `loadRecording` but:
- `src.loop = false`
- Stores source in `this.playlistSource`
- `src.onended = () => this.advancePlaylist(dest)`
- Silently skips on fetch/decode failure (same pattern as `loadRecording`)

```ts
private async loadPlaylistTrack(track: LocationTrack, dest: AudioNode): Promise<void> {
  const ctx = this.getCtx();
  try {
    const res = await fetch(track.src);
    if (!res.ok) return;
    const audioBuf = await ctx.decodeAudioData(await res.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.loop = false;
    const g = ctx.createGain();
    g.gain.value = track.gain ?? 1.0;
    src.connect(g);
    g.connect(dest);
    this.playlistSource = src;
    this.recordings.push(src); // cleaned up by stopAll on location change
    src.onended = () => this.advancePlaylist(dest);
    src.start();
  } catch {
    // File absent or decode failed — advance to next track
    this.advancePlaylist(dest);
  }
}
```

### New `advancePlaylist(dest)` (private)

```ts
private advancePlaylist(dest: AudioNode): void {
  if (this.playlistQueue.length === 0) return;
  this.playlistIndex = (this.playlistIndex + 1) % this.playlistQueue.length;
  this.loadPlaylistTrack(this.playlistQueue[this.playlistIndex], dest);
}
```

### `setState()` changes

After the state key check and `stopAll()`, before the switch statement:

```ts
const locationTracks = getLocationTracks(weatherData.city);

if (locationTracks) {
  this.playlistQueue = WeatherAudio.shuffle(locationTracks);
  this.playlistIndex = 0;
}

const behavior: TrackBehavior = this.playlistQueue[0]?.behavior ?? 'replace';
```

The `behavior` variable threads through the switch. For each weather state case:

- **`replace`**: wrap existing `loadRecording` ambient calls in `if (!locationTracks)`. After the switch, if `locationTracks`, call `loadPlaylistTrack(playlistQueue[0], amb)`.
- **`layer`**: run existing ambient `loadRecording` calls unconditionally. After the switch, if `locationTracks`, additionally call `loadPlaylistTrack(playlistQueue[0], amb)`.
- **`takeover`**: wrap ALL audio (procedural synths + recordings) in `if (!locationTracks || behavior !== 'takeover')`. After the switch, if takeover, call `loadPlaylistTrack(playlistQueue[0], this.userMasterGain!)`.

Because `behavior` is resolved once (from the first shuffled track), this is a single conditional per block rather than per-track branching.

---

## `getActiveLayerLabels` changes — `audio.ts`

Checks `getLocationTracks(weather.city)` and, if matched:

- **`replace`**: substitute `'LOCATION TRACK'` for the normal ambient recording label(s) for that state. Procedural labels (WIND, CITY HUM, etc.) remain.
- **`layer`**: prepend `'LOCATION TRACK'` alongside existing labels.
- **`takeover`**: return `'LOCATION TRACK'` only.

---

## New File

| File | Purpose |
|------|---------|
| `src/experiments/weather-vibe/locationTracks.ts` | Registry + `getLocationTracks` helper |

## Modified Files

| File | Change |
|------|--------|
| `src/experiments/weather-vibe/audio.ts` | State key, playlist state, `shuffle`, `loadPlaylistTrack`, `advancePlaylist`, `setState` behavior routing, `getActiveLayerLabels` |

---

## Extensibility

**Adding a new city:** append one `LocationEntry` to `LOCATION_TRACKS` in `locationTracks.ts`. No other files change.

**Adding a new behavior mode:** add a value to `TrackBehavior`, handle it in `setState`'s post-switch block and `getActiveLayerLabels`.

**Per-track behavior in future:** when `advancePlaylist` fires, compare the incoming track's behavior to the session behavior. If different, call a `reconfigureBehavior(newBehavior)` method that ramps category gain nodes rather than doing a full stop/rebuild.
