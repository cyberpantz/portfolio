import type * as React from 'react';

/**
 * Pattern Match glyphs.
 *
 * Two jobs:
 *
 * 1. Replace the emojis. Emoji render differently on every platform,
 *    carry their own colour, and cannot be styled — none of which
 *    suits an editorial system.
 *
 * 2. Fix a real accessibility bug. The six pads were identical
 *    circles distinguished only by hue, which makes the game
 *    unplayable for a colour-blind player. Each pad now has its own
 *    silhouette, so the sequence is readable in monochrome and the
 *    colour becomes reinforcement rather than the only signal.
 */

export type PadShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross' | 'ring';

export const PAD_SHAPES: PadShape[] = [
  'circle',
  'square',
  'triangle',
  'diamond',
  'cross',
  'ring',
];

/** Muted rather than neon, and every one clears AAA on #0a0a0a. */
export const PAD_COLORS: Record<PadShape, string> = {
  circle: '#6fd0c2',   // 10.82:1 — the site accent
  square: '#d9a441',   //  8.80:1
  triangle: '#e0857f', //  7.38:1
  diamond: '#a99ae0',  //  7.91:1
  cross: '#7fb4de',    //  8.94:1
  ring: '#9fc48a',     // 10.12:1
};

/** Spoken names, so the sequence can be described rather than shown. */
export const PAD_NAMES: Record<PadShape, string> = {
  circle: 'Circle',
  square: 'Square',
  triangle: 'Triangle',
  diamond: 'Diamond',
  cross: 'Cross',
  ring: 'Ring',
};

const P: Record<PadShape, React.ReactNode> = {
  circle: <circle cx="16" cy="16" r="10" />,
  square: <rect x="6.5" y="6.5" width="19" height="19" />,
  triangle: <path d="M16 5.5 27 25.5H5z" />,
  diamond: <path d="M16 4.5 27.5 16 16 27.5 4.5 16z" />,
  cross: <path d="M12.6 4h6.8v8.6H28v6.8h-8.6V28h-6.8v-8.6H4v-6.8h8.6z" />,
  ring: (
    <>
      <circle cx="16" cy="16" r="10.5" fill="none" strokeWidth="5" stroke="currentColor" />
    </>
  ),
};

interface Props {
  shape: PadShape;
  size?: number;
  /** Dimmed until the pad lights up. */
  active?: boolean;
}

export function PadGlyph({ shape, size = 36, active = false }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{
        display: 'block',
        color: PAD_COLORS[shape],
        fill: shape === 'ring' ? 'none' : 'currentColor',
        opacity: active ? 1 : 0.45,
        transition: 'opacity 180ms ease',
      }}
    >
      {P[shape]}
    </svg>
  );
}

/**
 * Difficulty marks: one, two and three ascending bars. Reads as
 * "more" instantly, needs no icon library, and says the same thing
 * the brain / flame / skull emoji were gesturing at without the
 * platform roulette.
 */
export function DifficultyBars({ level, size = 28 }: { level: 1 | 2 | 3; size?: number }) {
  const bars = [
    { x: 2, y: 14, h: 10 },
    { x: 10, y: 9, h: 15 },
    { x: 18, y: 4, h: 20 },
  ];
  return (
    <svg
      viewBox="0 0 26 26"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width="6"
          height={b.h}
          fill="currentColor"
          opacity={i < level ? 1 : 0.22}
        />
      ))}
    </svg>
  );
}

/**
 * The six pad shapes in a row. Replaces the bouncing game-controller
 * emoji on the start screen with a preview of the actual game, which
 * is both on-system and more useful.
 */
export function GlyphRow({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 10 }} aria-hidden="true">
      {PAD_SHAPES.map((s) => (
        <PadGlyph key={s} shape={s} size={size} active />
      ))}
    </div>
  );
}
