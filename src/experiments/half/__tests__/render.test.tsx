/**
 * Half — render, data and prose checks.
 *
 * Nine figures, and every one must draw from the file. The things that can
 * be completely wrong while the types are fine: a chart that renders empty,
 * a rate on screen that is not the rate in the filing, a figure drawn from a
 * source nobody opened, a number typed into a sentence, and a foundation
 * shown as someone's giving when it is not.
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../../data/half.json';
import { SOURCES, assertNoUnverifiedClaims } from '../../../data/half-sources';
import { Squares, Paired, Pledge, Payout, Horizon, Mechanisms, Founders, Scores, Coverage, PEOPLE, SUMMARY } from '../figures';
import Half from '../Half';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error('  FAIL  ' + m); } };

/* ---- the data file holds together ------------------------------------ */
console.log('\nThe data file');
ok(PEOPLE.length === 25, `${PEOPLE.length} people, expected 25`);
ok(PEOPLE.every((p, i) => p.rank === i + 1), 'ranks are 1..25 in order');
ok(PEOPLE.every((p) => p.wealth && p.wealth > 1e10), 'everyone has a wealth figure above $10B');
ok(PEOPLE[0].slug === 'elon-musk', 'Musk is first');
{
  /* Payout rate on the page must be the filing's own arithmetic. */
  for (const p of PEOPLE) {
    const f = p.foundation;
    if (!f || f.status !== 'primary' || f.payoutRate == null || !('assets' in f) || !f.assets) continue;
    const want = Math.round((f.paidOut / f.assets) * 10000) / 100;
    ok(Math.abs(f.payoutRate - want) < 0.011, `${p.name}: payoutRate ${f.payoutRate} ≠ paidOut/assets ${want}`);
  }
}
{
  /* A book-value asset figure makes payout read as >100%. That was the
     bug the verification pass existed to fix; it must not come back. */
  const shown = PEOPLE.filter((p) => p.foundation?.status === 'primary' && !p.foundation.notHis && !p.foundation.operating);
  for (const p of shown) ok(p.foundation!.payoutRate! < 60, `${p.name}: payout ${p.foundation!.payoutRate}% looks like book value`);
}
ok(PEOPLE.find((p) => p.slug === 'jeff-bezos')!.foundation?.notHis === true, "the Bezos Family Foundation is flagged as not his");
ok(PEOPLE.find((p) => p.slug === 'jeff-bezos')!.coverage.filing === false, "and does not count as a filing of his");
ok(SUMMARY.scores['3'] === 0 && SUMMARY.scores['4'] === 0, 'the score chart\'s finding — no 3s or 4s — holds in the data');
ok(SUMMARY.pledgers >= 5, `${SUMMARY.pledgers} pledgers`);
ok(SUMMARY.carriedForward > 0, 'something is carried forward');

/* ---- every figure renders, and draws something --------------------- */
console.log('Figures render');
const CH: [string, ReactElement, number][] = [
  ['squares', <Squares />, 25], ['paired', <Paired />, 8], ['pledge', <Pledge />, 25],
  ['payout', <Payout />, 8], ['horizon', <Horizon />, 6], ['mechanisms', <Mechanisms />, 3],
  ['founders', <Founders />, 4], ['scores', <Scores />, 5], ['coverage', <Coverage />, 25],
];
for (const [name, el, marks] of CH) {
  try {
    const html = renderToStaticMarkup(el);
    ok(html.length > 400, `${name} rendered ${html.length} chars — suspiciously empty`);
    const n = (html.match(/<(rect|circle)\b/g) ?? []).length;
    ok(n >= marks, `${name} drew ${n} marks, expected at least ${marks}`);
  } catch (e) {
    fails++; console.error(`  FAIL  ${name} threw: ${(e as Error).message}`);
  }
}

/* ---- the whole piece ------------------------------------------------ */
console.log('The piece renders');
let page = '';
try {
  page = renderToStaticMarkup(<Half />);
  ok(page.length > 20000, `piece rendered ${page.length} chars`);
  for (const slug of ['jensen-huang', 'larry-page', 'elon-musk']) {
    const p = PEOPLE.find((x) => x.slug === slug)!;
    /* The prose rounds to one decimal and says "percent"; the figure keeps two. */
    const r1 = (Math.round(p.foundation!.payoutRate! * 10) / 10).toString();
    ok(page.includes(`${r1} percent`) || page.includes(`${p.foundation!.payoutRate}%`), `${p.name}'s payout rate is on the page`);
  }
  ok(page.includes('Have they given enough'), 'the French Gates quote is on the page');
  ok(!page.includes('undefined') && !page.includes('NaN'), 'no undefined or NaN leaked into the page');
} catch (e) {
  fails++; console.error(`  FAIL  piece threw: ${(e as Error).message}`);
}

/* ---- citations ------------------------------------------------------ */
console.log('Citations');
try { assertNoUnverifiedClaims(); } catch (e) { fails++; console.error('  FAIL  ' + (e as Error).message); }
{
  const cited = new Set([...page.matchAll(/href="#src-([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const id of cited) ok(SOURCES.some((s) => s.id === id), `cites unknown source ${id}`);
  for (const src of SOURCES) ok(cited.has(src.id), `source "${src.id}" is listed but never cited`);
}

/* ---- nothing needs-check draws a bar ------------------------------- */
console.log('Statuses');
{
  const drawn = PEOPLE.filter((p) => p.coverage.lifetime);
  for (const p of drawn) ok(p.lifetime!.status !== 'needs-check', `${p.name}'s lifetime giving is drawn from a needs-check source`);
  for (const b of data.context.backlash.filter((x) => /Buffett|Bill Gates/.test(x.who))) {
    if (b.status === 'needs-check') ok(!page.includes(b.what.slice(0, 40)), `a needs-check quote is on the page: ${b.who}`);
  }
}

/* ---- nobody typed a number into a sentence -------------------------- */
console.log('Prose');
{
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const src = fs.readFileSync(path.resolve(process.cwd(), 'src/experiments/half/Half.tsx'), 'utf8');
  ok(src.length > 6000, `read ${src.length} chars of Half.tsx — wrong file?`);
  const TYPED = /(?:^|[>\s])[^<{}\n]*(\$\d[\d,]+|\b\d+(?:\.\d+)?\s?%)[^<{}\n]*/g;
  const literals = (src.match(TYPED) ?? [])
    .filter((l) => !/^\s*(\/\/|\/\*|\*|import|const|let|return|ok\(|[a-zA-Z]+[:=(])/.test(l.trim()))
    .map((l) => l.trim());
  ok(literals.length === 0, `typed figures in prose:\n    ${literals.join('\n    ')}`);
  ok(TYPED.test('<p>They hold $4.68T and pay 3.2%.</p>'), 'the typed-figure lint does not catch a typed figure');
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
