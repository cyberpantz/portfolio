# Weather Vibe Settings Panel Design

## Overview

A slide-up bottom panel that lets users tweak audio and visual parameters of the weather-vibe scene in real time. Triggered by a handle below the existing mute button. Settings persist as global multipliers across weather state changes; inappropriate audio layers are automatically unloaded when the location changes.

---

## UI Structure

### Trigger

A small `⚙ SETTINGS` pill handle sits directly below the existing mute/unmute button in the bottom-center HUD cluster. Same monospace font, same opacity/textColor theming as the rest of the HUD. Tapping it opens the panel; tapping again or tapping outside closes it.

### Panel

- Slides up from the bottom with a framer-motion spring animation (`type: "spring", damping: 28, stiffness: 260`)
- Background: `rgba(4, 6, 14, 0.92)` with `backdrop-filter: blur(16px)`, `border-top: 1px solid rgba(textColor, 0.12)`
- A drag-handle bar (32×3 px, centered) sits at the very top of the panel
- The scene dims slightly behind the panel (`rgba(0,0,0,0.35)` overlay on the canvas) when open
- The panel closes when the user clicks/taps outside of it

### Layout

Two columns separated by a faint vertical rule:

**Left — AUDIO**
| Slider | Controls |
|--------|----------|
| MASTER | Global gain multiplier — scales all audio output |
| AMBIENT | Multiplier for looping recordings (birds, crickets, city ambience, ocean surf) |
| EFFECTS | Multiplier for synthesized layers (wind, rain texture) |
| CITY HUM | Multiplier for the procedural city hum synth |

**Right — VISUALS**
| Slider | Controls |
|--------|----------|
| BLOOM | Multiplier on the per-state bloom intensity |
| VIGNETTE | Multiplier on the per-state vignette darkness |
| GRAIN | Multiplier on the per-state noise opacity |
| ABERRATION | Multiplier on the per-state chromatic aberration offset |

### Footer

A single row below both columns:
- **Left**: active audio layer labels for the current state (e.g. `CITY HUM · CITY AMBIENCE`) — dims/updates when state changes
- **Right**: `RESET` button — restores all 8 sliders to 1.0 (100%) with a smooth ramp

### Theming

The panel uses `palette.textColor` for labels and `palette.accent` as the filled track color for the MASTER slider. All other sliders use a dim version of textColor. This matches the existing HUD aesthetic and adapts automatically to the current weather state.

---

## State Management — `settings.ts`

A singleton module (not a class) that owns multiplier state and syncs to `localStorage`.

```ts
interface AudioMultipliers  { master: number; ambient: number; effects: number; cityHum: number; }
interface VisualMultipliers { bloom: number; vignette: number; grain: number; ca: number; }
interface Settings { audio: AudioMultipliers; visuals: VisualMultipliers; }
```

Defaults: all values `1.0`.

**Exports:**
- `getSettings(): Settings` — read current values
- `setAudio(partial: Partial<AudioMultipliers>): void` — update + persist + notify
- `setVisuals(partial: Partial<VisualMultipliers>): void` — update + persist + notify
- `resetSettings(): void` — restore all to 1.0
- `useSettings(): Settings` — React hook that re-renders on change (internal `useState` + listener pattern)

Persistence: `localStorage` key `weather-vibe-settings`, JSON serialized. Loaded once on module init with fallback to defaults if missing or invalid.

---

## Audio Integration — `audio.ts`

`WeatherAudio` gets four addressable category GainNodes that sit between each layer group and the master gain:

```
pinkNoise / recordings  →  categoryGain  →  master  →  destination
```

New method: `setAudioMultipliers(m: AudioMultipliers): void`

- `master`: sets `this.master.gain.setTargetAtTime(m.master * 0.7, ctx.currentTime, 0.05)`
  (0.7 is the existing max master gain; user multiplier scales it)
- `ambient`: sets the ambient category gain
- `effects`: sets the effects category gain
- `cityHum`: sets the city hum category gain

The 50ms time constant (`0.05`) prevents clicks on rapid slider movement.

**On location/state change (`setState`):** The audio system already calls `stopAll()` and rebuilds from scratch. The rebuild calls `setAudioMultipliers(getSettings().audio)` after constructing nodes, so persisted preferences are baked in from the start. Layers not appropriate for the new state are simply never created — the existing stop/rebuild pattern handles unloading automatically.

---

## Visual FX Integration — `Scene.tsx`

`Scene` reads from `useSettings()` and applies visual multipliers on top of the per-state `FX` defaults:

```tsx
const { visuals } = useSettings();
const fx = FX[weather.state] ?? FX['clear-night'];

// Applied to EffectComposer:
<Bloom     intensity={fx.bloom * visuals.bloom} luminanceThreshold={0.3} />
<Vignette  darkness={fx.vignette * visuals.vignette} offset={0.3} ... />
<Noise     opacity={fx.noise * visuals.grain} />
<ChromaticAberration offset={new Vector2(fx.ca * visuals.ca, fx.ca * visuals.ca)} />
```

The weather state still defines the baseline character; the user scales it. A stormy night with all visuals at 50% is still dark and moody — just dialed back.

---

## New File

**`src/experiments/weather-vibe/SettingsPanel.tsx`**
Self-contained component. Renders the trigger button + animated panel. Props:
```ts
interface SettingsPanelProps {
  palette: Palette;
  activeLayerLabels: string; // e.g. "CITY HUM · CITY AMBIENCE"
}
```

Active layer labels are computed by a pure helper function `getActiveLayerLabels(weather: WeatherData): string` that lives in `audio.ts` alongside the audio logic (it mirrors the same branching). Called in `WeatherVibe.tsx` and passed down as a prop. Example output: `"CITY HUM · CITY AMBIENCE"` for urban partly-cloudy-night, `"CRICKETS · WIND"` for rural clear-night.

---

## Files Modified

| File | Change |
|------|--------|
| `settings.ts` | New — singleton settings store |
| `SettingsPanel.tsx` | New — panel UI component |
| `WeatherVibe.tsx` | Add `<SettingsPanel>` alongside `<HUD>`, compute active layer labels |
| `audio.ts` | Add category GainNodes, `setAudioMultipliers()`, call on init |
| `Scene.tsx` | Read `useSettings().visuals`, apply multipliers to `EffectComposer` |

---

## What's Out of Scope

- Per-state or per-location setting overrides (global multipliers only)
- Saving/loading multiple presets
- Exposing wind intensity as a visual slider (grass/wave speed) — possible future addition
- Terrain inclusion in audio state key (ocean surf not yet wired to audio.ts)
