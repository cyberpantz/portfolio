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
    Skrillatime.tsx             💵 real-time wage comparison tool
    PatternMatch.tsx            🎮 Simon-style memory game
    KitchenDodgeball.tsx        🍳 canvas dodge game
  data/                         typed content (experience, projects, explorations)
  hooks/                        useActiveSection, useKeyboardNav
  styles/global.css             Tailwind base + CSS custom properties
public/
  sounds/                       audio files for experiments
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

---

## Deploy

Deploys to Netlify in one step — see **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough including custom domain setup with Namecheap.

---

## License

MIT — Frank Young, 2026
