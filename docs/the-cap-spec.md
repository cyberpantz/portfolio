# The Cap — Brief

A companion to **Wage Gap**. Same move: take a rate nobody can picture and make it
physical. Not a chart about billionaires.

Working title, no number in it — see `tilt-spec.md`.

**This is a brief, not a spec.** It carries the idea, the judgment behind it, the
data and the traps. It stops before the implementation, because the mechanism is
the part still to be found and writing it down early would freeze the wrong one.

---

## 1. What this is not

The pitch it started as: *taxes paid by Elon, you, the average, and a minimum-wage
worker* — four bars, four rates.

That version should not be built, for three reasons.

1. **It has been built.** Everyone has seen that chart. It arrives as a position
   rather than a discovery, and readers already know which side they are on.
2. **The answer depends entirely on the denominator**, and the defensible choices
   disagree violently — see §4. A piece that shows only one is an argument
   wearing a chart's clothes.
3. **It teaches nothing.** The reader finishes where they started.

Interesting lives one level down, in two structural facts that are exact, public,
and genuinely surprising.

## 2. The two mechanisms

### The bar that stops

Social Security tax applies to every dollar of wages up to **$184,500** (2026) and
then switches off entirely.

- Someone on $40,000 pays it on **100%** of their income.
- Someone on $4,000,000 pays it on **4.6%**.

That is not a claim about fairness. It is the arithmetic of a cap, and almost
nobody can tell you where the number sits. Visually: a bar that simply *ends*
while the income keeps running off the side of the frame.

This is the Wage Gap moment — a rate made physical.

### Taxed now versus taxed in ten years

- The minimum-wage worker's **7.65%** leaves every fortnight, from the first
  dollar, permanently.
- Musk's 2025 package is taxed at ordinary rates too — but on **vesting**, after a
  decade of compounding untaxed.

Same rate. Completely different instrument. This framing survives a hostile
reader, because it does not claim anyone underpaid; it shows that *when* is worth
more than *what*.

## 3. The data, and how public each part is

| Column | Source | Public? |
|---|---|---|
| **You** | User input + current law | Exact, computed |
| **Minimum wage** | $7.25 × 2,080 = **$15,080** | Exact, computed |
| **Average** | CBO, *Distribution of Household Income, 2022* (Jan 2026) | Fully public |
| **Musk, personal** | ProPublica *Secret IRS Files* — **leaked** | Not public record |
| **Musk, forward** | Tesla proxy, Nov 2025 pay package | Fully public, exact |
| **Tesla, corporate** | Tesla 10-K | Fully public |

**Individual returns are confidential** under 26 U.S.C. §6103. Musk's return is not
public record and never will be. Everything else here is.

### Figures, with dates

- **Social Security wage base, 2026:** $184,500 (was $176,100 in 2025).
- **Federal minimum wage:** $7.25/hr, unchanged since 24 July 2009 → $15,080/yr.
- **Standard deduction, 2026, single:** $16,100 — *above* $15,080, so the
  minimum-wage worker owes **$0 federal income tax**, derived from current law
  rather than asserted. Possibly negative with EITC.
- **Payroll tax:** 7.65% employee share (6.2% SS + 1.45% Medicare), from dollar one.
- **CBO effective federal rates, 2022:** 1.4% bottom quintile → 23.2% top quintile
  → **31.5% top 1%**.
- **ProPublica, 2014–18:** Musk's wealth +$13.9B, income $1.52B, tax $455M =
  **3.27% of wealth growth**. **Zero federal income tax in 2018.** Top 25
  collectively 3.4%.
- **White House CEA, 2010–18:** wealthiest 400 paid **8.2%** on $1.8T, counting
  unrealised gains.
- **Musk, 2021:** roughly **$11B**, one of the largest individual tax payments in
  US history, on exercising options.
- **Tesla 10-K, 2025:** ~$5.7B US income, **$0 current federal income tax**. Three
  years: 0.4% of US profits against a 21% statutory rate.
- **Pay package, approved 6 Nov 2025:** 423,743,904 restricted shares, 12 tranches
  over 10 years, targets up to $8.5T market cap. Restricted stock is ordinary
  income **at vest**. §162(m) caps Tesla's own deduction at $1M.

## 4. The denominator problem

The same question gives three defensible answers:

| Measure | Rate | Denominator |
|---|---|---|
| CBO, 2022 | **31.5%** (top 1%) | income as taxed |
| White House CEA, 2010–18 | **8.2%** (wealthiest 400) | income *incl. unrealised gains* |
| ProPublica, 2014–18 | **3.4%** (top 25) | growth in wealth |

None is wrong. They measure different things. ProPublica's "true tax rate" is
their own coinage, not a standard concept, and should be labelled as such.

**If the piece keeps the comparison at all**, the honest form is to let the reader
switch the denominator and watch the ranking invert. That is more interesting than
any single number, and it is the thing a portfolio reviewer will notice.

## 5. Traps

- **Corporate ≠ personal.** Tesla's $0 is corporate tax. Conflating it with Musk's
  personal liability is the sloppiest move available and reviewers catch it
  instantly. If both appear, they must be visibly separate.
- **Current vs deferred.** ITEP's $0 is *current* federal tax, excluding deferred.
  That is the right measure; it needs stating, not hiding.
- **The $11B belongs in the piece.** Omitting it is arguing rather than showing.
- **The leak is a leak.** Legal to cite, universally cited, needs explicit
  attribution — and it is now 8+ years stale.
- **State tax is a second axis.** Musk moved to Texas; no state income tax.
- **Employer-side payroll.** Economists generally treat the employer's 7.65% as
  borne by the worker too. Including it doubles the worker's rate to 15.3% and is
  defensible — but it is a modelling choice and must be shown as one.

## 6. The honesty rules

Inherited from `tilt-spec.md`, which got better when it was made to test three
explanations and admit two did not hold.

1. **No verdict.** Show the denominators disagreeing and let the reader sit with
   it. A piece demonstrating judgment under contested data is worth more than one
   demonstrating you can make a bar chart angry.
2. **Every figure derived, none typed.** Same discipline as
   `scripts/tilt-data.mjs` — a build step pulls from primary filings (EDGAR, CBO
   tables, IRS inflation adjustments) and the page reads that file. A number
   typed by hand is a number that will drift.
3. **Cite the denominator next to every rate.** A rate without one is not a fact.
4. **Date everything.** Tax law changed in 2025 (OBBBA) and the figures above are
   2026. They will go stale.

## 7. The open question

**The mechanism.** Wage Gap had a counter ticking away; Tilt had bands fanning
apart. This does not have one yet, and that — not the data — is the risk. Four
bars in a row is a chart, not an exploration.

The cap is the most promising candidate: something that runs, and then hits a wall
and stops, while the thing driving it carries on. Find the tick and there is a
piece here.

## 7a. Mechanism — decided

**The day it stops.** A year drawn as 26 paydays. A cell is inked while Social
Security tax is coming out of it, hollow once it is not. Read down a ladder of
incomes and the inked region falls away from the right into a cliff.

Each row carries two readouts: the stop date on the right, and on the left the
share of income actually taken — 6.2% until the base, then falling to 0.11% at
$10M. Two dimensions, one drawing, no legend.

Every chapter is a variant of that one figure:

| # | Chapter | Rows |
|---|---|---|
| 1 | Every payday, from the first dollar | the average wage, all cells inked |
| 2 | Only on the first $184,500 | + the base, + twice the base — the wall appears |
| 3 | The higher the income, the earlier | the full ladder, with **your row** in the accent |
| 4 | For Musk the question does not arise | $10M, then a dashed row with no cells, then 2021: one cell |
| 5 | Same rate, different clock | 260 paydays against 12 tranches |
| 6 | Three published answers | the denominator switch |
| — | Your year | the field again, one row, one sentence |

Pure SVG. Server-renderable, so the suite can hold the drawing to the data file.

Built as `src/experiments/cap/`, data from `scripts/cap-data.mjs`, sources in
`src/data/cap-sources.ts`. The suite checks the maths against the file, that
every source is cited and every citation resolves, and that no dollar figure or
percentage is typed into a sentence.

## 8. Sources

- ProPublica, *The Secret IRS Files* —
  https://www.propublica.org/article/the-secret-irs-files-trove-of-never-before-seen-records-reveal-how-the-wealthiest-avoid-income-tax
- CBO, *The Distribution of Household Income, 2022* (Jan 2026) —
  https://www.cbo.gov/system/files/2026-01/61911-Household-Income-2022.pdf
- CEA/OMB, *What Is the Average Federal Individual Income Tax Rate on the
  Wealthiest Americans?* —
  https://bidenwhitehouse.archives.gov/cea/blog/2021/09/23/what-is-the-average-federal-individual-income-tax-rate-on-the-wealthiest-americans
- Tax Foundation, critique of the CEA measure —
  https://taxfoundation.org/blog/white-house-average-tax-rates-wealthy/
- ITEP, *Tesla Reported Zero Federal Income Tax on $5.7 Billion of U.S. Income in
  2025* — https://itep.org/tesla-reported-zero-federal-income-tax-in-2025/
- Tesla 10-K/A FY2025, SEC EDGAR —
  https://www.sec.gov/Archives/edgar/data/0001318605/000110465926053166/tm2611837d1_10ka.htm
- NC State Poole, on the pay package —
  https://poole.ncsu.edu/thought-leadership/article/inside-the-implications-of-musks-massive-deal/
- IRS, 2026 inflation adjustments including OBBBA —
  https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
- Tax Foundation, *FAQ: The One Big Beautiful Bill Act Tax Changes* —
  https://taxfoundation.org/research/all/federal/one-big-beautiful-bill-act-tax-changes/

---

*Researched September 2026. Every figure above carries a date because all of them
will move — the wage base annually, the brackets with inflation, the filings each
year. Re-check before building.*
