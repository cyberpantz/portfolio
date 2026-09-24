# The Tilt — Spec

A scroll-driven piece about where American incarceration went. Astro island,
React, R3F for one chapter, real data from the Vera Institute.

Working title. No number in it, on purpose — that rule is now permanent, see
the insurance spec for why it had to be learned twice.

**Deliberately shorter than `insurance-spec.md`.** That document reached twenty
sections and produced nothing. This one carries the structure, the technical
decisions and the honesty rules, and stops. Detail belongs in the code.

---

## 1. The story

Seven chapters. Each earns a distinct visual form; if two chapters would look
the same, one of them is not a chapter.

| # | Chapter | The claim | Form |
|---|---|---|---|
| 1 | **The number you know** | Jail population peaked 2007, fell 7% | One line, falling |
| 2 | **An average of opposites** | 61 counties falling outweigh 1,460 rising | That line separating into bands |
| 3 | **The tilt** | Rate by county size: 1.31× → **2.61×**, monotonic | **3D. The centrepiece.** |
| 4 | **Not the obvious answers** | Transfers flat, rural population −1%, demography 3pt | Three small flat charts |
| 5 | **If you build it** | Capacity +21.8% while population fell. 150k empty beds | Divergence + construction bars |
| 6 | **Who is in there** | Pretrial, and ICE +211% rural | Proportion, one figure |
| 7 | **Your county** | The lookup | Search, then land on the gradient |

Chapters 1, 2, 4 and 6 are flat 2D **on purpose**. That is what makes 3 land.

## 2. What the piece claims, and what it refuses to

**Claims:** that the national decline is real and misleading; that the gradient
by county size doubled; that capacity grew while population fell; that three
obvious explanations do not survive contact with the data.

**Refuses:** to say why. This data has no charges, no bail, no sentences, no
court records, no crime figures. It counts people and beds. The candidate
causes — drug enforcement, bail practice, collapsing rural court resources,
per-diem revenue — cannot be ranked here, and a visualisation that implies
otherwise is lying.

That refusal is the difference between this and Vera's own work. They are an
advocacy organisation with a position, stated openly and argued well. This
shows a shape and stops.

## 3. Credit

The finding is **Vera's**. *Out of Sight: The Growth of Jails in Rural America*
(2017) established the rural inversion; *Understanding Jail Growth in Rural
America — If You Build It, They Will Come* (2017) established the capacity
mechanism with Grant County and Terrebonne Parish. `trends.vera.org` has been a
county-level interactive since 2015.

Credited on screen, not only in a footer. What is ours is the **national
gradient as a continuous slope that tilts**, four more years of data, and the
rendering. Nothing else.

## 4. Data

`src/data/raw/vera-county.csv` — 128,507 rows, 164 columns, 3,075 counties,
1970–2026. Plus `vera-jail-construction.csv` (1,926 projects, 2002–2022) and
the codebook.

**Usable window is 2002–2019.** Before that, coverage is scattered Census-of-
Jails years; after 2018 it thins. County prison data stops at 2019 entirely.

**Balanced panels only.** Every figure comes from counties present in *every*
year of the window, so no trend is an artefact of counties entering or leaving
the sample. Panel size is stated beside every chart (2,452 for capacity, 2,513
for rates, 2,350 for the ICE overlap).

### 4.1 Three traps found the hard way

**Pretrial is not comparable to total jail population.** Codebook p.12: total
jail population is an *average daily population*; pretrial is a *single-day
count* at end of June. Vera says they "are not always directly comparable."
Every pretrial-as-share-of-jail percentage must be rebuilt on a consistent
basis or dropped. Chapter 6 depends on this being done properly.

**ICE detainees are inside the pretrial number.** Same page: people held for
other authorities "are aggregated into the general pretrial population." So
pretrial growth and ICE growth are not independent. Rural ICE grew by 2,346
against a rural pretrial rise of 27,435 — **about 9%**. ICE is a component and
an illustration, never the headline.

**`total_jail_from_fed` does not equal the sum of its parts** (r = 0.918 against
BOP + Marshals + ICE + BIA + other). Use the named sub-columns, not the total,
and say which.

## 5. The 3D gate

Chapter 3 is the only 3D. It must beat an animated 2D line chart of the same
seven bands. If a prototype does not clearly win, **the piece is 2D throughout**
and cheaper, and §1 is rewritten.

The argument for 3D: the finding is that a surface which was flat acquires a
slope. Population, rate and time are three real axes. A camera near the horizon
shows a tilt that a top-down view cannot.

## 6. Scroll behaviour

Sticky visual stage, chapters as scroll-triggered steps over it.
`IntersectionObserver`, not scroll listeners.

**Never hijack scroll.** No `scroll-snap` that fights the wheel, no
`preventDefault`, no fixed-duration scroll animations. The reader's scroll is
theirs; the piece responds to it.

`prefers-reduced-motion` yields a **readable static sequence** — every chapter's
end state, stacked, with prose. Not a broken version of the animated one.

Mobile: the sticky stage becomes inline figures in document order.

## 7. Sources

`src/data/incarceration-sources.ts`, reusing the pattern from the insurance
piece: typed entries with `status` of `primary` / `secondary` / `needs-check`,
and a build check that refuses to render a claim resting on an unopened source.

Every figure on screen carries a citation the reader can reach in one action.
That is the point of the piece as much as the shape is.

## 8. Accessibility

- A real data table at its own route, working without JavaScript, containing
  every county in the visualisation.
- Keyboard parity with every pointer interaction.
- Colour never the only encoding.
- Contrast pairs computed in the lint, as with chatbots and Wage Gap.

## 9. Build order

1. Rebuild pretrial properly, or drop chapter 6's shares.
2. Pipeline → per-chapter JSON + sources file.
3. **Prototype chapter 3. Gate.**
4. Scroll engine and sticky stage.
5. Chapters 1, 2, 4, 5, 6.
6. Chapter 7 lookup.
7. Table route, keyboard, reduced motion, lint.
8. Wall label, credit, thumbnail recipe.

Steps 1 and 3 are the risky ones and come first.

## 10. Open

1. **Name.** *The Tilt* is geometric and survives recomputation. Alternatives:
   *Where It Went*, *Smaller*, *County Lines*. Not *Out of Sight* — that is
   Vera's title.
2. Does chapter 3 survive its gate?
3. County geometry: `us-atlas` at 3,143 polygons, or abstract the gradient away
   from the map entirely? Chapter 3 may not need a map at all.
4. How far past 2019 to show, given coverage thins and prison data stops.
