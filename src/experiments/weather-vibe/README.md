# Weather Vibe

A real-time 3D weather visualizer. Detects your location, fetches live conditions, and renders a procedurally animated scene matched to the actual weather — clear night, storm, snow, fog, etc.

Built with React Three Fiber, custom GLSL shaders, and Web Audio API.

---

## Adding audio files

Audio is a two-layer system: **procedural synthesis** (always running) plus **optional recording overlays** (drop files in, they're automatically blended in).

**Where to put files:** `public/audio/weather-vibe/`

**File names and gain levels** are defined in `audio.ts → AUDIO_ASSETS`. Drop a file with the matching name, refresh, and it plays. No code change needed.

See `public/audio/weather-vibe/README.md` for:
- Which file goes with which weather state
- Recommended gain levels and what to adjust
- Where to find free recordings (Freesound, BBC, etc.)
- Normalization and loop-point editing tips

To **add a completely new audio slot** (e.g. `thunder_crack.wav`):

1. Add an entry to `AUDIO_ASSETS` in `audio.ts`:
   ```ts
   thunder_crack: '/audio/weather-vibe/thunder_crack.wav',
   ```
2. Call `loadRecording` inside the relevant `setState` case:
   ```ts
   case 'storm':
     await this.loadRecording(AUDIO_ASSETS.thunder_crack, 0.5, dest);
   ```
3. Drop the file in `public/audio/weather-vibe/thunder_crack.wav`.

---

## Configurable options

### Weather states and palettes — `conditions.ts`

`PALETTES` controls the color theme for each weather state. Each palette has:

| Field | Purpose |
|-------|---------|
| `background` | Sky/scene base color (also used for building day silhouettes) |
| `accent` | Secondary color used in HUD and some scene elements |
| `textColor` | HUD text color — should be readable on `background` |
| `isDark` | `true` = dark background; gates building window glow |
| `vibe` | One-word mood label shown in the HUD |

### Post-processing — `Scene.tsx → FX`

The `FX` table sets per-state post-processing intensities:

```ts
const FX = {
  'storm': { bloom: 0.3, vignette: 0.9, ca: 0.004, noise: 0.05 },
  // ...
};
```

| Field | Effect | Range |
|-------|--------|-------|
| `bloom` | Glow on bright areas | 0–1 (0 = off) |
| `vignette` | Corner darkening | 0–1 |
| `ca` | Chromatic aberration offset | 0–0.01 |
| `noise` | Film grain opacity | 0–0.1 |

### City buildings — `environments/CityScape.tsx`

Buildings appear when `urbanDensity === 'urban'` (detected via BigDataCloud reverse geocode — `geo.city` present = urban).

Key constants at the top of the file:

| What | Where | Default |
|------|-------|---------|
| Number of buildings | `Array.from({ length: 32 }` | 32 |
| Layout seed (stable across states) | `makeRng(42)` | 42 |
| Arc spread (±radians) | `(t - 0.5) * 1.45` | ±83° |
| Radius from camera | `80 + rng() * 30` | 80–110 units |
| Building height range | `16 + rng() * 32` | 16–48 units |
| Building width range | `5 + rng() * 9` | 5–14 units |
| Window density (night) | `if (Math.random() > 0.40)` | 40% lit |
| Emissive intensity | `emissiveIntensity={0.4}` | 0.4 |
| Emissive tint | `emissive="#EED8C0"` | warm white |

To change where the building row sits vertically per weather state, edit `GROUND_Y` in `Scene.tsx`.

### Grass field — `environments/GrassField.tsx`

`GrassField` is a shared component used by `PartlyCloudy`, `Overcast`, and any environment that needs ground cover. Props:

| Prop | Type | Description |
|------|------|-------------|
| `count` | number | Number of blades (20k–80k is typical) |
| `spreadX` | number | Width of the grass patch in world units |
| `spreadZ` | number | Depth of the grass patch in world units |
| `groundY` | number | Y position of the ground plane |
| `maxBladeH` | number | Maximum blade height in world units |
| `windStrength` | number | Wind sway amplitude (1.0 = normal) |
| `colorBase` | [r,g,b] | Linear RGB color at blade root |
| `colorTip` | [r,g,b] | Linear RGB color at blade tip |

The vertex shader (`shaders/grassBlade.vert.glsl`) reconstructs full blade geometry from per-blade `offset` and `shape` attributes — technique adapted from [spacejack/terra](https://github.com/spacejack/terra).

---

## Adding a new weather state

1. Add the state string to the `WeatherState` union in `conditions.ts`.
2. Add a `Palette` entry to `PALETTES` in `conditions.ts`.
3. Map WMO codes to the new state in `wmoToState()` in `conditions.ts`.
4. Add a `GROUND_Y` entry in `Scene.tsx`.
5. Add an `FX` entry in `Scene.tsx`.
6. Create an environment component in `environments/YourState.tsx`.
7. Add a `case` in the `Environment` switch in `Scene.tsx`.
8. Add an audio `case` in `weatherAudio.setState()` in `audio.ts`.

---

## File map

```
weather-vibe/
├── conditions.ts          # WeatherState type, PALETTES, WMO code mapping
├── useWeather.ts          # Location → live weather data hook
├── Scene.tsx              # Canvas, FX table, GROUND_Y, Environment switcher
├── HUD.tsx                # On-screen temperature / wind / city / vibe overlay
├── usePan.ts              # Camera drift / pan animation hook
├── audio.ts               # Audio engine + AUDIO_ASSETS manifest
├── environments/
│   ├── CityScape.tsx      # Building silhouettes (urban only)
│   ├── GrassField.tsx     # Shared grass shader component
│   ├── ClearDay.tsx
│   ├── ClearNight.tsx
│   ├── PartlyCloudy.tsx
│   ├── PartlyCloudyNight.tsx
│   ├── Overcast.tsx
│   ├── Fog.tsx
│   ├── FogNight.tsx
│   ├── Rain.tsx
│   ├── Snow.tsx
│   └── Storm.tsx
└── shaders/
    ├── grassBlade.vert.glsl   # Blade geometry reconstruction + wind
    ├── grassBlade.frag.glsl
    ├── atmosphere.vert/frag   # Sky gradient
    ├── starField.vert/frag    # Night stars
    ├── fogMarch.frag.glsl     # Volumetric fog (day)
    ├── fogMarchNight.frag.glsl
    ├── heatShimmer.frag.glsl  # Clear day shimmer
    └── wetGlass.vert/frag     # Rain screen effect
```

---

## APIs used

| Service | Purpose | Cost |
|---------|---------|------|
| [open-meteo.com](https://open-meteo.com) | Live weather (WMO codes, wind, temperature) | Free |
| [geocoding-api.open-meteo.com](https://geocoding-api.open-meteo.com) | City name → coordinates | Free |
| [bigdatacloud.net](https://api.bigdatacloud.net) | Coordinates → city name + urban/rural detection | Free tier |
| Browser Geolocation API | Initial coordinates | Built-in |

Weather refreshes every 5 minutes. Coordinates are cached in `localStorage` so the scene is instant on repeat visits.
