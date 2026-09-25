/**
 * The seven chapters. One visual per chapter; if two would look the same,
 * one of them is not a chapter.
 *
 * Every figure here reads from tilt.json. There are no numbers typed into
 * this file — the Wage Gap lesson, where a hand-copied hourly rate drifted
 * from the data that produced it and nothing noticed for two years.
 */

import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import data from '../../data/tilt.json';
import { Frame, EndLabel, makeScales, path, band, W, H } from './charts';

/* Only chapter three loads three.js, and only when it is actually shown.
   Bundling ~600KB of WebGL into a page of line charts would be absurd. */
const Surface = lazy(() => import('./Surface'));
import s from './tilt.module.css';

const YEARS = data.ch1.years;
const XT = [2002, 2007, 2012, 2019];
const fmt = (n: number) => n.toLocaleString();
const k = (n: number) => `${Math.round(n / 1000)}k`;

/* Palette by band. One ramp, small to large, so size reads as colour
   without a legend. Every stop clears 4.5:1 on the page ground. */
const RAMP = ['#e8734a', '#e08a4e', '#c9975c', '#9c9a6e', '#6d9a8c', '#4f8fa8', '#4a7ab8'];

/* ── 1 ─────────────────────────────────────────────────────────────────── */
export function ChapterDecline() {
  const v = data.ch1.count;
  const sc = makeScales(YEARS, 560_000, 760_000);
  const peak = v.indexOf(Math.max(...v));
  return (
    <Frame title="US county jail population, 2002 to 2019"
           desc={`Rises from ${fmt(v[0])} in 2002 to a peak of ${fmt(v[peak])} in ${YEARS[peak]}, then falls to ${fmt(v.at(-1)!)} by 2019.`}
           yTicks={[560_000, 640_000, 720_000]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={k}
           hover={{ xs: YEARS, rows: [{ label: 'in jail', values: v }] }}>
      <path d={path(YEARS, v, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <circle cx={sc.x(YEARS[peak])} cy={sc.y(v[peak])} r={4} fill="currentColor" />
      <text x={sc.x(YEARS[peak])} y={sc.y(v[peak]) - 14} textAnchor="middle" fontSize="12" fill="currentColor">
        peak {YEARS[peak]}
      </text>
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(v.at(-1)!)}>−7%</EndLabel>
    </Frame>
  );
}

/* ── 2 and 3 ───────────────────────────────────────────────────────────
 * The same seven series, twice. Chapter two shows counts, where the big
 * counties dominate and the story is hidden. Chapter three shows rates,
 * where it is not. Putting them in one component keeps the geometry
 * registered between the two, so the transition is the argument.
 */
export function ChapterBands({ mode, toggle }: { mode: 'count' | 'rate'; toggle?: ReactNode }) {
  const bands = data.bands;
  const series = bands.map((b) => (mode === 'count' ? b.count : b.rate));
  const all = series.flat();
  const sc = makeScales(YEARS, mode === 'count' ? 0 : 200, Math.max(...all) * 1.08);
  const yTicks = mode === 'count' ? [0, 100_000, 200_000] : [200, 400, 600, 800];
  return (
    <Frame
      title={mode === 'count' ? 'Jail population by county size' : 'Jail rate by county size, per 100,000 residents aged 15–64'}
      desc={mode === 'count'
        ? 'Seven size bands. The largest counties hold most people, which conceals the divergence in the rates.'
        : `In 2002 the smallest counties jailed at ${bands[0].rate[0]} per 100,000 against ${bands.at(-1)!.rate[0]} in the largest. By 2019 it is ${bands[0].rate.at(-1)} against ${bands.at(-1)!.rate.at(-1)}.`}
      yTicks={yTicks} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={mode === 'count' ? k : fmt}
      hover={{ xs: YEARS, fmt: mode === 'count' ? k : fmt,
               rows: bands.map((b, i) => ({ label: b.label, values: series[i], ink: RAMP[i] })) }}
      extra={toggle}>
      {bands.map((b, i) => (
        <path key={b.key} d={path(YEARS, series[i], sc.x, sc.y)} fill="none"
              stroke={RAMP[i]} strokeWidth={2} opacity={0.92} />
      ))}
      {bands.map((b, i) => (
        <text key={b.key} x={sc.x(YEARS.at(-1)!) + 8} y={sc.y(series[i].at(-1)!)} dy="0.32em"
              fontSize="11" fill={RAMP[i]}>{b.label}</text>
      ))}
    </Frame>
  );
}

/* ── 3, in three dimensions ───────────────────────────────────────────
 *
 * The same seven bands and eighteen years as ChapterBands, as a surface:
 * size one way, time the other, rate as height.
 *
 * Falls back to the 2D chart, which is not a consolation prize — same
 * numbers, keyboard-readable, and it has a hover readout the surface does
 * not. Three reasons to fall back, checked in this order:
 *
 *   reduced motion  — an orbitable object is motion nobody asked for
 *   no WebGL        — old hardware, blocklisted drivers, some VMs
 *   a render error  — a WebGL context can be lost at any moment
 */
export function ChapterTilt() {
  /*
   * Three separate facts. Conflating any two makes the toggle one-way, since
   * a preference would then overwrite the capability check.
   *
   *   can3d   — WebGL exists and the reader has not asked for reduced motion
   *   want3d  — what the reader last chose
   *   failed  — the canvas threw, which no preference may undo
   */

  const [can3d, setCan3d] = useState(false);
  const [want3d, setWant3d] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const c = document.createElement('canvas');
      if (c.getContext('webgl2') ?? c.getContext('webgl')) setCan3d(true);
    } catch { /* stays 2D */ }
  }, []);

  const showing3d = can3d && want3d && !failed;

  /* The switch is offered whenever 3D is possible, in both directions, and
     disappears entirely when it is not — rather than sitting there dead. */
  const toggle = can3d && !failed ? (
    <button type="button" className={s.linkish} onClick={() => setWant3d((v) => !v)}
            aria-pressed={showing3d}>
      {showing3d ? 'Show as a flat chart' : 'Show as a surface'}
    </button>
  ) : null;

  if (!showing3d) {
    return <ChapterBands mode="rate" toggle={toggle} />;
  }

  const surface = {
    years: YEARS,
    bands: data.bands.map((b) => ({ label: b.label, rate: b.rate })),
  };
  return (
    <figure className={s.figure}>
      <div className={s.canvas}>
        <ErrorBoundary onError={() => setFailed(true)}>
          <Suspense fallback={<div className={s.loading}>Drawing the surface…</div>}>
            <Surface data={surface} />
          </Suspense>
        </ErrorBoundary>
      </div>
      <figcaption>
        <span className={s.hint}>Drag to turn it &middot; hover to read a value</span>
        {toggle}
      </figcaption>
      {/* The numbers, for anyone the canvas cannot serve. A <canvas> is opaque
          to assistive technology no matter how it is labelled. */}
      <div className={s.srOnlyInline}>
        <ChapterBands mode="rate" />
      </div>
    </figure>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { dead: boolean }> {
  state = { dead: false };
  static getDerivedStateFromError() { return { dead: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.dead ? null : this.props.children; }
}

/* ── 4 ─────────────────────────────────────────────────────────────────
 * Three eliminations, drawn deliberately plainly and on a shared axis that
 * makes flatness visible. Their going nowhere IS the content, so any styling
 * that made them interesting would be working against the point.
 */
export function ChapterEliminations() {
  const panels = [
    { k: 'held for other authorities', v: data.ch4.transfers.share, unit: '%', n: data.ch4.transfers.panel },
    { k: 'rural population', v: data.ch4.population.index, unit: ' (2002 = 100)', n: data.ch4.population.panel },
    { k: 'rural Latino share', v: data.ch4.demography.latinxShare, unit: '%', n: data.ch4.demography.panel },
  ];
  return (
    <div className={s.smallMultiples}>
      {panels.map((p) => {
        const lo = Math.min(...p.v), hi = Math.max(...p.v);
        const pad = Math.max((hi - lo) * 2, 4);
        const sc = makeScales(YEARS, lo - pad, hi + pad);
        return (
          <figure key={p.k} className={s.mini}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.k}
                 style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* aria-label above is the accessible name; a <title> here
                  would also produce a native tooltip. */}
              <desc>{`${p.v[0]}${p.unit} in 2002, ${p.v.at(-1)}${p.unit} in 2019.`}</desc>
              <line x1={56} x2={W - 96} y1={sc.y(p.v[0])} y2={sc.y(p.v[0])}
                    stroke="currentColor" opacity={0.18} strokeDasharray="4 4" />
              <path d={path(YEARS, p.v, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={3} />
            </svg>
            <figcaption>
              <b>{p.k}</b>
              <span>{p.v[0]}{p.unit} → {p.v.at(-1)}{p.unit}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ── 5 ─────────────────────────────────────────────────────────────────── */
export function ChapterCapacity() {
  const { people, beds, spare } = data.ch5;
  const sc = makeScales(YEARS, 560_000, 880_000);
  return (
    <Frame title="People in jail against rated capacity"
           desc={`Capacity rises from ${fmt(beds[0])} to ${fmt(beds.at(-1)!)} while population falls from its peak to ${fmt(people.at(-1)!)}. Spare beds grow from ${fmt(spare[0])} to ${fmt(spare.at(-1)!)}.`}
           yTicks={[600_000, 700_000, 800_000]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={k}
           hover={{ xs: YEARS, fmt, rows: [
             { label: 'beds', values: beds }, { label: 'people', values: people },
             { label: 'empty', values: spare }] }}>
      <path d={band(YEARS, beds, people, sc.x, sc.y)} fill="currentColor" opacity={0.12} />
      <path d={path(YEARS, beds, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.75} />
      <path d={path(YEARS, people, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(beds.at(-1)!)} dim>beds</EndLabel>
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(people.at(-1)!)}>people</EndLabel>
      <text x={(sc.x(2002) + sc.x(2019)) / 2} y={sc.y((beds[8] + people[8]) / 2)} textAnchor="middle"
            fontSize="12" fill="currentColor" opacity={0.8}>{fmt(spare.at(-1)!)} empty beds</text>
    </Frame>
  );
}

export function ChapterConstruction() {
  const c = data.ch5.construction;
  const max = Math.max(...c.count);
  const bw = (W - 152) / c.years.length;
  return (
    <Frame title="Jail construction projects per year, 2002 to 2022"
           desc={`Falls to ${Math.min(...c.count)} in ${c.years[c.count.indexOf(Math.min(...c.count))]} then rises to ${max} in ${c.years[c.count.indexOf(max)]}. ${c.total.toLocaleString()} projects in total.`}
           yTicks={[0, 100, 200]} xTicks={[2002, 2012, 2022]}
           sx={makeScales(c.years, 0, max).x} sy={makeScales(c.years, 0, max * 1.1).y}
           sourceId="vera-construction"
           hover={{ xs: c.years, rows: [{ label: 'projects', values: c.count }] }}>
      {c.count.map((v, i) => {
        const sc = makeScales(c.years, 0, max * 1.1);
        return <rect key={c.years[i]} x={sc.x(c.years[i]) - bw * 0.35} width={bw * 0.7}
                     y={sc.y(v)} height={Math.max(sc.y(0) - sc.y(v), 0)}
                     fill="currentColor" opacity={i === c.count.length - 1 ? 0.95 : 0.4} />;
      })}
    </Frame>
  );
}

/* ── 6 ─────────────────────────────────────────────────────────────────
 * Pretrial as a RATE only. The codebook says a single-day June count and an
 * average daily population are not directly comparable, so this does not
 * divide one by the other — it compares pretrial against itself over time.
 */
export function ChapterPretrial() {
  const u = data.ch6.byUrbanicity as Record<string, { pretrialRate: number[]; iceCount: number[]; n: number; iceShareOfPretrialChange: number }>;
  const keys = ['rural', 'small/mid', 'suburban', 'urban'];
  const all = keys.flatMap((x) => u[x].pretrialRate);
  const sc = makeScales(YEARS, Math.min(...all) * 0.9, Math.max(...all) * 1.08);
  const ink = ['#e8734a', '#c9975c', '#6d9a8c', '#4a7ab8'];
  return (
    <Frame title="Pretrial jail rate per 100,000 residents, by county type"
           desc={`Rural rises from ${u.rural.pretrialRate[0]} to ${u.rural.pretrialRate.at(-1)}. Urban falls from ${u.urban.pretrialRate[0]} to ${u.urban.pretrialRate.at(-1)}.`}
           yTicks={[150, 200, 250, 300, 350]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={fmt}
           hover={{ xs: YEARS, rows: keys.map((key, i) => ({ label: key, values: u[key].pretrialRate, ink: ink[i] })) }}>
      {keys.map((key, i) => (
        <path key={key} d={path(YEARS, u[key].pretrialRate, sc.x, sc.y)} fill="none"
              stroke={ink[i]} strokeWidth={2.2} />
      ))}
      {keys.map((key, i) => (
        <text key={key} x={sc.x(YEARS.at(-1)!) + 8} y={sc.y(u[key].pretrialRate.at(-1)!)} dy="0.32em"
              fontSize="11" fill={ink[i]}>{key}</text>
      ))}
    </Frame>
  );
}

/* ── 7 ──────────────────────────────────────────────────────────────── */

/*
 * The county lookup lives in its own file. It is the only chapter that
 * fetches at runtime — eighteen years for 2,513 counties is heavier than the
 * whole of the rest of the piece — and keeping that apparatus out of here
 * stops a page of line charts from inheriting a loading state it never needs.
 */
export { ChapterLookup } from './Lookup';
