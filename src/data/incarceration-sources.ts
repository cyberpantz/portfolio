/**
 * Sources for The Tilt.
 *
 * Same pattern as insurance-sources.ts: the piece renders its citations from
 * here, and `status` records how well each claim is actually known rather than
 * how confident the sentence sounds.
 *
 *   'primary'     the issuing body's own document, read directly
 *   'secondary'   reputable reporting of a primary fact, read directly
 *   'needs-check' reached me through a search summary; not yet opened
 *
 * Nothing marked 'needs-check' may carry a figure on screen.
 */

export type SourceStatus = 'primary' | 'secondary' | 'needs-check';

export type Source = {
  id: string;
  title: string;
  publisher: string;
  date?: string;
  url: string;
  status: SourceStatus;
  supports: string;
  note?: string;
};

export const SOURCES: Source[] = [
  {
    id: 'vera-data',
    title: 'Incarceration Trends Dataset, version 3.1',
    publisher: 'Vera Institute of Justice',
    date: '2026-03',
    url: 'https://github.com/vera-institute/incarceration-trends',
    status: 'primary',
    supports:
      'Every jail population, capacity, pretrial and ICE figure in this piece. County-level, 1970–2026, built from the BJS Census of Jails and Annual Survey of Jails.',
    note: 'Read directly. All figures here use a 2002–2019 window on balanced county panels.',
  },
  {
    id: 'vera-codebook',
    title: 'Incarceration Trends Codebook, March 2026',
    publisher: 'Vera Institute of Justice',
    date: '2026-03',
    url: 'https://github.com/vera-institute/incarceration-trends/blob/main/Incarceration%20Trends%20Codebook%2003-2026.pdf',
    status: 'primary',
    supports:
      'That total jail population is an average daily population while pretrial is a single-day June count, and that people held for other authorities — including ICE — are counted inside the pretrial figure.',
    note:
      'Page 12. Both facts changed what this piece could claim, and both were found by reading rather than by computing.',
  },
  {
    id: 'vera-construction',
    title: 'Incarceration Trends: jail construction dataset',
    publisher: 'Vera Institute of Justice',
    date: '2024-10',
    url: 'https://github.com/vera-institute/incarceration-trends/blob/main/incarceration_trends_jail_construction.csv',
    status: 'primary',
    supports:
      '1,926 jail construction projects, 2002–2022, with cost, capacity before and after, and whether each proposal passed, failed or is pending.',
  },
  {
    id: 'vera-out-of-sight',
    title: 'Out of Sight: The Growth of Jails in Rural America',
    publisher: 'Vera Institute of Justice',
    date: '2017',
    url: 'https://www.vera.org/publications/out-of-sight-growth-of-jails-rural-america',
    status: 'needs-check',
    supports:
      'The rural inversion — that small and rural counties drive jail growth while big cities decline. This finding is Vera’s, not this piece’s.',
    note: 'Cited for credit. Read the report before quoting any figure from it.',
  },
  {
    id: 'vera-build-it',
    title: 'Understanding Jail Growth in Rural America: If You Build It, They Will Come',
    publisher: 'Vera Institute of Justice',
    date: '2017-06-16',
    url: 'https://www.vera.org/news/understanding-jail-growth-in-rural-america',
    status: 'primary',
    supports:
      'The capacity mechanism, and the Grant County and Terrebonne Parish cases. Vera names the per-diem incentive: sheriffs are paid for each person held for state prisons or federal immigration.',
    note: 'Read in full. The phrase "if you build it, they will come" is theirs.',
  },
  {
    id: 'bloomberg-grant',
    title: 'Kentucky County Flirts With Bankruptcy as Jail Holds It Prisoner',
    publisher: 'Bloomberg',
    date: '2017-03-08',
    url: 'https://www.bloomberg.com/news/articles/2017-03-08/kentucky-county-flirts-with-bankruptcy-as-jail-holds-it-prisoner',
    status: 'needs-check',
    supports:
      'Grant County, Kentucky built to rent beds to the state, and faced insolvency when the state stopped sending people.',
    note: 'Cited by Vera. Not opened directly — do not quote a figure from it.',
  },
  {
    id: 'vera-trends-tool',
    title: 'Incarceration Trends data tool',
    publisher: 'Vera Institute of Justice',
    date: '2015',
    url: 'https://trends.vera.org/',
    status: 'primary',
    supports:
      'Prior art. A county-level interactive on this dataset has existed since 2015, including per-county lookup.',
    note: 'What is new here is the gradient as a continuous slope, not the underlying finding.',
  },
];

export const byId = (id: string): Source => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`incarceration-sources: no source "${id}"`);
  return s;
};

/** Build check — a claim resting on an unopened source does not ship. */
export function assertNoUnverifiedClaims(ids: string[]): void {
  const bad = ids.map(byId).filter((s) => s.status === 'needs-check');
  if (bad.length) {
    throw new Error(
      `incarceration-sources: ${bad.length} rendered claim(s) rest on unopened sources:\n` +
        bad.map((s) => `  · ${s.id} — ${s.supports.slice(0, 70)}…`).join('\n')
    );
  }
}
