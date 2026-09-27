/**
 * Sources for The Cap.
 *
 * Same pattern as incarceration-sources.ts. The page renders its citations
 * from here, and `status` records how well each claim is known rather than
 * how confident the sentence sounds. Nothing 'needs-check' may carry a
 * figure on screen; the build gate at the bottom enforces it.
 */
import type { Source } from './incarceration-sources';

export const SOURCES: Source[] = [
  {
    id: 'ssa-2026',
    title: 'Cost-of-Living Increase and Other Determinations for 2026',
    publisher: 'Social Security Administration, Federal Register',
    date: '2025-11-03',
    url: 'https://www.federalregister.gov/documents/2025/11/03/2025-19763/cost-of-living-increase-and-other-determinations-for-2026',
    kind: 'government',
    status: 'primary',
    supports: 'The 2026 contribution and benefit base of $184,500, and the 2024 national average wage index of $69,846.57.',
  },
  {
    id: 'ssa-cbb',
    title: 'Contribution and Benefit Base',
    publisher: 'Social Security Administration',
    url: 'https://www.ssa.gov/oact/cola/cbb.html',
    kind: 'government',
    status: 'primary',
    supports: 'The base in every year, including $142,800 in 2021.',
  },
  {
    id: 'usc-3101',
    title: '26 U.S.C. §3101 — Rate of tax',
    publisher: 'United States Code',
    url: 'https://www.law.cornell.edu/uscode/text/26/3101',
    kind: 'government',
    status: 'primary',
    supports: 'The employee rates: 6.2% Social Security, 1.45% Medicare, and 0.9% additional Medicare above $200,000.',
  },
  {
    id: 'usc-206',
    title: '29 U.S.C. §206 — Minimum wage',
    publisher: 'United States Code',
    url: 'https://www.law.cornell.edu/uscode/text/29/206',
    kind: 'government',
    status: 'primary',
    supports: 'The federal minimum wage of $7.25, in force since 24 July 2009.',
  },
  {
    id: 'irs-2026',
    title: 'IRS releases tax inflation adjustments for tax year 2026',
    publisher: 'Internal Revenue Service',
    date: '2025-10',
    url: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
    kind: 'government',
    status: 'primary',
    supports: 'The 2026 standard deduction for a single filer, $16,100.',
  },
  {
    id: 'cbo-2022',
    title: 'The Distribution of Household Income, 2022',
    publisher: 'Congressional Budget Office',
    date: '2026-01',
    url: 'https://www.cbo.gov/system/files/2026-01/61911-Household-Income-2022.pdf',
    kind: 'government',
    status: 'primary',
    supports: 'Average federal tax rates by income group: 1.4% for the lowest fifth, 23.2% for the highest, 31.5% for the top 1%.',
    note: 'Federal taxes here mean individual income, payroll, corporate income and excise taxes together.',
  },
  {
    id: 'cea-2021',
    title: 'What Is the Average Federal Individual Income Tax Rate on the Wealthiest Americans?',
    author: 'Greg Leiserson and Danny Yagan',
    publisher: 'White House Council of Economic Advisers and OMB',
    date: '2021-09-23',
    url: 'https://bidenwhitehouse.archives.gov/cea/blog/2021/09/23/what-is-the-average-federal-individual-income-tax-rate-on-the-wealthiest-americans',
    kind: 'government',
    status: 'primary',
    supports: 'The 8.2% figure for the wealthiest 400 families, 2010–2018, on an income measure that includes unrealised gains.',
  },
  {
    id: 'taxfoundation-cea',
    title: 'Latest White House Report Tells Incomplete Story on Average Tax Rates for Wealthy',
    publisher: 'Tax Foundation',
    date: '2021-09',
    url: 'https://taxfoundation.org/blog/white-house-average-tax-rates-wealthy/',
    kind: 'research report',
    status: 'secondary',
    supports: 'The case against counting unrealised gains as income — cited so the denominator dispute is shown from both sides.',
  },
  {
    id: 'propublica-2021',
    title: 'The Secret IRS Files: Trove of Never-Before-Seen Records Reveal How the Wealthiest Avoid Income Tax',
    author: 'Jesse Eisinger, Jeff Ernsthausen and Paul Kiel',
    publisher: 'ProPublica',
    date: '2021-06-08',
    url: 'https://www.propublica.org/article/the-secret-irs-files-trove-of-never-before-seen-records-reveal-how-the-wealthiest-avoid-income-tax',
    kind: 'journalism',
    status: 'secondary',
    supports: "Musk's 2014–2018 figures: wealth growth $13.9B, reported income $1.52B, tax paid $455M, and no federal income tax in 2018. The 3.4% rate for the 25 wealthiest.",
    note: 'Built on leaked IRS data. Individual returns are otherwise confidential under 26 U.S.C. §6103. The figures are now eight years old.',
  },
  {
    id: 'musk-2021',
    title: "Musk's $11 Billion Tax Bill Is Big News — Because It's Just 10% of His Wealth Increase So Far This Year",
    publisher: 'Americans for Tax Fairness',
    date: '2021-12',
    url: 'https://americansfortaxfairness.org/musks-11-billion-tax-bill-big-news-just-10-wealth-increase-far-year/',
    kind: 'research report',
    status: 'secondary',
    supports: "The roughly $11 billion Musk said he would pay for 2021, on exercising options. His own statement, reported here by an advocacy organisation.",
  },
  {
    id: 'tesla-ars-2024',
    title: 'Tesla, Inc. — Annual Report to Shareholders, FY2024',
    publisher: 'Tesla, Inc., via SEC EDGAR',
    date: '2025',
    url: 'https://www.sec.gov/Archives/edgar/data/1318605/000110465925090875/tm252787d3_ars.pdf',
    kind: 'government',
    status: 'primary',
    supports: 'That Musk has never accepted a salary and that, from May 2019, none is accrued.',
    note: 'An SEC filing rather than a government document, but a primary record with legal liability attached.',
  },
  {
    id: 'tesla-package',
    title: 'Inside the Implications of Musk’s Massive Deal',
    publisher: 'North Carolina State University, Poole College of Management',
    date: '2025-11-11',
    url: 'https://poole.ncsu.edu/thought-leadership/article/inside-the-implications-of-musks-massive-deal/',
    kind: 'research report',
    status: 'secondary',
    supports: 'The 2025 package: 423,743,904 restricted shares, 12 tranches over 10 years, targets to $8.5 trillion, taxed as ordinary income at vest, and the §162(m) deduction cap.',
  },
  {
    id: 'itep-tesla-2025',
    title: 'Tesla Reported Zero Federal Income Tax on $5.7 Billion of U.S. Income in 2025',
    publisher: 'Institute on Taxation and Economic Policy',
    date: '2026',
    url: 'https://itep.org/tesla-reported-zero-federal-income-tax-in-2025/',
    kind: 'research report',
    status: 'secondary',
    supports: "Tesla's 2025 US income and current federal income tax, read from the 10-K, and the three-year rate of 0.4%.",
    note: 'Current tax, not total tax provision. Corporate tax — a different thing from Musk’s personal liability, and shown separately.',
  },
];

export const byId = (id: string): Source => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`The Cap: unknown source "${id}"`);
  return s;
};

/** Build gate: a source that has not been opened cannot back a figure. */
export function assertNoUnverifiedClaims(): void {
  const bad = SOURCES.filter((s) => s.status === 'needs-check');
  if (bad.length) throw new Error(`The Cap: unverified sources on screen: ${bad.map((s) => s.id).join(', ')}`);
}
