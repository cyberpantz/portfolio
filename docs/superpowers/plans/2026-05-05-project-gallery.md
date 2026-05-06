# Project Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `screenshot` field on each project with a multi-image gallery that crossfades between images with a minimal thumbnail strip below.

**Architecture:** `ProjectVisual` (inline in `Projects.tsx`) is replaced by a new `ProjectGallery` component that accepts `imageIdx` and `onImageChange` as props, keeping gallery state owned by `Projects.tsx`. Project-level and gallery-level keyboard navigation are unified into a single `useEffect` in `Projects.tsx`, replacing the existing `useKeyboardNav` hook usage. Crossfade is a CSS `animate-gallery-in` keyframe triggered by React `key` remounting on the `<img>`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Astro 6

---

### Task 1: Update data model and animation

**Files:**
- Modify: `src/data/projects.ts`
- Modify: `tailwind.config.mjs`

- [ ] **Step 1: Update the `Project` interface — replace `screenshot` with `images`**

In `src/data/projects.ts`, replace:

```ts
export interface Project {
  id: string;
  name: string;
  tagline: string;
  url: string | null;
  tags: string[];
  year: string;
  description: string;
  /** Hex placeholder color until a real screenshot is added. */
  color: string;
  /** Path relative to /public, e.g. '/projects/crumb-1.png'. */
  screenshot?: string;
}
```

with:

```ts
export interface Project {
  id: string;
  name: string;
  tagline: string;
  url: string | null;
  tags: string[];
  year: string;
  description: string;
  /** Hex placeholder color shown when images is absent or empty. */
  color: string;
  /** Paths relative to /public. First image is the hero. */
  images?: string[];
}
```

- [ ] **Step 2: Seed Crumb images, remove screenshot fields**

Replace the full `PROJECTS` array:

```ts
export const PROJECTS: Project[] = [
  {
    id: 'crumb',
    name: 'The Crumb',
    tagline: 'AI sourdough bake journal & diagnosis',
    url: 'https://thecrumb.app',
    tags: ['LLM', 'Vision API', 'React', 'Node'],
    year: '2024',
    description:
      'Photograph your loaf, get an AI diagnosis of the crumb structure, and learn exactly what to adjust on the next bake. Built with a vision LLM, React frontend, and Node backend. Solves a real problem I had — sourdough is finicky and the feedback loop is slow.',
    color: '#8b5e3c',
    images: [
      '/projects/thecrumb/thecrumb-1.png',
      '/projects/thecrumb/thecrumb-2.png',
      '/projects/thecrumb/thecrumb-3.png',
      '/projects/thecrumb/thecrumb-4.png',
      '/projects/thecrumb/thecrumb-5.png',
    ],
  },
  {
    id: 'fleet-monitor',
    name: 'Fleet Monitor',
    tagline: 'Real-time EV charging dashboard concept',
    url: null,
    tags: ['React', 'WebSocket', 'D3', 'TypeScript'],
    year: '2023',
    description:
      'Personal exploration of real-time fleet data visualization patterns developed alongside my work at ChargePoint. Experiments in dense data tables, live status indicators, and constraint-aware scheduling UI.',
    color: '#2a4a7a',
  },
  {
    id: 'type-specimen',
    name: 'Type Specimen',
    tagline: 'Interactive typography explorer',
    url: null,
    tags: ['Vanilla JS', 'CSS', 'Typography'],
    year: '2023',
    description:
      'A personal tool for exploring typeface pairings and optical sizing. Drag sliders, compare specimens, export CSS variables. Built in a weekend to scratch my own itch.',
    color: '#3a3a3a',
  },
];
```

- [ ] **Step 3: Add `gallery-in` animation to `tailwind.config.mjs`**

Add to `animation`:

```js
'gallery-in': 'galleryIn 0.15s ease-out both',
```

Add to `keyframes`:

```js
galleryIn: {
  '0%':   { opacity: '0', transform: 'translateY(6px)' },
  '100%': { opacity: '1', transform: 'translateY(0)' },
},
```

The full `animation` block should now read:

```js
animation: {
  'fade-up':    'fadeUp 0.7s cubic-bezier(0.4,0,0.2,1) both',
  'fade-up-2':  'fadeUp 0.7s 0.1s cubic-bezier(0.4,0,0.2,1) both',
  'fade-up-3':  'fadeUp 0.7s 0.2s cubic-bezier(0.4,0,0.2,1) both',
  blink:        'blink 1.1s step-end infinite',
  'gallery-in': 'galleryIn 0.15s ease-out both',
},
```

- [ ] **Step 4: Verify TypeScript sees no errors yet**

```bash
cd /Users/frankyoung/Documents/Projects/portfolio/frank-portfolio && npx astro check 2>&1 | grep -v "^$"
```

Expected: errors only about `screenshot` being referenced in `Projects.tsx` (not yet updated). Zero errors from `projects.ts` or `tailwind.config.mjs`.

- [ ] **Step 5: Commit**

```bash
git add src/data/projects.ts tailwind.config.mjs
git commit -m "feat: replace screenshot with images array, add gallery-in animation"
```

---

### Task 2: Create `ProjectGallery` component

**Files:**
- Create: `src/components/ProjectGallery.tsx`

- [ ] **Step 1: Create the file**

```tsx
import type { Project } from '../data/projects';

interface Props {
  project: Project;
  imageIdx: number;
  onImageChange: (idx: number) => void;
}

function Placeholder({ color, label }: { color: string; label: string }) {
  const safeId = label.replace(/\W+/g, '-');
  return (
    <div
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
      style={{ background: color }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]">
        <defs>
          <pattern
            id={`h-${safeId}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="12" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#h-${safeId})`} />
      </svg>
      <span className="font-mono text-[11px] text-white/30 tracking-[0.08em] relative">
        {label}
      </span>
    </div>
  );
}

export default function ProjectGallery({ project, imageIdx, onImageChange }: Props) {
  const images = project.images ?? [];
  const hasMultiple = images.length > 1;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main image */}
      <div className="relative flex-1 overflow-hidden bg-ink-surface">
        {images.length > 0 ? (
          <img
            key={`${project.id}-${imageIdx}`}
            src={images[imageIdx]}
            alt={`${project.name} screenshot ${imageIdx + 1}`}
            className="w-full h-full object-cover animate-gallery-in"
          />
        ) : (
          <Placeholder color={project.color} label="screenshot" />
        )}

        {hasMultiple && (
          <div className="absolute bottom-4 left-4 font-mono text-[10px] text-white/30 tracking-[0.1em]">
            {String(imageIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Thumbnail strip — only when >1 image */}
      {hasMultiple && (
        <div className="flex border-t border-rule flex-shrink-0" style={{ height: 48 }}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onImageChange(i)}
              className={`relative flex-1 overflow-hidden cursor-pointer transition-opacity
                          ${i < images.length - 1 ? 'border-r border-rule' : ''}
                          ${i === imageIdx ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
              {i === imageIdx && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProjectGallery.tsx
git commit -m "feat: add ProjectGallery component with crossfade and thumbnail strip"
```

---

### Task 3: Update `Projects.tsx`

**Files:**
- Modify: `src/components/Projects.tsx`

This task removes `ProjectVisual`, removes `useKeyboardNav`, and replaces them with `ProjectGallery` and a unified two-level keyboard handler.

- [ ] **Step 1: Replace `Projects.tsx` entirely**

```tsx
import { useState, useEffect } from 'react';
import { PROJECTS } from '../data/projects';
import { Tag } from './ui/Tag';
import ProjectGallery from './ProjectGallery';

export default function Projects() {
  const [activeProject, setActiveProject] = useState(0);
  const [activeImage, setActiveImage] = useState(0);

  // Reset to first image when project changes
  useEffect(() => {
    setActiveImage(0);
  }, [activeProject]);

  // Unified keyboard nav: gallery-level first, project-level at boundaries
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const imageCount = PROJECTS[activeProject]?.images?.length ?? 0;

      if (e.key === 'ArrowRight') {
        if (imageCount > 1 && activeImage < imageCount - 1) {
          setActiveImage((i) => i + 1);
        } else {
          setActiveProject((i) => (i + 1) % PROJECTS.length);
        }
      }
      if (e.key === 'ArrowLeft') {
        if (imageCount > 1 && activeImage > 0) {
          setActiveImage((i) => i - 1);
        } else {
          setActiveProject((i) => (i - 1 + PROJECTS.length) % PROJECTS.length);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeProject, activeImage]);

  const proj = PROJECTS[activeProject]!;

  return (
    <section id="projects" className="py-24 border-b border-rule">
      <div className="px-12 max-w-[900px] mx-auto">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-muted mb-8 uppercase">
          Projects
        </div>
        <h2
          className="font-serif font-normal text-fg mb-14 leading-[1.1]"
          style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}
        >
          Things <span className="text-accent italic">built.</span>
        </h2>
      </div>

      <div className="grid grid-cols-2 border-y border-rule" style={{ minHeight: 440 }}>
        {/* Left: gallery */}
        <div className="border-r border-rule bg-ink-surface overflow-hidden">
          <ProjectGallery
            project={proj}
            imageIdx={activeImage}
            onImageChange={setActiveImage}
          />
        </div>

        {/* Right: project detail */}
        <div className="px-12 py-10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-[10px] text-accent tracking-[0.14em] mb-4 uppercase">
              {proj.year}
            </div>
            <h3 className="font-serif text-3xl text-fg mb-2 font-normal">{proj.name}</h3>
            <div className="font-mono text-xs text-fg-sub mb-6 tracking-[0.04em]">
              {proj.tagline}
            </div>
            <p className="text-sm text-fg-sub leading-[1.75] mb-7">{proj.description}</p>
            <div className="flex gap-1.5 flex-wrap mb-7">
              {proj.tags.map((t) => (
                <Tag key={t} label={t} tone="accent" />
              ))}
            </div>
          </div>

          {proj.url && (
            <a
              href={proj.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex self-start px-4 py-2 rounded-sm border border-accent/30 text-accent
                         font-mono text-[11px] tracking-[0.06em] no-underline
                         transition-colors hover:bg-accent/10"
            >
              visit site ↗
            </a>
          )}
        </div>
      </div>

      {/* Project selector strip */}
      <div className="flex px-12 border-b border-rule">
        {PROJECTS.map((p, i) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setActiveProject(i)}
            className={`flex-1 overflow-hidden relative cursor-pointer transition-all
                        ${i < PROJECTS.length - 1 ? 'border-r border-rule' : ''}
                        ${i === activeProject
                          ? 'opacity-100'
                          : 'opacity-40 hover:opacity-80 hover:-translate-y-0.5'
                        }`}
            style={{ height: 72 }}
          >
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: p.color }} />
            )}
            {i === activeProject && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
        <div className="flex items-center pl-5 font-mono text-[10px] text-fg-muted tracking-[0.06em] gap-1.5 flex-shrink-0">
          <span>← →</span>
          <span>navigate</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/frankyoung/Documents/Projects/portfolio/frank-portfolio && npx astro check 2>&1 | grep -v "^$"
```

Expected: zero errors.

- [ ] **Step 3: Manual verification in browser**

Start the dev server if not already running: `npm run dev`, then open http://localhost:4321 and check:

1. The Crumb is selected by default — first screenshot fills the left panel
2. A row of 5 thumbnails appears below the main image (48px tall)
3. Clicking a thumbnail crossfades the main image with a brief fade-up motion
4. The active thumbnail has a royal blue accent line at the bottom
5. Counter reads `01 / 05`, updates as you switch images
6. Arrow keys cycle gallery images; pressing right on `05 / 05` advances to Fleet Monitor
7. Arrow keys cycle back through gallery when going left from image `01 / 05`
8. Fleet Monitor and Type Specimen show the color placeholder, no thumbnail strip
9. The project selector strip (bottom row) shows the Crumb's first screenshot as its thumbnail; Fleet Monitor and Type Specimen show their placeholder colors

- [ ] **Step 4: Commit**

```bash
git add src/components/Projects.tsx
git commit -m "feat: wire ProjectGallery into Projects, unify keyboard nav"
```

---

### Task 4: Build verification and cleanup

**Files:**
- No changes — verification only

- [ ] **Step 1: Run full build**

```bash
cd /Users/frankyoung/Documents/Projects/portfolio/frank-portfolio && npm run build 2>&1 | tail -20
```

Expected: clean build with no TypeScript errors or warnings about unused imports.

- [ ] **Step 2: Note `useKeyboardNav` is unused**

`src/hooks/useKeyboardNav.ts` is no longer imported anywhere. Leave it in place — do not delete it. It is a general-purpose utility that may be reused for future interactive sections.

- [ ] **Step 3: Final commit if any stray changes**

If the build step produced any auto-fixes or the working tree is dirty:

```bash
git status
git add -p
git commit -m "chore: post-gallery build cleanup"
```

If the tree is clean, skip this step.
