# Weather Vibe — Design Spec

## Vision

A full-screen immersive WebGL experience that reads your local weather and generates a living, breathing 3D environment around it. The aesthetic sits at the intersection of Feltron's data precision, Tufte's information density, and sci-fi HUD design — a mood engine that feels both ancient and from the future.

**The experience is meditative above all else.** Nothing rushes. Nothing demands. The environment breathes slowly, the camera drifts gently, sounds emerge and recede. A user should be able to open this, set it aside, and feel calmer for having had it running. Every design decision — camera speed, refill rate, audio fade time, particle density — should be measured against this principle first.

---

## Aesthetic Language

**Feltron + Tufte + Sci-Fi convergence:**
- Monospaced data overlays with exact coordinates, temperature, condition, local time
- Thin hairline grid and tick marks at screen edges — feels like a measurement instrument
- Chromatic aberration, film grain, vignette — the world is being observed through a lens
- Color palettes shift completely per condition — not a tint, a full re-skin of the world
- Typography is sparse, precise, upper-case. No decoration. Everything shown has a reason.
- Subtle scan lines. The HUD reads like a field instrument from 2087.

---

## Tech Stack

- **React Three Fiber** (R3F) + **Three.js** — scene, camera, geometry
- **@react-three/drei** — helpers (stars, cloud, environment, text)
- **@react-three/postprocessing** — bloom, vignette, chromatic aberration, noise
- **GLSL custom shaders** — wet glass, condensation mask, atmosphere, heat shimmer, fog march, star field
- **Open-Meteo API** — free, no key, global weather (`api.open-meteo.com`)
- **Browser Geolocation API** — auto-detect coordinates
- **Web Audio API** — ambient soundscape per condition
- **Astro + React** — page wrapper and island mounting

---

## File Structure

```
src/
  experiments/
    WeatherVibe.tsx              # Root component — geolocation, fetch, state machine
    weather-vibe/
      Scene.tsx                  # R3F Canvas, postprocessing, camera rig
      useWeather.ts              # Hook: geolocation → Open-Meteo fetch → WeatherState
      conditions.ts              # WMO code → WeatherState mapper + palette definitions
      HUD.tsx                    # Feltron/Tufte/Sci-Fi data overlay (DOM, not WebGL)
      audio.ts                   # Audio manager — per-condition ambient loops
      environments/
        ClearDay.tsx             # Sunny sky, heat shimmer, drifting camera
        ClearNight.tsx           # Star field, moon, fireflies, cricket audio
        PartlyCloudy.tsx         # Mixed sky, drifting clouds
        Overcast.tsx             # Flat grey world, diffuse light
        Rain.tsx                 # Glass window + condensation mechanic + 3D world behind
        Snow.tsx                 # Particle snow, silence, muted palette
        Fog.tsx                  # Volumetric fog march, slow forward drift
        Storm.tsx                # Glass window + lightning flash + electric tint
      shaders/
        wetGlass.glsl            # Droplet accumulation, streaks, refraction
        condensation.glsl        # Fog mask — cleared by mouse/touch, slowly refills
        atmosphere.glsl          # Sky gradient — sun angle, color bands
        heatShimmer.glsl         # UV perturbation for sunny days
        fogMarch.glsl            # Raymarched volumetric fog
        starField.glsl           # Procedural stars with twinkle
  pages/
    explorations/
      weather-vibe.astro         # Page wrapper
  public/
    audio/
      weather-vibe/              # ⏸ AUDIO GATE — see Audio section below
```

---

## Weather States

Mapped from **WMO weather interpretation codes** returned by Open-Meteo, plus `is_day` flag:

| State | WMO Codes | is_day | Camera |
|---|---|---|---|
| `clear-day` | 0 | 1 | Within environment |
| `clear-night` | 0 | 0 | Within environment |
| `partly-cloudy` | 1, 2 | any | Within environment |
| `overcast` | 3 | any | Within environment |
| `fog` | 45, 48 | any | Within environment (drifting) |
| `rain` | 51–67, 80–82 | any | Inside + glass window |
| `snow` | 71–77, 85, 86 | any | Within environment |
| `storm` | 95, 96, 99 | any | Inside + glass window |

Fallback: if geolocation is denied or fetch fails, default to `clear-night`.

---

## Environment Designs

All camera movements are **slow and unhurried**. No abrupt cuts. Transitions between states cross-fade over 3 seconds. The viewer should never feel startled.

### `clear-day`
- **Camera:** Very slow upward tilt from horizon toward zenith. One full tilt over ~90 seconds, then gently reverses. Slight lateral drift adds life.
- **Scene:** Atmospheric sky gradient (deep blue at zenith, haze at horizon). Procedural sun disc with soft lens flare. Heat shimmer shader on horizon geometry — subtle UV perturbation, almost subliminal.
- **Palette:** Warm ambers, sky blues, white haze.
- **HUD accent:** Gold/amber.
- **Audio:** See audio gate below.

### `clear-night`
- **Camera:** Extremely slow rotation around vertical axis. One full revolution over ~4 minutes. Slightly tilted up — you are lying on your back looking at stars.
- **Scene:** Procedural star field shader (density, twinkle, color temperature variation — some stars are warm, some cold). Moon — a sphere with emissive material and soft glow halo. Firefly particles drift lazily at ground level, blinking in and out.
- **Palette:** Deep navy, purple-black, silver-white stars.
- **HUD accent:** Silver/pale blue.
- **Audio:** See audio gate below.

### `partly-cloudy`
- **Camera:** Gentle horizontal drift, looking upward at ~45°. Clouds pass overhead.
- **Scene:** Volumetric cloud layer (drei `<Cloud>`) drifting slowly on a consistent wind vector. Dappled light breaks through cloud gaps and moves across the ground plane. Sky gradient shifts between cloud-grey and clear blue as clouds pass.
- **Palette:** Steel grey and sky blue, shifting.
- **HUD accent:** Muted blue-grey.
- **Audio:** See audio gate below.

### `overcast`
- **Camera:** Very slow forward drift at low altitude — just above ground level.
- **Scene:** Flat diffuse sky dome (no visible light source). Ground plane with a faint procedural texture — suggests earth or pavement without being literal. Muted, desaturated world. Horizon is barely distinguishable from sky.
- **Palette:** Slate grey, dark taupe.
- **HUD accent:** Cool grey.
- **Audio:** See audio gate below.

### `fog`
- **Camera:** Slow forward drift — feels like walking into the unknown at a contemplative pace. Camera bobs very slightly (1–2px amplitude) to suggest footsteps without being distracting.
- **Scene:** Raymarched volumetric fog shader fills the world. Procedural tree silhouettes emerge from the fog at ~20 units distance and dissolve back as the camera approaches — they are never fully reached. Fog density breathes slowly (±10% over a 30-second cycle). Pale diffuse light comes from an undefined direction.
- **Palette:** Pale grey-green, white, muted sage.
- **HUD accent:** Pale sage.
- **Audio:** See audio gate below.

### `rain` ← The signature interaction

**The meditative read:** You are inside. It is raining. The window has fogged up. You are not in a hurry. Slowly, you reach up and clear a patch of glass with your hand and look out at the world beyond.

- **Scene architecture (two layers):**
  1. **Glass layer (foreground):** Full-screen quad with wet glass shader. Condensation covers the glass. Rain streaks animate slowly downward — not violently, not frantically. A few streaks per second. Some merge. Some stop midway.
  2. **3D world (behind glass):** Full rain environment — dark moody sky, rain particle system (angled slightly, varying fall speeds), reflective wet ground plane with subtle puddle ripple geometry, distant tree silhouettes barely visible in rain haze.

- **The condensation mechanic:**
  - On load, the glass is ~85% fogged. The world is almost entirely obscured.
  - Mouse drag / touch drag paints black into the condensation mask at cursor UV position (~40px radius, gaussian falloff, soft edges). The cleared area reveals the 3D world with only the wet glass refraction remaining.
  - **Refill rate:** `+0.0017` per frame at 60fps — a fully cleared patch takes ~10 seconds to re-fog completely. Unhurried. The user has time to look.
  - A faint finger-smear texture follows the cursor during clearing, suggesting physical contact with glass.
  - The remaining fogged areas show only diffuse light and rain streak silhouettes — the world is present but hidden.
  - **Hint:** After 8 seconds with no interaction, a single slow cursor-trail animation plays automatically in a corner of the glass — a suggestion that the surface can be touched. It plays once only.

- **Camera:** Fixed. You are inside, stationary.
- **Palette:** Deep teal, slate blue, near-black.
- **HUD accent:** Deep teal.
- **Audio:** See audio gate below.

### `snow`
- **Camera:** Slow forward-and-slightly-downward drift — you are walking through falling snow, watching it settle.
- **Scene:** Thousands of white flakes at varying sizes and fall speeds. Some drift laterally on a slow wind. Ground plane gradually appears more covered (visual morph only — no physics). Sky is a pale uniform white-grey, sourceless light. Near-silence emphasised by the visual weight of the flakes.
- **Palette:** White, pale ice blue, silver.
- **HUD accent:** Ice white.
- **Audio:** See audio gate below.

### `storm`
- **Scene architecture:** Same two-layer glass setup as `rain`, but everything is heightened:
  - Glass tinted near-black with electric blue cast.
  - Rain streaks are faster and denser.
  - **Lightning:** Periodic full-scene brightness spike via a shader uniform — not a flash object, but the entire world momentarily overexposed. Interval is random (12–30 seconds). Intensity varies. Each lightning event triggers a corresponding audio rumble with a 1–3 second delay (simulating distance). The world behind the glass briefly becomes fully visible at peak flash.
  - The 3D world behind the glass is darker and more wind-distorted than rain.
  - **Condensation refill:** Same 10-second rate as rain — storm does not rush the user.

- **Camera:** Fixed inside.
- **Palette:** Near-black, electric blue, deep purple.
- **HUD accent:** Electric blue.
- **Audio:** See audio gate below.

---

## The HUD

A DOM layer (not WebGL) rendered over the canvas. Keeps the 3D scene uncluttered.

**Top-left:** Coordinates (lat/lon to 4 decimal places). Monospaced, 10px, 25% opacity.
**Top-right:** Local time (updates live, HH:MM:SS). Condition label in caps.
**Bottom-left:** Temperature in °C and °F. Wind speed in km/h.
**Bottom-right:** Vibe word (see below). 14px, 60% opacity — the most readable element.

**Grid:** 1px hairlines at screen edges. Small corner bracket marks (not full frame). Feels like a viewfinder, not a cage.

**Scan lines:** 1px lines at 4px intervals, 3% opacity. Present but subliminal.

**Color:** All HUD elements use the condition accent color at low opacity. The HUD whispers. It does not shout.

**Audio toggle:** Small mute icon, bottom-center. No label. Icon only.

---

## Color Palettes

| State | Background | Accent | HUD |
|---|---|---|---|
| clear-day | `#87CEEB` → `#FDB97D` | `#F5A623` | `#F5A623` |
| clear-night | `#0A0A1A` → `#1A1A3E` | `#C8D8F0` | `#C8D8F0` |
| partly-cloudy | `#B0C4D8` → `#6B8CAE` | `#7B9FC7` | `#7B9FC7` |
| overcast | `#7A7A7A` → `#4A4A4A` | `#9A9A9A` | `#9A9A9A` |
| fog | `#C8CCBE` → `#8A9A88` | `#A0B09A` | `#A0B09A` |
| rain | `#1A2A3A` → `#0D1A26` | `#2A7A8A` | `#2A7A8A` |
| snow | `#E8EEF4` → `#B8C8D8` | `#D0E0F0` | `#D0E0F0` |
| storm | `#050810` → `#0A0F1E` | `#2244AA` | `#2244AA` |

---

## Audio

### Design Principle

Sound in this experience is not background filler — it is the other half of the atmosphere. The audio layer should feel **spatially present**, as if the environment has genuine acoustic depth. All sounds fade in gradually (3–5 seconds) on first user interaction (Web Audio API gesture requirement). All transitions between states cross-fade over 4 seconds.

The binaural direction remains open. If pursued, the implementation switches from simple stereo loops to HRTF-processed spatial audio — left/right panning becomes genuine 3D head-related positioning. This would particularly benefit `clear-night` (crickets surrounding you), `fog` (sounds arriving from undefined distances), and `rain` (glass positioned in front, world sounds behind and muffled). Flag for a separate conversation before implementation begins.

---

### ✅ AUDIO GATE 1 — Resolved

**Approach: Hybrid (Path C).** Procedural synthesis for wind, rain, fog, and snow as a working baseline — real CC0 field recordings swapped in later if they feel thin. One exception:

**`clear-night` uses a real cricket recording.** The meditative quality of that environment depends on organic texture that procedural chirp cannot replicate. Source: Freesound.org, CC0 license. Required asset: a looping outdoor cricket field recording, ideally 60–120 seconds, stereo, minimal wind or road noise.

> **Asset needed before `ClearNight.tsx` is built:** `public/audio/weather-vibe/crickets.mp3`

All other states start procedural. The audio manager should be designed so recordings can be dropped in to replace procedural layers without restructuring.

---

### Intended Soundscape Per State

| State | Primary | Secondary | Character |
|---|---|---|---|
| clear-day | Gentle wind | Distant birds (sparse) | Warm, open, unhurried |
| clear-night | Cricket loop | Low wind (very quiet) | Still, vast, alive |
| partly-cloudy | Wind (medium) | Occasional gust | Present but soft |
| overcast | Low wind hum | — | Heavy, blanketing |
| fog | Near-silence drone | One distant drip every 8–15s | Eerie, contemplative |
| rain | Rain on glass (stereo) | World rain (muffled, behind) | Interior, sheltered |
| snow | Wind whisper (barely present) | — | Hushed, the quietest state |
| storm | Heavy rain (glass) | Thunder events (delayed) | Controlled tension |

---

### ✅ AUDIO GATE 2 — Resolved

**Thunder: distant rumble only.** Low-frequency sub-bass roll, 3–6 seconds duration. No sharp transient crack. Never startling. Generated procedurally via Web Audio API — filtered noise burst with a slow attack and long decay, pitched low (~40–80 Hz). The storm environment remains meditative even at its most dramatic.

---

## Open-Meteo API

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}
  &longitude={lon}
  &current_weather=true
  &timezone=auto
```

Response fields used:
- `current_weather.weathercode` → WMO code → state
- `current_weather.is_day` → day/night split
- `current_weather.temperature` → HUD display
- `current_weather.windspeed` → HUD display

---

## Post-Processing Per State

| State | Bloom | Vignette | ChromaticAberration | Noise |
|---|---|---|---|---|
| clear-day | High | Low | Low | Low |
| clear-night | High | High | Medium | Medium |
| partly-cloudy | Low | Medium | Low | Low |
| overcast | None | High | Low | Medium |
| fog | Low | High | High | High |
| rain | Low | High | Medium | Medium |
| snow | Medium | Medium | Low | Low |
| storm | Medium | High | High | Medium |

---

## Condensation Mechanic — Technical Detail

The condensation mask is a **render target texture** (512×512).

- **Init:** Flood fill with white (fully fogged, ~85% coverage).
- **Clear gesture:** On mouse/touch drag, write black into the texture at cursor UV coordinates. Brush radius ~40px. Gaussian falloff for soft, natural edges that suggest a real hand on glass.
- **Refill:** Each frame, lerp every texel slightly toward white at rate `+0.0017` per frame at 60fps. A fully cleared patch takes **~10 seconds** to completely re-fog. This is intentionally slow — the user has earned their view.
- **The glass shader** uses this mask as a uniform: where mask is white → full condensation (blur, opacity, streak overlay). Where mask is black → world visible with wet-glass refraction only (still slightly distorted, still glassy, but see-through).
- **Hint animation:** After 8 seconds of no interaction, a single automated smear plays once in the lower-left corner — a gentle invitation, not a tutorial. Never repeats.

---

## Loading / Permission States

1. **Loading:** Black screen. HUD fades in first with `LOCATING...`. Environment fades in once weather data arrives.
2. **Geolocation denied:** Default to `clear-night`. HUD shows `LOCATION UNKNOWN`.
3. **Fetch failed:** Same fallback.
4. **Slow connection:** Begin rendering `clear-night` immediately. HUD shows `SYNCING` until real data arrives, then cross-fades into the correct environment.

All loading states are calm. No spinners. No progress bars. Just presence.

---

## Vibe Words (Bottom-Right HUD)

| State | Word |
|---|---|
| clear-day | OPEN |
| clear-night | STILL |
| partly-cloudy | DRIFTING |
| overcast | MUTED |
| fog | ADRIFT |
| rain | INSIDE |
| snow | HUSHED |
| storm | ELECTRIC |
