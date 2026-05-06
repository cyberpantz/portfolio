# Project Gallery Design

**Date:** 2026-05-05
**Status:** Approved

## Summary

Replace the single `screenshot` field on each project with a multi-image gallery. The main project panel crossfades between images with a minimal filmstrip of thumbnails below. No new dependencies, no new UI chrome beyond the thumbnail strip.

A fullscreen expand button is a known future addition — not in scope here.

---

## Data Model

In `src/data/projects.ts`, replace:

```ts
screenshot?: string;
```

with:

```ts
images?: string[];
```

The first item in `images` is the hero/default image. If `images` is absent or empty, the existing color placeholder renders unchanged — fully backwards compatible.

**Initial data:**
- The Crumb: `['/projects/thecrumb/thecrumb-1.png', ..., '/projects/thecrumb/thecrumb-5.png']`
- Fleet Monitor: no `images` (placeholder)
- Type Specimen: no `images` (placeholder)

---

## Interaction & Motion

- **Crossfade transition:** When the active image changes, the new image fades in with `opacity 0→1` + `translateY(6px)→0`, 150ms ease-out. Old image fades out simultaneously. Implemented via CSS transitions and a small keyframe already defined in `global.css`.
- **Thumbnail strip:** Renders below the main image only when `images.length > 1`. Inactive thumbnails at `opacity-40`, hover to `opacity-80`. Active thumbnail gets the accent underline (same pattern as the project selector strip).
- **Counter:** `01 / 05` in the bottom-left of the main image, same monospace style as the existing project counter.
- **Keyboard navigation:** Left/right arrows cycle gallery images when the active project has multiple images. On the first/last image, the next keypress advances to the next project — same behaviour as today for single-image projects.

---

## Component Architecture

### `ProjectGallery` (replaces `ProjectVisual`)

**Location:** `src/components/ProjectGallery.tsx`

**Props:**
```ts
interface ProjectGalleryProps {
  project: Project;
}
```

**State:**
- `activeImage: number` — resets to `0` whenever `project` changes

**Renders:**
- Main image area with crossfade CSS transition
- Thumbnail strip (conditional on `images.length > 1`)
- `01 / 05` counter overlay
- Colour placeholder if no images

### `useKeyboardNav` hook update

`src/hooks/useKeyboardNav.ts` gains a second mode: when the active project has `images.length > 1`, left/right arrows drive gallery navigation first. Overflow at the boundary advances the project, same as today.

### `Projects.tsx`

Replaces `<ProjectVisual>` with `<ProjectGallery>`. Passes down a gallery index setter so `useKeyboardNav` can coordinate project-level and image-level navigation.

---

## What's Not In Scope

- Fullscreen / lightbox view (future iteration)
- Swipe gestures on mobile (future iteration)
- Lazy loading / blur-up placeholders (future iteration)

---

## Future Upgrades

### Video support in the gallery

Extend the `images` field to a typed union so gallery items can be either images or videos:

```ts
type GalleryItem =
  | { type: 'image'; src: string }
  | { type: 'video'; src: string; poster?: string };

images?: GalleryItem[];
```

`ProjectGallery` would render a `<video>` element (muted, loop, controls hidden) for video items, and an `<img>` for image items. The crossfade transition applies to both. The thumbnail strip would show the `poster` frame for video items, with a small play-indicator overlay to distinguish them visually.

Backwards compatibility: the current `string[]` shorthand could be auto-coerced to `{ type: 'image', src }` at runtime, or a one-time migration of the data layer handles it at implementation time.
