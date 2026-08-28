# Frank Young — Portfolio ✦

Personal portfolio and creative lab. Built to be fast, minimal, and a little bit weird.

🔗 **[frankyoung.dev](https://frankyoung.dev)**

---

## Stack

| | |
|---|---|
| **Astro** | Static-first framework — ships zero JS by default; React only where interaction is needed |
| **React + TypeScript** | Powers the interactive components (timeline, carousel, experiments) |
| **Tailwind CSS** | Utility-class styling with a custom semantic color palette |
| **Recharts** | SVG charting for the Skrillatime experiment |
| **Framer Motion** | Transitions, spring animations, AnimatePresence |
| **DM Serif Display · DM Sans · JetBrains Mono** | Typography |

---

## Project structure

```
src/
  pages/
    index.astro                 main portfolio page
    explorations/               one page per experiment
  layouts/
    Base.astro                  HTML shell, fonts, meta tags
  components/
    Nav.tsx                     fixed nav with active-section tracking
    Hero.tsx                    typewriter intro
    Work.tsx                    expandable role timeline
    Projects.tsx                screenshot carousel with keyboard nav
    Explorations.astro          experiment card grid
    Skills.astro                skill matrix
    Contact.astro               contact section
  experiments/
    WeatherVibe.tsx             🌦 immersive weather scene with live data + spatial audio
    weather-vibe/               engine: Scene, HUD, audio, conditions, locationTracks
    Skrillatime.tsx             💵 real-time wage comparison tool
    SimonSays.tsx               🎮 pattern memory game
    KitchenDodgeball.tsx        🍳 canvas dodge game
  data/                         typed content (experience, projects, explorations)
  hooks/                        useActiveSection, useKeyboardNav
  styles/global.css             Tailwind base + CSS custom properties
public/
  audio/
    weather-vibe/               ambient recordings + location track files (see README inside)
  projects/                     project screenshots
```

---

## Get started

```bash
pnpm install
pnpm dev
```

Open [localhost:4321](http://localhost:4321).

---

## Build & preview

```bash
pnpm build      # compiles to dist/
pnpm preview    # serves dist/ locally
```

Output is a plain static folder — no server required.

---

## Customization

- **Accent color** — `--accent` in `src/styles/global.css`
- **Content** — edit files under `src/data/`
- **Project screenshots** — drop images into `public/projects/` and reference in `src/data/projects.ts`

### Adding city-specific music to Weather Vibe

Open `src/experiments/weather-vibe/locationTracks.ts` and add an entry to `LOCATION_TRACKS`:

```ts
export const LOCATION_TRACKS: LocationEntry[] = [
  {
    city: 'New Orleans',   // bare city name — matches "New Orleans, Louisiana" etc.
    tracks: [
      { src: '/audio/weather-vibe/locations/new-orleans-jazz.mp3' },
      { src: '/audio/weather-vibe/locations/new-orleans-brass.mp3', gain: 0.8 },
    ],
  },
];
```

Drop the audio files into `public/audio/weather-vibe/locations/`. The tracks shuffle on each visit and advance automatically when each one ends.

**Behavior modes** (set per-track via `behavior`, defaults to `replace`):

| Mode | Effect |
|------|--------|
| `replace` | Location track plays via the ambient bus; ambient recordings are skipped. Procedural synths (wind, city hum, etc.) still play. |
| `layer` | Everything plays — location track is added on top of all existing audio. |
| `takeover` | Only the location track plays; all procedural and ambient audio is silenced. |

All tracks in one city entry should share the same `behavior` value — the first shuffled track's behavior applies for the entire visit.

See `public/audio/weather-vibe/README.md` for file format, gain, and editing tips.

---

## Deploy

Deploys to Netlify in one step — see **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough including custom domain setup with Namecheap.

---

## License

MIT — Frank Young, 2026
