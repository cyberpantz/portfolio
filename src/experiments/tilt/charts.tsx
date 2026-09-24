/**
 * The chart vocabulary for The Tilt.
 *
 * Hand-built SVG rather than a charting library, for three reasons that
 * matter here more than convenience:
 *
 * 1. Every pixel traces to a number in tilt.json. Recharts would interpose
 *    its own scales, ticks and rounding between the data and the screen, and
 *    this is a piece whose whole argument is that the numbers are checkable.
 * 2. The chapters need a shared coordinate system so a line drawn in chapter
 *    one can still be in the same place in chapter two. Libraries own their
 *    own layout and fight that.
 * 3. Accessibility. Each chart carries its own title and description and can
 *    be handed a table equivalent; generated SVG from a library cannot.
 *
 * Every component takes plain arrays. None of them fetch, derive or round —
 * the pipeline did that, and doing it twice is how two numbers drift apart.
 */

import type { ReactNode } from 'react';

export const W = 720, H = 420;
const PAD = { t: 28, r: 96, b: 36, l: 56 };

export type Scale = (v: number) => number;

/** Linear scales for the plot area. Shared so chapters stay registered. */
export function makeScales(xs: number[], yMin: number, yMax: number) {
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const x: Scale = (v) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y: Scale = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  return { x, y, x0, x1, yMin, yMax };
}

export const path = (xs: number[], ys: number[], sx: Scale, sy: Scale) =>
  xs.map((v, i) => `${i ? 'L' : 'M'}${sx(v).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join('');

/** An area between two series — used for the spare-beds gap. */
export const band = (xs: number[], hi: number[], lo: number[], sx: Scale, sy: Scale) =>
  path(xs, hi, sx, sy) +
  xs.map((v, i) => `L${sx(xs[xs.length - 1 - i]).toFixed(1)},${sy(lo[xs.length - 1 - i]).toFixed(1)}`).join('') +
  'Z';

export function Frame({
  title, desc, children, yTicks, xTicks, sx, sy, fmtY = (n: number) => `${n}`,
}: {
  title: string; desc: string; children: ReactNode;
  yTicks: number[]; xTicks: number[]; sx: Scale; sy: Scale;
  fmtY?: (n: number) => string;
}) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}
         style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
      <title>{title}</title>
      <desc>{desc}</desc>
      {yTicks.map((t) => (
        <g key={t}>
          {/* Gridlines at 8% rather than a solid rule: they orient the eye
              and must never compete with the data they sit behind. */}
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="currentColor" opacity="0.08" />
          <text x={PAD.l - 10} y={sy(t)} dy="0.32em" textAnchor="end"
                fontSize="11" fill="currentColor" opacity="0.5">{fmtY(t)}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={sx(t)} y={H - PAD.b + 18} textAnchor="middle"
              fontSize="11" fill="currentColor" opacity="0.5">{t}</text>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={sy(yTicks[0])} y2={sy(yTicks[0])}
            stroke="currentColor" opacity="0.25" />
      {children}
    </svg>
  );
}

/** A series label parked at the end of its own line, never in a legend. */
export function EndLabel({ x, y, children, dim }: { x: number; y: number; children: ReactNode; dim?: boolean }) {
  return (
    <text x={x + 8} y={y} dy="0.32em" fontSize="12" fill="currentColor"
          opacity={dim ? 0.45 : 0.95}>{children}</text>
  );
}

/*
 * A legend is a lookup table the reader has to hold in their head. With seven
 * bands that is seven round trips per glance. Labels at the end of each line
 * cost nothing and remove the round trip entirely — the reason this file has
 * no Legend component and is not getting one.
 */
