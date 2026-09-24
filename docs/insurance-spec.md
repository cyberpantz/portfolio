# The Crossing — Spec & Build Plan

A data visualisation of what American homeowners insurance charges, against
what it pays out in claims — and of the two states where, for five years, it
charged less. React Three Fiber in an Astro island, TypeScript, US Treasury
data.

**No number in the title, on purpose.** It was *Ninety-One Cents*, then
*Seventy-Seven Cents* an hour later when the estimator changed, and the figure
is still 0.77 / 0.85 / 0.90 / 0.91 depending on how it is built (§6.5). A
headline that has to be re-derived every time the pipeline moves is a liability,
not a name — and the one string everybody repeats is the worst place to put the
least settled thing in the project.

*Below Cost* was the obvious number-free alternative and is rejected for the
same reason §2 rejects the phrasing: claims are not costs. Expenses,
reinsurance and capital sit on top. Naming the piece after that misreading
would bake it into the title.

*The Crossing* is geometric, which is the register the whole piece should use —
the price surface falls through the loss surface. It survives any
recomputation, because the crossing either happens or it does not. §18.

> **Revision, after Phase 1.** This document originally proposed a piece about
> insurers withdrawing from climate-exposed markets, measured by non-renewal
> rate and premium against loss ratio. The data killed both. Non-renewal cannot
> carry the story (§5.4) and premium-versus-loss-ratio is statistical noise
> (§6.1). What replaced them is better, and the §7 gate now passes on evidence
> rather than on hope. The original framing is preserved in git history.
>
> **Second revision.** "Loss ratio is noise" was itself the wrong diagnosis —
> loss ratio has premium in its denominator, so correlating the two correlates
> premium against itself (§6.1). And the headline figure moved from 91 cents to
> 77 when the estimator was corrected, which is why there is no number in the
> title any more (§6.5).

---

## The bar

Wage Gap works because it shows its arithmetic. This has to meet that standard
under harder conditions: the subject is somebody's house, the reader may be
personally exposed, and the numbers are frightening.

A piece about financial risk that overclaims is worse than no piece. The
failure mode is not being boring — it is being dismissible. One overstated
sentence hands a reader a reason to stop reading, and this data does not need
any help.

---

## 1. The questions

1. **What does home insurance cost, and where?** Premium per policy, by ZIP,
   2018–2022.
2. **What does it pay out?** Expected annual loss per policy — claim frequency
   × claim severity. The insurer's own experience, not a model.
3. **Where do those two numbers cross?** Where premium falls below paid
   losses, **claims alone exceeded premium**. Not "below cost" — expenses sit
   on top of claims (§2). **This is the piece.**
4. **What happened next?** The data stops in 2022. The rupture is 2022–2026,
   and has to be told rather than shown.
5. **Who ends up paying?** A policyholder — just not the one who burned. §9.4.

---

## 2. The claim

> Across the ZIP codes in this dataset, American homeowners insurance collected
> about **$1.59 in premium for every dollar it paid out in claims**. In
> California it collected **77 cents** — claims alone exceeded premium, before
> a cent of expenses. Five months after the data ends, the largest insurer in
> the state stopped writing new policies.

**California is the spine, and it is the only state that can be.** Louisiana's
0.85 is the sharper number and it has to come out of the headline: Louisiana is
one of eight states whose regulators opted out of the data call (§5.7), so the
file holds only the national carriers operating there — not the Louisiana
insurers that actually failed. It survives as corroboration that the threshold
is not one state's quirk, carrying its caveat. It cannot be a co-headline.

**Three disciplines this sentence has to keep.**

*Claims are not costs, and the error runs both ways.* Everything above 1.0
still has to pay claims handling, acquisition, reinsurance and capital on top —
commonly 25–30 points, so $1.59 is a normal claims ratio and not a margin.
**And an insurer can be profitable with a loss ratio over 100%**, because
premium float is invested and investment income is a separate earnings stream.
Public Citizen makes this point in its own metric notes, and a piece that omits
it while leaning on the first half is arguing rather than describing.

The threshold means exactly one thing — **claims exceeded premium** — and that
is the phrase that goes on the graphic. It does not mean below cost, and it
does not mean losing money.

*It is an average over ZIP codes, not national accounting.* The workbook
publishes policy-count deciles, not policy counts, so a true dollar-weighted
"total premium ÷ total losses" cannot be computed. §6.5.

*Louisiana is not an "after".* Ida was August 2021 and the insolvencies run
through 2023 — inside the years the ratio is built from. Only California's exit
is cleanly after the window, so only California gets the "months later"
construction.

This is mechanical rather than moral. The popular framing is that insurers
abandoned people; the data says that where they left, claims alone were
outrunning premium. That is not a defence of insurers. It moves the argument to
the question the arithmetic forces — who carries the cost — and then the piece
stops, because §14 says the wall copy states flows and does not answer.

**What the piece must not claim.** That anyone hid the data — Treasury
published it. That insurers are blameless — rate suppression is one cause among
several and the dataset cannot rank them. That a reader should do anything
about their own house.

---

## 3. Goals

- One national field, legible in five seconds, that rewards a minute of orbiting.
- The crossing of two surfaces made visible as a shape, not as a legend.
- Three supporting graphics that carry what the geometry structurally cannot.
- Sourcing shown, not asserted. Every number traceable to a named row or a
  dated, cited event.
- A non-visual equivalent that is genuinely equivalent, not a courtesy.

## 4. Non-goals

- Prediction. The data ends in 2022 and the piece describes.
- Advice, financial or otherwise. §13.
- Flood and earthquake. Excluded from the source data, so excluded here.
- Live data. A fixed snapshot with a date on it.

---

## 5. Data

### 5.1 What is actually in the file

`src/data/raw/fio-homeowners-2018-2022.xlsx` — Treasury FIO, published
16 January 2025. Sheet `Supporting Underlying Metrics`, **127,965 rows**,
**25,593 ZIP codes × 5 years**, no nulls, every ZIP present in all five years.

| Column | Definition per the workbook |
|---|---|
| `ZIP Code` | Integer — **leading zeros stripped**, so `1001` is `01001` |
| `Year` | 2018–2022 |
| `Policy Decile Grouping` | 1–10, relative policy count. **The only weight available** |
| `Claim Frequency` | paid claims ÷ policies in force |
| `Claim Severity` | losses paid ÷ paid claims |
| `Loss Ratio` | losses paid ÷ written premium |
| `Premiums Per Policy` | written premium ÷ policies in force |
| `Nonrenewal Rate` | insurer-initiated non-renewals ÷ policies |
| `Nonpayment Cancellation Rate` | cancelled for non-payment ÷ policies |
| `Other than Nonpayment Cancellation Rate` | insurer-initiated mid-term cancels |

### 5.2 What is NOT in it, and what that costs

- **No coverage amount.** The original §6 proposed premium ÷ coverage per
  $1,000 to make prices comparable across house values. Not possible. Premium
  per policy conflates the price of risk with the size of the house, and that
  limitation has to be disclosed rather than finessed.
- **No policy counts** — only deciles. "Policy-weighted aggregation" is
  therefore ordinal and approximate. Say so.
- **No county or state identifier.** A ZIP→county crosswalk is required after
  all. §5.5.
- **No residual market, no excess & surplus.** FAIR plans and E&S carriers are
  excluded, which is why the story of the retreat is not in here. §5.4.

### 5.3 Suppression

Only ZIPs with **≥10 reporting insurers and ≥50 policies** are published. That
removes 22% of ZIPs from the underlying collection. Coverage is roughly 80% of
national premium written, and varies by state — some regulators required
smaller domestic insurers to report and some did not.

**Suppressed and absent ZIPs render as visibly absent, never as zero.** On an
extruded map a zero reads as good news, and this is the single most dangerous
rendering bug the piece could ship.

### 5.4 Two hazards found in the data

**Texas reports no non-renewals at all.** All 1,510 Texas ZIPs, all five years,
exactly one distinct value: `0.0`. Other-than-non-payment cancellations are
also uniformly zero, while claim frequency is normal. This is an unreported
field, not a stable market, and a map would render Texas as the calmest place
in America.

**Florida's non-renewal rate is below the national average** — 0.44% against
0.89% — which is absurd on its face for the state with the most disrupted
market in the country. The explanation is §5.2: Florida's crisis moved policies
into Citizens and into E&S, both excluded here. Its premium column still shows
it, at $4,975 against a national $1,717.

Together these are conclusive: **the non-renewal column cannot carry the
story.** It is retained in the dataset and the table, and nothing is extruded
by it.

### 5.4.1 But the hazard does not stop at non-renewal

Florida's premium is real and its paid losses are real, so it renders a
perfectly valid **2.06** — a comfortable-looking margin in the state with the
most disrupted market in the country. It looks that way *because* its worst
risks left the admitted market for Citizens and E&S. The same applies to Texas
at 1.56 with an unreported column.

This is the same class of visual lie that killed the non-renewal map, and a
wall-label sentence is the fix already rejected for Texas. **The field itself
must mark Florida and Texas as incomplete** — hatched, or drawn at reduced
opacity with a legend entry that says *"admitted market only; this state's
residual market is large and is not in this data."*

A caveat a reader has to scroll to is a caveat that has been designed to be
missed.

### 5.4.2 The real explanation: states were allowed to opt out

Found by reading the prior art rather than the data (§19). The NAIC let state
regulators decline the collection, and **Florida, Alabama, Louisiana, Georgia,
Indiana, Montana, North Dakota and Texas** did. For those states the file holds
only the *national* carriers that operate there; the state-domiciled insurers
are absent.

That single mechanism explains every anomaly in §5.4 at once, and it is worse
than the explanations they replace:

| state | published ZIPs | what is missing |
|---|---|---|
| Texas | 1,510 | the column itself — all zeros |
| Florida | 560 | the Florida-domestic carriers, several of which failed |
| Louisiana | 337 | the Louisiana carriers — i.e. the eleven that went insolvent |

**This is not a caveat, it is a constraint on the claim.** A state figure for an
opt-out state is a statement about national carriers operating there, not about
that state's market. The eight states are flagged in the data, hatched in the
field (§5.4.1), and excluded from any headline.

### 5.5 Geometry and crosswalk

- **Counties** for the field: ~3,143 polygons from `us-atlas` (TopoJSON), to be
  added as a dependency.
- **ZIP → county crosswalk**, required because the workbook has no FIPS.
  HUD's USPS crosswalk or the Census ZCTA relationship file.
- **ZCTA centroids** for the lookup fly-to.

### 5.6 Pipeline

Build-time script, not a runtime fetch. `scripts/insurance-data.mjs`:

1. Read the workbook, zero-pad ZIPs to five characters.
2. Join to county via the crosswalk; report unmatched ZIPs as a count, loudly.
3. Aggregate ZIP → county, decile-weighted, and compute §6.
4. Emit quantised JSON keyed by FIPS, plus a ZIP-level file for the lookup.
5. Fail on missing columns by name rather than by position.

---

## 6. Derived measures

### 6.1 Why the first measure failed — and it was not the loss ratio's fault

The original thesis measure was `premium percentile − loss-ratio percentile`.
Rank correlation between premium and loss ratio is **+0.049**, and +0.043
winsorised. That reads as "loss ratio is noise", and the first revision of this
document said so. That was the wrong diagnosis.

**Loss ratio has premium in its denominator.** It is `losses ÷ premium`, so
correlating it against premium correlates premium against itself, and the
artefact cancels the real relationship. Confirm by substituting the reciprocal:

| | rank corr. with premium |
|---|---|
| Loss Ratio (`losses ÷ premium`) | **+0.049** — contaminated |
| 1 ÷ Loss Ratio | **−0.050** — contaminated, mirrored |
| EAL (`losses ÷ policies`) | **+0.545** — clean |

EAL is not a new quantity that rescued the piece. It is the same information
with premium taken out of the denominator, which is the only form in which the
comparison means anything. **The ZIP-level correlation was an artefact; the
state-level story is the five-year paid loss ratio, stated in cents.**

### 6.2 The measures

| Measure | Definition | Note |
|---|---|---|
| `premium` | Premiums Per Policy | Conflates price and house size (§5.2) |
| `eal` | Claim Frequency × Claim Severity, **per year, then averaged** | Paid losses per policy |
| `cents` | `premium ÷ eal` | Below 1.0 means **claims exceeded premium** |
| `gap` | percentile(`premium`) − percentile(`eal`) | Readout, not the extrusion |
| `trend` | 2018→2022 slope of `premium` | Direction |

**`cents` is a readout. Neither it nor `gap` is what gets extruded** — a single
ratio with height is a choropleth with height, which §7 declines. The surfaces
are `premium` and `eal`, both in dollars, and the crossing is the exhibit.

### 6.3 The finding

Construction A (§6.5), five-year pooled:

| | premium | paid losses | cents per dollar |
|---|---|---|---|
| California | $1,681 | $2,183 | **0.77** |
| Louisiana ⚠ | $2,453 | $2,870 | **0.85** |
| Texas ⚠ | $2,276 | $1,455 | 1.56 |
| **United States** | **$1,717** | **$1,080** | **1.59** |
| Oklahoma | $2,572 | $1,498 | 1.72 |
| Florida ⚠ | $4,975 | $2,417 | 2.06 |
| South Carolina | $1,778 | $708 | 2.51 |

⚠ = opt-out state (§5.4.2); national carriers only. Below 1.0 means claims
alone exceeded premium, before any expense. It does not mean "below cost" (§2),
it is not a margin, and it does not mean the insurer lost money.

### 6.4 The caveat that must be on screen

`eal` is **five years of paid claims**, not an actuarial expected loss. No
catastrophe model, so it does not price events that had not yet happened. For
wildfire that means it *understates* the risk — which makes California's 0.77
worse than it looks, not better. The single most load-bearing caveat here.

### 6.5 The estimator problem, and why the title has no number in it

There is no single "cents per dollar". There are four defensible
constructions and they disagree:

| | A pooled | B mean of ZIP means | C mean(freq)×mean(sev) | D 1 ÷ published LR |
|---|---|---|---|---|
| California | **0.77** | 0.77 | 0.91 | 0.90 |
| Louisiana | **0.85** | 0.85 | 0.86 | 0.96 |
| United States | **1.59** | 1.59 | 1.62 | 1.75 |

- **C is what the first draft quoted**, and it is the weakest: multiplying two
  separately-averaged quantities, `mean(f) × mean(s)`, is not the mean of
  `f × s` unless they are uncorrelated. They are not. This is where "91 cents"
  came from, and it is why the piece is no longer named after it.
- **D uses the workbook's own Loss Ratio column.** Algebraically `premium ÷ eal`
  should equal `1 ÷ lossRatio` — the policy counts cancel. In this file it does
  not: the offset is near-constant at about 1.17× (p1 0.85, p99 1.00), because
  the published columns are aggregated per insurer and then combined, and that
  does not commute. Neither is wrong; they are different estimators.
- **A is adopted**: pool the dollars, then divide. Stated as such on screen.

**Also: 2,021 rows have EAL ≤ 0** — catastrophe recoveries and subrogation
making paid losses negative. They break any per-ZIP ratio and must be excluded
from `cents` while remaining in the surfaces.

### 6.6 What cannot be computed

A true dollar-weighted national figure — total premium ÷ total losses. The
workbook publishes policy-count **deciles**, not counts, so every aggregate
here is an average over ZIP codes rather than over policies. Decile-weighting
moves the US figure from 1.59 to 1.61 and California from 0.77 to 0.91, which
is a large enough swing that the weighting has to be named beside the number
rather than assumed.

---

## 7. Why 3D earns its place

The test has not moved: 3D must do something a 2D choropleth cannot.

**The interesting quantity is the space between two surfaces.** Premium over
the map, expected loss over the map, and the volume between them. A choropleth
can show either, or their difference as a third colour ramp the reader has to
take on trust. Extruding both lets them *cross*, and the crossing is the
finding: where the price surface drops beneath the loss surface, the market is
selling below cost.

**The narration stays geometric.** The price surface falls *through* the loss
surface, and California and Louisiana are the places it comes out underneath.
Water language is banned throughout — "underwater", "submerged", "drowning" —
because this is a wildfire and wind story built on a dataset that explicitly
excludes flood, and importing the one peril the file cannot see is how a
careful reader decides the rest is careless too.

A crossing is only legible from near the horizon, which is an argument for a
camera, which is the argument for 3D.

This gate previously had no evidence behind it. It now does: §6.2.

**Phase 2 remains a real gate, and it tests the right thing.** Two surfaces in
**dollars** — `premium` and `eal` — crossing. Not a ratio extruded as height:
that is a choropleth with relief, which this section has already declined, and
it would pass a test the piece does not need to pass. `cents` and `gap` stay as
readouts. If the dollar crossing at 3,143 polygons reads as mush, the honest
outcome is a 2D piece and §8 is rewritten.

---

## 8. The 3D field

### 8.1 The price

Counties extruded by `premium`. Free orbit, damped, opening three-quarter —
the angle that shows relief, where top-down is a choropleth with extra steps.

### 8.2 The crossing

The second surface, `eal`, fades in. Where price sits above loss the volume
between them reads one way; where it sits below, the other. The camera drops
toward the horizon, because submersion is invisible from above.

### 8.3 Your county

Type a ZIP; camera flies there; neighbours dim; a readout gives the measures
with national percentiles. The Wage Gap move — place the reader and let the
placement talk.

---

## 9. The supporting graphics

The field can only show 2018–2022, and only as places. Everything else is a
different shape of fact. **The rule: a supporting graphic must do something the
3D structurally cannot. If it could have been another layer on the map, it does
not belong here.**

### 9.1 The window that ends — inline SVG

A band for 2018–2022, then events plotted *after* it, clustered immediately to
its right:

| When | What |
|---|---|
| late 2022 | Allstate stops writing new California home policies |
| **Dec 2022** | **the data ends** |
| May 2023 | State Farm stops writing new California policies |
| 2021–2023 | 11 Louisiana carriers become insolvent after Ida |
| Jan 2025 | Palisades and Eaton fires |
| Feb 2025 | $1B FAIR Plan assessment, the first since 1994 |

The whole graphic exists to show that the events pile up in the gap. The 3D has
no axis for "after".

### 9.2 Where the policies went — Recharts

FAIR Plan enrolment, California and Louisiana. Anchors, not a fabricated curve:
CA FAIR Plan past **668,000 policies** by early 2026, up **43%** in the fifteen
months after the fires; Louisiana Citizens roughly **tripled** 2021–2023, past
130,000 by 2024. If annual series cannot be sourced cleanly, draw annotated
anchor points and say that is what they are.

### 9.3 The same instrument, built twice — Recharts or SVG

**Louisiana Citizens** must by statute charge at least **10% above** the higher
of the actuarially justified rate or the highest rate any assessable insurer
charges. **Florida Citizens** must be actuarially sound and uncompetitive, but
a statutory glide path caps increases at **14%** a year, so it cannot be both.

Two states, one instrument, opposite design, opposite outcome. Converts the
piece from "nature did this" to "somebody chose this."

### 9.4 Who actually pays — inline SVG mechanism diagram

Not a chart. Five nodes:

```
Palisades + Eaton  →  FAIR Plan exposure ~$4.8B  →  exceeds reserves
   →  $1B assessment on every insurer licensed in California
   →  50% recoupable from their policyholders
   →  ~1% surcharge on a policy in Sacramento, from 10 Jan 2026
```

This is the ending. Someone with no wildfire exposure pays more because houses
burned two hundred miles away — by statute, and invisibly unless they read the
renewal notice. A map cannot show a flow.

---

## 10. Structure

Four beats, the 3D first and largest:

> **the price** (8.1) → **the crossing** (8.2) → **your county** (8.3) →
> **the break** (9.1) → **where it went** (9.2, 9.3) → **who pays** (9.4)

§1 calls the crossing the piece, so it is named as a beat rather than folded
into "the price". Price is the setup; the crossing is the turn; the lookup is
where a stranger becomes a participant.

**The setup has a built-in misread, and it is deliberate.** Extruding premium
makes Florida and the Gulf the mountains, and California — $1,681 against a
national $1,717 — is unremarkable. The ordinary-looking state is the one that
goes under when the second surface arrives. Five-second legibility and the
finding are different moments, and the gap between them is the drama.

---

## 11. Technology

| Concern | Choice | Note |
|---|---|---|
| Rendering | `three` + `@react-three/fiber` | Already used by Weather Vibe |
| Controls | `@react-three/drei` | Present |
| Geometry | `topojson-client` + **`us-atlas`** | `us-atlas` to add |
| Extrusion | `THREE.ExtrudeGeometry`, merged per layer | < 20 draw calls |
| 2D charts | `recharts` | Present, used by Wage Gap |
| Diagrams | Hand-built inline SVG | Recharts would fight these |
| Island | Astro `client:visible` | |
| Styling | CSS module | |
| Data | Build-time script → static asset | No runtime API |

**Merged, never 3,143 meshes.** One `BufferGeometry` per surface with
per-vertex attributes, so switching measure or year is a uniform change.

---

## 12. Performance budget

| Budget | Target |
|---|---|
| Data payload | < 500 KB gzipped |
| First frame | < 2.5s mid laptop |
| Interaction | 60fps orbit, 30fps floor on integrated graphics |
| Draw calls | < 20 |
| Memory | < 300 MB |

---

## 13. Accessibility

The hardest case on this site, and the standard does not move.

- **Colour is never the only encoding.** Whether price is above or below loss is
  carried by geometry — which surface is on top — and by hatching, not hue.
- **A real table**, same data, sortable, working without JavaScript. Linked
  prominently, not hidden.
- **`prefers-reduced-motion`** kills the fly-to and the year animation; the
  scrubber still works.
- **Keyboard parity** with every pointer interaction.
- **Contrast computed, not eyeballed**, in the lint.

---

## 14. Honesty obligations

Required, on first paint, outside the visualisation:

1. Data is 2018–2022; the market moved sharply after it.
2. `eal` is paid claims, not modelled catastrophe risk, and understates tail
   perils (§6.4).
3. Premium is not adjusted for house size — no coverage column exists.
4. Texas did not report non-renewals; Florida's crisis is largely outside this
   dataset.
5. Excludes flood and earthquake.
6. A portfolio piece. Not financial advice, not a property valuation.

Register: **descriptive throughout.** The piece states what the data says. It
does not tell anyone what to do, and it does not editorialise on top of numbers
that are alarming without help.

---

## 15. Sources

`src/data/insurance-sources.ts` is the single point of truth. The piece renders
its citations from it; nothing is retyped into a component.

Each entry carries a **`status`**, which records how well the claim is actually
known rather than how confident the sentence sounds:

- `primary` — the issuing body's own document, read directly.
- `secondary` — reputable reporting of a primary fact, read directly.
- `needs-check` — reached me through a search summary and the underlying
  document has **not** been opened.

`assertNoUnverifiedClaims()` throws on any `needs-check` source, and the
pipeline and the test suite both call it. Because the timeline and every figure
cite by id, there is no way to render an unchecked claim without tripping it.

**Current state: 16 sources, 4 primary, 12 needing checking.** The gate is shut
and will stay shut until they are opened. The two that matter most, because
they carry the ending:

- `fairplan-enrolment` — the 668,000 policies and the 43% rise reached me with
  no attributable publisher. Replace with the FAIR Plan's own statistics or
  draw §9.2 without them.
- `travelers-surcharge` — the last node of §9.4 and the sentence a reader will
  remember. It needs a filing or a named report, not a summary.

---

## 16. Verification

- **Every rendered figure traces to a source row or a cited event.** No
  hand-typed numbers in components — the Wage Gap lesson, where a copied rate
  drifted from the data that produced it.
- **No claim may rest on a `needs-check` source** (§15).
- **Suppressed and unmatched areas never render as 0.**
- **Percentiles and ratios computed, not asserted**, with the §6.3 table
  reproduced as a test fixture.
- **The table route contains every county in the scene.**
- **Every event in 9.1 carries a date and a source** in the data file.
- **Contrast pairs computed** in the lint.

---

## 17. Build plan

**Phase 1 — Data.** ✅ Profiled. Measures tested, §6.1 rejected, §6.2 adopted,
hazards found. Remaining: crosswalk, aggregation, emit.

**Phase 2 — The two-surface prototype.** Throwaway, ugly, one question: do two
**dollar** surfaces crossing read at a glance? *Gate: if not, 2D piece, rewrite
§7–§8.* Also settles open decision 5 — extrude dollars, keep ratios as
readouts.

**Phase 3 — The field.** Merged geometry, orbit, hover, year scrub.

**Phase 4 — The crossing scene and camera.**

**Phase 5 — ZIP lookup and readout.**

**Phase 6 — The four supporting graphics.**

**Phase 7 — Table route, keyboard, reduced motion, contrast lint.**

**Phase 8 — Wall label, disclosures, sourcing panel, thumbnail recipe.**

---

## 18. Open decisions

1. **Name.** *Ninety-One Cents* is California's ratio — plain, particular,
   memorable, and it is the finding rather than the category. Alternatives:
   *The Price of Risk* (generic). *Below Cost* and *Underwater* are both
   **rejected on substance**, not taste: the first states the overclaim §2
   exists to prevent, the second imports the one peril the dataset excludes.
   *The Retreat* is retired with the framing it belonged to, and every
   number-bearing title is retired with §6.5.

   **The rule, for next time: no number in a title.** A figure that can move
   when the estimator is corrected should not be the string everyone repeats.
2. **County or ZIP for the field.** County is ~3,143 and cheap; ZIP is 25,593
   and shows intra-county variation that is sometimes the whole story. Proposal
   stands: county for the field, ZIP for the lookup.
3. **Which crosswalk**, and how to report unmatched ZIPs.
4. **Does the crossing survive Phase 2?**
5. **Settled by §17 Phase 2:** extrude two dollar surfaces; `cents` and `gap`
   are readouts.
6. **Chase the Senate Budget Committee data** (§19.1) — county-level
   non-renewal through 2023, which would put a real year into the gap.
7. **How to credit Public Citizen** in the piece itself, not only in the spec.

---

## 19. Prior art

**This dataset has already been mapped.** [Public Citizen and the Revolving
Door Project, *Mapping the Home Insurance Crisis*][pc] (April 2025) is an
open-source ZIP-level interactive on this exact FIO release, with seven metrics
in a dropdown — non-renewal, both cancellation rates, claim frequency, average
claim, paid loss ratio, average premium — plus per-metric searchable tables and
a second map on Senate Budget Committee data.

Read it before building. Three things follow.

**1. The obvious version of this piece exists, and it is good.** A map extruded
by any single FIO metric is a prettier restatement of an advocacy tool that
already covers the whole country and lets you search your own ZIP. That is not
a reason to abandon this; it is the reason §7 has to hold. The crossing of two
measures is the only thing here that is not already on their map.

**2. Their framing is explicitly advocacy; this one should not be.** They write
that insurers are "scrambling to shift those costs to the public" and generate
"record profits". That may well be right, and it is a position. This piece
describes a mechanism and stops (§14), which is a genuine difference rather
than timidity — and it means carrying the inconvenient half of the loss-ratio
caveat, the investment-income point that Public Citizen states plainly in its
own metric notes and that cuts against my framing (§2).

**3. They found the thing I could not.** §5.4.2 — the state opt-out — is from
their writeup, not from the data. I had inferred a plausible-sounding but wrong
explanation for the Texas zeros and the Florida anomaly. **Credit them in the
piece, not only in this file.**

### 19.1 The Senate Budget Committee dataset

Worth following up (§18.6). County-level non-renewal, **2018–2023**, ~24
companies, ~65% of the market, published December 2024. It extends a year past
FIO and arrives already at county level, so no crosswalk is needed for that
measure. It could put one real year into the gap between the data ending and
the rupture — which the timeline in §9.1 currently has to cross in prose.

[pc]: https://www.citizen.org/article/mapping-the-home-insurance-crisis/
