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

/**
 * What kind of evidence this is. Printed next to each citation, because a
 * peer-reviewed effect estimate and an advocacy organisation's briefing are
 * both useful and are not the same thing, and a reader should not have to
 * recognise the publisher to know which they are looking at.
 */
export type SourceKind =
  | 'dataset' | 'peer-reviewed' | 'book' | 'law review'
  | 'government' | 'research report' | 'journalism';

export type Source = {
  id: string;
  title: string;
  author?: string;
  publisher: string;
  date?: string;
  url: string;
  kind: SourceKind;
  status: SourceStatus;
  supports: string;
  note?: string;
  /** True when the link goes to a free copy of a paywalled work. */
  openCopy?: boolean;
};

export const SOURCES: Source[] = [
  {
    id: 'vera-data',
    kind: 'dataset',
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
    kind: 'dataset',
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
    kind: 'dataset',
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
    kind: 'research report',
    title: 'Out of Sight: The Growth of Jails in Rural America',
    publisher: 'Vera Institute of Justice',
    date: '2017',
    url: 'https://www.vera.org/publications/out-of-sight-growth-of-jails-rural-america',
    status: 'secondary',
    supports:
      'The rural inversion — that small and rural counties drive jail growth while big cities decline — and the two drivers Vera names: rising pretrial detention, and people held for other authorities. This finding is Vera’s, not this piece’s.',
    note:
      'Chapter four originally argued against the second of those drivers, on a misreading of a flat share. Corrected.',
  },
  {
    id: 'vera-build-it',
    kind: 'research report',
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
    kind: 'journalism',
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
    kind: 'dataset',
    title: 'Incarceration Trends data tool',
    publisher: 'Vera Institute of Justice',
    date: '2015',
    url: 'https://trends.vera.org/',
    status: 'primary',
    supports:
      'Prior art. A county-level interactive on this dataset has existed since 2015, including per-county lookup.',
    note: 'What is new here is the gradient as a continuous slope, not the underlying finding.',
  },
  {
    id: 'vera-scale',
    kind: 'research report',
    title: 'The Scale of Jail Construction Across the United States, 2002–2022',
    publisher: 'Vera Institute of Justice',
    date: '2026',
    url: 'https://www.vera.org/ending-mass-incarceration/reducing-incarceration/reducing-jail-and-prison-population/beyond-jails-initiative/the-scale-of-jail-construction-across-the-us-2002-2022',
    status: 'primary',
    supports:
      'That more than 1,200 counties have spent over $42 billion expanding jail capacity since 2002; that lease-purchase agreements let counties build without the public vote a general obligation bond would require, and are used where voters have already refused one; that jail bonds carry the second-highest default rate in the municipal bond market; and that over thirty years roughly 90 percent of a jail’s cost is operations, not construction.',
    note: 'Read in full. This is the companion essay to the construction dataset already used here.',
  },
  {
    id: 'littman-sheriffs',
    kind: 'law review',
    title: 'Jails, Sheriffs, and Carceral Policymaking',
    author: 'Aaron Littman',
    publisher: 'Vanderbilt Law Review 74(4), 861–956',
    date: '2021',
    url: 'https://scholarship.law.vanderbilt.edu/vlr/vol74/iss4/6',
    status: 'secondary',
    supports:
      'That county sheriffs and commissioners are effectively unreviewed carceral policymakers: they decide who is booked and who is released, and almost no state supervises those decisions.',
    note: 'Legal scholarship, student-edited rather than blind peer-reviewed. Open access.',
  },
  {
    id: 'intercept-architects',
    kind: 'journalism',
    title: 'The Little-Known Reason Counties Keep Building Bigger Jails: Architecture Firms',
    author: 'Amanda Abrams',
    publisher: 'The Intercept',
    date: '2024-05-31',
    url: 'https://theintercept.com/2024/05/31/jail-construction-justice-architecture-firms/',
    status: 'secondary',
    supports:
      'That the firms paid to forecast how many jail beds a county will need are frequently the firms hired to design the jail — in Indiana, three firms designed about 90 percent of recent projects. Documents needs assessments that recommend expansion in counties where both crime and population are projected to fall.',
    note: 'Read in full. Vera describes the same conflict independently.',
  },
  {
    id: 'dobbie-pretrial',
    kind: 'peer-reviewed',
    title: 'The Effects of Pretrial Detention on Conviction, Future Crime, and Employment',
    author: 'Will Dobbie, Jacob Goldin, Crystal S. Yang',
    publisher: 'American Economic Review 108(2), 201–240',
    date: '2018',
    url: 'https://www.aeaweb.org/articles?id=10.1257/aer.20161503',
    status: 'secondary',
    supports:
      'That being held before trial is not a neutral wait. Using the random assignment of bail judges, it raises the probability of conviction — mainly by producing guilty pleas — and reduces later formal employment.',
    note: 'The identification is quasi-experimental, which is why this piece leans on it rather than on correlational work.',
  },
  {
    id: 'kubrin-covid',
    kind: 'peer-reviewed',
    title: 'The COVID-19 Pandemic, Prison Downsizing, and Crime Trends',
    author: 'Charis E. Kubrin, Bradley J. Bartos',
    publisher: 'Journal of Contemporary Criminal Justice 40(1), 113–137',
    date: '2024',
    url: 'https://doi.org/10.1177/10439862231190206',
    status: 'secondary',
    supports:
      'That jail populations can fall sharply without crime rising. Synthetic-control analysis of all 58 California counties finds no consistent relationship between 2020 jail decarceration and county violent or property crime.',
    note:
      'One state, one short window, and the published title says prison while the analysis is of jails. Cited as evidence that the lever exists, not that it is costless.',
    openCopy: true,
  },
  {
    id: 'thompson-sheriffs',
    kind: 'peer-reviewed',
    title: 'How Partisan Is Local Law Enforcement? Evidence from Sheriff Cooperation with Immigration Authorities',
    author: 'Daniel M. Thompson',
    publisher: 'American Political Science Review 114(1), 222–236',
    date: '2020',
    url: 'https://dthompson.scholar.ss.ucla.edu/wp-content/uploads/sites/19/2020/08/Thompson_Sheriffs_Immigration_Enforcement_APSR.pdf',
    status: 'secondary',
    supports:
      'That the obvious political story does not hold. A regression discontinuity across more than 3,200 partisan sheriff elections finds Democratic and Republican sheriffs comply with ICE detainers at close to the same rate.',
    note: 'Cited because it cuts against the reading this piece would otherwise invite. Link is the author’s free copy.',
    openCopy: true,
  },
  {
    id: 'farris-holman-badge',
    kind: 'book',
    title: 'The Power of the Badge: Sheriffs and Inequality in the United States',
    author: 'Emily M. Farris, Mirya R. Holman',
    publisher: 'University of Chicago Press',
    date: '2024-09',
    url: 'https://press.uchicago.edu/ucp/books/book/chicago/P/bo220537347.html',
    status: 'secondary',
    supports:
      'That sheriffs are elected in low-visibility, noncompetitive elections, oversee more than a third of US law enforcement employees, and control almost all local jails. Built on two national surveys of sheriffs taken about a decade apart.',
    note: 'The book itself is not read here; this cites the publisher’s description of its findings.',
  },
  {
    id: 'senate-deaths',
    kind: 'government',
    title: 'Uncounted Deaths in America’s Prisons and Jails',
    author: 'Permanent Subcommittee on Investigations',
    publisher: 'United States Senate',
    date: '2022-09-20',
    url: 'https://www.hsgac.senate.gov/wp-content/uploads/imo/media/doc/2022-09-20%20PSI%20Staff%20Report%20-%20Uncounted%20Deaths%20in%20America%27s%20Prisons%20and%20Jails.pdf',
    status: 'secondary',
    supports:
      'That there is no reliable national count of deaths in custody. A bipartisan investigation found the Justice Department missed at least 1,000 deaths in a single year, and that 70 percent of the records it did collect were missing required fields.',
  },
  {
    id: 'ppi-jail-mortality',
    kind: 'research report',
    title: 'Rise in jail deaths is especially troubling as jail populations become more rural and more female',
    author: 'Leah Wang',
    publisher: 'Prison Policy Initiative',
    date: '2021-06-23',
    url: 'https://www.prisonpolicy.org/blog/2021/06/23/jail_mortality/',
    status: 'secondary',
    supports:
      'That the smallest jails have the highest death rates — jails holding 49 people or fewer, in some years at more than double the overall jail rate.',
    note: 'Advocacy analysis of federal mortality data, not peer-reviewed.',
  },
  {
    id: 'quandt-rural-deaths',
    kind: 'journalism',
    title: 'America’s Rural-Jail-Death Problem',
    author: 'Katie Rose Quandt',
    publisher: 'The Atlantic, via the Pulitzer Center',
    date: '2021-03-29',
    url: 'https://pulitzercenter.org/stories/americas-rural-jail-death-problem',
    status: 'secondary',
    supports:
      'Boyd County, Kentucky: a jail expanded from 93 to 202 beds in 2006 held 286 people by 2021, with four deaths in eight months and a federal civil-rights finding against it.',
    note: 'Linked to the Pulitzer Center republication, which is not paywalled.',
  },
  {
    id: 'eason-bighouse',
    kind: 'book',
    title: 'Big House on the Prairie: Rise of the Rural Ghetto and Prison Proliferation',
    author: 'John M. Eason',
    publisher: 'University of Chicago Press',
    date: '2017',
    url: 'https://press.uchicago.edu/ucp/books/book/chicago/B/bo25227153.html',
    status: 'secondary',
    supports:
      'That rural towns pursue carceral facilities for reputation and a sense of order as much as for jobs — which is why the economics failing does not stop the building.',
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
