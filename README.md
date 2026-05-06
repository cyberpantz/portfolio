# Frank Young — Personal Portfolio

A single-page portfolio site. Astro + React + TypeScript + Tailwind.

## Stack

- **Astro** — static-first, ships zero JS by default; React only where it needs to be interactive
- **React + TypeScript** — for the interactive bits (work history expand, project carousel, nav)
- **Tailwind CSS** — for utility-class styling with a custom semantic palette
- **DM Serif Display + DM Sans + JetBrains Mono** — typography

## Structure

```
src/
  pages/index.astro          single-page entry
  layouts/Base.astro         HTML shell, fonts, meta
  components/
    Nav.tsx                  fixed top nav with active-section highlight
    Hero.tsx                 typewriter intro
    Work.tsx                 expandable role timeline
    Projects.tsx             screenshot carousel with keyboard nav
    Explorations.astro       static card grid
    Skills.astro             static skill matrix
    Contact.astro            static contact info
    Footer.astro             static footer
    ui/Tag.tsx               accent + gray tag pills
  data/                      typed content (experience, projects, etc.)
  hooks/                     useActiveSection, useKeyboardNav
  styles/global.css          Tailwind + CSS variables
```

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:4321.

## Build

```bash
npm run build
npm run preview
```

Deploys cleanly to Vercel, Netlify, Cloudflare Pages, or any static host.

## Customization

- **Accent color** — change `--accent` in `src/styles/global.css`
- **Content** — edit files under `src/data/`
- **Project screenshots** — drop into `public/projects/` and reference by path in `src/data/projects.ts`

## Deploy

```bash
# Vercel
npx vercel

# Netlify
npx netlify deploy --build --prod
```

## License

MIT — Frank Young, 2026
