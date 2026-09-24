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
 *    one is still in the same place in chapter two.
 * 3. Accessibility. Each chart carries its own title, description and source,
 *    and the hover layer is reachable from a keyboard.
 */

import { useState, type ReactNode, type KeyboardEvent } from 'react';
import { byId } from '../../data/incarceration-sources';
import s from './tilt.module.css';

export const W = 720, H = 420;
const PAD = { t: 28, r: 96, b: 36, l: 56 };

export type Scale = (v: number) => number;

export function makeScales(xs: number[], yMin: number, yMax: number) {
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const x: Scale = (v) => PAD.l + ((v - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y: Scale = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  return { x, y, x0, x1, yMin, yMax };
}

export const path = (xs: number[], ys: number[], sx: Scale, sy: Scale) =>
  xs.map((v, i) => `${i ? 'L' : 'M'}${sx(v).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join('');

export const band = (xs: number[], hi: number[], lo: number[], sx: Scale, sy: Scale) =>
  path(xs, hi, sx, sy) +
  xs.map((v, i) => `L${sx(xs[xs.length - 1 - i]).toFixed(1)},${sy(lo[xs.length - 1 - i]).toFixed(1)}`).join('') +
  'Z';

/**
 * A readout at a point in time, driven by hover OR keyboard.
 *
 * Deliberately not a floating tooltip. A tooltip that follows the pointer
 * covers the data it describes, cannot be reached without a pointer, and has
 * to be dismissed. This is a fixed panel in the chart's own top-left with a
 * guide line down the plot — the reader's eye already knows where to look,
 * and arrow keys move it.
 */
export type HoverSpec = {
  xs: number[];
  rows: { label: string; values: number[]; ink?: string }[];
  fmt?: (n: number) => string;
};

export function Frame({
  title, desc, children, yTicks, xTicks, sx, sy, fmtY = (n: number) => `${n}`,
  sourceId = 'vera-data', hover,
}: {
  title: string; desc: string; children: ReactNode;
  yTicks: number[]; xTicks: number[]; sx: Scale; sy: Scale;
  fmtY?: (n: number) => string;
  sourceId?: string;
  hover?: HoverSpec;
}) {
  const [at, setAt] = useState<number | null>(null);
  const src = byId(sourceId);
  const n = hover?.xs.length ?? 0;
  const step = n > 1 ? (sx(hover!.xs[1]) - sx(hover!.xs[0])) : 0;
  const fmt = hover?.fmt ?? ((v: number) => v.toLocaleString());

  const onKey = (e: KeyboardEvent) => {
    if (!hover) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setAt((i) => Math.min((i ?? -1) + 1, n - 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((i) => Math.max((i ?? n) - 1, 0)); }
    else if (e.key === 'Escape') setAt(null);
  };

  return (
    <figure className={s.figure}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}
           tabIndex={hover ? 0 : -1}
           onKeyDown={onKey}
           onBlur={() => setAt(null)}
           onMouseLeave={() => setAt(null)}
           className={hover ? s.interactive : undefined}
           style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/*
          No <title> element. It would be the accessible name — but aria-label
          on the <svg> already is, and <title> ALSO renders as a native browser
          tooltip that follows the cursor around on top of the chart. <desc> is
          announced without producing one.
        */}
        <desc>{desc}</desc>
        {yTicks.map((t) => (
          <g key={t}>
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

        {hover && at !== null && (() => {
          /*
           * Values are printed AT their own line, not gathered into a panel.
           *
           * The panel this replaced listed seven rows in the top-left: it
           * covered the two largest series, repeated labels that are already
           * at the line ends, and sat a long way from the guide the reader
           * was actually looking at. Putting each number beside its own dot
           * removes the journey and the lookup at once.
           *
           * Labels are nudged apart vertically where lines run close, because
           * two numbers on top of each other are worth less than one.
           */
          const gx = sx(hover.xs[at]);
          const right = gx < W - PAD.r - 90;
          const placed = hover.rows
            .map((r, i) => ({ r, i, y: sy(r.values[at]) }))
            .sort((a, b) => a.y - b.y);
          const MIN = 13;
          for (let i = 1; i < placed.length; i++) {
            if (placed[i].y - placed[i - 1].y < MIN) placed[i].y = placed[i - 1].y + MIN;
          }
          return (
            <g pointerEvents="none">
              <line x1={gx} x2={gx} y1={PAD.t - 2} y2={H - PAD.b}
                    stroke="currentColor" opacity="0.28" />
              <rect x={gx - 20} y={PAD.t - 20} width={40} height={16} rx={3}
                    fill="currentColor" opacity={0.9} />
              <text x={gx} y={PAD.t - 12} dy="0.32em" textAnchor="middle" fontSize="11"
                    fontWeight={500} className={s.chipText}>{hover.xs[at]}</text>
              {hover.rows.map((r, i) => (
                <circle key={`d${i}`} cx={gx} cy={sy(r.values[at])} r={3.5}
                        fill={r.ink ?? 'currentColor'} />
              ))}
              {placed.map(({ r, i, y }) => (
                <text key={`v${i}`} x={right ? gx + 9 : gx - 9} y={y} dy="0.32em"
                      textAnchor={right ? 'start' : 'end'} fontSize="11.5" fontWeight={500}
                      fill={r.ink ?? 'currentColor'}
                      stroke="#131315" strokeWidth={3} paintOrder="stroke">
                  {fmt(r.values[at])}
                </text>
              ))}
            </g>
          );
        })()}

        {/* One hit area per step. Invisible, but a real target — the chart is
            useless to a pointer if the hover zones are the 2px lines. */}
        {hover && hover.xs.map((v, i) => (
          <rect key={v} x={sx(v) - step / 2} y={PAD.t - 8} width={Math.max(step, 6)} height={H - PAD.t - PAD.b + 8}
                fill="transparent" onMouseEnter={() => setAt(i)} />
        ))}
      </svg>
      <figcaption>
        {hover && <span className={s.hint}>Hover, or focus and use ← →</span>}
        <a href={src.url} target="_blank" rel="noopener noreferrer">{src.publisher}{src.date ? `, ${src.date}` : ''}</a>
      </figcaption>
    </figure>
  );
}

export function EndLabel({ x, y, children, dim }: { x: number; y: number; children: ReactNode; dim?: boolean }) {
  return (
    <text x={x + 8} y={y} dy="0.32em" fontSize="12" fill="currentColor"
          opacity={dim ? 0.45 : 0.95}>{children}</text>
  );
}

/*
 * A legend is a lookup table the reader has to hold in their head. With seven
 * bands that is seven round trips per glance. Labels at the end of each line
 * cost nothing and remove the round trip — the reason this file has no Legend
 * component and is not getting one.
 */
