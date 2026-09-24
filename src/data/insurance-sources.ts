/**
 * Every source behind the insurance piece, and what each one is holding up.
 *
 * This file is the single point of truth, not a bibliography appended to a
 * finished page. The piece renders its citations FROM here, and spec §15
 * requires that every figure on screen trace back to an entry — the Wage Gap
 * lesson, where a hand-copied hourly rate drifted away from the data that
 * produced it and nothing noticed for two years.
 *
 * ── `status` is the load-bearing field ───────────────────────────────────
 *
 * It records how well I actually know each thing, which is not the same as
 * how confident the sentence sounds:
 *
 *   'primary'   the issuing body's own document — a statute, a regulator's
 *               bulletin, a Treasury release. Read directly.
 *   'secondary' reputable reporting of a primary fact, read directly.
 *   'needs-check' the claim came to me through a search summary and I have
 *               NOT opened the underlying document. It may well be right. It
 *               is not yet good enough to put on screen.
 *
 * Nothing marked 'needs-check' may be rendered. That is a build check, not a
 * good intention — see `assertNoUnverifiedClaims` below.
 *
 * The honesty here is not decoration. A piece whose whole argument is "look
 * at what the numbers actually say" cannot itself be sloppy about where its
 * numbers came from, and the failure mode is specific: one wrong figure and a
 * reader is entitled to discard everything else.
 */

export type SourceStatus = 'primary' | 'secondary' | 'needs-check';

export type Source = {
  id: string;
  title: string;
  publisher: string;
  /** ISO date of the source itself, not of access. */
  date?: string;
  url: string;
  status: SourceStatus;
  /** What this source is being asked to support, in plain words. */
  supports: string;
  /** Anything a future reader should know before trusting it. */
  note?: string;
};

export const SOURCES: Source[] = [
  /* ─── the dataset itself ─────────────────────────────────────────────── */
  {
    id: 'fio-data',
    title:
      'Supporting Underlying Metrics for Analyses of US Homeowners Insurance Markets, 2018–2022',
    publisher: 'U.S. Department of the Treasury, Federal Insurance Office',
    date: '2025-01-16',
    url: 'https://home.treasury.gov/system/files/311/Supporting_Underlying_Metrics_and_Disclaimer_for_Analyses_of_US_Homeowners_Insurance_Markets_2018-2022.xlsx',
    status: 'primary',
    supports:
      'Every premium, claim frequency, claim severity, loss ratio and non-renewal figure in the visualisation. 25,593 ZIP codes, 2018–2022.',
    note:
      'Public domain. Published only for ZIPs with at least 10 reporting insurers and 50 policies, which removes 22% of ZIPs from the underlying collection.',
  },
  {
    id: 'fio-report',
    title:
      'Analyses of U.S. Homeowners Insurance Markets, 2018–2022: Climate-Related Risks and Other Factors',
    publisher: 'U.S. Department of the Treasury, Federal Insurance Office',
    date: '2025-01-16',
    url: 'https://home.treasury.gov/system/files/311/Analyses_of_US_Homeowners_Insurance_Markets_2018-2022_Climate-Related_Risks_and_Other_Factors_0.pdf',
    status: 'primary',
    supports:
      'Metric definitions, the suppression rule, the nine perils covered, and the exclusion of flood and earthquake.',
  },
  {
    id: 'fio-release',
    title:
      'Treasury Report: Homeowners Insurance Costs Rising, Availability Declining',
    publisher: 'U.S. Department of the Treasury',
    date: '2025-01-16',
    url: 'https://home.treasury.gov/news/press-releases/jy2791',
    status: 'primary',
    supports:
      'Scope — 330+ insurers, 246M policies, ~80% of premium written. Premiums rose 8.7% faster than inflation 2018–2022. Highest-risk quintile ZIPs paid $2,321, 82% more than the lowest.',
    note: 'Read in full.',
  },

  /* ─── what happened after the data stops ─────────────────────────────── */
  {
    id: 'cadoi-statefarm-2023',
    title: "Consumer Alert on State Farm's Decision",
    publisher: 'California Department of Insurance',
    date: '2023-05',
    url: 'https://www.insurance.ca.gov/0400-news/0102-alerts/2023/Consumer-Alert-on-State-Farm%27s-Decision.cfm',
    status: 'needs-check',
    supports:
      'State Farm stopped writing new California home policies in May 2023 — five months after the dataset ends.',
    note:
      'The regulator’s own alert, so it should be definitive once opened. Found via search; not yet read directly.',
  },
  {
    id: 'allstate-2022',
    title: 'Allstate plans to write new home insurance policies in California',
    publisher: 'San Francisco Chronicle',
    url: 'https://www.sfchronicle.com/california/article/allstate-home-insurance-22417956.php',
    status: 'needs-check',
    supports:
      'Allstate stopped writing new California home policies in late 2022 — at the very edge of the data window.',
    note:
      'Reports the 2026 return and refers back to the halt. A contemporaneous 2022 source would be better for the timeline.',
  },
  {
    id: 'la-insolvencies',
    title:
      'Louisiana faces a homeowners insurance crisis after devastating hurricanes',
    publisher: 'NBC News',
    url: 'https://www.nbcnews.com/news/us-news/louisiana-homeowners-insurance-crisis-hurricanes-rcna46746',
    status: 'needs-check',
    supports:
      'Eleven Louisiana carriers became insolvent following Hurricane Ida.',
    note:
      'Counts differ slightly between outlets. Before this goes on screen, pin it to the Louisiana Department of Insurance receivership list.',
  },

  /* ─── who ends up paying ─────────────────────────────────────────────── */
  {
    id: 'cadoi-bulletin-2025-4',
    title:
      'Bulletin 2025-4: Updated Guidance regarding Insurer Recoupment Procedures in Response to Assessment by the FAIR Plan',
    publisher: 'California Department of Insurance',
    date: '2025',
    url: 'https://www.insurance.ca.gov/0250-insurers/0300-insurers/0200-bulletins/bulletin-notices-commiss-opinion/upload/Bulletin-2025-4-Updated-Guidance-regarding-Insurer-Recoupment-Procedures-in-Response-to-Assessment-by-the-FAIR-Plan.pdf',
    status: 'needs-check',
    supports:
      'Member insurers may recoup 50% of a FAIR Plan assessment from their own policyholders with the Commissioner’s approval; 100% above $1B.',
    note: 'The mechanism at the heart of §9.4. Must be read directly before publishing.',
  },
  {
    id: 'cadoi-recoupment-faq',
    title: 'FAQ: Recoupment of FAIR Plan Assessment by Admitted Insurers',
    publisher: 'California Department of Insurance',
    date: '2025-02-27',
    url: 'https://www.insurance.ca.gov/0250-insurers/0800-rate-filings/0200-prior-approval-factors/upload/FAQ-Recoupment-of-FAIR-Plan-Assessment-by-Admitted-Insurers-FINAL-2-27-2025.pdf',
    status: 'needs-check',
    supports: 'Recoupment procedure, six-month filing window, revenue neutrality.',
  },
  {
    id: 'fairplan-structure',
    title:
      'Structure of the California FAIR Plan and the financial challenges',
    publisher: 'Kennedys Law',
    date: '2025',
    url: 'https://www.kennedyslaw.com/en/thought-leadership/article/2025/structure-of-the-california-fair-plan-and-the-financial-challenges/',
    status: 'needs-check',
    supports:
      'The FAIR Plan is a syndicate of admitted insurers rather than a state agency; Palisades and Eaton exposure ~$4.8B; the February 2025 $1B assessment was the first since 1994.',
  },
  {
    id: 'fairplan-enrolment',
    title: 'California FAIR Plan enrolment growth',
    publisher: 'unresolved',
    url: 'https://www.cfpnet.com/',
    status: 'needs-check',
    supports:
      'CA FAIR Plan past 668,000 policies by early 2026, up 43% between September 2024 and December 2025.',
    note:
      'WEAKEST LINK IN THE PIECE. These numbers reached me through a search summary with no single attributable publisher. Replace with the FAIR Plan’s own published policy-count statistics before §9.2 renders, or draw §9.2 without them.',
  },
  {
    id: 'travelers-surcharge',
    title: 'California insurers add a temporary supplemental fee',
    publisher: 'unresolved',
    url: 'https://www.insurance.ca.gov/',
    status: 'needs-check',
    supports:
      'Travelers applied a ~1% temporary surcharge to California property policies from 10 January 2026.',
    note:
      'This is the last node of §9.4 and the sentence a reader will remember, so it needs a filing or a named report behind it, not a summary.',
  },

  /* ─── the same instrument, built twice ───────────────────────────────── */
  {
    id: 'la-citizens-statute',
    title: 'Louisiana R.S. 22:2303 — Louisiana Citizens Property Insurance Corporation',
    publisher: 'Louisiana State Legislature',
    url: 'https://legis.la.gov/legis/Law.aspx?d=509402',
    status: 'needs-check',
    supports:
      'Louisiana Citizens must charge at least 10% above the higher of the actuarially justified rate or the highest rate charged by any assessable insurer.',
    note: 'A statute, so it will be definitive once read. Quote the subsection.',
  },
  {
    id: 'fl-citizens-rates',
    title: 'Citizens 2025 Rate Media Kit',
    publisher: 'Citizens Property Insurance Corporation (Florida)',
    date: '2024-06-18',
    url: 'https://www.citizensfla.com/-/20240618-citizens-releases-2025-rate-media-kit',
    status: 'needs-check',
    supports:
      'Florida Citizens must be actuarially sound and non-competitive, while a statutory glide path caps increases at 14% for primary residences in 2025.',
  },

  /* ─── why there may never be a second dataset ────────────────────────── */
  {
    id: 'fio-dropped-collection',
    title: 'US Treasury Drops Plan to Collect Insurer Data on Climate Risks',
    publisher: 'Insurance Journal',
    date: '2024-03-08',
    url: 'https://www.insurancejournal.com/news/national/2024/03/08/764130.htm',
    status: 'needs-check',
    supports:
      'In March 2024 FIO abandoned its own mandatory collection and accepted an anonymised NAIC subset instead — before the change of administration.',
    note:
      'Important for the wall label: the narrowing of this dataset predates 2025, which is a more defensible claim than any single-administration story.',
  },
  {
    id: 'fio-future',
    title: "What's next for the Federal Insurance Office?",
    publisher: 'InsuranceNewsNet',
    url: 'https://insurancenewsnet.com/innarticle/whats-next-for-the-federal-insurance-office',
    status: 'needs-check',
    supports:
      'H.R. 643, which would eliminate FIO, passed the House Financial Services Committee in July 2025.',
    note: 'Pin to the bill record on congress.gov rather than to reporting.',
  },

  /* ─── geometry and joins ─────────────────────────────────────────────── */
  {
    id: 'us-atlas',
    title: 'us-atlas — TopoJSON county and state boundaries',
    publisher: 'Mike Bostock',
    url: 'https://github.com/topojson/us-atlas',
    status: 'primary',
    supports: 'The ~3,143 county polygons the field is extruded from.',
    note: 'Derived from US Census TIGER/Line. Public domain.',
  },
];

export const byId = (id: string): Source => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`insurance-sources: no source "${id}"`);
  return s;
};

/**
 * The timeline in spec §9.1. Every entry cites, and the entry that cites
 * nothing is the dataset ending — which is the only event here that is a
 * property of this file rather than of the world.
 */
export type TimelineEvent = {
  date: string;
  label: string;
  sourceId?: string;
  /** The data window closing, drawn differently from things that happened. */
  isBoundary?: boolean;
};

export const TIMELINE: TimelineEvent[] = [
  { date: '2021-08', label: 'Hurricane Ida', sourceId: 'la-insolvencies' },
  { date: '2022-12', label: 'Allstate stops writing new California policies', sourceId: 'allstate-2022' },
  { date: '2022-12', label: 'The data ends here', isBoundary: true },
  { date: '2023-05', label: 'State Farm stops writing new California policies', sourceId: 'cadoi-statefarm-2023' },
  { date: '2023-12', label: 'Eleven Louisiana carriers insolvent', sourceId: 'la-insolvencies' },
  { date: '2025-01', label: 'Palisades and Eaton fires', sourceId: 'fairplan-structure' },
  { date: '2025-02', label: '$1B FAIR Plan assessment — first since 1994', sourceId: 'cadoi-bulletin-2025-4' },
  { date: '2026-01', label: '~1% surcharge reaches ordinary policies', sourceId: 'travelers-surcharge' },
];

/**
 * The build check that makes `status` mean something.
 *
 * Called by the data pipeline and by the test suite. A claim resting on a
 * source I have not opened does not ship — and because the timeline and the
 * figures all cite by id, there is no way to render one without tripping this.
 */
export function assertNoUnverifiedClaims(): void {
  const unverified = SOURCES.filter((s) => s.status === 'needs-check');
  if (unverified.length) {
    throw new Error(
      `insurance-sources: ${unverified.length} source(s) still need-check and cannot be rendered:\n` +
        unverified.map((s) => `  · ${s.id} — ${s.supports.slice(0, 72)}…`).join('\n')
    );
  }
}
