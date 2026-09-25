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

/* ---- the piece itself, not only its parts ----------------------------
 *
 * This suite rendered eight chapters and never once rendered Tilt. A dangling
 * brace left in CHAPTERS while moving the lookup out of it took tsc down and
 * the suite still printed PASSED, because Tilt.tsx was only ever read as text
 * for the prose checks. Rendering it server-side exercises the stacked
 * reading — the path taken under reduced motion — and, more to the point,
 * means the file has to compile.
 */
console.log('\nThe whole piece renders');
{
  const Tilt = (require('../Tilt') as { default: () => ReactElement }).default;
  const whole = renderToStaticMarkup(<Tilt />);
  html['tilt/whole'] = whole;
  ok(whole.length > 4000, `the article rendered ${whole.length} chars — chapters are missing`);
  /* The lookup is now a section after the story rather than a chapter in it,
     so it must appear exactly once. As a chapter it rendered twice: once in
     the aria-hidden stage and once in the screen-reader copy. */
  const inputs = (whole.match(/type="search"/g) ?? []).length;
  ok(inputs === 1, `${inputs} search fields in the article — the lookup is a section, not a chapter`);
  ok(whole.includes('Now find your own county'),
     'the lookup section is missing its heading, so the search box arrives unannounced');
  console.log(`  ${whole.length.toLocaleString()} chars, one search field, ${CH.length - 1} chapters plus the finder`);
}

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

/* ---- the prose quotes the data it is printed next to -----------------
 *
 * Chapter one read "peaked in 2008" for months. The panel peaks in 2007 —
 * 734,475 against 733,116 — and the sentence was not invented: 2008 is the
 * nationally reported peak, so a true fact about a different population was
 * standing in for this one, beside a chart that disagreed with it.
 *
 * It survived review because it was a string. Anything a chapter asserts
 * about a turning point or a direction is checked against the series here,
 * so a figure can go stale in the pipeline but not in the copy.
 */
console.log('\nProse agrees with the series');
{
  /* Comments stripped first. The first version of this check failed on the
     note explaining WHY the year is no longer typed — a test that forbids
     discussing the bug it guards is a test nobody will keep. */
  const src = (require('fs').readFileSync(__dirname + '/../Tilt.tsx', 'utf8') as string)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  ok(!/peaked in (19|20)\d\d/.test(src),
     'a peak year is typed into the prose rather than derived from ch1.count');

  const count = data.ch1.count;
  const peak = data.ch1.years[count.indexOf(Math.max(...count))];
  ok(peak === 2007, `the panel now peaks in ${peak}; chapter one is written around a single turning point`);

  /* The standfirst is the one claim every reader sees, and it is a direction:
     small counties up, large counties down. If that ever reverses the opening
     sentence is wrong, and no chart further down would say so. */
  const small = data.bands[0].rate, large = data.bands.at(-1)!;
  ok(small.at(-1)! > small[0], 'the smallest counties no longer rise — the standfirst claims they do');
  ok(large.rate.at(-1)! < large.rate[0], 'the largest counties no longer fall — the standfirst claims they do');
  ok(!/did not stop putting|moved the practice/.test(src),
     'the old "not X, but Y" standfirst is back; it asserts a transfer that chapter four disproves');
  /* Neither ratio may be typed. Chapter three carried "1.31 times" and "2.61
     times" as literals for months, in the file whose own header says no
     number is typed, while the intro three lines above computed the same two
     figures from the data. */
  ok(!/\d\.\d\d? times/.test(src),
     'a ratio is typed into the prose rather than derived from data.bands');

  /* The copy does not tell the reader what they think.
   *
   * Chapter one was kickered "What you already know" and went on to call the
   * figure "the number most people carry around" and the last thing here that
   * would "behave the way you expect" — three guesses about the audience in
   * one short chapter, and a reader who did not recognise the figure had been
   * told they were unusual before the first chart. Every claim in this piece
   * should be about the data. */
  for (const phrase of [
    'you already know', 'most people', 'you expect', 'as you know',
    'of course', 'obviously', 'everyone knows', 'we all know',
  ]) {
    ok(!new RegExp(phrase, 'i').test(src), `the copy tells the reader what they think: "${phrase}"`);
  }
  /* The intro says the two ends were "about the same rate" in 2002 and gives
     a multiple for 2019. Both halves are claims about the data. */
  const ratio02 = data.bands[0].rate[0] / data.bands.at(-1)!.rate[0];
  const ratio19 = data.bands[0].rate.at(-1)! / data.bands.at(-1)!.rate.at(-1)!;
  ok(ratio02 < 1.5, `the ends were ${ratio02.toFixed(2)}x apart in 2002 — the intro calls that "about the same rate"`);
  ok(ratio19 > 2, `the ends are only ${ratio19.toFixed(2)}x apart in 2019 — the intro leads on that multiple`);
  console.log(`  peak ${peak}, smallest +${Math.round((small.at(-1)! / small[0] - 1) * 100)}%, largest ${Math.round((large.rate.at(-1)! / large.rate[0] - 1) * 100)}%`);
}

/* ---- the lookup renders twice on every page --------------------------
 *
 * The scrolly layout puts each chapter in the sticky stage AND in .srFigure
 * beside the prose, because the stage is aria-hidden. Fine for a chart. Two
 * search inputs were sharing id="tilt-county", so both <label for> attributes
 * resolved to the same element and one field was left unlabelled — an error
 * no visual check would ever surface.
 */
console.log('\nThe lookup survives being rendered twice');
{
  const twice = renderToStaticMarkup(<div><ChapterLookup /><ChapterLookup /></div>);
  const ids = [...twice.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  ok(ids.length >= 2, 'the lookup input has no id at all, so its label points nowhere');
  ok(new Set(ids).size === ids.length, `duplicate id across two lookups: ${ids.join(', ')}`);
  for (const f of [...twice.matchAll(/for="([^"]+)"/g)].map((m) => m[1])) {
    ok(ids.includes(f), `a label points at "${f}", which no input on the page has`);
  }
  console.log(`  ${ids.length} unique ids, every label resolved`);
}

/* ---- the key does not overprint itself -------------------------------
 *
 * Eight end-of-line labels — seven size bands and the county — land wherever
 * their lines finish. On a flat county several finish within a pixel or two
 * of each other, and drawn as-is they smear into something that reads as a
 * rendering fault rather than a key. They are spread apart before drawing,
 * and that spreading is arithmetic, so it is checked on every county rather
 * than on the two I happened to look at.
 */
console.log('\nThe chart key stays legible');
{
  const { spread } = require('../Lookup') as typeof import('../Lookup');
  /* The same geometry Frame uses: H 420, top padding 28, bottom padding 36. */
  const TOP = 28, BOTTOM = 384;
  const yOf = (v: number, max: number) => BOTTOM - (v / max) * (BOTTOM - TOP);

  let worstGap = Infinity, worstAt = '', outside = 0;
  for (const c of counties) {
    const max = Math.max(1000, Math.ceil((Math.max(...c.rate) * 1.1) / 500) * 500);
    const ends = [
      ...data.bands.map((b) => ({ y: yOf(b.rate.at(-1)!, max) })),
      { y: yOf(c.rate.at(-1)!, max) },
    ];
    const out = spread(ends, TOP, BOTTOM);
    for (let i = 1; i < out.length; i++) {
      const gap = out[i].y - out[i - 1].y;
      if (gap < worstGap) { worstGap = gap; worstAt = `${c.name}, ${c.state}`; }
    }
    if (out.some((e) => e.y < TOP - 8 || e.y > BOTTOM + 8)) outside++;
  }
  ok(worstGap >= 12, `two key labels are ${worstGap.toFixed(1)}px apart on ${worstAt} — they overprint`);
  ok(outside === 0, `${outside} counties push a key label outside the plot frame`);
  console.log(`  closest pair across ${counties.length.toLocaleString()} counties: ${worstGap.toFixed(1)}px, ${outside} outside the frame`);
}

/* The modal is the only part of this piece that takes the page away from the
 * reader, so the ways out are checked structurally rather than remembered.
 *
 * It exists because the stage swaps its contents on scroll and destroyed the
 * inline result — which also means the scroll lock is load-bearing, not
 * cosmetic: without it the lookup unmounts mid-read and takes the portal, and
 * the dialog, with it.
 */
console.log('\nThe modal has its exits');
{
  const src = require('fs').readFileSync(__dirname + '/../Lookup.tsx', 'utf8') as string;
  ok(/showModal\(\)/.test(src), 'the dialog is not opened as a modal, so nothing is focus-trapped or inert');
  ok(/createPortal\([\s\S]*?document\.body/.test(src),
     'the dialog is not portalled to body — inside the aria-hidden stage it would be invisible to a screen reader');
  ok(/onCancel=\{\(e\) => \{ e\.preventDefault\(\); onClose\(\); \}\}/.test(src),
     'Escape is not routed back into React state, so the dialog would close without clearing the selection and not reopen');
  /* Deliberately NOT click-to-dismiss: the panel is full-bleed, so the only
     clickable emptiness is the gutter beside the charts, which reads as part
     of the panel rather than as a way out. A stray click there would discard
     the reader's search. If someone adds it back, they should have to delete
     this line and read the reason first. */
  ok(!/e\.target === ref\.current/.test(src),
     'click-to-dismiss is back on a full-screen panel, where the gutter is not obviously "outside"');
  ok(/aria-label="Close county detail"/.test(src), 'the close button has no accessible name');
  ok(/html\.style\.overflow = 'hidden'/.test(src) && /html\.style\.overflow = prevOverflow/.test(src),
     'the scroll lock is missing or never released — the stage would swap chapters and unmount the dialog');
  ok(/input\.current\?\.focus\(\)/.test(src), 'focus is not returned to the search field on close');
  console.log('  X and Escape, no stray-click dismissal, scroll locked and released, focus returned');
}

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
