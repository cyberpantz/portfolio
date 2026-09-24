# The Retreat — Spec & Build Plan

A 3D data visualisation of the US homeowners insurance market withdrawing from
places it no longer wants to cover. React Three Fiber in an Astro island,
TypeScript, real data from the US Treasury.

Working title. Alternatives in §16.

Companion document: `docs/insurance-impl-plan.md` (types, data pipeline, test
wiring) — to be written once §16 is settled. This document is intent and
behavioural contract; it stays readable end to end.

---

## The bar

Wage Gap works because it shows its arithmetic. The Musk figure is contested,
so the piece puts the division sum on screen and names the tracker and the
date. That is the standard this has to meet, and it is harder here: the subject
is somebody's house, the reader may be personally exposed, and the number is
frightening.

A piece about financial risk that overclaims is worse than no piece. The
failure mode is not being boring — it is being dismissible. One overstated
sentence hands a reader a reason to stop reading, and the underlying data does
not need any help.

---

## 1. The questions

In the order the piece should answer them.

1. **Where has home insurance become more expensive, and by how much?**
   Premium per $1,000 of coverage, by ZIP, 2018–2022.
2. **Where are insurers actually leaving?** Non-renewal rate — the share of
   policies the *insurer* declined to continue. Not lapses, not moves.
3. **Are those the same places?** They are correlated but not identical, and
   the divergence is the most interesting quantity in the dataset.
4. **Is this only the coasts?** No — and that is the moment the piece earns
   its keep. Hail exposure across the plains shows up in the same data.
5. **What about where I live?** The personal lookup. The question everyone
   actually came to ask.

Question 3 is the thesis. Questions 1 and 2 are the setup, 4 is the surprise,
5 is why anyone stays.

---

## 2. The claim

> Insurers are the only participants in the housing market with no incentive to
> be optimistic. Realtors, developers, county assessors and mortgage lenders all
> do better if prices stay up. An insurer that is wrong loses money. So the
> insurance market is the most honest price signal on climate risk that exists —
> and it has been repricing for years inside a public dataset almost nobody
> reads.

This is the framing that makes it a *who is telling you the truth* story
rather than another weather story. It is also defensible, which the stronger
version ("this is being suppressed") is not.

**What the piece must not claim.** That anyone is hiding the data — Treasury
published it. That non-renewal means uninsurable — FAIR plans and surplus lines
absorb much of it, at worse terms. That a reader should do anything about their
house.

---

## 3. Goals

- One national field, legible in five seconds, that rewards a minute of orbiting.
- The divergence between price and risk made visible as a *shape*, not a legend.
- A personal lookup that places the reader without telling them what it means.
- Sourcing shown, not asserted. Every number traceable to Treasury FIO.
- A non-visual equivalent that is genuinely equivalent, not a courtesy.

## 4. Non-goals

- Prediction. The data ends in 2022; the piece describes, it does not forecast.
- Advice, financial or otherwise. See §13.
- Global scope. US only, because that is where the dataset is.
- Live data. This is a fixed snapshot with a date on it.

---

## 5. Data

### 5.1 Primary source

**Federal Insurance Office / NAIC homeowners insurance data call**, published
January 2025 as *Analyses of US Homeowners Insurance Markets, 2018–2022*.

- ~25,593 ZIP codes
- 330+ insurers, ~246M policies
- Per ZIP per year: average premium, coverage amount, loss ratio, claim
  frequency, claim severity, **non-renewal rate**
- Public domain (US federal government work)

Headline finding to verify against our own aggregation before quoting:
consumers in the highest-risk ZIPs faced non-renewal rates roughly 80% higher
than those in the lowest-risk ZIPs.

### 5.2 Geometry

- **Counties** for the national field: ~3,143 polygons, from `us-atlas`
  (TopoJSON). Needs adding — the repo has `world-atlas`, not `us-atlas`.
- **ZIP → county crosswalk** for aggregation, and ZIP centroids for the lookup.
  HUD publishes a ZIP–county crosswalk; ZCTA centroids come from the Census.

### 5.3 The gap that must be disclosed

**The data ends in 2022.** The crisis accelerated afterwards. This is not a
flaw to be hidden — *"this is what it looked like before it got bad"* is a
stronger frame than a stale dataset pretending to be current. It goes on the
wall label, not in a footnote.

### 5.4 Pipeline

A build-time script, not a runtime fetch. `scripts/insurance-data.mjs`:

1. Fetch the FIO tables and the crosswalk.
2. Aggregate ZIP → county, policy-weighted. An unweighted mean across ZIPs
   would let a 40-policy ZIP outvote a 40,000-policy one.
3. Compute the derived measures in §6.
4. Emit a compact binary or quantised JSON keyed by FIPS, plus a separate
   ZIP-level file for the lookup only.
5. Fail loudly on missing or suppressed cells rather than interpolating.

Suppression is real: cells with too few policies are withheld for
confidentiality. Those counties render as *absent*, visibly, and never as zero.
A hole in the data must not look like good news.

---

## 6. Derived measures

| Measure | Definition | Why |
|---|---|---|
| `premiumRate` | premium ÷ coverage, per $1,000 | Comparable across house values |
| `nonrenewal` | insurer-initiated non-renewals ÷ policies | Where insurers are leaving |
| `lossRatio` | incurred losses ÷ earned premium | The insurer's own view of risk |
| `gap` | `premiumRate` percentile − `lossRatio` percentile | **The thesis, as a number** |
| `trend` | 2018→2022 slope of `nonrenewal` | Direction, not level |

`gap` is the one to get right. Positive means price has moved ahead of
experienced loss; negative means it has not caught up. Both are interesting and
they mean opposite things, so the encoding must distinguish them by more than
hue — see §12.

---

## 7. Why 3D earns its place

The test from the outset: 3D must be doing work a 2D choropleth cannot.

It does, for one reason. **The interesting quantity is the space between two
surfaces.** Price is one surface over the map; experienced loss is another. A
choropleth can show either, or their difference as a third colour ramp that the
reader has to take on trust. Extruding both and rendering the volume between
them makes the divergence a thing you can look *into* — and lets the two
surfaces cross, which is exactly where the story is.

If, during prototyping, the two-surface idea does not read at a glance, the
honest outcome is a 2D piece. That decision point is in §15, Phase 2, and it is
a real gate rather than a formality.

---

## 8. The visualisation

Three scenes, one continuous camera.

### 8.1 The field

Counties extruded by `nonrenewal`, animated 2018 → 2022. Free orbit, damped.
Opens on a three-quarter view — the angle that shows relief, where a top-down
view would be a choropleth with extra steps.

The expected spikes appear in Florida and coastal Louisiana. So do Oklahoma and
Kansas. The piece should not caption that; let the reader find it, then confirm
it if they ask.

### 8.2 The divergence

Second surface fades in: `lossRatio`. Where price sits above loss, the volume
between them reads one way; where it sits below, the other. The camera drops to
a low angle, because the gap is only legible from near the horizon.

### 8.3 Your county

Type a ZIP. Camera flies to it, the surrounding counties dim, and a readout
gives the five measures with their national percentiles. The interaction Wage
Gap already proved: place the reader in the data and let the placement do the
talking.

---

## 9. Interaction

- **Orbit / zoom / pan** — damped, with bounds. No infinite zoom into z-fighting.
- **Scrub the year** — a timeline, scrubbing rather than autoplay-only.
- **Hover a county** — name, the five measures, sample size.
- **ZIP lookup** — a text field, not a map click. People know their ZIP.
- **Toggle surfaces** — premium / loss / both.

Keyboard reaches all of it. Arrow keys orbit, `[`/`]` step the year, tab
reaches counties in descending `nonrenewal` order — which is also the order a
screen reader user most wants.

---

## 10. Technology

Everything needed is already in the repo except the atlas.

| Concern | Choice | Note |
|---|---|---|
| Rendering | `three` + `@react-three/fiber` | Already used by Weather Vibe |
| Controls / helpers | `@react-three/drei` | Already present |
| Geometry | `topojson-client` + **`us-atlas`** | `us-atlas` to add |
| Extrusion | `THREE.ExtrudeGeometry`, merged | One draft call per year-layer |
| Island | Astro `client:visible` | Consistent with the others |
| Styling | CSS module | Not Tailwind — see the chatbots spec |
| Data | Build-time script → static asset | No runtime API |

**Instanced or merged, never 3,143 meshes.** County polygons merge into a
single `BufferGeometry` per layer with per-vertex attributes for the measures,
so switching year or measure is a uniform change rather than a rebuild.

---

## 11. Performance budget

| Budget | Target |
|---|---|
| Data payload | < 500 KB gzipped |
| Time to first frame | < 2.5s on a mid laptop |
| Interaction | 60fps orbit; 30fps floor on integrated graphics |
| Draw calls | < 20 |
| Memory | < 300 MB |

Weather Vibe already ships a Three.js scene on this site, so the budget is
"comparable to that", not "whatever it takes".

---

## 12. Accessibility

A 3D dataviz is the hardest case on this site, and the standard does not move.

- **Colour is never the only encoding.** `gap` sign is carried by height
  direction *and* by hatching, not hue alone.
- **A real table**, not a fallback — the same data, sortable, at a route that
  works with JavaScript disabled. Linked prominently, not hidden.
- **`prefers-reduced-motion`** kills the fly-to and the year animation; the
  scrubber still works.
- **Keyboard parity** with every pointer interaction (§9).
- **Contrast computed, not eyeballed.** Every label pair goes in the lint, the
  way the chatbots and Wage Gap pairs do.

---

## 13. Honesty obligations

This piece is more sensitive than anything else on the site. Someone may look
up their own county and make a decision about their house.

Required, on first paint, outside the visualisation:

- The data is 2018–2022 and the market moved after it.
- Non-renewal is not uninsurability.
- Suppressed cells are absent, not zero.
- This is a portfolio piece, not financial advice, and not a property valuation.

Register: **descriptive throughout.** The piece states what the data says. It
does not tell anyone what to do, and it does not editorialise on top of numbers
that are alarming without help.

---

## 14. Verification

Same enforcement-over-review posture as the chatbots suite. What gets checked:

- **Every rendered figure traces to a source row.** No hand-typed numbers in
  components — the Wage Gap lesson, where a hand-copied rate drifted from the
  data that produced it.
- **Aggregation is policy-weighted**, asserted on a fixture.
- **Suppressed cells never render as 0.**
- **`gap` percentiles are computed, not asserted.**
- **The table route contains every county in the scene**, so the accessible
  version cannot silently fall behind.
- **Contrast pairs computed** in the lint.

---

## 15. Build plan

**Phase 1 — Data.** Fetch, aggregate, derive, emit. Ends with a JSON file and
a script that reproduces it. No rendering yet. *Gate: do the numbers reproduce
the published headline finding?*

**Phase 2 — The two-surface prototype.** Throwaway, one state, ugly. Only
question: does the divergence read? *Gate: if not, this becomes a 2D piece and
the rest of this spec is rewritten.*

**Phase 3 — The field.** Merged geometry, year animation, orbit, hover.

**Phase 4 — Divergence scene and camera choreography.**

**Phase 5 — ZIP lookup and readout.**

**Phase 6 — The table route, keyboard, reduced motion, contrast lint.**

**Phase 7 — Wall label, disclaimer, sourcing panel, thumbnail recipe.**

Phases 1 and 2 are the risky ones and they come first on purpose. Everything
after Phase 2 is execution.

---

## 16. Open decisions

1. **Name.** *The Retreat* is the working title. Alternatives: *Nonrenewal*
   (plain, particular, unsearchable in a good way), *Quiet Exit*, *Last to
   Leave*, *Where Insurance Stopped*. The chatbots lesson applies — name it
   after the thing, not the category, and not with a pun.
2. **County or ZIP for the field.** County is ~3,143 polygons and cheap; ZIP is
   ~25,593 and shows intra-county variation that is sometimes the whole story
   (one side of a river). Proposal: county for the field, ZIP for the lookup.
3. **Does the second surface survive Phase 2?** See §7.
4. **How current can this be made?** Whether any post-2022 source is good
   enough to extend the series without mixing methodologies. Default: no.
5. **Where the table route lives** — `/explorations/the-retreat/data`, or a
   panel within the piece.
