/**
 * Half — every number the article can say, by name.
 *
 * article.md writes {name}; this file decides what {name} is. Each value is
 * derived from half.json (and so from the build script and its sources);
 * none is typed. To give the article a new number, add it here.
 */
import data from '../../data/half.json';
import { PEOPLE, SUMMARY, CONTEXT, money, disclosureGroups, scoreGap, scoreRows } from './figures';

/* Prose speaks its numbers; the charts abbreviate theirs. */
export const pct = (n: number) => `${(Math.round(n * 10) / 10).toString()} percent`;
export const words = (n: number | null | undefined) =>
  n == null ? '—'
  : n >= 1e12 ? `$${+(n / 1e12).toFixed(2)} trillion`
  : n >= 1e9 ? `$${(n / 1e9) % 1 ? (n / 1e9).toFixed(1) : (n / 1e9).toFixed(0)} billion`
  : n >= 1e6 ? `$${Math.round(n / 1e6)} million`
  : `$${Math.round(n).toLocaleString('en-US')}`;
export const longDate = (iso: string) => new Date(iso + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const times = (x: number) => `${Math.round(x / 10) * 10}`;
/* Counts on this page never exceed the list, so words through twenty-five. */
export const spell = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five'][n] ?? String(n);
const andList = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '';

const by = (slug: string) => {
  const p = PEOPLE.find((x) => x.slug === slug);
  if (!p) throw new Error(`Half: no person "${slug}"`);
  return p;
};
const musk = by('elon-musk'), huang = by('jensen-huang'), page = by('larry-page'), dell = by('michael-dell');
const brin = by('sergey-brin'), gates = by('bill-gates'), buffett = by('warren-buffett');
const bloomberg = by('michael-bloomberg'), bezos = by('jeff-bezos');

const ips15 = CONTEXT.assessments.find((a) => /at 15/.test(a.source))!;
const chronicle = CONTEXT.assessments.find((a) => /Chronicle/.test(a.source))!;
const f15 = ips15.figures as Record<string, string | number>;
const fig = (m: string, key: string) => {
  const hit = CONTEXT.shelters.find((x) => x.mechanism === m && x.figures && key in (x.figures as object));
  if (!hit) throw new Error(`Half: no shelter figure "${key}" under ${m}`);
  return (hit.figures as Record<string, string | number>)[key];
};
const dollars = (v: string | number) => Number(String(v).replace(/[^\d.]/g, ''));

const now = Number(data.built.slice(0, 4));
const [filedG, ownG, noneG] = disclosureGroups();
const scored = Object.values(SUMMARY.scores).reduce((sum, n) => sum + n, 0);
const rows = scoreRows();
const topGivers = rows.filter((r) => !r.bound && r.share >= 0.2).length;
const gap = scoreGap();
const surname = (name: string) => name.split(' ').pop()!;
const shortName = (n: string) => n.replace(' Helu', '').replace(' (CZ)', '');

export const VALUES: Record<string, string> = {
  /* the list */
  count: String(SUMMARY.count),
  totalWealth: words(SUMMARY.totalWealth),
  listDate: longDate(SUMMARY.listDate),
  built: longDate(data.built),
  foreignCount: spell(PEOPLE.filter((p) => !/^United States/.test(p.citizenship ?? '')).length),

  /* the Pledge */
  pledgers: spell(SUMMARY.pledgers),
  signerCount: spell(PEOPLE.filter((p) => p.pledge.signed === true).length),
  signedPct: String((chronicle.figures as Record<string, number>).us_billionaires_signed_pct),
  signersGrowthPct: String(f15.net_worth_growth_since_2010_pct),
  muskPledgeYear: String(musk.pledge.year),
  muskWealthAtSigning: words(musk.pledge.wealthAtSigning),
  muskGrowth: times(musk.derived.growthSincePledge!),
  buffettToGates: words(48e9),

  /* giving against wealth */
  giversFloor: words(SUMMARY.giversFloor),
  boundedCount: spell(SUMMARY.lifetimeBounded),
  household: money(SUMMARY.household),
  buffettGiven: words(buffett.lifetime!.amount),
  gatesGiven: words(gates.lifetime!.amount),
  bloombergGiven: words(bloomberg.lifetime!.amount),
  bezosGiven: words(bezos.lifetime?.amount),
  bezosWealth: words(bezos.wealth),

  /* the foundations */
  foundationAssetsShort: money(SUMMARY.foundationAssets),
  huangPayout: pct(huang.foundation!.payoutRate!),
  huangAssets: words(huang.foundation!.assets),
  pagePayout: pct(page.foundation!.payoutRate!),
  dellPayout: pct(dell.foundation!.payoutRate!),
  muskPayout: pct(musk.foundation!.payoutRate!),
  brinPayout: pct(brin.foundation!.payoutRate!),
  shortfall: andList(SUMMARY.shortfallThisYear.map((slug) => surname(by(slug).name))),
  carriedForward: words(SUMMARY.carriedForward),
  medianPayout: String(fig('payout-shortfall', 'median_payout_billion_dollar_foundations_2024_pct')),
  bezosEarthExpenses: words(13.9e6),

  /* the three structures */
  waltonMuseum: words(dollars(fig('related-party', 'crystal_bridges_grants_2010_usd'))),
  waltonRegion: words(dollars(fig('related-party', 'other_home_region_2010_usd'))),
  dafHeld: `$${fig('daf', 'assets_per_dollar_granted_big4_2025')}`,
  subsidy: String(f15.public_subsidy_per_dollar ?? '').replace(/^up to /, ''),

  /* the projection */
  bloombergHalfYear: String(now + (bloomberg.derived.yearsToHalf ?? 0)),
  muskHalfYear: String(now + (musk.derived.yearsToHalf ?? 0)),

  /* the scores */
  topGivers: spell(topGivers),
  restGivers: spell(rows.length - topGivers),
  scoredCount: spell(scored),
  unscoredCount: spell(SUMMARY.count - scored),
  gapAbove: gap.above.p.name,
  gapBelow: gap.below.p.name,

  /* disclosure */
  darkWealth: words(ownG.wealth + noneG.wealth),
  filedCount: spell(filedG.people.length),
  ownCount: spell(ownG.people.length),
  ownNames: andList(ownG.people.map((p) => shortName(p.name))),
  noneCount: spell(noneG.people.length),
};
