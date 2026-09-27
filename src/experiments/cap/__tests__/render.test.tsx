/**
 * The Cap — render, maths and prose checks.
 *
 * tsc proves the types line up. It does not prove a component renders, that
 * the stop date on screen is the one in the file, or that nobody typed a
 * number into a sentence. All three have gone wrong on this site before.
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import data from '../../../data/cap.json';
import { SOURCES, assertNoUnverifiedClaims } from '../../../data/cap-sources';
import {
  ChapterEvery, ChapterWall, ChapterCliff, ChapterNoWages, ChapterClocks, ChapterRates,
  stopDay, stopDate, stopPayday, socialSecurity, rowFor,
} from '../figures';
import Cap from '../Cap';

let fails = 0;
const ok = (c: unknown, m: string) => { if (!c) { fails++; console.error('  FAIL  ' + m); } };
const LAW = data.law;

/* ---- the maths on the page is the maths in the file ------------------ */
console.log('\nThe maths agrees with the data file');
for (const r of data.ladder) {
  ok(stopDay(r.income) === r.stopDay, `${r.label}: stopDay ${stopDay(r.income)} ≠ file ${r.stopDay}`);
  ok(stopPayday(r.income) === r.stopPayday, `${r.label}: stopPayday differs`);
  ok((stopDate(r.income) ?? null) === (r.stopDate ?? null), `${r.label}: stopDate ${stopDate(r.income)} ≠ ${r.stopDate}`);
  ok(Math.abs(socialSecurity(r.income) - r.socialSecurity) < 0.01, `${r.label}: SS amount differs`);
}

/* ---- and it has the shape the piece claims --------------------------- */
console.log('The cap behaves like a cap');
ok(stopDay(LAW.wageBase) === null, 'exactly the base never stops');
ok(stopDay(LAW.wageBase + 1) === 365, 'a dollar over the base stops on the last day');
ok(stopDay(LAW.wageBase * 2)! >= 182 && stopDay(LAW.wageBase * 2)! <= 184, 'twice the base stops mid-year');
{
  let prev = 366;
  for (let e = Math.log10(LAW.wageBase); e < 8; e += 0.05) {
    const d = stopDay(10 ** e) ?? 366;
    ok(d <= prev, `stop day rose as income rose at ${10 ** e}`);
    prev = d;
  }
}
ok(socialSecurity(1e9) === socialSecurity(LAW.wageBase), 'a billion pays the same Social Security as the base');
ok(data.minimum.federalIncomeTax === 0, 'minimum wage owes no federal income tax under the data file');
ok(data.minimum.income < LAW.standardDeductionSingle, 'minimum wage is below the standard deduction');

/* ---- every figure renders ------------------------------------------- */
console.log('Figures render');
const you = rowFor(250_000, 'You', { id: 'you', you: true });
const CH: [string, ReactElement][] = [
  ['every', <ChapterEvery />],
  ['wall', <ChapterWall />],
  ['cliff', <ChapterCliff you={you} />],
  ['nowages', <ChapterNoWages />],
  ['clocks', <ChapterClocks />],
  ['rates', <ChapterRates you={{ rate: 7.65 }} />],
];
for (const [name, el] of CH) {
  try {
    const html = renderToStaticMarkup(el);
    ok(html.length > 300, `${name} rendered ${html.length} chars — suspiciously empty`);
    ok(html.includes('<svg') || name === 'rates', `${name} drew no SVG`);
  } catch (e) {
    fails++; console.error(`  FAIL  ${name} threw: ${(e as Error).message}`);
  }
}

/* ---- the whole piece, server-side ------------------------------------ */
console.log('The piece renders');
let page = '';
try {
  page = renderToStaticMarkup(<Cap />);
  ok(page.length > 8000, `piece rendered ${page.length} chars`);
  ok(page.includes(String(LAW.wageBase.toLocaleString('en-US'))), 'the base appears on the page');
  for (const r of data.ladder) {
    if (r.stopDate) ok(page.includes(r.stopDate), `${r.label}'s stop date "${r.stopDate}" is on the page`);
  }
  ok(page.includes(data.musk.in2021.socialSecurityMax.toLocaleString('en-US')), "Musk's 2021 maximum is on the page");
} catch (e) {
  fails++; console.error(`  FAIL  piece threw: ${(e as Error).message}`);
}

/* ---- every citation resolves, and no source is unverified ------------ */
console.log('Citations');
try { assertNoUnverifiedClaims(); } catch (e) { fails++; console.error('  FAIL  ' + (e as Error).message); }
{
  const cited = new Set([...page.matchAll(/href="#src-([a-z0-9-]+)"/g)].map((m) => m[1]));
  for (const id of cited) ok(SOURCES.some((s) => s.id === id), `cites unknown source ${id}`);
  for (const src of SOURCES) ok(cited.has(src.id), `source "${src.id}" is listed but never cited`);
  ok(cited.size >= 10, `only ${cited.size} distinct sources cited`);
}

/* ---- nobody typed a number into a sentence --------------------------- */
console.log('Prose');
{
  /*
   * Every figure the prose quotes comes from cap.json. A number written
   * into a sentence by hand — "$184,500", "31.5%" — is one that will not
   * follow the data when it changes. So the source of the piece is read
   * and any dollar amount or percentage in a JSX string literal fails.
   * Template expressions are fine: that is the data speaking.
   */
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  /* run.sh works from the project root, so this is where the file is —
     stated, rather than resolved relative to wherever the bundle landed. */
  const file = path.resolve(process.cwd(), 'src/experiments/cap/Cap.tsx');
  const src = fs.readFileSync(file, 'utf8');
  ok(src.length > 4000, `read ${src.length} chars of Cap.tsx — wrong file?`);
  const TYPED = /(?:^|[>\s])[^<{}\n]*(\$\d[\d,]+|\b\d+(?:\.\d+)?\s?%)[^<{}\n]*/g;
  const literals = (src.match(TYPED) ?? [])
    /* JSX text only: drop lines that are code, comments or attributes. */
    .filter((l) => !/^\s*(\/\/|\/\*|\*|import|const|let|return|ok\(|[a-zA-Z]+[:=(])/.test(l.trim()))
    .map((l) => l.trim());
  ok(literals.length === 0, `typed figures in prose:\n    ${literals.join('\n    ')}`);
  /* And the lint itself works: a sentence with a typed dollar figure in it
     must trip it, or the pass above means nothing. */
  ok(TYPED.test('<p>It stops at $184,500 a year.</p>'), 'the typed-figure lint does not catch a typed figure');
  TYPED.lastIndex = 0;
  ok(TYPED.test('<p>the top 1% pay 31.5% of income</p>'), 'the typed-figure lint does not catch a percentage');
}

console.log(fails ? `\n${fails} failed` : '\nall passed');
process.exit(fails ? 1 : 0);
