# Weather Vibe — Audio Assets

All audio files for the Weather Vibe experiment live in this directory.
Drop a file here, refresh, and it automatically blends into the soundscape.
No code changes needed — the engine checks for each file at runtime and layers
it in if found, or silently falls back to procedural synthesis if it's missing.

---

## How it works

Every weather state runs **procedural synthesis** as its base layer (pink-noise wind,
layered rain, fog drone, etc.). Recording files are **additive** — they stack on top
at the gain level shown below. Missing files are ignored, so you can add them one at a
time and the experience degrades gracefully if they're not there.

---

## Active files (already included)

| File | Used in | Notes |
|------|---------|-------|
| `frogs_and_crickets.wav` | Clear night | Main ambient loop |
| `birds_in_forest.wav` | Clear day | Main ambient loop |

---

## Optional enhancement slots

Drop any of these files into this folder to activate them.
Accepted formats: **WAV or MP3**, any sample rate (resampled automatically).
Stereo or mono both work. Loop points don't matter — files loop seamlessly.

| File | Used in | Gain | What to look for |
|------|---------|------|------------------|
| `rain_on_glass.wav` | Rain, Storm | 0.45 / 0.35 | Close-mic rain hitting a window. Rich low-mid character, not just hiss. |
| `city_ambience.wav` | Overcast, Rain | 0.28 / 0.10 | Distant city hum — traffic, low chatter, AC units. Should feel far away. |
| `ocean_surf.wav` | Clear day, Partly cloudy | 0.15 / 0.12 | Gentle breaking waves, not crashing surf. Blends quietly under birds/wind. |
| `storm_wind.wav` | Storm | 0.40 | Heavy sustained wind — howling, not just noise. Recorded outdoors in strong wind. |
| `forest_wind.wav` | Partly cloudy, Overcast | 0.30 / 0.20 | Wind moving through trees — rustling leaves, creaking branches. |
| `snow_ambience.wav` | Snow | 0.40 | Quiet winter ambience — slight wind, maybe distant crows or silence. Very subtle. |
| `fog_ambience.wav` | Fog | 0.35 | Damp quiet — distant foghorn, muffled water, dripping. Low energy. |

---

## Where to find free sounds

All of these have good CC0/CC-BY options:

- **[freesound.org](https://freesound.org)** — largest free library, filter by CC0.
  Search terms that work well: `rain window`, `ocean waves calm`, `city ambience night`,
  `wind strong`, `forest wind`, `winter ambience`, `foghorn`.

- **[soundsnap.com](https://soundsnap.com)** — professionally recorded, subscription but high quality.

- **[BBC Sound Effects](https://sound-effects.bbcrewind.co.uk)** — free for personal/non-commercial use.
  Excellent weather sounds.

- **[FREESOUND packs worth grabbing](https://freesound.org)**:
  - Search for "rain window ambience" — look for 2–5 min recordings, not single drops
  - Search for "city night ambience" — avoid anything with prominent voices or music
  - Search for "ocean waves loop" — look for seamless loops tagged as such

---

## Editing tips

- **Normalize to -6 dBFS** before saving. The engine handles relative mixing via the
  gain values above — starting too hot causes clipping when multiple layers combine.
- **Fade the loop points** — even a 100ms crossfade at the loop boundary prevents clicks.
  Audacity's "Crossfade Clips" effect works well for this.
- **Trim silence** from the start. A file that begins with 500ms of silence will create
  an audible gap before it loops.
- **WAV at 44.1 kHz / 16-bit** is a good default — small enough to load fast, no compression
  artifacts. 48 kHz is fine too.

---

## Adjusting gain levels

If a recording feels too loud or quiet relative to the procedural layer, edit `audio.ts`
and change the second argument to `loadRecording()` for that asset. The gain is a linear
scalar: `0.5` is half volume, `1.0` is unity.

```ts
// In setState(), rain case — bump rain_on_glass up slightly:
await this.loadRecording(AUDIO_ASSETS.rain_on_glass, 0.55, dest); // was 0.45
```
