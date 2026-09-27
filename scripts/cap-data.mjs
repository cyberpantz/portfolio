/**
 * The Cap — the data build.
 *
 *   pnpm data:cap     →  src/data/cap.json
 *
 * The page reads the JSON and nothing else. No number on it is typed by hand;
 * each is either a constant below with its source and date, or derived from
 * those constants here. The rule is the one from tilt-data.mjs: a figure typed
 * into prose is a figure that will drift.
 *
 * Every constant names the document it came from and the date it applies to.
 * All of them move — the wage base annually, the brackets with inflation, the
 * filings each year — so the first thing to do when any of this looks stale
 * is to re-read those documents, not to search for a new number.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/data/cap.json');

/* ------------------------------------------------------------ constants */

const LAW = {
  year: 2026,
  /* SSA, "Cost-of-Living Increase and Other Determinations for 2026",
     Federal Register 2025-11-03. Contribution and benefit base. */
  wageBase: 184_500,
  wageBasePrior: 176_100,
  /* Same notice. The national average wage index for 2024 — the figure the
     base is indexed to, and the piece's default income for the same reason:
     it is the agency's own measure of what a wage is. */
  averageWage: 69_846.57,
  averageWageYear: 2024,
  /* 26 U.S.C. §3101. Employee share; the employer pays the same again. */
  socialSecurityRate: 0.062,
  medicareRate: 0.0145,
  /* §3101(b)(2). Additional Medicare above this, single filer. Not indexed. */
  additionalMedicareRate: 0.009,
  additionalMedicareFrom: 200_000,
  /* 29 U.S.C. §206(a)(1)(C). Unchanged since 24 July 2009. */
  minimumWage: 7.25,
  /* Full time, full year: 40 × 52. The BLS convention. */
  fullTimeHours: 2_080,
  /* IRS IR-2025-103, tax year 2026 inflation adjustments, single filer. */
  standardDeductionSingle: 16_100,
  /* Twice a month is common too; fortnightly gives 26 and is what the
     figures draw. The stop DATE does not depend on it. */
  payPeriods: 26,
  /* For the one year Musk's income was wages. SSA contribution and benefit
     base history, ssa.gov/oact/cola/cbb.html. */
  wageBase2021: 142_800,
};

/* Published effective rates, each with the denominator that produced it.
   They disagree because they measure different things; the page shows all
   three and says so. */
const RATES = [
  {
    id: 'cbo',
    label: 'Top 1%',
    rate: 31.5,
    denominator: 'Income as taxed',
    period: '2022',
    source: 'cbo-2022',
    /* Same report: the other end of the distribution. */
    lowest: { label: 'Lowest fifth', rate: 1.4 },
    middle: { label: 'Highest fifth', rate: 23.2 },
  },
  {
    id: 'cea',
    label: 'Wealthiest 400',
    rate: 8.2,
    denominator: 'Income, including unrealised gains',
    period: '2010–2018',
    source: 'cea-2021',
  },
  {
    id: 'propublica',
    label: 'Wealthiest 25',
    rate: 3.4,
    denominator: 'Growth in wealth',
    period: '2014–2018',
    source: 'propublica-2021',
    note: 'ProPublica calls this the "true tax rate". It is their term, not a standard measure.',
  },
];

const MUSK = {
  /* Tesla annual report FY2024, executive compensation: never accepted a
     salary; accrual eliminated May 2019 at his request. */
  salary: 0,
  salarySince: 2019,
  /* ProPublica, The Secret IRS Files, 2021. Leaked IRS data, 2014–2018. */
  leak: {
    from: 2014, to: 2018,
    wealthGrowth: 13.9e9,
    incomeReported: 1.52e9,
    taxPaid: 455e6,
    zeroYear: 2018,
  },
  /* His own statement, December 2021; widely reported. Option exercise —
     which IS compensation, so it is the one year the cap applied to him. */
  exercise: { year: 2021, taxPaid: 11e9 },
  /* Tesla proxy, approved 6 November 2025. */
  package: {
    approved: '2025-11-06',
    shares: 423_743_904,
    tranches: 12,
    years: 10,
    topTarget: 8.5e12,
  },
};

const TESLA = {
  /* Tesla 10-K FY2025, as read by ITEP: current federal income tax. */
  year: 2025,
  usIncome: 5.7e9,
  currentFederalTax: 0,
  threeYearRate: 0.4,
  statutoryRate: 21,
};

/* ------------------------------------------------------------- derived */

const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * The day Social Security tax stops.
 *
 * Wages are taxed until they reach the base, and the base is reached at
 * the same FRACTION of the year regardless of how the pay is split up, so
 * the date does not depend on the pay schedule. `null` is never: the base
 * was not reached.
 */
function stopDay(income) {
  if (income <= LAW.wageBase) return null;
  return Math.ceil((LAW.wageBase / income) * 365);
}

function dateOf(day) {
  const d = new Date(Date.UTC(LAW.year, 0, day));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function stopPayday(income) {
  if (income <= LAW.wageBase) return null;
  return Math.ceil((LAW.wageBase / income) * LAW.payPeriods);
}

function payroll(income) {
  const ss = Math.min(income, LAW.wageBase) * LAW.socialSecurityRate;
  const medicare = income * LAW.medicareRate
    + Math.max(0, income - LAW.additionalMedicareFrom) * LAW.additionalMedicareRate;
  return {
    socialSecurity: round(ss, 2),
    medicare: round(medicare, 2),
    total: round(ss + medicare, 2),
    /* Share of income taken by Social Security alone. The number the cap
       bends. */
    socialSecurityRate: round((ss / income) * 100, 2),
    /* How much of the income was subject to it. */
    shareTaxed: round((Math.min(income, LAW.wageBase) / income) * 100, 1),
  };
}

const minimumWageIncome = LAW.minimumWage * LAW.fullTimeHours;

/* The named incomes the curve is drawn through. */
const LADDER = [
  { id: 'minimum', label: 'Federal minimum wage', income: minimumWageIncome },
  { id: 'average', label: 'Average wage', income: LAW.averageWage },
  { id: 'base', label: 'The base itself', income: LAW.wageBase },
  { id: 'twice', label: 'Twice the base', income: LAW.wageBase * 2 },
  { id: 'half-million', label: '$500,000', income: 500_000 },
  { id: 'million', label: '$1,000,000', income: 1_000_000 },
  { id: 'four-million', label: '$4,000,000', income: 4_000_000 },
  { id: 'ten-million', label: '$10,000,000', income: 10_000_000 },
].map((r) => ({
  ...r,
  income: round(r.income, 2),
  stopDay: stopDay(r.income),
  stopDate: stopDay(r.income) === null ? null : dateOf(stopDay(r.income)),
  stopPayday: stopPayday(r.income),
  ...payroll(r.income),
}));

/* A dense curve for drawing: stop day against income, log-spaced. */
const CURVE = [];
for (let e = Math.log10(LAW.wageBase); e <= 7.05; e += 0.02) {
  const income = 10 ** e;
  CURVE.push([round(income), stopDay(income)]);
}

const minimum = {
  income: minimumWageIncome,
  hourly: LAW.minimumWage,
  hours: LAW.fullTimeHours,
  /* Below the standard deduction, so taxable income is zero before any
     credit is considered. Derived, not asserted. */
  belowStandardDeduction: minimumWageIncome < LAW.standardDeductionSingle,
  federalIncomeTax: minimumWageIncome < LAW.standardDeductionSingle ? 0 : null,
  ...payroll(minimumWageIncome),
  perPayday: round(payroll(minimumWageIncome).total / LAW.payPeriods, 2),
};

/* The one year the cap applied to Musk. Social Security stops at the base;
   Medicare does not stop. */
const musk2021 = {
  year: MUSK.exercise.year,
  wageBase: LAW.wageBase2021,
  socialSecurityMax: round(LAW.wageBase2021 * LAW.socialSecurityRate, 2),
  stopPayday: 1,
};

const musk = {
  ...MUSK,
  leak: {
    ...MUSK.leak,
    rateOnWealthGrowth: round((MUSK.leak.taxPaid / MUSK.leak.wealthGrowth) * 100, 2),
    rateOnIncomeReported: round((MUSK.leak.taxPaid / MUSK.leak.incomeReported) * 100, 1),
  },
  in2021: musk2021,
  package: {
    ...MUSK.package,
    /* The worker's paydays over the same span, for the two clocks. */
    workerPaydays: MUSK.package.years * LAW.payPeriods,
  },
};

/* ---------------------------------------------------------------- write */

const out = {
  built: new Date().toISOString().slice(0, 10),
  law: LAW,
  minimum,
  ladder: LADDER,
  curve: CURVE,
  rates: RATES,
  musk,
  tesla: TESLA,
};

/* Sanity, so a bad constant fails here rather than on the page. */
const twice = LADDER.find((r) => r.id === 'twice');
if (twice.stopDay < 180 || twice.stopDay > 186) throw new Error(`twice the base should stop mid-year, got day ${twice.stopDay}`);
if (LADDER.find((r) => r.id === 'base').stopDay !== null) throw new Error('the base itself should never stop');
if (!minimum.belowStandardDeduction) throw new Error('minimum wage is no longer below the standard deduction — the page says it is');
for (let i = 1; i < LADDER.length; i++) {
  const a = LADDER[i - 1], b = LADDER[i];
  if (a.stopDay !== null && b.stopDay !== null && b.stopDay > a.stopDay) throw new Error('stop day must fall as income rises');
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

console.log(`cap.json — ${LAW.year} law, base $${LAW.wageBase.toLocaleString()}`);
for (const r of LADDER) {
  console.log(`  ${r.label.padEnd(22)} $${r.income.toLocaleString().padStart(12)}   ${r.stopDate ?? 'never'}   SS ${r.socialSecurityRate}% of income`);
}
console.log(`  minimum wage: $${minimum.total} payroll/yr, $${minimum.perPayday}/payday, income tax $${minimum.federalIncomeTax}`);
console.log(`  Musk 2021: SS maxed at $${musk2021.socialSecurityMax} on the first payday`);
