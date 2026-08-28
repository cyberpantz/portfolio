# Internet Radio Streaming — Design Spec (Draft)

## Goal

For any city typed into weather-vibe that has no entry in `LOCATION_TRACKS`, automatically fetch a nearby radio station from the Radio Browser API and stream it as if it were a `replace`-behavior location track.

---

## Architecture

The feature lives entirely inside `audio.ts` and a new thin helper `radioFallback.ts`. Nothing in the UI changes — the HUD already shows playing-track info, so the station name just shows up there.

**Flow:**
1. `setState` checks `getLocationTracks(city)` — as today.
2. If `null` and `lat`/`lng` are available, call `fetchNearbyStation(lat, lng)` from `radioFallback.ts`.
3. If a station comes back, create a synthetic `LocationTrack`-like descriptor and start the stream via `streamRadio(url)` on the audio engine.
4. If the API is unavailable or returns nothing, fall through to normal procedural audio — silent fail.

---

## New file: `src/experiments/weather-vibe/radioFallback.ts`

Responsible for one thing: given a lat/lng, return the best station object or `null`.

```ts
export interface RadioStation {
  name: string;
  url: string;      // direct stream URL (resolved, not redirect)
  codec: string;    // 'MP3' | 'AAC' | etc — for display/debug only
  bitrate: number;
}

export async function fetchNearbyStation(
  lat: number,
  lng: number,
  radius = 100,     // km
): Promise<RadioStation | null>
```

**API call:**
```
GET https://de1.api.radio-browser.info/json/stations/search
  ?lat={lat}&long={lng}&radius={radius}
  &hidebroken=true&order=votes&limit=5
  &codec=MP3,AAC
```

Pick the first result that has a non-empty `url_resolved`. Return `null` on network error or empty results.

**Fallback strategy:** if `radius=100` returns nothing, retry once with `radius=300`. If still nothing, return `null`.

---

## Changes to `audio.ts`

### New fields
```ts
private radioAudio: HTMLAudioElement | null = null;
private radioSource: MediaElementAudioSourceNode | null = null;
private radioStationName: string | null = null;
```

### `streamRadio(station: RadioStation)`
- Creates `new Audio(station.url)` with `crossOrigin = 'anonymous'`
- `createMediaElementSource` → `ambientGain` (same bus as `replace`-mode location tracks)
- Sets `loop = false` (radio is live; no looping needed)
- `radioAudio.play()` — returns promise, catch errors silently
- Stores `radioStationName` for HUD display

### `stopRadio()`
- Pause + disconnect + null all three radio fields
- Called from `stopAll()` and at the top of `setState` before switching state

### `setState` changes
- After the existing `locationTracks` check, add:
  ```ts
  if (!locationTracks && weatherData.latitude && weatherData.longitude) {
    const station = await fetchNearbyStation(weatherData.latitude, weatherData.longitude);
    if (station) await this.streamRadio(station);
  }
  ```
- `skipAmbient` flag set to `true` when streaming radio (same as `replace` behavior)

### `getActiveLayerLabels` changes
- Add `radioStationName` to the returned labels array when non-null (e.g. `"📻 KQED 88.5"` or just the station name raw — TBD on format)

---

## State key

No change needed — the existing city-keyed state key (`${state}:${urbanDensity}:${city}`) already causes a fresh `setState` call when the city changes, which will re-fetch the station.

---

## Error handling / edge cases

| Scenario | Behavior |
|----------|----------|
| API returns 0 stations | Fall through to procedural audio, no radio |
| Stream URL fails to load | `onerror` → `stopRadio()`, fall through |
| City changes mid-stream | `stopRadio()` at top of `setState` cleans up before new fetch |
| No lat/lng (FALLBACK weather data) | Skip radio fetch entirely |
| CORS blocked stream | Caught by `onerror`, fall through |

---

## HUD display

Station name shown in the active-layers section exactly like a track label. No new UI components. Station name from `RadioStation.name` field, truncated to 24 chars if needed.

---

## Audio Visualizer

An aurora borealis-style canvas overlay that pulses with whatever is playing — location tracks, radio, or procedural synths.

**Aesthetic:** 3–5 overlapping sine ribbon layers with shifting gradient colors (greens, teals, purples), a CSS blur/glow filter for bloom, drifting slowly when audio is quiet, swelling when the bass hits.

**Technical approach:**
- `AnalyserNode` tapped off master output — one insertion point, works for all audio sources
- New `AuroraVisualizer` React component: a `<canvas>` positioned behind the weather scene, `requestAnimationFrame` loop
- `analyser.getByteFrequencyData(array)` each frame → low-band average drives wave amplitude, overall energy drives opacity
- Canvas: 3–5 ribbon layers, each a sine path with its own phase offset, speed, and gradient stroke; `filter: blur(18px)` on the canvas for bloom
- Amplitude at rest: gentle slow drift (~15px height). At full energy: 80–120px swell

**Integration:** `audio.ts` exposes the `AnalyserNode` via a getter. `WeatherVibe.tsx` (or `Scene.tsx`) renders `<AuroraVisualizer analyser={audio.analyser} />` behind the scene.

---

## Out of scope (v1)

- Station picker / user can't choose between multiple results
- Caching station results (re-fetched on each city change is fine)
- Volume control separate from ambient track volume
- Showing codec/bitrate in UI
- Retry on stream error with next station in results (v2)

---

## Open questions (resolve before writing plan)

1. **API server reliability**: `de1.api.radio-browser.info` is one of several community mirrors. Should we hard-code one or resolve a random mirror from the DNS lookup (`all.api.radio-browser.info` → round-robins)?
2. **Behavior when LOCATION_TRACKS *does* have an entry**: Radio is always skipped — confirmed.
3. **User-visible opt-out**: Should the settings panel have a "local radio" toggle? Or just always-on?
