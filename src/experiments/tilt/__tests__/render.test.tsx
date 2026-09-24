/**
 * The Tilt — render and data checks.
 *
 * tsc proves the types line up. It does not prove a component renders, and it
 * certainly does not prove the numbers on screen are the numbers in the file.
 * Both have gone wrong on this site before, which is why this exists.
 *
 * Run through __tests__/run.sh (esbuild bundle, then node).
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../../data/tilt.json';
import { SOURCES, assertNoUnverifiedClaims } from '../../../data/incarceration-sources';
import {
  ChapterDecline, ChapterBands, ChapterTilt, ChapterEliminations, ChapterCapacity,
  ChapterConstruction, ChapterPretrial, ChapterLookup,
} from '../chapters';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error('  FAIL  ' + m); } };

/* ---- every chapter renders, and renders something ------------------- */
console.log('\nChapters render');
const CH: [string, ReactElement][] = [
  ['decline', <ChapterDecline />],
  ['bands/count', <ChapterBands mode="count" />],
  ['bands/rate', <ChapterBands mode="rate" />],
  /* Server-rendered, so the WebGL probe in useEffect has not run and this
     exercises the 2D fallback — which is the path that has to work when
     WebGL is absent, reduced motion is set, or the canvas throws. */
  ['tilt/fallback', <ChapterTilt />],
  ['eliminations', <ChapterEliminations />],
  ['capacity', <ChapterCapacity />],
  ['construction', <ChapterConstruction />],
  ['pretrial', <ChapterPretrial />],
  ['lookup', <ChapterLookup />],
];
const html: Record<string, string> = {};
for (const [name, el] of CH) {
  try {
    html[name] = renderToStaticMarkup(el);
      /* The lookup is a search field and is correctly near-empty until
       somebody types. Every other chapter draws immediately. */
    const floor = name === 'lookup' ? 120 : 200;
    ok(html[name].length > floor, `${name} rendered ${html[name].length} chars — suspiciously empty`);
  } catch (e) {
    fails++; console.error(`  FAIL  ${name} threw: ${(e as Error).message}`);
  }
}
console.log(`  ${CH.length} chapters`);

/* ---- no NaN reaches the screen --------------------------------------
 * An SVG path with NaN in it renders as nothing at all — a blank chart that
 * looks like a styling problem rather than a maths one.
 */
console.log('\nNo NaN in any path');
for (const [name, markup] of Object.entries(html)) {
  ok(!/NaN|Infinity|undefined/.test(markup), `${name} contains NaN, Infinity or undefined`);
}
console.log('  clean');

/* ---- the charts draw the data, not a copy of it ----------------------
 * The chapters take their numbers from tilt.json. These assertions fail if
 * someone hard-codes a figure into a component, which is exactly how the
 * Wage Gap rate drifted away from the data that produced it.
 */
console.log('\nFigures trace to the data file');
const bands = data.bands;
const ratio0 = bands[0].rate[0] / bands[bands.length - 1].rate[0];
const ratio1 = bands[0].rate.at(-1)! / bands[bands.length - 1].rate.at(-1)!;
ok(Math.abs(ratio0 - 1.31) < 0.02, `2002 ratio is ${ratio0.toFixed(2)}, expected ~1.31`);
ok(Math.abs(ratio1 - 2.61) < 0.02, `2019 ratio is ${ratio1.toFixed(2)}, expected ~2.61`);
console.log(`  gradient ${ratio0.toFixed(2)}x → ${ratio1.toFixed(2)}x`);

/* The gradient descends cleanly from the SECOND band down, and the smallest
 * band sits below its neighbour rather than above it.
 *
 * I asserted seven-band monotonicity first, and this check failed it, which
 * is the only reason the piece does not currently claim something untrue.
 * The exception is real and has a cause: 38% of counties under 5,000 people
 * are flagged as regional jails against 19% of the next band up, so the
 * smallest counties frequently share a facility and their own rate is
 * measured on a different basis. It is described, not smoothed away.
 */
const last = bands.map((b) => b.rate.at(-1)!);
let mono = true;
for (let i = 2; i < last.length; i++) if (last[i] > last[i - 1]) mono = false;
ok(mono, `2019 rates are not descending from the second band down: ${last.join(' > ')}`);
ok(last[0] < last[1],
   `the smallest band (${last[0]}) is no longer below the second (${last[1]}) — chapter 3 describes that exception and would need rewriting`);
console.log(`  descending from band 2: ${last.slice(1).join(' > ')}   (smallest ${last[0]}, the stated exception)`);

/* Capacity above population in the final year is the whole of chapter 5. */
const { people, beds, spare } = data.ch5;
ok(beds.at(-1)! > people.at(-1)!, 'capacity is not above population in 2019');
ok(spare.at(-1)! === beds.at(-1)! - people.at(-1)!, 'spare beds do not equal beds minus people');
console.log(`  spare beds ${spare[0].toLocaleString()} → ${spare.at(-1)!.toLocaleString()}`);

/* ICE sits inside pretrial, so its share of the pretrial change must be a
   fraction, not a headline. If this ever exceeds 50% the framing in
   chapter 6 needs rewriting rather than quietly leaving. */
const rural = (data.ch6.byUrbanicity as Record<string, { iceShareOfPretrialChange: number }>).rural;
ok(rural.iceShareOfPretrialChange < 50,
   `ICE is ${rural.iceShareOfPretrialChange}% of the rural pretrial change — chapter 6 claims it is a minority`);
console.log(`  ICE = ${rural.iceShareOfPretrialChange}% of the rural pretrial change`);

/* ---- panels are stated, and real ------------------------------------ */
console.log('\nPanels');
ok(data.ch1.panel > 2000, `rate panel is only ${data.ch1.panel} counties`);
/* The lookup index is fetched from public/ at runtime rather than bundled, so
   nothing at build time would notice if the pipeline stopped writing it, or
   wrote a shape the component cannot read. Read it off disk and check both. */
const counties: import('../Lookup').County[] = JSON.parse(require('fs').readFileSync(__dirname + '/../../../../public/tilt-counties.json', 'utf8'));
ok(counties.length === data.ch1.panel,
   `lookup has ${counties.length} counties but the panel is ${data.ch1.panel}`);
ok(counties.every((c) => c.rate.length === data.ch1.years.length),
   'some counties do not carry one rate per year — the chart would draw a short line');
ok(counties.every((c) => c.pct >= 0 && c.pct <= 100), 'a percentile is outside 0–100');
ok(counties.every((c) => (c.beds === undefined) === (c.people === undefined)),
   'a county has beds without people or people without beds — the bed chart draws both or neither');
ok(counties.every((c) => !c.beds || c.beds.length === data.ch1.years.length),
   'a capacity series is short, which would draw as capacity vanishing');
/* The percentile has to be a real rank, or the strip under the headline is
   decoration. Check the extremes against the panel the ranks came from. */
{
  const sorted = [...counties].sort((a, b) => a.rate.at(-1)! - b.rate.at(-1)!);
  ok(sorted[0].pct <= 1 && sorted.at(-1)!.pct >= 99,
     `percentiles do not span the panel: lowest rate is p${sorted[0].pct}, highest p${sorted.at(-1)!.pct}`);
}
console.log(`  ${data.ch1.panel.toLocaleString()} counties, ${counties.filter((c) => c.beds).length.toLocaleString()} with capacity, series and ranks intact`);

/* ---- the county report, which no search runs under test ---------------
 * The axis under the county line is computed from that county's own maximum,
 * because 373 counties exceed 1,000 per 100,000 and one reaches 56,757. A
 * fixed axis would clip them silently. A dynamic one can divide by zero, take
 * the log of nothing, or emit a NaN into a path — so every county in the
 * panel is rendered here, not a sample of three.
 */
console.log('\nEvery county renders');
{
  const { CountyReport } = require('../Lookup') as typeof import('../Lookup');
  let bad = 0, worst = '';
  for (const c of counties) {
    let m = '';
    try { m = renderToStaticMarkup(<CountyReport c={c} />); }
    catch (e) { bad++; worst ||= `${c.name} threw: ${(e as Error).message}`; continue; }
    if (/NaN|Infinity/.test(m)) { bad++; worst ||= `${c.name} drew a NaN`; }
  }
  ok(bad === 0, `${bad} counties failed to render — first: ${worst}`);
  /* The outlier is the case the fixed axis got wrong, so name it. */
  const top = [...counties].sort((a, b) => b.rate.at(-1)! - a.rate.at(-1)!)[0];
  ok(renderToStaticMarkup(<CountyReport c={top} />).includes(top.rate.at(-1)!.toLocaleString()),
     `the highest-rate county (${top.name}, ${top.rate.at(-1)}) does not print its own 2019 rate`);
  console.log(`  ${counties.length.toLocaleString()} rendered clean, including ${top.name} at ${top.rate.at(-1)!.toLocaleString()} per 100,000`);
}

/* The 2D/3D switch works in BOTH directions.
 *
 * The first version had a single flag doing two jobs, so "show as a chart"
 * overwrote the WebGL capability check and there was no state left that
 * remembered 3D had ever been possible. One-way. This renders the fallback
 * path and asserts the way back is present and labelled as a return.
 */
console.log('\nThe surface toggle is two-way');
{
  const f = html['tilt/fallback'] ?? '';
  /* Server-rendered, so the capability probe has not run: can3d is false and
     no switch should be offered at all rather than a dead one. */
  ok(!/Show as a/.test(f),
     'the fallback offers a 3D switch before WebGL has been confirmed — it would be dead on click');
  const src = require('fs').readFileSync(__dirname + '/../chapters.tsx', 'utf8');
  ok(/Show as a flat chart/.test(src) && /Show as a surface/.test(src),
     'chapters.tsx has no return path from the flat chart to the surface');
  ok(/aria-pressed=\{showing3d\}/.test(src),
     'the switch does not announce its state');
}
console.log('  both labels present, and none offered before WebGL is confirmed');

/* No <title> inside any chart SVG.
 *
 * It renders as a native browser tooltip that trails the cursor across the
 * chart — visible in a screenshot before anyone thought to look for it. The
 * accessible name comes from aria-label, which produces no such thing.
 */
console.log('\nNo native tooltips');
for (const [name, markup] of Object.entries(html)) {
  ok(!/<title>/.test(markup), `${name} has a <title> element, which renders as a native tooltip`);
  if (name !== 'eliminations' && name !== 'lookup') {
    ok(/aria-label=/.test(markup), `${name} has no aria-label, so it has no accessible name either`);
  }
}
console.log('  charts named by aria-label, no <title> anywhere');

/* The fallback must be the real chart, not an apology. If chapter three
   server-renders to a placeholder, a reader without WebGL gets nothing. */
ok(/<svg/.test(html['tilt/fallback'] ?? ''), 'chapter 3 fallback did not render an SVG chart');
ok((html['tilt/fallback'] ?? '').includes('over 500k'),
   'chapter 3 fallback is missing the band labels — it is not the real chart');
console.log('  chapter 3 falls back to the real 2D chart');

/* ---- sourcing ------------------------------------------------------- */
console.log('\nSources');
/* Every sourceId a chart actually cites, so a figure can never quietly
   point at something nobody opened. */
const RENDERED = ['vera-data', 'vera-codebook', 'vera-construction', 'vera-build-it', 'vera-trends-tool'];
try {
  assertNoUnverifiedClaims(RENDERED);
  console.log(`  ${RENDERED.length} sources carrying figures, all opened directly`);
} catch (e) {
  fails++; console.error('  FAIL  ' + (e as Error).message);
}
/* Credit is not optional: Vera's finding must be named in the piece. */
ok(SOURCES.some((x) => x.id === 'vera-out-of-sight'), 'Out of Sight is not credited');

console.log(fails ? `\n${fails} FAILED\n` : '\nAll Tilt checks passed\n');
process.exit(fails ? 1 : 0);
