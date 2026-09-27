/**
 * Half — the data build.
 *
 *   pnpm data:half     →  src/data/half.json, docs/research/half/SOURCES.md
 *
 * Merges the research files in docs/research/half — one per person, plus a
 * verified 990-PF reading and a lifetime-giving file where they exist — into
 * one record per person, derives every figure the page will show, and
 * writes a register of every URL the research touched, grouped by person
 * and tagged with how well each is known.
 *
 * Rules, inherited from tilt-data.mjs and cap-data.mjs:
 *   · nothing on the page is typed by hand; it is in a research file with a
 *     URL, or it is computed here from something that is
 *   · a figure whose status is 'needs-check' is carried in the data but
 *     flagged, and the page must not draw a bar from it
 *   · the coverage — what could not be found — is data too, and is written
 *     out rather than left implicit
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IN = resolve(ROOT, 'docs/research/half');
const OUT = resolve(ROOT, 'src/data/half.json');
const REGISTER = resolve(ROOT, 'docs/research/half/SOURCES.md');

/* The list, as pinned. Forbes real-time, 1 September 2026, top ten from the
   Forbes article; 11–25 from the mirror, each wealth figure then re-read
   from the person's Forbes profile by the research pass. */
const LIST_DATE = '2026-09-01';
const ORDER = [
  'elon-musk', 'larry-page', 'jeff-bezos', 'michael-dell', 'sergey-brin',
  'mark-zuckerberg', 'larry-ellison', 'jensen-huang', 'steve-ballmer', 'amancio-ortega',
  'warren-buffett', 'bernard-arnault', 'rob-walton', 'jim-walton', 'carlos-slim-helu',
  'alice-walton', 'changpeng-zhao', 'bill-gates', 'michael-bloomberg', 'thomas-peterffy',
  'zhang-yiming', 'francoise-bettencourt-meyers', 'mukesh-ambani', 'giancarlo-devasini', 'julia-koch',
];

/*
 * Judgements the research files cannot make for themselves. Each is a
 * decision about attribution, stated here so it is reviewable rather than
 * buried in a merge.
 */
const OVERRIDES = {
  /* The only Bezos foundation that files a 990-PF is run by his parents
     — Jeff is an unpaid director. Its 233% payout is not his giving and must
     not be shown as such. His own vehicles (Bezos Earth Fund, Day 1 Fund)
     do not file, so his filing coverage is honestly "none". */
  'jeff-bezos': { notHis: true },
  /* The verifier read the Susan Thompson Buffett Foundation's 990-PF from
     ProPublica's rendering of the IRS e-file — that is a primary read — but
     graded it 'secondary' out of caution after correcting the EIN. */
  'warren-buffett': { filingStatus: 'primary' },
};

const read = (name) => {
  try { return JSON.parse(readFileSync(resolve(IN, name), 'utf8')); }
  catch { return null; }
};

const urls = new Map(); // url -> { people:Set, statuses:Set, what:Set }
function note(url, person, status, what) {
  if (!url || !/^https?:/.test(url)) return;
  const e = urls.get(url) ?? { people: new Set(), statuses: new Set(), what: new Set() };
  e.people.add(person); if (status) e.statuses.add(status); if (what) e.what.add(what);
  urls.set(url, e);
}

const B = 1e9, M = 1e6;
const r2 = (n) => (n == null ? null : Math.round(n * 100) / 100);
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

const people = ORDER.map((slug, i) => {
  const base = read(`${slug}.json`);
  if (!base) throw new Error(`missing research file for ${slug}`);
  const v = read(`verify-${slug}.json`);
  const g = read(`giving-${slug}.json`);
  const name = base.name;

  /* ---- wealth ------------------------------------------------------- */
  const wealth = base.wealth?.billions != null ? base.wealth.billions * B : null;
  note(base.wealth?.url, name, base.wealth?.status, 'wealth');

  /* ---- the pledge --------------------------------------------------- */
  const pledge = {
    signed: base.givingPledge?.signed ?? null,
    year: base.givingPledge?.year ?? g?.pledgeSigningYear ?? null,
    wealthAtSigning: (base.givingPledge?.wealthAtSigningBillions ?? g?.pledgeWealthAtSigningBillions) != null
      ? (base.givingPledge?.wealthAtSigningBillions ?? g?.pledgeWealthAtSigningBillions) * B : null,
  };
  note(base.givingPledge?.url, name, 'primary', 'giving pledge');
  note(g?.pledgeUrl, name, 'secondary', 'pledge wealth at signing');

  /* ---- lifetime giving --------------------------------------------- */
  const lifetime = g?.lifetimeGivingBillions != null
    ? { amount: g.lifetimeGivingBillions * B, asOf: g.lifetimeGivingAsOf, source: g.lifetimeGivingSource, status: g.lifetimeGivingStatus }
    : base.lifetimeGiving?.billions != null
      ? { amount: base.lifetimeGiving.billions * B, asOf: null, source: base.lifetimeGiving.source, status: base.lifetimeGiving.status }
      : null;
  note(g?.lifetimeGivingUrl, name, g?.lifetimeGivingStatus, 'lifetime giving');
  note(base.lifetimeGiving?.url, name, base.lifetimeGiving?.status, 'lifetime giving');

  const score = g?.forbesPhilanthropyScore ?? base.forbesPhilanthropyScore?.score ?? null;
  note(g?.forbesScoreUrl || base.forbesPhilanthropyScore?.url, name, 'primary', 'Forbes philanthropy score');

  /* ---- the foundation, verified where a filing exists --------------- */
  const files = Boolean(base.foundation?.filesUS990PF);
  const ov = OVERRIDES[slug] ?? {};
  let foundation = null;
  if (v && v.fmvAssets != null) {
    foundation = {
      name: v.foundation, ein: v.ein, fiscalYear: v.fiscalYear,
      notHis: ov.notHis ?? false,
      assets: v.fmvAssets,
      paidOut: v.qualifyingDistributions,
      required: v.distributableAmount,
      payoutRate: v.fmvAssets ? r2((v.qualifyingDistributions / v.fmvAssets) * 100) : null,
      metMinimum: v.metMinimum,
      carriedForward: v.undistributedIncomeCarried,
      officerPay: v.officerCompensation,
      operating: v.metMinimum === null && /operating/i.test(v.notes || ''),
      status: ov.filingStatus ?? v.status,
      note: v.notes || null,
    };
    note(v.url, name, v.status, '990-PF');
    if (v.personalFoundation) {
      const p = v.personalFoundation;
      foundation.personal = {
        name: p.foundation ?? p.name, ein: p.ein, fiscalYear: p.fiscalYear, assets: p.fmvAssets,
        paidOut: p.qualifyingDistributions, required: p.distributableAmount, metMinimum: p.metMinimum,
        payoutRate: p.fmvAssets ? r2((p.qualifyingDistributions / p.fmvAssets) * 100) : null,
      };
      note(p.url, name, p.status, '990-PF (personal foundation)');
    }
  } else if (base.foundation?.name) {
    /* No US filing: what the foundation itself publishes, in its own currency. */
    foundation = {
      name: base.foundation.name, files: false,
      currency: base.foundation.currency ?? null,
      paidOut: base.foundation.latestGrantsMillions != null ? base.foundation.latestGrantsMillions * M : null,
      paidOutYear: base.foundation.latestGrantsYear ?? null,
      assets: base.foundation.assetsBillions != null ? base.foundation.assetsBillions * B : null,
      status: 'secondary',
    };
    note(base.foundation.url, name, 'secondary', 'foundation (own report)');
  }

  /* ---- politics, and the record ------------------------------------ */
  const political = base.political2024Cycle?.millions != null
    ? { amount: base.political2024Cycle.millions * M, status: base.political2024Cycle.status }
    : null;
  note(base.political2024Cycle?.url, name, base.political2024Cycle?.status, 'political giving 2024');

  const record = (base.onTheRecord ?? []).filter((x) => x?.finding).map((x) => {
    note(x.url, name, 'secondary', `on the record: ${x.kind}`);
    return { finding: x.finding, kind: x.kind };
  });
  if (base.foundation?.relatedPartyFinding) {
    record.push({ finding: base.foundation.relatedPartyFinding, kind: 'related-party' });
  }

  /* ---- derived --------------------------------------------------------- */
  const yearGiven = foundation?.paidOut ?? null;
  const derived = {
    /* what the foundation holds, as a share of the fortune */
    foundationShareOfWealth: wealth && foundation?.assets && foundation.status === 'primary' && !foundation.notHis
      ? r2((foundation.assets / wealth) * 100) : null,
    /* what left the foundation in its latest year, as a share of the fortune */
    yearGivenShareOfWealth: wealth && yearGiven && foundation?.status === 'primary' && !foundation.notHis
      ? r2((yearGiven / wealth) * 100) : null,
    /* lifetime giving as a share of the fortune */
    lifetimeShareOfWealth: wealth && lifetime?.amount && lifetime.status !== 'needs-check'
      ? r1((lifetime.amount / wealth) * 100) : null,
    /* how far the fortune has grown since the pledge */
    growthSincePledge: pledge.wealthAtSigning && wealth ? r1(wealth / pledge.wealthAtSigning) : null,
    /* years to have given half, at the latest year's rate, from where they are */
    yearsToHalf: wealth && yearGiven && foundation?.status === 'primary' && !foundation.notHis
      ? Math.round((0.5 * wealth - (lifetime?.amount ?? 0)) / yearGiven) : null,
  };

  return {
    rank: i + 1, slug, name,
    citizenship: base.citizenship, source: base.sourceOfWealth,
    filesUS: files,
    wealth, wealthAsOf: base.wealth?.asOf ?? null, wealthStatus: base.wealth?.status ?? null,
    score, pledge, lifetime, foundation, political, record, derived,
    coverage: {
      wealth: !!wealth, pledge: pledge.signed !== null, lifetime: !!lifetime && lifetime.status !== 'needs-check',
      filing: !!(foundation && foundation.status === 'primary' && !foundation.notHis), political: !!political && political.status !== 'needs-check',
    },
  };
});

/* ------------------------------------------------------------- summary */

const filers = people.filter((p) => p.foundation?.status === 'primary' && p.foundation.payoutRate != null && !p.foundation.operating && !p.foundation.notHis);
const summary = {
  listDate: LIST_DATE,
  count: people.length,
  americans: people.filter((p) => p.filesUS).length,
  totalWealth: people.reduce((a, p) => a + (p.wealth ?? 0), 0),
  pledgers: people.filter((p) => p.pledge.signed).length,
  lifetimeKnown: people.filter((p) => p.coverage.lifetime).length,
  lifetimeTotal: people.filter((p) => p.coverage.lifetime).reduce((a, p) => a + p.lifetime.amount, 0),
  filingsRead: filers.length,
  foundationAssets: filers.reduce((a, p) => a + p.foundation.assets, 0),
  foundationPaidOut: filers.reduce((a, p) => a + p.foundation.paidOut, 0),
  /* Paid out less than the year required. Legal for one year — the rest is
     owed by the end of the next — so this is a shortfall, not a penalty. */
  shortfallThisYear: filers.filter((p) => p.foundation.metMinimum === false).map((p) => p.slug),
  /* Owed into the following year, across all the filings read. */
  carriedForward: filers.reduce((a, p) => a + (p.foundation.carriedForward ?? 0), 0),
  scores: Object.fromEntries([1, 2, 3, 4, 5].map((s) => [s, people.filter((p) => p.score === s).length])),
};

/* ---------------------------------------------------------------- write */

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ built: new Date().toISOString().slice(0, 10), summary, people }, null, 2) + '\n');

/* The register. Every URL the research touched, grouped by person. */
const byPerson = new Map();
for (const [url, e] of urls) for (const p of e.people) {
  byPerson.set(p, [...(byPerson.get(p) ?? []), { url, status: [...e.statuses].join('/') || '—', what: [...e.what].join(', ') }]);
}
const lines = [
  '# Half — sources register', '',
  `Generated by \`scripts/half-data.mjs\` on ${new Date().toISOString().slice(0, 10)}. Every URL the research`,
  'touched, grouped by person. Status is how well the figure is known:',
  '`primary` the issuing body\'s own document · `secondary` reputable reporting of it ·',
  '`needs-check` seen only in a search summary and not opened. Nothing marked', '`needs-check` may draw a bar on the page.', '',
  `List: Forbes real-time billionaires, ${LIST_DATE}. ${urls.size} distinct sources.`, '',
];
for (const p of people) {
  const rows = byPerson.get(p.name) ?? [];
  lines.push(`## ${p.rank}. ${p.name}`, '');
  if (!rows.length) lines.push('_no sources recorded_', '');
  for (const r of rows.sort((a, b) => a.what.localeCompare(b.what))) lines.push(`- **${r.what}** — ${r.url} _(${r.status})_`);
  lines.push('');
}
writeFileSync(REGISTER, lines.join('\n'));

console.log(`half.json — ${people.length} people, ${filers.length} verified filings, ${urls.size} sources`);
console.log(`  combined wealth $${(summary.totalWealth / 1e12).toFixed(2)}T; foundation assets read $${(summary.foundationAssets / B).toFixed(1)}B; paid out $${(summary.foundationPaidOut / B).toFixed(2)}B`);
console.log(`  paid less than the year required: ${summary.shortfallThisYear.join(', ') || 'none'}; owed into next year $${(summary.carriedForward / B).toFixed(2)}B`);
console.log(`  scores 1..5: ${Object.values(summary.scores).join(' / ')}`);
console.log('  coverage (wealth/pledge/lifetime/filing/political):');
for (const p of people) {
  const c = p.coverage;
  console.log(`    ${String(p.rank).padStart(2)} ${p.name.padEnd(30)} ${['wealth', 'pledge', 'lifetime', 'filing', 'political'].map((k) => (c[k] ? '●' : '·')).join(' ')}   ${p.foundation?.payoutRate != null ? p.foundation.payoutRate + '%' : ''}`);
}
