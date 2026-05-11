# Location-Specific Track Arrays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow specific cities to have curated arrays of ambient tracks that shuffle randomly, replacing or layering over the existing procedural audio.

**Architecture:** A new `locationTracks.ts` file holds the pure-data registry and a matching helper. `audio.ts` gains playlist state (shuffled queue, index, active source node), a non-looping load path with `onended` advancement, and two boolean flags (`skipAmbient`, `skipAll`) that thread through the existing `setState` switch to route audio based on the matched track's behavior.

**Tech Stack:** TypeScript, Web Audio API, React 18, Astro — no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `src/experiments/weather-vibe/locationTracks.ts` | **Create** — types, registry, `getLocationTracks` |
| `src/experiments/weather-vibe/audio.ts` | **Modify** — import, state key, playlist state, `stopAll`, `shuffle`, `loadPlaylistTrack`, `advancePlaylist`, `setState`, `getActiveLayerLabels` |

---

### Task 1: Create `locationTracks.ts`

**Files:**
- Create: `src/experiments/weather-vibe/locationTracks.ts`

- [ ] **Step 1: Create the file**

```ts
// src/experiments/weather-vibe/locationTracks.ts
export type TrackBehavior = 'replace' | 'layer' | 'takeover';

export interface LocationTrack {
  src: string;
  gain?: number;         // default 1.0
  behavior?: TrackBehavior; // default 'replace'
}

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
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/experiments/weather-vibe/locationTracks.ts
git commit -m "feat(weather-vibe): add locationTracks registry and getLocationTracks helper"
```

---

### Task 2: Add playlist infrastructure to `audio.ts`

This task adds the import, updates the state key, adds the three new private fields, updates `stopAll`, and adds the static `shuffle` helper. No playback logic yet.

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

- [ ] **Step 1: Add import at the top of `audio.ts`**

The current first line is:
```ts
import type { WeatherData, WeatherState } from './conditions';
```

Add the location tracks import on the next line:
```ts
import type { WeatherData, WeatherState } from './conditions';
import { getLocationTracks, type LocationTrack, type TrackBehavior } from './locationTracks';
import { getSettings, type AudioMultipliers } from './settings';
```

(Replace the existing two-line import block.)

- [ ] **Step 2: Add three private fields to the `WeatherAudio` class**

The current private fields block ends at `private muted = false;`. Add the new fields directly after it:

```ts
  private muted = false;
  private playlistQueue:  LocationTrack[] = [];
  private playlistIndex:  number = 0;
  private playlistSource: AudioBufferSourceNode | null = null;
```

- [ ] **Step 3: Update the state key in `setState` to include city**

Find this line inside `setState`:
```ts
    const key = `${state}:${urbanDensity ?? 'rural'}`;
```

Replace it with:
```ts
    const key = `${state}:${urbanDensity ?? 'rural'}:${weatherData.city?.toLowerCase().trim() ?? ''}`;
```

- [ ] **Step 4: Update `stopAll` to clean up playlist state**

The current `stopAll` body ends with:
```ts
    this.recordings.forEach(n => { try { n.stop(); } catch {} });
    this.recordings = [];
```

Add playlist cleanup directly after that:
```ts
    this.recordings.forEach(n => { try { n.stop(); } catch {} });
    this.recordings = [];
    if (this.playlistSource) {
      try { this.playlistSource.stop(); } catch {}
      this.playlistSource = null;
    }
    this.playlistQueue = [];
    this.playlistIndex = 0;
```

- [ ] **Step 5: Add the `shuffle` static helper to the class**

Add it directly before the `pinkNoiseBuffer` method:

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

- [ ] **Step 6: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): add playlist infrastructure to WeatherAudio (state, stopAll, shuffle)"
```

---

### Task 3: Add `loadPlaylistTrack` and `advancePlaylist` to `audio.ts`

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

- [ ] **Step 1: Add `loadPlaylistTrack` after the `loadRecording` method**

The current `loadRecording` method ends at the closing `}` around line 271. Add `loadPlaylistTrack` and `advancePlaylist` directly after it:

```ts
  private async loadPlaylistTrack(track: LocationTrack, dest: AudioNode): Promise<void> {
    const ctx = this.getCtx();
    try {
      const res = await fetch(track.src);
      if (!res.ok) { this.advancePlaylist(dest); return; }
      const audioBuf = await ctx.decodeAudioData(await res.arrayBuffer());
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.loop = false;
      const g = ctx.createGain();
      g.gain.value = track.gain ?? 1.0;
      src.connect(g);
      g.connect(dest);
      this.playlistSource = src;
      src.onended = () => {
        // Guard against stale callbacks after stopAll clears playlistSource
        if (this.playlistSource === src) this.advancePlaylist(dest);
      };
      src.start();
    } catch {
      this.advancePlaylist(dest);
    }
  }

  private advancePlaylist(dest: AudioNode): void {
    if (this.playlistQueue.length === 0) return;
    this.playlistIndex = (this.playlistIndex + 1) % this.playlistQueue.length;
    this.loadPlaylistTrack(this.playlistQueue[this.playlistIndex], dest);
  }
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): add loadPlaylistTrack and advancePlaylist to WeatherAudio"
```

---

### Task 4: Update `setState` to route location tracks

This replaces the entire `setState` method body with the location-aware version. The switch cases are identical to the current code except every `loadRecording(…, amb)` call is guarded by `!skipAmbient` and every procedural synth call (`cityHum`, `wind`, `fogDrone`, `layeredRain`) and every `loadRecording(…, efx)` call is guarded by `!skipAll`. After the switch, the playlist track is loaded if a location match was found.

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

- [ ] **Step 1: Replace the full `setState` method with the version below**

```ts
  async setState(weatherData: WeatherData) {
    const { state, windspeed, urbanDensity } = weatherData;
    const key = `${state}:${urbanDensity ?? 'rural'}:${weatherData.city?.toLowerCase().trim() ?? ''}`;
    if (key === this.currentStateKey) return;
    this.currentStateKey = key;
    this.stopAll();
    this.getCtx();

    const amb  = this.ambientGain!;
    const efx  = this.effectsGain!;
    const city = this.cityHumGain!;

    const isUrban = urbanDensity === 'urban';
    const isTown  = urbanDensity === 'town';

    const locationTracks = getLocationTracks(weatherData.city);
    if (locationTracks) {
      this.playlistQueue = WeatherAudio.shuffle(locationTracks);
      this.playlistIndex = 0;
    }
    const behavior: TrackBehavior = this.playlistQueue[0]?.behavior ?? 'replace';
    const skipAmbient = !!locationTracks && (behavior === 'replace' || behavior === 'takeover');
    const skipAll     = !!locationTracks && behavior === 'takeover';

    switch (state) {
      case 'clear-night':
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.55, amb);
        } else if (isTown) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.crickets,      0.35, amb);
          if (!skipAll)     this.wind(Math.min(windspeed, 15), efx);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.crickets, 0.60, amb);
          if (!skipAll)     this.wind(Math.min(windspeed, 15), efx);
        }
        break;

      case 'clear-day':
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.50, amb);
          if (!skipAll)     this.wind(windspeed, efx);
        } else if (isTown) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.birds,         0.30, amb);
          if (!skipAll)     this.wind(windspeed, efx);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.birds,      0.40, amb);
          if (!skipAll)     this.wind(windspeed, efx);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.15, amb);
        }
        break;

      case 'golden-hour':
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.45, amb);
          if (!skipAll)     this.wind(Math.min(windspeed, 12), efx);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.birds,      0.35, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.12, amb);
          if (!skipAll)     this.wind(Math.min(windspeed, 12), efx);
        }
        break;

      case 'partly-cloudy':
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.42, amb);
          if (!skipAll)     this.wind(windspeed, efx);
        } else {
          if (!skipAll)     this.wind(windspeed, efx);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.forest_wind, 0.30, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.ocean_surf,  0.12, amb);
        }
        break;

      case 'partly-cloudy-night':
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.48, amb);
        } else if (isTown) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.crickets,      0.32, amb);
          if (!skipAll)     this.wind(windspeed, efx);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.crickets, 0.50, amb);
          if (!skipAll)     this.wind(windspeed, efx);
        }
        break;

      case 'overcast':
        if (!skipAll)     this.wind(windspeed, efx);
        if (isUrban) {
          if (!skipAll)     this.cityHum(city);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.40, amb);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.28, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.forest_wind,   0.20, amb);
        }
        break;

      case 'fog':
        if (!skipAll) this.fogDrone(efx);
        if (!skipAll) this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.22, amb);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.35, amb);
        }
        break;

      case 'fog-night':
        if (!skipAll) this.fogDrone(efx);
        if (!skipAll) this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
        } else {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.crickets,     0.40, amb);
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.30, amb);
        }
        break;

      case 'rain':
        if (!skipAll) this.layeredRain(false, efx);
        if (!skipAll) this.wind(Math.min(windspeed, 20), efx);
        if (!skipAll) await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.45, efx);
        if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, isUrban ? 0.20 : 0.10, amb);
        if (isUrban && !skipAll) this.cityHum(city);
        break;

      case 'snow':
        if (!skipAll)     this.wind(Math.min(windspeed, 10), efx);
        if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.snow_ambience, 0.40, amb);
        if (isUrban) {
          if (!skipAmbient) await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.15, amb);
        }
        break;

      case 'storm':
        if (!skipAll) this.layeredRain(true, efx);
        if (!skipAll) this.wind(windspeed, efx);
        if (!skipAll) await this.loadRecording(AUDIO_ASSETS.storm_wind,    0.40, efx);
        if (!skipAll) await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.35, efx);
        break;
    }

    if (locationTracks) {
      const dest = behavior === 'takeover' ? this.userMasterGain! : amb;
      await this.loadPlaylistTrack(this.playlistQueue[0], dest);
    }
  }
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify manually**

Start the dev server (`pnpm dev`), open the weather-vibe page. Load a city, confirm audio plays normally. Switch to a different city with a different weather state/urbanDensity and confirm the audio changes (e.g. SF urban → a small rural town should swap city sounds for wind/crickets).

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): route location tracks through setState with replace/layer/takeover behavior"
```

---

### Task 5: Update `getActiveLayerLabels`

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

- [ ] **Step 1: Replace the `getActiveLayerLabels` function with the version below**

The function currently starts at `export function getActiveLayerLabels(weather: WeatherData): string {`. Replace the entire function:

```ts
export function getActiveLayerLabels(weather: WeatherData): string {
  const locationTracks = getLocationTracks(weather.city);
  const behavior: TrackBehavior = locationTracks?.[0]?.behavior ?? 'replace';

  if (locationTracks && behavior === 'takeover') return 'LOCATION TRACK';

  const { state, urbanDensity } = weather;
  const isUrban = urbanDensity === 'urban';
  const isTown  = urbanDensity === 'town';
  const L: string[] = [];

  switch (state) {
    case 'clear-night':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'CRICKETS', 'WIND');
      else              L.push('CRICKETS', 'WIND');
      break;
    case 'clear-day':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'BIRDS', 'WIND');
      else              L.push('BIRDS', 'WIND', 'OCEAN SURF');
      break;
    case 'golden-hour':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else              L.push('BIRDS', 'OCEAN SURF', 'WIND');
      break;
    case 'partly-cloudy':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE', 'WIND');
      else              L.push('WIND', 'FOREST WIND', 'OCEAN SURF');
      break;
    case 'partly-cloudy-night':
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else if (isTown)  L.push('CITY HUM', 'CITY AMBIENCE', 'CRICKETS', 'WIND');
      else              L.push('CRICKETS', 'WIND');
      break;
    case 'overcast':
      L.push('WIND');
      if (isUrban)      L.push('CITY HUM', 'CITY AMBIENCE');
      else              L.push('CITY AMBIENCE', 'FOREST WIND');
      break;
    case 'fog':
      L.push('FOG DRONE', 'WIND');
      if (isUrban)      L.push('CITY AMBIENCE');
      else              L.push('FOG AMBIENCE');
      break;
    case 'fog-night':
      L.push('FOG DRONE', 'WIND');
      if (isUrban)      L.push('CITY AMBIENCE');
      else              L.push('CRICKETS', 'FOG AMBIENCE');
      break;
    case 'rain':
      L.push('RAIN', 'WIND', 'RAIN ON GLASS', 'CITY AMBIENCE');
      if (isUrban) L.push('CITY HUM');
      break;
    case 'snow':
      L.push('WIND', 'SNOW AMBIENCE');
      if (isUrban) L.push('CITY AMBIENCE');
      break;
    case 'storm':
      L.push('RAIN', 'WIND', 'STORM WIND', 'RAIN ON GLASS');
      break;
  }

  if (!locationTracks) return L.join(' · ');
  if (behavior === 'layer') return ['LOCATION TRACK', ...L].join(' · ');

  // 'replace': keep synth + effect-recording labels, replace ambient recording labels
  const AMB_RECORDING_LABELS = new Set([
    'CITY AMBIENCE', 'BIRDS', 'CRICKETS', 'OCEAN SURF',
    'FOREST WIND', 'SNOW AMBIENCE', 'FOG AMBIENCE',
  ]);
  const nonAmbient = L.filter(l => !AMB_RECORDING_LABELS.has(l));
  return ['LOCATION TRACK', ...nonAmbient].join(' · ');
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): update getActiveLayerLabels to reflect location track behavior"
```
