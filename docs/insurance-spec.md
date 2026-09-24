# Ninety-One Cents — Spec & Build Plan

A data visualisation of what American homeowners insurance costs, against what
it pays out — and of the two states where, for five years, it cost less.
React Three Fiber in an Astro island, TypeScript, US Treasury data.

Working title, and the second one. See §17.

> **Revision, after Phase 1.** This document originally proposed a piece about
> insurers withdrawing from climate-exposed markets, measured by non-renewal
> rate and premium against loss ratio. The data killed both. Non-renewal cannot
> carry the story (§5.4) and premium-versus-loss-ratio is statistical noise
> (§6.1). What replaced them is better, and the §7 gate now passes on evidence
> rather than on hope. The original framing is preserved in git history.

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
3. **Where do those two numbers cross?** Where premium falls below paid losses,
   the market is selling something for less than it costs. **This is the piece.**
4. **What happened next?** The data stops in 2022. The rupture is 2022–2026,
   and has to be told rather than shown.
5. **Who ends up paying?** Not the homeowner, and not the insurer. §9.4.

---

## 2. The claim

> In every state but two, American homeowners insurance collected about $1.60
> for every dollar it paid out in claims. In California it collected 91 cents.
> In Louisiana, 86. Within months of the data ending, the largest insurer in
> California stopped writing new policies, and eleven Louisiana carriers went
> insolvent.

This works because it is mechanical rather than moral. The popular framing is
that insurers abandoned people; the data says that where they left, they were
being paid less than they were paying out. That is not a defence of insurers —
it relocates the argument to the real question, which is who should carry the
cost: the homeowner, the other policyholders, or the state.

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
story.** It is retained in the dataset and the table, and it is not the
measure anything is extruded by.

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

### 6.1 What was tested and rejected

`gap = premium percentile − loss-ratio percentile`, the original thesis
measure. **Rank correlation between premium and loss ratio is +0.049** — and
+0.043 after winsorising the tails, and +0.049 on five-year means. It is noise
against noise. Paid loss ratio in one ZIP-year records whether a catastrophe
happened to land there, not what the risk is. Its range runs from −73.9 to
+317.8.

### 6.2 What replaced it

| Measure | Definition | Note |
|---|---|---|
| `premium` | Premiums Per Policy, 5-year mean | Conflates price and house size (§5.2) |
| `eal` | Claim Frequency × Claim Severity | Expected annual loss per policy |
| `ratio` | `premium ÷ eal` | **The measure. Below 1.0 is selling under cost** |
| `gap` | percentile(`premium`) − percentile(`eal`) | For the surface crossing |
| `trend` | 2018→2022 slope of `premium` | Direction |

**Rank correlation between premium and EAL is +0.537**, and the gap has a
standard deviation of **0.278** where pure noise would give 0.41. There is real
structure in the residual, which is what the whole visual depends on.

### 6.3 The finding

| | premium | EAL | ratio |
|---|---|---|---|
| Louisiana | $2,453 | $2,842 | **0.86** |
| California | $1,681 | $1,839 | **0.91** |
| Texas | $2,276 | $1,552 | 1.47 |
| **United States** | **$1,717** | **$1,058** | **1.62** |
| Oklahoma | $2,572 | $1,486 | 1.73 |
| Florida | $4,975 | $2,363 | 2.11 |
| South Carolina | $1,778 | $727 | 2.44 |

### 6.4 The caveat that must be on screen

`eal` is **five years of paid claims**, not an actuarial expected loss. It
contains no catastrophe model, so it does not price events that had not yet
happened. For wildfire that means it *understates* the risk — which makes
California's 0.91 worse than it looks, not better. State it plainly; it is the
single most load-bearing caveat in the piece.

---

## 7. Why 3D earns its place

The test has not moved: 3D must do something a 2D choropleth cannot.

**The interesting quantity is the space between two surfaces.** Premium over
the map, expected loss over the map, and the volume between them. A choropleth
can show either, or their difference as a third colour ramp the reader has to
take on trust. Extruding both lets them *cross*, and the crossing is the
finding: where the price surface drops beneath the loss surface, the market is
selling below cost.

"Underwater" stops being a metaphor. California and Louisiana are submerged,
and submersion is only legible from a low camera angle — which is an argument
for a camera, which is an argument for 3D.

This gate previously had no evidence behind it. It now does: §6.2.

**Phase 2 remains a real gate.** If two surfaces at 3,143 polygons read as
mush, the honest outcome is a 2D piece and §8 is rewritten.

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

> **the price** (3D) → **the break** (9.1) → **where it went** (9.2, 9.3) →
> **who pays** (9.4)

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

## 15. Verification

- **Every rendered figure traces to a source row or a cited event.** No
  hand-typed numbers in components — the Wage Gap lesson, where a copied rate
  drifted from the data that produced it.
- **Suppressed and unmatched areas never render as 0.**
- **Percentiles and ratios computed, not asserted**, with the §6.3 table
  reproduced as a test fixture.
- **The table route contains every county in the scene.**
- **Every event in 9.1 carries a date and a source** in the data file.
- **Contrast pairs computed** in the lint.

---

## 16. Build plan

**Phase 1 — Data.** ✅ Profiled. Measures tested, §6.1 rejected, §6.2 adopted,
hazards found. Remaining: crosswalk, aggregation, emit.

**Phase 2 — The two-surface prototype.** Throwaway, ugly, one question: does
the crossing read? *Gate: if not, 2D piece, rewrite §7–§8.*

**Phase 3 — The field.** Merged geometry, orbit, hover, year scrub.

**Phase 4 — The crossing scene and camera.**

**Phase 5 — ZIP lookup and readout.**

**Phase 6 — The four supporting graphics.**

**Phase 7 — Table route, keyboard, reduced motion, contrast lint.**

**Phase 8 — Wall label, disclosures, sourcing panel, thumbnail recipe.**

---

## 17. Open decisions

1. **Name.** *Ninety-One Cents* is California's ratio — plain, particular,
   memorable, and it is the finding rather than the category. Alternatives:
   *Below Cost*, *The Price of Risk*, *Underwater* (literal in the visual, but a
   flood metaphor on a wildfire story). *The Retreat* is retired with the
   framing it belonged to.
2. **County or ZIP for the field.** County is ~3,143 and cheap; ZIP is 25,593
   and shows intra-county variation that is sometimes the whole story. Proposal
   stands: county for the field, ZIP for the lookup.
3. **Which crosswalk**, and how to report unmatched ZIPs.
4. **Does the crossing survive Phase 2?**
5. **Is `ratio` or `gap` the extrusion?** `ratio` is more interpretable, `gap`
   is better behaved at the tails. Decide on the prototype.
