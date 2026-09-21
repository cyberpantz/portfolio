# Click-Wheel Player — Spec & Build Plan

Portfolio exploration: a retro click-wheel music player built as a React island for an Astro site. TypeScript, no UI libraries, no runtime CSS-in-JS — the visual work is all CSS modules + one canvas. The goal is a component that looks like a photographed object, not a flat illustration — if it can't hit that bar, it isn't worth shipping.

A note on trade dress: this is *inspired by* the classic click-wheel player, not a replica. No Apple logo, wordmark, or menu copy. The boot screen shows your own mark. Proportions and materials are original interpretations.

---

## 1. Goals

- Reads as a physical object: chrome back, brushed-polycarbonate face, glass over an LCD.
- LCD that behaves like an LCD: backlight that fades, pixel grid, glass reflection, slight parallax.
- Real audio player underneath: playlist in, play/pause/seek/volume out, honest buffering state.
- One orchestrated entrance: the device rises from below the viewport, then boots.
- Drop-in for the portfolio: one `<ClickWheelPlayer client:visible tracks={...} />` in an `.astro` page.

## 2. Non-goals

- Mobile touch wheel parity (it should work on touch, but the desktop pointer experience is the showcase).
- Cover Flow, EQ, games, or a full menu tree. Three screens max.
- Streaming DRM, HLS, or non-`<audio>` sources.

---

## 3. Public API

```tsx
// src/components/clickwheel/ClickWheelPlayer.tsx
export type Track = {
  title: string; artist: string; album?: string;
  src: string;            // any format <audio> can decode
  art?: string;           // dithered to 1-bit on load
};

export type PlayerState =
  | 'booting' | 'idle' | 'playing' | 'paused' | 'buffering' | 'error';

export type ClickWheelPlayerProps = {
  tracks: Track[];
  theme?: 'silver' | 'black';
  autoBoot?: boolean;     // run entrance + boot on mount (default true)
  volume?: number;        // 0–1, default 0.7
  clicks?: boolean;       // wheel tick sound, default true
  onTrackChange?: (track: Track, index: number) => void;
  onStateChange?: (state: PlayerState) => void;
};

export type ClickWheelPlayerHandle = {
  play(): void; pause(): void; next(): void; prev(): void;
  seek(seconds: number): void; setVolume(v: number): void;
  sleep(): void; wake(): void;   // backlight off/on
};

// forwardRef so a parent island can drive it
const ClickWheelPlayer = forwardRef<ClickWheelPlayerHandle, ClickWheelPlayerProps>(...)
```

Usage in Astro:

```astro
---
import ClickWheelPlayer from '../components/clickwheel/ClickWheelPlayer';
import tracks from '../data/tracks.json';
---
<ClickWheelPlayer client:visible tracks={tracks} theme="silver" />
```

`client:visible` so the entrance fires when the visitor scrolls to it, not on page load. `tracks` is plain JSON so Astro can serialize it across the island boundary; callbacks can't cross that boundary, so they're only for React-side parents.

Accepted `src`: any format the browser's `<audio>` can decode (mp3, m4a/aac, ogg, wav, flac where supported). Unsupported formats mark the track with a small "!" in the list and skip on play.

---

## 4. Anatomy

```
  ┌─────────────────────────┐
  │ ┌─────────────────────┐ │   ← chrome bezel (outer body)
  │ │ ▛▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▜ │ │
  │ │ ▌  LCD  (glass)     ▐ │ │   ← screen, 4:3, inset
  │ │ ▙▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▟ │ │
  │ │                       │ │
  │ │       ╭───────╮       │ │
  │ │     ╭─┤ MENU  ├─╮     │ │
  │ │     │◀   ( )   ▶│     │ │   ← wheel: ring + center button
  │ │     ╰─┤ ▶∥    ├─╯     │ │
  │ │       ╰───────╯       │ │
  │ └─────────────────────┘ │
  └─────────────────────────┘
```

Device: ~260 × 420 px at 1×, scaled via a single CSS custom property `--pod-scale` so it stays crisp. Everything is proportional to that.

### 4.1 Body

Proportions from the reference: body ~2:3.2, screen sits in the upper third with roughly equal side margins, wheel diameter ≈ 65% of body width, center button ≈ 35% of wheel. Corner radius on the body is large and continuous (superellipse, not a plain `border-radius`).

- Face: near-white polycarbonate. Subtle vertical brushed texture via a repeating linear gradient at 1px, ≤4% opacity.
- Edge: 2–3px chrome bevel — a conic-gradient border that shifts from bright to dark to simulate a rounded metal lip.
- Drop shadow: two layers, one tight and dark, one large and soft, offset downward.
- Black theme swaps face to deep graphite with a finer, glossier brush.

### 4.2 Screen (the hero — spend the effort here)

Layered, bottom to top:

1. **Backlight** — a radial gradient, brighter at center, pale blue-white (`#d3dfef` → `#b7c6de`). Driven by `--backlight` (0–1). Off state is a dead grey-green LCD (`#7f8a7a`).
2. **LCD content** — 176 × 132 logical pixels, rendered into a `<canvas>` and upscaled with `image-rendering: pixelated`. Ink is deep navy (`#1e2d5c`), never black. Real pixel font (bitmap-style, ~7px cap height). No anti-aliasing — that's what makes it read as an LCD.
3. **Pixel grid** — a 1px repeating grid overlay at ~8% opacity so the screen has visible cell structure up close.
4. **Ghosting** — when content changes, the previous frame lingers for ~80ms at reduced opacity. Cheap trick, huge realism.
5. **Glass** — a diagonal specular highlight (linear gradient, white 0→18%→0) plus a faint inner shadow at the top edge where the glass meets the bezel.
6. **Parallax** — glass highlight and backlight hotspot shift ±3px opposite to pointer movement across the device. Disabled under `prefers-reduced-motion`.

Backlight behaviour: full on any interaction, fades to 15% after 8s idle, off after 30s idle while paused. Any wheel touch wakes it in 120ms.

### 4.3 Wheel

- Ring: flat, very light warm grey (`#e3e4e6`), sitting almost flush with the face — the reference wheel is barely recessed, so the edge is a soft 1px tonal step rather than a deep shadow. Four glyphs at N/E/S/W in a slightly lighter grey, almost invisible until you look.
- Center button: convex, slightly raised, catches a highlight. Press state translates it 1px down and darkens the rim.
- Input model: pointer down anywhere on the ring starts a "scrub"; angle delta from the device center accumulates into ticks (every 12° = 1 tick). Ticks drive list selection, scrubbing, or volume depending on the active screen. Hitting the ring corners (glyph zones) on release without significant rotation counts as a button tap.
- Feedback per tick: a 12ms `AudioContext` click (square-wave blip, ~2kHz, very quiet, respects a `clicks: false` option) and a 1-frame visual nudge on the selected list row.

---

## 5. Screens (LCD content)

Only three. Each is a small render function drawing to the canvas.

**Boot**
Screen dark → backlight ramps 0→1 over 600ms → `BootScreen` runs the potato loop (`lcd/bootBlob.ts`: cycling walk-and-flip, moonwalk, and the robot) with the "TWERKALIZING... PLEASE WAIT" header while the first track's metadata loads (min 2s so it's never a flash) → cuts to Menu. Optional single low chime. The blob is a `render(frame, imageData)` function, so `Screen.tsx` can drive it from its own rAF loop and layer the ghosting/glass effects on top like any other screen.

**Menu** (list)
Centered title in the header with a battery glyph at the right and a 1px rule beneath. List rows have a right-aligned chevron when they lead to a submenu: *Music ›*, *Extras ›*, *Settings ›*, *Shuffle songs*, *Backlight*. Selected row is a solid navy bar with the label knocked out to the backlight colour. Wheel scrolls, center selects, MENU goes back. *Music* is the same list component fed with tracks; *Extras* holds the boot blob as a hidden toy.

**Now playing**
Track index (`3 of 12`), title, artist, album (each truncated with a scrolling marquee if too long, only for the title), small dithered album art on the left if `art` is provided (converted to 1-bit ordered dither on load — this is the detail that sells it), and a progress bar with elapsed / remaining. Wheel = seek (each tick 2% of duration, held = accelerates). Center press = toggle a volume overlay for 2s where wheel = volume. Status glyph top-right: ▶, ∥, or a rotating buffering spinner (4-frame ASCII).

---

## 6. Audio engine

Single `<audio>` element, `preload="metadata"`, `crossorigin="anonymous"` when `art` or analyser is used.

State machine:

```
idle ─load→ loading ─canplay→ ready ─play→ playing
playing ─waiting→ buffering ─playing→ playing
playing ─pause→ paused ─play→ playing
* ─error→ error (show "Can't play this track", skip after 2s)
```

- Buffering: drive from the `waiting` / `playing` / `progress` events. The progress bar shows a lighter "buffered" segment from `audio.buffered` ranges behind the elapsed segment.
- Preload the next track's metadata when the current one passes 80%.
- Volume: `audio.volume`, 0–1 in 0.05 steps, persisted to memory only (no storage APIs).
- Seek: set `currentTime`; if the target is outside buffered ranges, immediately flip to `buffering` so the UI is honest.
- Autoplay policy: the boot sequence never starts audio. First user press on the wheel unlocks the `AudioContext` and playback.

---

## 7. Entrance + boot choreography

One sequence, once per mount. Total ≈ 2.4s.

| t (ms) | Event |
|---|---|
| 0 | Device sits at `translateY(120vh)`, screen dark |
| 0–900 | Rises with a spring-ish ease (`cubic-bezier(.2,.9,.25,1.1)`), tiny overshoot, settles. Shadow grows in sync so it reads as lifting into the light |
| 900–1500 | Backlight ramps 0 → 1 |
| 1100–2000 | Boot mark fades in and holds |
| 2000–2400 | Cut to Menu, first row highlighted |
| 2400 | Idle timer starts; `onStateChange('idle')` |

`prefers-reduced-motion`: device fades in over 300ms in place, backlight snaps on, boot mark holds 600ms.

---

## 8. Visual quality bar (the "don't bother" test)

Before calling it done, at 1× and 2× device pixel ratio:

- The bezel reads as metal, not a grey border. If the conic gradient looks banded, it fails.
- Screen text is crisp with visible pixel cells — no blurry upscaling.
- Glass highlight moves with the pointer without feeling gimmicky (≤3px).
- Wheel highlights are consistent with one light source, top-left.
- Nothing about it reads as a CSS "card". No rounded-rectangle-with-drop-shadow default look.

If any of these can't be hit in a single HTML file, the fallback is a static hi-res render for the portfolio and a note that the interactive version is in progress — not a half-good version.

---

## 9. Accessibility & robustness

- Every wheel action has a keyboard equivalent: arrows scroll/seek, Enter = center, Backspace/Esc = MENU, Space = play/pause, `+`/`-` = volume.
- Hidden live region announces track changes and play state.
- Focus ring drawn as a thin glow on the wheel, not a browser default box.
- Works with 0 tracks (Menu shows "No songs loaded").
- Handles network failure per track without stalling the playlist.

---

## 10. Build plan

1. **Static shell** — body, bezel, wheel, dead screen. Screenshot and fix materials until it passes §8. Don't proceed until this looks right; this is where most of the effort goes.
2. **LCD renderer** — canvas, pixel font, list + now-playing draw functions, ghosting, grid, glass layers, parallax.
3. **Wheel input** — angle math, tick generation, glyph hit zones, keyboard map, click sound.
4. **Audio engine** — state machine, buffered ranges, error path, preload.
5. **Screens wired to engine** — menu → songs → now playing, volume overlay.
6. **Boot & entrance** — timeline in one place, reduced-motion branch.
7. **Polish** — dithered album art, marquee, backlight idle behaviour, black theme.
8. **Portfolio integration** — the `.astro` page, `client:visible`, a short caption, and a sample playlist of your own tracks or CC-licensed audio in `public/audio/`.

Deliverable:

```
src/components/clickwheel/
  ClickWheelPlayer.tsx     island root, forwardRef, entrance timeline
  ClickWheelPlayer.module.css   body, bezel, wheel, glass layers, themes
  Screen.tsx               canvas LCD, ghosting, backlight
  BootScreen.tsx           thin wrapper that mounts the boot blob on a canvas
  Wheel.tsx                pointer/keyboard input → ticks + button events
  useAudioEngine.ts        <audio> state machine, buffered ranges, preload
  useIdleBacklight.ts      idle timers → --backlight
  lcd/
    bootBlob.ts            1-bit raster helpers + boot animation (done)
    font.ts, draw.ts       to be split out of bootBlob for the other screens
  index.ts
src/pages/explorations/clickwheel.astro   demo page + caption
```

Dev loop: `astro dev` with a `/explorations/clickwheel` page; screenshot at 1× and 2× after step 1 before moving on.

---

## 11. React / Astro specifics

- State: `useReducer` for the audio state machine; `useRef` for the `<audio>` element, `AudioContext`, and the canvas. No global store.
- Rendering the LCD: don't re-render React per frame. The canvas draw runs in a `requestAnimationFrame` loop reading from refs; React only re-renders on state transitions.
- Parallax and backlight write CSS custom properties directly on the root element via a ref, not through state, so pointer movement doesn't touch React.
- SSR: the island renders nothing meaningful on the server (canvas/audio are client-only); render the static shell so there's no layout shift, and guard `window`/`AudioContext` behind `useEffect`.
- `client:visible` + `IntersectionObserver` inside the component means the entrance starts once, on first sight. Guard with a ref so React strict-mode double-mount in dev doesn't run it twice.
- Cleanup in `destroy` becomes `useEffect` return: pause audio, close `AudioContext`, cancel rAF, clear idle timers.
- Types live in `index.ts`; the demo page imports only the component and the `Track` type.

## 12. Open decisions

- Silver or black as the default theme for the portfolio?
- Your boot mark: text, monogram, or an SVG you already have?
- Should the pixel font be hand-drawn (more work, more authentic) or a bitmap web font like a public-domain 5×7?
- Do you want the wheel click sound on by default? It's charming but some visitors will have audio off and never know it exists.
