/**
 * Builds the data for The Tilt from Vera's county file.
 *
 *   node scripts/tilt-data.mjs
 *
 * Emits src/data/tilt.json (the chapters) and src/data/tilt-counties.json
 * (the lookup). Both are committed: they are small, deterministic, and the
 * page should not depend on a 61MB CSV at build time.
 *
 * ── The rules this script enforces ──────────────────────────────────────
 *
 * BALANCED PANELS. Every series comes from counties present in EVERY year of
 * the window. Vera's coverage changes year to year, so a naive sum over all
 * rows produces a trend that is partly counties arriving and leaving. Each
 * chapter records the panel it used and the count goes on screen.
 *
 * NO MIXED UNITS. Total jail population is an average daily population;
 * pretrial is a single-day count taken at the end of June (codebook p.12).
 * Vera says plainly they are "not always directly comparable", so this script
 * will not divide one by the other. Pretrial is reported as a RATE against
 * residents, compared only against itself over time. The pretrial-as-share-of
 * -jail percentages computed before the codebook was read are gone.
 *
 * ICE IS INSIDE PRETRIAL. Same page: people held for other authorities are
 * "aggregated into the general pretrial population". So ICE growth is reported
 * as a share of the pretrial change, not as an independent finding.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'src', 'data', 'raw');
const OUT = join(ROOT, 'src', 'data');

const Y0 = 2002, Y1 = 2019;
const YEARS = Array.from({ length: Y1 - Y0 + 1 }, (_, i) => Y0 + i);

/* Fixed on 2002 population so counties never migrate between bands and make
   a band's trend partly a composition change. */
const BANDS = [
  { key: 'u5',    label: 'under 5k',    max: 5_000 },
  { key: '5_10',  label: '5k–10k',      max: 10_000 },
  { key: '10_25', label: '10k–25k',     max: 25_000 },
  { key: '25_50', label: '25k–50k',     max: 50_000 },
  { key: '50_100',label: '50k–100k',    max: 100_000 },
  { key: '100_500', label: '100k–500k', max: 500_000 },
  { key: 'o500',  label: 'over 500k',   max: Infinity },
];
const bandOf = (pop) => BANDS.find((b) => pop < b.max).key;

/* ---------------------------------------------------------------- csv ---
 * Vera's file is well-formed and quoted, but county names contain commas
 * ("Miami-Dade County, FL" style entries elsewhere), so this is a real
 * parser rather than a split on commas.
 */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  const idx = Object.fromEntries(head.map((h, i) => [h.trim(), i]));
  return { rows, idx };
}

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

console.log('reading vera-county.csv …');
const { rows, idx } = parseCSV(readFileSync(join(RAW, 'vera-county.csv'), 'utf8'));
console.log(`  ${rows.length.toLocaleString()} rows`);

const need = ['year','county_fips','county_name','state_abbr','urbanicity','total_jail_pop',
  'jail_rated_capacity','total_pretrial_custody','total_jail_from_ice','total_jail_from_other_jail',
  'total_jail_from_prison','total_jail_from_fed','total_pop_15to64','black_pop_15to64','latinx_pop_15to64'];
for (const c of need) if (!(c in idx)) throw new Error(`column missing from the CSV: ${c}`);

/* Index by fips → year → record, for the window only. */
const byFips = new Map();
for (const r of rows) {
  const y = num(r[idx.year]);
  if (y === null || y < Y0 || y > Y1) continue;
  const fips = r[idx.county_fips];
  if (!byFips.has(fips)) byFips.set(fips, new Map());
  byFips.get(fips).set(y, {
    name: r[idx.county_name], state: r[idx.state_abbr], urb: r[idx.urbanicity],
    jail: num(r[idx.total_jail_pop]), cap: num(r[idx.jail_rated_capacity]),
    pre: num(r[idx.total_pretrial_custody]), ice: num(r[idx.total_jail_from_ice]),
    oth: num(r[idx.total_jail_from_other_jail]), pri: num(r[idx.total_jail_from_prison]),
    fed: num(r[idx.total_jail_from_fed]), pop: num(r[idx.total_pop_15to64]),
    black: num(r[idx.black_pop_15to64]), latinx: num(r[idx.latinx_pop_15to64]),
  });
}

/** Counties with non-null values for every field in `fields`, in every year. */
function panel(fields) {
  const keep = [];
  for (const [fips, years] of byFips) {
    if (years.size !== YEARS.length) continue;
    let ok = true;
    for (const y of YEARS) {
      const r = years.get(y);
      if (!r || fields.some((f) => r[f] === null)) { ok = false; break; }
    }
    if (ok) keep.push(fips);
  }
  return keep;
}

const sumBy = (fips, fn) => {
  const out = {};
  for (const y of YEARS) {
    let t = 0;
    for (const f of fips) t += fn(byFips.get(f).get(y)) ?? 0;
    out[y] = t;
  }
  return out;
};

const round = (n, p = 0) => Number(n.toFixed(p));

/* ── ch1 + ch2 + ch3 — rates and counts by size band ───────────────────── */
const pRate = panel(['jail', 'pop']);
const bandOfFips = new Map(pRate.map((f) => [f, bandOf(byFips.get(f).get(Y0).pop)]));
const bandSeries = BANDS.map((b) => {
  const fips = pRate.filter((f) => bandOfFips.get(f) === b.key);
  const jail = sumBy(fips, (r) => r.jail), pop = sumBy(fips, (r) => r.pop);
  return {
    ...b, max: b.max === Infinity ? null : b.max, n: fips.length,
    count: YEARS.map((y) => round(jail[y])),
    rate: YEARS.map((y) => round((jail[y] / pop[y]) * 1e5, 1)),
  };
});
const natJail = sumBy(pRate, (r) => r.jail);
const ch1 = { panel: pRate.length, years: YEARS, count: YEARS.map((y) => round(natJail[y])) };

/* ── ch4 — the three eliminations ──────────────────────────────────────── */
const pHeld = panel(['jail', 'oth', 'pri', 'fed']);
const heldRural = pHeld.filter((f) => byFips.get(f).get(Y0).urb === 'rural');
const hJail = sumBy(heldRural, (r) => r.jail);
const hHeld = sumBy(heldRural, (r) => r.oth + r.pri + r.fed);
const pDem = panel(['pop', 'black', 'latinx']);
const demRural = pDem.filter((f) => byFips.get(f).get(Y0).urb === 'rural');
const dPop = sumBy(demRural, (r) => r.pop), dLat = sumBy(demRural, (r) => r.latinx);
const ch4 = {
  transfers: { panel: heldRural.length, years: YEARS,
    share: YEARS.map((y) => round((hHeld[y] / hJail[y]) * 100, 1)) },
  population: { panel: demRural.length, years: YEARS,
    index: YEARS.map((y) => round((dPop[y] / dPop[Y0]) * 100, 1)) },
  demography: { panel: demRural.length, years: YEARS,
    latinxShare: YEARS.map((y) => round((dLat[y] / dPop[y]) * 100, 1)) },
};

/* ── ch5 — capacity against population, and construction ───────────────── */
const pCap = panel(['jail', 'cap']);
const cJail = sumBy(pCap, (r) => r.jail), cCap = sumBy(pCap, (r) => r.cap);
const ch5 = {
  panel: pCap.length, years: YEARS,
  people: YEARS.map((y) => round(cJail[y])),
  beds: YEARS.map((y) => round(cCap[y])),
  spare: YEARS.map((y) => round(cCap[y] - cJail[y])),
};

const con = parseCSV(readFileSync(join(RAW, 'vera-jail-construction.csv'), 'utf8'));
const cy = {}, cStatus = {};
for (const r of con.rows) {
  const y = num(r[con.idx.project_year]);
  if (y === null) continue;
  cy[y] = (cy[y] ?? 0) + 1;
  const s = r[con.idx.project_status]?.trim();
  if (s) cStatus[s] = (cStatus[s] ?? 0) + 1;
}
ch5.construction = {
  years: Object.keys(cy).map(Number).sort((a, b) => a - b),
  count: Object.keys(cy).map(Number).sort((a, b) => a - b).map((y) => cy[y]),
  status: cStatus, total: con.rows.length,
};

/* ── ch6 — pretrial as a RATE, and ICE inside it ───────────────────────── */
const pPre = panel(['pre', 'ice', 'pop']);
const URB = ['rural', 'small/mid', 'suburban', 'urban'];
const ch6 = { panel: pPre.length, years: YEARS, byUrbanicity: {} };
for (const u of URB) {
  const fips = pPre.filter((f) => byFips.get(f).get(Y0).urb === u);
  const pre = sumBy(fips, (r) => r.pre), pop = sumBy(fips, (r) => r.pop), ice = sumBy(fips, (r) => r.ice);
  ch6.byUrbanicity[u] = {
    n: fips.length,
    pretrialRate: YEARS.map((y) => round((pre[y] / pop[y]) * 1e5, 1)),
    iceCount: YEARS.map((y) => round(ice[y])),
    /* ICE sits inside pretrial, so this is the only honest comparison. */
    iceShareOfPretrialChange: round(((ice[Y1] - ice[Y0]) / (pre[Y1] - pre[Y0])) * 100, 1),
  };
}

/* ── anchors named in Vera's 2017 piece ────────────────────────────────── */
const anchor = (fips) => {
  const years = byFips.get(fips);
  if (!years) return null;
  const ys = [...years.keys()].sort();
  return { fips, name: years.get(ys[0]).name, state: years.get(ys[0]).state, years: ys,
    jail: ys.map((y) => years.get(y).jail), cap: ys.map((y) => years.get(y).cap),
    pre: ys.map((y) => years.get(y).pre),
    held: ys.map((y) => { const r = years.get(y); return (r.oth ?? 0) + (r.pri ?? 0) + (r.fed ?? 0); }) };
};

/* ── ch7 — the lookup ──────────────────────────────────────────────────── */
const counties = pRate.map((f) => {
  const a = byFips.get(f).get(Y0), b = byFips.get(f).get(Y1);
  return { fips: f, name: a.name, state: a.state, urb: a.urb, band: bandOfFips.get(f),
    pop: round(b.pop), r0: round((a.jail / a.pop) * 1e5, 1), r1: round((b.jail / b.pop) * 1e5, 1) };
});

mkdirSync(OUT, { recursive: true });
const bundle = {
  meta: {
    window: [Y0, Y1], source: 'Vera Institute of Justice, Incarceration Trends v3.1 (March 2026)',
    note: 'Balanced panels: counties present with the required fields in every year of the window.',
    generated: new Date().toISOString().slice(0, 10),
  },
  ch1, bands: bandSeries, ch4, ch5, ch6,
  anchors: { grant: anchor('21081'), terrebonne: anchor('22109') },
};
writeFileSync(join(OUT, 'tilt.json'), JSON.stringify(bundle));
writeFileSync(join(OUT, 'tilt-counties.json'), JSON.stringify(counties));

const kb = (p) => `${(readFileSync(join(OUT, p)).length / 1024).toFixed(0)} KB`;
console.log(`\nwrote src/data/tilt.json (${kb('tilt.json')})`);
console.log(`wrote src/data/tilt-counties.json (${kb('tilt-counties.json')}, ${counties.length.toLocaleString()} counties)\n`);
console.log(`  panels   rate ${pRate.length}  capacity ${pCap.length}  pretrial+ICE ${pPre.length}  held-for ${heldRural.length} rural`);
console.log(`  gradient ${bandSeries[0].rate[0]} → ${bandSeries[0].rate.at(-1)} (smallest)   ` +
            `${bandSeries.at(-1).rate[0]} → ${bandSeries.at(-1).rate.at(-1)} (largest)`);
console.log(`  ratio    ${round(bandSeries[0].rate[0] / bandSeries.at(-1).rate[0], 2)}x → ` +
            `${round(bandSeries[0].rate.at(-1) / bandSeries.at(-1).rate.at(-1), 2)}x`);
