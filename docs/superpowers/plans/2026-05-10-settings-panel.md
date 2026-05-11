# Weather Vibe Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-up settings panel to the weather-vibe experiment that lets users tweak audio category levels and visual post-processing multipliers in real time, with settings persisted to localStorage.

**Architecture:** A singleton `settings.ts` module owns all multiplier state with a listener pattern for React reactivity. `audio.ts` gains four category GainNodes (ambient, effects, cityHum, plus a userMaster) that sit between the sound sources and the master output — sliders adjust these nodes live. `Scene.tsx` reads visual multipliers from `useSettings()` and applies them on top of the per-state FX defaults. A new `SettingsPanel.tsx` component renders the trigger pill + animated panel, and lives alongside `<HUD>` in `WeatherVibe.tsx`.

**Tech Stack:** React 19, TypeScript 5, framer-motion 12, Web Audio API, Tailwind CSS (layout only — panel styling is inline to match existing HUD aesthetic)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/experiments/weather-vibe/settings.ts` | **Create** | Singleton multiplier store, localStorage persistence, `useSettings` hook |
| `src/experiments/weather-vibe/SettingsPanel.tsx` | **Create** | Trigger button + animated slide-up panel with `Slider` primitive |
| `src/experiments/weather-vibe/audio.ts` | **Modify** | Add category GainNodes, `setAudioMultipliers()`, `getActiveLayerLabels()` |
| `src/experiments/weather-vibe/Scene.tsx` | **Modify** | Apply visual multipliers from `useSettings()` to EffectComposer |
| `src/experiments/weather-vibe/WeatherVibe.tsx` | **Modify** | Render `<SettingsPanel>`, compute `activeLayerLabels`, pass `palette` |
| `src/experiments/weather-vibe/HUD.tsx` | **Modify** | Move mute button up (`bottom-5` → `bottom-10`) to make room for settings trigger |

---

## Task 1: Create `settings.ts` — singleton settings store

**Files:**
- Create: `src/experiments/weather-vibe/settings.ts`

- [ ] **Step 1: Create the file with types, defaults, and module state**

```ts
// src/experiments/weather-vibe/settings.ts
import { useState, useEffect } from 'react';

export interface AudioMultipliers {
  master:  number;
  ambient: number;
  effects: number;
  cityHum: number;
}

export interface VisualMultipliers {
  bloom:    number;
  vignette: number;
  grain:    number;
  ca:       number;
}

export interface Settings {
  audio:   AudioMultipliers;
  visuals: VisualMultipliers;
}

const STORAGE_KEY = 'weather-vibe-settings';

const DEFAULTS: Settings = {
  audio:   { master: 1, ambient: 1, effects: 1, cityHum: 1 },
  visuals: { bloom: 1, vignette: 1, grain: 1, ca: 1 },
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      audio:   { ...DEFAULTS.audio,   ...(parsed.audio   ?? {}) },
      visuals: { ...DEFAULTS.visuals, ...(parsed.visuals ?? {}) },
    };
  } catch {
    return { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
  }
}

let state: Settings = loadFromStorage();
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
```

- [ ] **Step 2: Add the exported API functions**

Append to the same file:

```ts
export function getSettings(): Settings { return state; }

export function setAudio(partial: Partial<AudioMultipliers>): void {
  state = { ...state, audio: { ...state.audio, ...partial } };
  persist();
  notify();
}

export function setVisuals(partial: Partial<VisualMultipliers>): void {
  state = { ...state, visuals: { ...state.visuals, ...partial } };
  persist();
  notify();
}

export function resetSettings(): void {
  state = { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
  persist();
  notify();
}

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(state);
  useEffect(() => {
    const fn = () => setS({ ...state });
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return s;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/settings.ts
git commit -m "feat(weather-vibe): add settings singleton store with localStorage persistence"
```

---

## Task 2: Add `getActiveLayerLabels` to `audio.ts`

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

This is a pure function that mirrors the `setState` branching logic and returns a human-readable string of active audio layers for display in the settings panel footer.

- [ ] **Step 1: Add the export at the bottom of `audio.ts`, before the final `export const weatherAudio` line**

Find this line near the bottom of `audio.ts`:
```ts
export const weatherAudio = new WeatherAudio();
```

Insert the following function directly above it:

```ts
export function getActiveLayerLabels(weather: WeatherData): string {
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

  return L.join(' · ');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): add getActiveLayerLabels pure helper"
```

---

## Task 3: Refactor `audio.ts` — category GainNodes + `setAudioMultipliers`

**Files:**
- Modify: `src/experiments/weather-vibe/audio.ts`

This task routes each audio layer to a dedicated category GainNode so the settings sliders can independently control each category. The signal chain becomes:

```
recordings/synth → ambientGain  ┐
recordings/synth → effectsGain  ├─→ userMasterGain → master (0.7) → destination
synth            → cityHumGain  ┘
```

`master` continues to handle mute (0 / 0.7) and the initial fade-in. `userMasterGain` is the user's master volume control. `mute()`/`unmute()` only touch `master`, not `userMasterGain`.

- [ ] **Step 1: Add the import for `getSettings` and `AudioMultipliers` at the top of `audio.ts`**

The current top of `audio.ts`:
```ts
import type { WeatherData, WeatherState } from './conditions';
```

Replace with:
```ts
import type { WeatherData, WeatherState } from './conditions';
import { getSettings, type AudioMultipliers } from './settings';
```

- [ ] **Step 2: Add four category GainNode properties to the `WeatherAudio` class**

Find the existing private properties block at the top of `WeatherAudio`:
```ts
class WeatherAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: AudioNode[] = [];
  private recordings: AudioBufferSourceNode[] = [];
  private currentStateKey: string | null = null;
  private muted = false;
```

Replace with:
```ts
class WeatherAudio {
  private ctx:            AudioContext | null = null;
  private master:         GainNode | null = null;
  private userMasterGain: GainNode | null = null;
  private ambientGain:    GainNode | null = null;
  private effectsGain:    GainNode | null = null;
  private cityHumGain:    GainNode | null = null;
  private active:         AudioNode[] = [];
  private recordings:     AudioBufferSourceNode[] = [];
  private currentStateKey: string | null = null;
  private muted = false;
```

- [ ] **Step 3: Update `getCtx()` to create and wire category GainNodes**

Find the full `getCtx()` method:
```ts
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.master.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 4);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
```

Replace with:
```ts
  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const saved = getSettings().audio;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.master.gain.linearRampToValueAtTime(0.7, this.ctx.currentTime + 4);

      this.userMasterGain = this.ctx.createGain();
      this.userMasterGain.gain.value = saved.master;
      this.userMasterGain.connect(this.master);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = saved.ambient;
      this.ambientGain.connect(this.userMasterGain);

      this.effectsGain = this.ctx.createGain();
      this.effectsGain.gain.value = saved.effects;
      this.effectsGain.connect(this.userMasterGain);

      this.cityHumGain = this.ctx.createGain();
      this.cityHumGain.gain.value = saved.cityHum;
      this.cityHumGain.connect(this.userMasterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
```

- [ ] **Step 4: Add `setAudioMultipliers()` public method**

Add this method to the `WeatherAudio` class, after the `getCtx()` method:

```ts
  setAudioMultipliers(m: AudioMultipliers): void {
    if (!this.ctx) return;
    const t  = this.ctx.currentTime;
    const tc = 0.05; // 50 ms ramp — prevents clicks on rapid slider movement
    this.userMasterGain!.gain.setTargetAtTime(m.master,  t, tc);
    this.ambientGain!.gain.setTargetAtTime(m.ambient,    t, tc);
    this.effectsGain!.gain.setTargetAtTime(m.effects,    t, tc);
    this.cityHumGain!.gain.setTargetAtTime(m.cityHum,    t, tc);
  }
```

- [ ] **Step 5: Replace the full `setState` method to route each layer to its category GainNode**

Find the full `async setState(weatherData: WeatherData)` method (lines ~241–383 in the original file). Replace it entirely with the following. The only change is replacing every `dest` argument with the appropriate category gain. Note: `rain_on_glass` and `storm_wind` go to `effectsGain`; all other recordings go to `ambientGain`; `wind`/`layeredRain`/`fogDrone` go to `effectsGain`; `cityHum` goes to `cityHumGain`.

```ts
  async setState(weatherData: WeatherData) {
    const { state, windspeed, urbanDensity } = weatherData;
    const key = `${state}:${urbanDensity ?? 'rural'}`;
    if (key === this.currentStateKey) return;
    this.currentStateKey = key;
    this.stopAll();
    this.getCtx();

    const amb  = this.ambientGain!;
    const efx  = this.effectsGain!;
    const city = this.cityHumGain!;

    const isUrban = urbanDensity === 'urban';
    const isTown  = urbanDensity === 'town';

    switch (state) {
      case 'clear-night':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.55, amb);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
          await this.loadRecording(AUDIO_ASSETS.crickets,      0.35, amb);
          this.wind(Math.min(windspeed, 15), efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets, 0.60, amb);
          this.wind(Math.min(windspeed, 15), efx);
        }
        break;

      case 'clear-day':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.50, amb);
          this.wind(windspeed, efx);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          await this.loadRecording(AUDIO_ASSETS.birds,         0.30, amb);
          this.wind(windspeed, efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.birds,      0.40, amb);
          this.wind(windspeed, efx);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.15, amb);
        }
        break;

      case 'golden-hour':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.45, amb);
          this.wind(Math.min(windspeed, 12), efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.birds,      0.35, amb);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf, 0.12, amb);
          this.wind(Math.min(windspeed, 12), efx);
        }
        break;

      case 'partly-cloudy':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.42, amb);
          this.wind(windspeed, efx);
        } else {
          this.wind(windspeed, efx);
          await this.loadRecording(AUDIO_ASSETS.forest_wind, 0.30, amb);
          await this.loadRecording(AUDIO_ASSETS.ocean_surf,  0.12, amb);
        }
        break;

      case 'partly-cloudy-night':
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.48, amb);
        } else if (isTown) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.18, amb);
          await this.loadRecording(AUDIO_ASSETS.crickets,      0.32, amb);
          this.wind(windspeed, efx);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets, 0.50, amb);
          this.wind(windspeed, efx);
        }
        break;

      case 'overcast':
        this.wind(windspeed, efx);
        if (isUrban) {
          this.cityHum(city);
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.40, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.28, amb);
          await this.loadRecording(AUDIO_ASSETS.forest_wind,   0.20, amb);
        }
        break;

      case 'fog':
        this.fogDrone(efx);
        this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.22, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.35, amb);
        }
        break;

      case 'fog-night':
        this.fogDrone(efx);
        this.wind(Math.min(windspeed, 8), efx);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.20, amb);
        } else {
          await this.loadRecording(AUDIO_ASSETS.crickets,     0.40, amb);
          await this.loadRecording(AUDIO_ASSETS.fog_ambience, 0.30, amb);
        }
        break;

      case 'rain':
        this.layeredRain(false, efx);
        this.wind(Math.min(windspeed, 20), efx);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.45, efx);
        await this.loadRecording(AUDIO_ASSETS.city_ambience, isUrban ? 0.20 : 0.10, amb);
        if (isUrban) this.cityHum(city);
        break;

      case 'snow':
        this.wind(Math.min(windspeed, 10), efx);
        await this.loadRecording(AUDIO_ASSETS.snow_ambience, 0.40, amb);
        if (isUrban) {
          await this.loadRecording(AUDIO_ASSETS.city_ambience, 0.15, amb);
        }
        break;

      case 'storm':
        this.layeredRain(true, efx);
        this.wind(windspeed, efx);
        await this.loadRecording(AUDIO_ASSETS.storm_wind,    0.40, efx);
        await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.35, efx);
        break;
    }
  }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Manual smoke test**

Run: `pnpm dev` and open the weather-vibe page. Click to start audio. Confirm sound still plays correctly for at least two weather states (e.g. clear-day and rain). No browser console errors.

- [ ] **Step 8: Commit**

```bash
git add src/experiments/weather-vibe/audio.ts
git commit -m "feat(weather-vibe): add category GainNodes and setAudioMultipliers to audio engine"
```

---

## Task 4: Update `Scene.tsx` — apply visual multipliers

**Files:**
- Modify: `src/experiments/weather-vibe/Scene.tsx`

- [ ] **Step 1: Add the `useSettings` import to `Scene.tsx`**

Find the imports block at the top of `Scene.tsx`. The last import line is:
```ts
import CoastalBackground from './environments/CoastalBackground';
```

Add after it:
```ts
import { useSettings } from './settings';
```

- [ ] **Step 2: Read `visuals` from `useSettings()` inside the `Scene` component and apply multipliers**

Find the `Scene` component function:
```tsx
export default function Scene({ weather }: SceneProps) {
  const fx = FX[weather.state] ?? FX['clear-night'];
  return (
    <Canvas
      camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Environment weather={weather} />

      <EffectComposer>
        <Bloom intensity={fx.bloom} luminanceThreshold={0.3} />
        <Vignette darkness={fx.vignette} offset={0.3} blendFunction={BlendFunction.NORMAL} />
        <ChromaticAberration offset={new Vector2(fx.ca, fx.ca)} />
        <Noise opacity={fx.noise} />
      </EffectComposer>
    </Canvas>
  );
}
```

Replace with:
```tsx
export default function Scene({ weather }: SceneProps) {
  const fx = FX[weather.state] ?? FX['clear-night'];
  const { visuals } = useSettings();
  return (
    <Canvas
      camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 0] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true }}
    >
      <Environment weather={weather} />

      <EffectComposer>
        <Bloom intensity={fx.bloom * visuals.bloom} luminanceThreshold={0.3} />
        <Vignette darkness={fx.vignette * visuals.vignette} offset={0.3} blendFunction={BlendFunction.NORMAL} />
        <ChromaticAberration offset={new Vector2(fx.ca * visuals.ca, fx.ca * visuals.ca)} />
        <Noise opacity={fx.noise * visuals.grain} />
      </EffectComposer>
    </Canvas>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/Scene.tsx
git commit -m "feat(weather-vibe): wire visual multipliers from settings into EffectComposer"
```

---

## Task 5: Create `SettingsPanel.tsx`

**Files:**
- Create: `src/experiments/weather-vibe/SettingsPanel.tsx`

This component contains a reusable `Slider` primitive and the full panel UI. Styling is inline (monospace, HUD-matching) with a single `<style>` tag for the range input pseudo-elements which cannot be set inline.

- [ ] **Step 1: Create the file with imports and the `Slider` primitive**

```tsx
// src/experiments/weather-vibe/SettingsPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Palette } from './conditions';
import {
  getSettings, setAudio, setVisuals, resetSettings, useSettings,
  type AudioMultipliers, type VisualMultipliers,
} from './settings';
import { weatherAudio } from './audio';

interface SliderProps {
  label:    string;
  value:    number;        // 0–1
  onChange: (v: number) => void;
  accent?:  string;        // filled track + thumb color (MASTER only)
  textColor: string;
}

function Slider({ label, value, onChange, accent, textColor }: SliderProps) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          color: textColor, fontFamily: 'monospace', fontSize: 9,
          letterSpacing: '0.1em', opacity: accent ? 1 : 0.65,
        }}>
          {label}
        </span>
        <span style={{ color: accent ?? textColor, fontFamily: 'monospace', fontSize: 9, opacity: 0.75 }}>
          {pct}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="sv-slider"
        style={{ color: accent ?? `rgba(176,192,208,0.7)` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add the `SettingsPanel` component and export**

Append to the same file:

```tsx
export interface SettingsPanelProps {
  palette:           Palette;
  activeLayerLabels: string;
}

export default function SettingsPanel({ palette, activeLayerLabels }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef        = useRef<HTMLDivElement>(null);
  const settings        = useSettings();
  const { textColor, accent } = palette;

  // Close when clicking outside the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleAudio(key: keyof AudioMultipliers, v: number) {
    setAudio({ [key]: v } as Partial<AudioMultipliers>);
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  function handleVisuals(key: keyof VisualMultipliers, v: number) {
    setVisuals({ [key]: v } as Partial<VisualMultipliers>);
  }

  function handleReset() {
    resetSettings();
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  const dimBorder = `rgba(176,192,208,0.08)`;

  return (
    <>
      {/* Range input styles — cannot be set inline */}
      <style>{`
        .sv-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 2px;
          background: rgba(176,192,208,0.12);
          border-radius: 1px;
          outline: none;
          cursor: pointer;
        }
        .sv-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: currentColor;
          margin-top: -4px;
          cursor: pointer;
        }
        .sv-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: currentColor;
          border: none;
          cursor: pointer;
        }
      `}</style>

      {/* Trigger pill — bottom-center, below the mute button */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: 10, pointerEvents: 'auto', zIndex: 20 }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close settings' : 'Open settings'}
          style={{
            background: open ? 'rgba(4,6,14,0.65)' : 'rgba(176,192,208,0.07)',
            border: `1px solid rgba(176,192,208,${open ? 0.25 : 0.14})`,
            borderRadius: 12,
            padding: '3px 14px',
            color: textColor,
            fontFamily: 'monospace',
            fontSize: 9,
            letterSpacing: '0.15em',
            opacity: open ? 0.9 : 0.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'opacity 0.2s, background 0.2s',
          }}
        >
          ⚙ SETTINGS
        </button>
      </div>

      {/* Scene dim overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'none', zIndex: 19 }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            style={{
              background: 'rgba(4,6,14,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderTop: `1px solid rgba(176,192,208,0.12)`,
              zIndex: 25,
              pointerEvents: 'auto',
            }}
          >
            {/* Drag-handle bar */}
            <div style={{
              width: 32, height: 3,
              background: 'rgba(176,192,208,0.22)',
              borderRadius: 2,
              margin: '12px auto 14px',
            }} />

            <div style={{ padding: '0 20px 18px' }}>
              {/* Two-column layout */}
              <div style={{ display: 'flex', gap: 20 }}>

                {/* ── Audio ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 8,
                    letterSpacing: '0.2em', opacity: 0.45,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>AUDIO</div>

                  <Slider label="MASTER"   value={settings.audio.master}  accent={accent} textColor={textColor} onChange={v => handleAudio('master',  v)} />
                  <Slider label="AMBIENT"  value={settings.audio.ambient}  textColor={textColor} onChange={v => handleAudio('ambient',  v)} />
                  <Slider label="EFFECTS"  value={settings.audio.effects}  textColor={textColor} onChange={v => handleAudio('effects',  v)} />
                  <Slider label="CITY HUM" value={settings.audio.cityHum}  textColor={textColor} onChange={v => handleAudio('cityHum',  v)} />
                </div>

                {/* Divider */}
                <div style={{ width: 1, background: dimBorder }} />

                {/* ── Visuals ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 8,
                    letterSpacing: '0.2em', opacity: 0.45,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>VISUALS</div>

                  <Slider label="BLOOM"       value={settings.visuals.bloom}    textColor={textColor} onChange={v => handleVisuals('bloom',    v)} />
                  <Slider label="VIGNETTE"    value={settings.visuals.vignette}  textColor={textColor} onChange={v => handleVisuals('vignette',  v)} />
                  <Slider label="GRAIN"       value={settings.visuals.grain}     textColor={textColor} onChange={v => handleVisuals('grain',     v)} />
                  <Slider label="ABERRATION"  value={settings.visuals.ca}        textColor={textColor} onChange={v => handleVisuals('ca',        v)} />
                </div>
              </div>

              {/* Footer: active layers + reset */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 14, paddingTop: 10,
                borderTop: `1px solid rgba(176,192,208,0.06)`,
              }}>
                <span style={{
                  color: textColor, fontFamily: 'monospace',
                  fontSize: 8, letterSpacing: '0.1em', opacity: 0.3,
                }}>
                  {activeLayerLabels}
                </span>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'none',
                    border: `1px solid rgba(176,192,208,0.15)`,
                    color: textColor,
                    fontFamily: 'monospace',
                    fontSize: 8,
                    letterSpacing: '0.12em',
                    padding: '4px 10px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    opacity: 0.55,
                  }}
                >
                  RESET
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/experiments/weather-vibe/SettingsPanel.tsx
git commit -m "feat(weather-vibe): add SettingsPanel component with Slider primitive"
```

---

## Task 6: Wire `SettingsPanel` into `WeatherVibe.tsx` + adjust `HUD.tsx`

**Files:**
- Modify: `src/experiments/weather-vibe/WeatherVibe.tsx`
- Modify: `src/experiments/weather-vibe/HUD.tsx`

- [ ] **Step 1: Move the mute button up in `HUD.tsx`**

The mute button currently sits at `bottom-5`. The settings trigger sits at `bottom: 10px`. Move the mute button up to `bottom-10` to give the trigger room.

Find in `HUD.tsx`:
```tsx
      {/* Audio toggle */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2" style={{ pointerEvents: 'auto' }}>
```

Replace with:
```tsx
      {/* Audio toggle */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2" style={{ pointerEvents: 'auto' }}>
```

- [ ] **Step 2: Add `SettingsPanel` and `getActiveLayerLabels` imports to `WeatherVibe.tsx`**

Find the imports block at the top of `WeatherVibe.tsx`:
```ts
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import { PALETTES } from './weather-vibe/conditions';
import { weatherAudio } from './weather-vibe/audio';
```

Replace with:
```ts
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import SettingsPanel from './weather-vibe/SettingsPanel';
import { PALETTES } from './weather-vibe/conditions';
import { weatherAudio, getActiveLayerLabels } from './weather-vibe/audio';
```

- [ ] **Step 3: Add `<SettingsPanel>` to the render in `WeatherVibe.tsx`**

Find `const bg = ...` and the return statement together in the `WeatherVibe` component. The current block (from `const bg` through the end of `return`):
```tsx
  const bg = PALETTES[weather.state].background;

  return (
    <div className="fixed inset-0" style={{ background: bg }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={weather.state}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        >
          <Scene weather={weather} />
        </motion.div>
      </AnimatePresence>
      <HUD weather={weather} status={status} onSetCity={setCity} />
      <AnimatePresence>
        {!audioReady && (
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: PALETTES[weather.state].textColor }}
          >
            CLICK FOR AUDIO
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
```

Replace with:
```tsx
  const palette = PALETTES[weather.state];

  return (
    <div className="fixed inset-0" style={{ background: palette.background }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={weather.state}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        >
          <Scene weather={weather} />
        </motion.div>
      </AnimatePresence>
      <HUD weather={weather} status={status} onSetCity={setCity} />
      <SettingsPanel
        palette={palette}
        activeLayerLabels={getActiveLayerLabels(weather)}
      />
      <AnimatePresence>
        {!audioReady && (
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: palette.textColor }}
          >
            CLICK FOR AUDIO
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
```

Note: `const bg = PALETTES[weather.state].background` (the original line) is replaced by `const palette = PALETTES[weather.state]` and `style={{ background: palette.background }}`. Remove the now-unused `bg` const.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Manual end-to-end test**

Run: `pnpm dev` and open the weather-vibe page. Verify:
1. A `⚙ SETTINGS` pill appears at the bottom center, below the mute button
2. Clicking the pill slides the panel up with a spring animation
3. The scene dims slightly behind the panel
4. Dragging the MASTER audio slider changes volume in real time
5. Dragging BLOOM changes the bloom immediately in the scene
6. The footer shows the correct active layer labels for the current weather state
7. RESET restores all sliders to 100%
8. Clicking outside the panel closes it
9. Refreshing the page restores the last slider positions (localStorage persistence)
10. Changing the city location — audio updates correctly, panel footer updates to show new active layers

- [ ] **Step 6: Commit**

```bash
git add src/experiments/weather-vibe/WeatherVibe.tsx src/experiments/weather-vibe/HUD.tsx
git commit -m "feat(weather-vibe): wire SettingsPanel into WeatherVibe, adjust HUD mute button position"
```
