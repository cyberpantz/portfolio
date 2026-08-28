# The Quizzolator — Design Spec

**Status:** Proposed
**Date:** August 27, 2026
**Route:** `/explorations/quizzolator`

---

## Overview

**This is a quiz engine.** It renders whatever quiz it is handed, from a data file, with no engine changes required.

Two datasets ship in v1 — **farm animals** and **typography** — because one quiz proves nothing. Two, of different lengths and using different answer kinds, is the only way a visitor can see that the content is data rather than a hardcoded page.

One question on screen at a time. Everything animated.

### What it has to demonstrate

The existing five explorations cover canvas games, Web Audio and WebGL. None of them show **interaction craft** — staggered choreography, considered state transitions, motion that carries meaning rather than decorating it. That is what a design technologist role screens for, and it is the hardest thing to fake.

So the content is disposable and the engine is the portfolio piece. Someone should be able to answer three questions and come away thinking *this person knows how things should feel*, then look at the data file and realise the whole thing is content-driven.

The second signal: a quiz is a compact, honest test of accessible interaction design. Radio semantics, focus movement between slides, announcing right and wrong without relying on colour — all while it stays fun. Harder to get right than another WebGL scene, and rarer on a portfolio.

### On tone

Dry, not cheesy. The register is a deadpan setup with a flat payoff — closer to a good caption than to a joke. Specifically avoid: exclamation marks, puns, "Oops!", cheerleading ("Great job!"), and anything that congratulates the reader for existing.

The test for any line: would it survive being read aloud by someone unimpressed? If it needs enthusiasm to land, cut it.

---

## Content model

Quizzes are data. The engine renders whatever it is handed, which is what makes a second quiz a content task rather than an engineering one.

```ts
export type AnswerKind = 'text' | 'figure' | 'specimen';

export interface Choice {
  id: string;
  /** Always present. For figure and specimen choices this is the
   *  visible caption AND the accessible name — nothing is ever
   *  left unlabelled. */
  label: string;

  /** Figure choices only. Keys into the shape registry. */
  figure?: FigureId;

  /** Specimen choices only — the label is rendered *as type*, and
   *  these are the settings under test. */
  specimen?: {
    fontFamily?: string;
    fontVariationSettings?: string;
    fontFeatureSettings?: string;
    letterSpacing?: string;
    fontSize?: string;
    fontStyle?: string;
    /** Shear applied via transform — used to fake an oblique so a
     *  question can ask which italic is real. */
    skewX?: number;
  };

  /** Specimen choices only. A factual description of what is being
   *  shown, used as the accessible name. See the accessibility
   *  section — this is what lets a non-sighted visitor answer a
   *  question about letterforms. */
  describedAs?: string;

  /** Revealed after answering. For specimens this is usually the
   *  name of the thing — withheld until then, because naming it
   *  up front gives the question away. */
  postLabel?: string;
}

export interface Question {
  id: string;
  kind: AnswerKind;
  prompt: string;
  /** Optional second line — setup, or the joke. */
  aside?: string;
  choices: Choice[];
  correctId: string;
  /** Shown after answering, either way. This is where the wit lives. */
  reveal: string;
}

export interface Quiz {
  id: string;
  title: string;
  /** One line under the title on the intro card. */
  blurb: string;
  questions: Question[];
  /** Score bands, highest threshold first. */
  results: ResultBand[];
}

export interface ResultBand {
  /** Minimum correct answers, inclusive. */
  min: number;
  title: string;
  body: string;
}
```

Quizzes live in `src/data/quizzes/*.ts` and are imported statically. Not `fetch`ed — a static import means the content is bundled, type-checked, and cannot 404 or arrive late.

### Could this come from a database instead?

Yes for text, with one sharp caveat.

The engine's only contract is the `Quiz` object. It has no idea where that object came from, so the source is swappable by design. But the three answer kinds are not equally portable:

| Kind | From a database? | Why |
|---|---|---|
| `text` | Yes, trivially | Every field is a string with no rendering implications |
| `figure` | Yes, by **ID only** | `figure: 'cow'` keys into a registry of React components. The database stores the key; the shapes stay in code |
| `specimen` | Yes, by **whitelisted values only** | `fontFamily` must be validated against the loaded set. An arbitrary string here is a request for a font the page does not have |

**The rule: a database stores identifiers, never markup.** No SVG strings, no HTML, no `dangerouslySetInnerHTML`. A quiz row that can inject markup is a stored-XSS hole with a friendly name — and since a future author-facing builder would write to that same table, this constraint gets more important, not less.

Because the site is static Astro on Netlify with no server at runtime, there are two shapes:

**Build-time** *(recommended)* — query the database during `astro build` and bake quizzes into the bundle. Stays fully static, no runtime dependency, no loading state, no way for a quiz to fail to arrive. Content edits need a rebuild, which a Netlify build hook handles from a webhook on save. This is the option that costs the engine nothing.

**Runtime** — the client fetches from a Netlify Function or a hosted API. Necessary only if quizzes must change without a deploy. The cost is real and lands entirely on the interaction: a loading state before the first question, an error state when the fetch fails, and a slower start to the thing whose whole point is that it feels immediate.

Either way, validate on the way in. Parse the response against the `Quiz` shape — a missing `correctId`, or a `correctId` matching no choice, should fail loudly at the boundary rather than rendering a question nobody can get right.

Not in v1. The static files are the right call while there are two quizzes, and the contract means moving later is a change of import, not a rewrite.

### Figures

`figure` keys into a registry of inline SVG shapes, one component each, all drawn on a shared 24×24 grid with `stroke="currentColor"` so they inherit state colour for free.

Farm set: `cow`, `pig`, `chicken`, `sheep`, `goat`, `horse`, `duck`, `goose`, `turkey`, `donkey`.

Hand-drawn simple silhouettes, not an icon-library dependency. They are small, they are part of the charm, and owning them means they can be animated per-state.

---

## Screens

Three, in sequence.

### 1. Intro

Quiz title in Bodoni, the blurb, question count, and a single `Begin` button. Exists so the first question arrives on a deliberate action rather than a page load, which makes the entrance animation land.

It has a second job: it is where hydration and font loading happen. See *Loading and slow connections* — the intro is the buffer that keeps the first question from ever rendering half-ready.

### 2. Question

```
  ┌──────────────────────────────────────────────┐
  │  QUESTION 03 / 08          ▓▓▓▓▓▓░░░░░░░░░░  │   progress
  │                                              │
  │  Which of these lays the egg                 │   prompt
  │  you had for breakfast?                      │
  │  A genuine question for some of you.         │   aside
  │                                              │
  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
  │  │ ┌────┐ │ │ ┌────┐ │ │ ┌────┐ │ │ ┌────┐ │ │   figure choices
  │  │ │ svg│ │ │ │ svg│ │ │ │ svg│ │ │ │ svg│ │ │   (drawn shapes,
  │  │ └────┘ │ │ └────┘ │ │ └────┘ │ │ └────┘ │ │    never emoji)
  │  │  Cow   │ │  Pig   │ │Chicken │ │ Sheep  │ │
  │  └────────┘ └────────┘ └────────┘ └────────┘ │
  │                                              │
  │  ─────────────────────────────────────────   │
  │  Reveal text appears here after answering    │
  │                              [    Next  → ]  │
  └──────────────────────────────────────────────┘
```

Text choices stack as full-width rows instead of a grid. Same states, same choreography.

### 3. Result

Score as a large Bodoni fraction, the matching band title and body, a per-question recap strip, and two buttons: `Play again` and `All explorations`.

---

## Interaction flow

| Step | What happens |
|---|---|
| 1 | Question and choices animate in, staggered |
| 2 | User picks a choice. It locks immediately — no changing the answer |
| 3 | Correct or incorrect state resolves on that choice; if wrong, the correct one is also marked |
| 4 | Reveal text fades in, `Next` becomes enabled and takes focus |
| 5 | `Next` slides the current question out left, the following one in from the right |
| 6 | After the last question, the result screen replaces it |

Answering is one-shot. No retry within a question — a second guess makes the score meaningless and removes the small sting that makes getting it right feel like anything.

---

## Motion

The centrepiece. Built with **framer-motion**, already a dependency and already on the résumé's Motion line.

### Question transition

Exit and enter overlap slightly so the screen is never empty.

| Property | Out (current) | In (next) |
|---|---|---|
| `x` | `0 → -64` | `72 → 0` |
| `opacity` | `1 → 0` | `0 → 1` |
| Duration | 260ms | 420ms |
| Easing | `easeIn` | spring — `stiffness: 320, damping: 26` |

The spring on entry is what produces the requested bounce: a slight overshoot past zero and a settle, rather than a linear glide. Damping 26 against stiffness 320 gives roughly one visible overshoot. **These numbers are a starting point and need tuning against the real thing** — feel cannot be specified from a table.

### Stagger

Children enter in sequence, not together. Two numbers matter per row — when a thing *starts* and when it has *settled* — and confusing them is how a stagger ends up feeling rushed on paper and wrong in the browser.

| Element | Starts | Settled |
|---|---:|---:|
| prompt | 0ms | 420ms |
| aside | 90ms | 510ms |
| choice 1 | 150ms | 570ms |
| choice 2 | 235ms | 655ms |
| choice 3 | 320ms | 740ms |
| choice 4 | 405ms | 825ms |
| progress | 480ms | 900ms |

**85ms between choices.** Below roughly 60ms a stagger stops reading as sequence and just looks like an imprecise simultaneous entrance — you get the cost of the delay without the legibility it buys. 85ms is far enough apart to track each row arriving as its own event.

Implemented with `staggerChildren: 0.085` and `delayChildren: 0.15` on the container variant.

**Choices accept input the moment they start animating**, not when they settle. The stagger is a reveal, never a gate — someone who already knows the answer can click choice 1 at 150ms while choice 4 is still moving. Nothing about the choreography should slow down a fast player.

**Tuning note:** this sequence plays once per question, so eight times in the farm quiz. A reveal that feels considered on question one can feel tedious by question six. Worth testing whether questions after the first want a multiplier of around 0.85 on the delays — same shape, slightly quicker — or whether the consistency is worth more than the saved time. Cannot be decided from a table; decide it after playing the whole quiz twice.

### Answer states

**Correct** — the chosen row scales to 1.04 and settles back over 400ms on a spring, its border and text move to the success colour, and a checkmark path draws itself in 300ms via `pathLength`. A figure choice also gets a single 8° wobble, because a cow that nods when you are right is worth writing.

**Incorrect** — a horizontal shake: `x: [0, -7, 6, -4, 3, 0]` over 380ms. Border and text move to the error colour, the mark is a drawn ✕. The correct choice then fades up to the success colour 200ms later, so the two events read in order — *you were wrong*, then *here is right* — rather than arriving as one confusing frame.

The shake is deliberately small. The brief asked for subtle but unmistakable, and a violent shake reads as a system error rather than a wrong guess.

**Not chosen** — drop to 45% opacity. They are no longer relevant and should stop competing.

### Result screen

The score counts up from zero to the final number over 900ms with an ease-out, digits in tabular figures so the layout does not jitter. The band title arrives 300ms after the count settles.

### Reduced motion

Under `prefers-reduced-motion: reduce`, every one of the above collapses to a 1ms opacity change. No slide, no stagger, no shake, no count-up — the score renders at its final value immediately. The state colours and the drawn marks stay, because they carry meaning rather than decoration. The existing rule in `explorations.css` handles the CSS side; framer-motion needs `useReducedMotion()` checked explicitly, since it does not respect the media query on its own.

---

## Loading and slow connections

**No loading spinner.** The quiz content is statically imported, so it is inside the JS bundle — there is nothing to fetch, nothing to await, and no state where content is missing. A spinner would be animating over a problem that does not exist.

There are two real slow-connection risks, and neither is solved by a spinner.

### 1. Hydration lag

On a slow connection the HTML lands well before React and framer-motion do. Whatever Astro server-rendered is what the visitor stares at in the meantime.

The fix is structural, not decorative: **server-render the intro card**. Title, blurb and question count are static markup, so they appear with the document. The `Begin` button starts disabled with the label `Loading…`, and hydration is what enables it. The visitor sees the real thing immediately and the only degraded element is the one that genuinely is not ready.

This is why the intro screen exists at all. It gives hydration somewhere to happen while the visitor reads, so the first *question* — the part with all the choreography — never renders half-alive.

Budget: framer-motion is roughly 40KB gzipped and is the single largest dependency here. If that proves too heavy for the payoff, the transitions are expressible in the Web Animations API at a fraction of the size. Measure before assuming.

### 2. Fonts — the one that actually matters

This is not a performance problem. It is a **correctness** problem.

Question 3 asks which specimen is a Didone. If EB Garamond has not arrived yet, all four choices render in the same fallback serif and the question is *unanswerable* — not slow, not ugly, wrong. Same for the x-height comparison, which is meaningless if the faces are substituted.

Three measures, in order:

**Preload during the intro.** `<link rel="preload" as="font" crossorigin>` for the subset specimen faces. The seconds a visitor spends reading the intro and reaching for `Begin` are free loading time, and two subset faces are a few kilobytes. In practice this alone should mean the fonts are resident long before question 3.

**`font-display: block`, not `swap`.** `swap` renders a fallback and then substitutes the real face — which on a specimen question means *the answer visibly changes while the visitor is deciding*. Brief invisible text is much better than a question that silently rewrites itself. Combined with preloading, the block period should never be reached.

**Verify before showing.** Before a `specimen` question enters, check `document.fonts.check()` for each face it needs. If one is missing, hold — with a **1200ms ceiling**, after which the question proceeds regardless. A permanently stalled quiz is worse than a degraded question, and a font can fail to load entirely.

If the guard ever does have to wait, it must not introduce a spinner. **Hold the outgoing question on screen a beat longer instead.** A spinner is a foreign object that announces "something went wrong"; a slightly longer transition reads as pacing. The visitor should never learn that a wait happened.

Text and figure questions have no such dependency and never wait.

Inherits the explorations system already in `explorations.css` — fixed dark ground, Bodoni Moda for display, Archivo for UI, JetBrains Mono for metadata, teal accent. No new palette.

Two new state colours are needed, and both must clear AA on `--color-ink` (#0a0a0a):

| Token | Value | Ratio | Use |
|---|---|---:|---|
| `--color-correct` | `#6fd0c2` | 10.82:1 | reuses the existing accent |
| `--color-wrong` | `#f0968c` | 8.37:1 | matches the case-study danger tone |

Reusing the accent for correct is deliberate: the palette stays at two hues, and the accent already means *this is the good thing* everywhere else on the site.

**Colour is never the only signal.** Every state carries a drawn mark (✓ or ✕) and a text change alongside the hue. A monochrome screenshot of this quiz must still be readable — that is the test.

---

## Accessibility

The part that makes this a portfolio piece rather than a toy.

- Choices are a **`radiogroup`**, not buttons. `aria-labelledby` points at the prompt; each choice is `role="radio"` with `aria-checked`. Arrow keys move between them, Space selects — the behaviour a keyboard user already expects.
- Once answered, the group goes `aria-disabled="true"` rather than being removed from the tab order, so a screen-reader user can still review what was there.
- Correct/incorrect is announced through a **polite live region**, not by colour and not by an alert. `"Correct. A chicken lays eggs."` / `"Not quite. The answer is chicken."`
- On slide-in, focus moves to the new question's heading (`tabindex="-1"`), so a keyboard user lands in the right place rather than at the top of the document.
- `Next` receives focus once enabled, so the flow is: answer → read → Enter → next question, without touching the mouse.
- Progress is a real `<progress>` element with `aria-label`, so "question 3 of 8" is available to assistive tech, not just drawn.
- Figure choices are labelled by their visible caption. The SVG itself is `aria-hidden` — the text is the accessible name, so nothing is announced twice.
- Every target clears 44×44px. Metadata stays at or above 12px, per the same floor the rest of the site uses.

### Specimen questions and sight

A question like *"which of these is a Didone?"* is answered by looking at letterforms. That is a genuine barrier, and it should be handled rather than hand-waved.

The mitigation is `describedAs` — a factual description of what each specimen shows, used as its accessible name:

> Choice A — "The word Modern with extreme thick-to-thin contrast and flat hairline serifs."
> Choice B — "The word Modern with even stroke weight and angled bracketed serifs."

This is a **description, not the answer**. Someone who knows what a Didone is can answer correctly from it; someone who does not still has to know the term. That is exactly the knowledge the question tests, so the question stays fair rather than becoming a giveaway.

The same approach carries the kerning question — "the gap between A and V is wide" versus "closed up" — and the italic question, where the tell is described as "the letterforms are redrawn" against "the upright letterforms are sheared."

Two honest limits. The x-height comparison resists useful description without stating the answer, so it carries a plain relative measure and is the weakest question of the nine on this axis. And a description can never fully substitute for seeing type — it is a translation, not an equivalent.

What this buys: the typography quiz is **completable** by a screen-reader user rather than stalling at question one. That is a lower bar than *equivalent*, and the spec should say so plainly rather than claim more than it delivers.

---

## Component architecture

```
src/experiments/quizzolator/
  Quizzolator.tsx        # state machine: intro → question → result
  IntroCard.tsx
  QuestionCard.tsx       # prompt, aside, choices, reveal, next
  ChoiceText.tsx         # full-width row variant
  ChoiceFigure.tsx       # tile variant with SVG
  ChoiceSpecimen.tsx     # tile variant rendering the label AS type
  ResultCard.tsx         # score, band, recap, replay
  ProgressBar.tsx
  figures.tsx            # the SVG registry
  motion.ts              # every duration, easing and stagger in one file
  useQuiz.ts             # answers, scoring, current index, band lookup

src/data/quizzes/
  index.ts               # registry — id to Quiz, for the picker
  farm-animals.ts
  typography.ts
```

With two quizzes there is a picker: the intro screen lists both and the
route accepts `?quiz=typography`, so either can be linked directly.

`motion.ts` holding all timing constants matters: tuning the feel should mean editing one file, not hunting through six components. It is also the file to point at in an interview.

State lives in `useQuiz`. Nothing persists — no localStorage, no resume. Replay starts clean.

---

## Farm animals — starter content

Eight questions, mixed kinds. Tone: deadpan setup, silly payoff.

1. **figure** — "Which of these lays the egg you had for breakfast?" *A genuine question for some of you.* → chicken
   *Reveal:* "Chicken. The cow was never in the running and you know it."

2. **text** — "A group of geese on the ground is called a—" *In flight they get a different word. Geese negotiated well.* → gaggle
   *Reveal:* "A gaggle on the ground, a skein in the air."

3. **figure** — "Which one produces wool?" → sheep
   *Reveal:* "Sheep. Goats produce cashmere, chaos, and an unblinking stare."

4. **text** — "How many stomachs does a cow have?" → "One, with four chambers"
   *Reveal:* "One stomach, four compartments. Everyone says four. Everyone is wrong, including most farmers."

5. **figure** — "Which of these is a *ruminant*?" *It means they chew cud. It does not mean they are thoughtful.* → cow
   *Reveal:* "Cows, sheep and goats all qualify. Pigs do not, and seem fine about it."

6. **text** — "What is a castrated male chicken called?" → capon
   *Reveal:* "A capon. Now you know, and there is no giving it back."

7. **figure** — "Which animal has rectangular pupils?" → goat
   *Reveal:* "Goats. Horizontal, rectangular, and pointed at you specifically."

8. **text** — "Pigs cannot do which of the following?" → "Look up at the sky"
   *Reveal:* "Mostly true — their neck structure makes it hard, though not impossible. Pigs also cannot sweat, which is the more useful fact at a barbecue."

### Result bands

| Correct | Title | Body |
|---:|---|---|
| 8 | **Certified** | "Eight for eight. You have either lived on a farm or read about geese for reasons of your own." |
| 6–7 | **Suspiciously Well Informed** | "You know more about livestock than your job requires. We did not ask why." |
| 4–5 | **Competent Townie** | "You would survive a weekend on a farm. You would not be handed anything sharp." |
| 2–3 | **Needs Work** | "You have met an animal before. The details are negotiable." |
| 0–1 | **Below Coin Toss** | "Four options, eight questions, one correct. That takes a kind of commitment." |

---

## Typography — second dataset

Nine questions. The one that has to be beautiful.

The farm quiz proves the engine renders content. This one proves the engine has *range* — and it is the dataset a design technologist hiring manager will actually read. Half the questions are answered by looking at type rather than reading about it, which is the entire argument for the `specimen` kind existing.

Quiz lengths differ deliberately: eight and nine. If both were eight, someone could reasonably assume the count was baked into the engine.

### Questions

1. **specimen** — "One of these was kerned. One was left to chance." Two settings of **AVATAR**, one with default metrics, one with the AV and TA pairs tightened.
   *Reveal:* "Diagonal pairs — AV, AW, TA, VA — open up gaps the metrics do not close. Kerning is what closes them."

2. **text** — "Which mark belongs in `1998–2004`?" Hyphen · En dash · Em dash · Minus sign → **en dash**
   *Reveal:* "En dash for ranges. The hyphen is doing someone else's job and the em dash is having a lie down."

3. **specimen** — "Which of these is a Didone?" The word **Modern** set in Bodoni Moda, EB Garamond, Libre Franklin and Archivo. → **Bodoni Moda**
   *Reveal:* "Extreme thick-to-thin contrast, hairline serifs at right angles, vertical stress. Didones were the 1790s deciding that print could be sharp now."

4. **text** — "The space between two specific letters is called—" Kerning · Tracking · Leading · Hinting → **kerning**
   *Reveal:* "Kerning is a pair. Tracking is the whole line. People will use them interchangeably at you for the rest of your career."

5. **specimen** — "One of these italics is real. The other is a roman that got pushed over." The word **Regarding** as true italic, and as roman with `skewX: -12`. → **the true italic**
   *Reveal:* "A real italic is redrawn, not leaned. Look at the *a* — the true one changed shape; the fake one just fell."

6. **specimen** — "Which has the largest x-height?" **Height** set in four faces at an identical point size.
   *Reveal:* "X-height drives apparent size far more than point size does. Two faces at 16px can differ by a third in how big they look."

7. **text** — "Leading is named after—" Strips of lead between lines · The lead singer of a line · Leading edge of the letter · Nothing, it is an acronym → **strips of lead**
   *Reveal:* "Actual lead, placed between lines of metal type. Which is why it rhymes with sledding and not with reading."

8. **text** — "Comic Sans was originally drawn for—" A cartoon dog in Microsoft Bob · A children's hospital · A ransom note generator · Windows 95 error dialogs → **a cartoon dog**
   *Reveal:* "Vincent Connare drew it in 1994 for Rover, a cartoon dog in Microsoft Bob. It escaped, and it has never once been caught."

9. **text** — "A single word stranded on the last line of a paragraph is a—" Widow · Orphan · Runt · Rag → **widow**
   *Reveal:* "A widow is left behind at the end. An orphan is alone at the start. Both are your problem."

### Result bands

| Correct | Title | Body |
|---:|---|---|
| 9 | **Kerned By Hand** | "Nine for nine. You have opinions about hyphens and you have been waiting years for someone to ask." |
| 7–8 | **Type Director** | "You would catch a fake italic on a billboard from a moving car." |
| 5–6 | **Knows A Serif** | "Solid working knowledge. You would not embarrass yourself in a type review, which is more than most." |
| 3–4 | **Needs Tracking** | "You have absorbed some of this by proximity. The rest is in a book, and the book is short." |
| 0–2 | **Set In Default** | "Nine questions, four options each. The arithmetic here is not flattering." |

### Typefaces

Specimen questions need real faces, and each one is a network cost. Bodoni Moda and Archivo are already loaded by the explorations shell. Questions 3 and 6 need two more — **EB Garamond** and **Libre Franklin** — both on Google Fonts.

Load them with `&text=` subsetting so only the specimen glyphs ship. "Modern" and "Height" between them need about a dozen characters, which turns two full families into a few kilobytes. Without subsetting this quiz costs more to load than every other exploration combined.

---

## Acceptance criteria

**Behaviour**

- [ ] Questions render from the data file with no engine changes needed for new content
- [ ] Both quizzes play from the same engine; neither has bespoke code
- [ ] A quiz can be linked directly by id
- [ ] `text`, `figure` and `specimen` choices render and behave identically as far as state and keyboard go
- [ ] Specimen fonts are subset with `&text=`; the quiz does not ship two whole families
- [ ] Specimen faces are preloaded, and set to `font-display: block` so no answer visibly changes mid-question
- [ ] A specimen question waits for its fonts, with a 1200ms ceiling, and never blocks forever
- [ ] Any wait extends the transition — no spinner appears anywhere in the quiz
- [ ] The intro card is server-rendered; `Begin` is disabled until hydration rather than absent
- [ ] Answering locks the question; a second click does nothing
- [ ] Wrong answers mark the chosen choice *and* reveal the correct one, in that order
- [ ] `Next` is disabled until an answer is chosen
- [ ] The final score matches the number correct, and the right band is shown

**Motion**

- [ ] Question exit and entry overlap; the screen is never blank between questions
- [ ] Entry uses a spring with a visible overshoot, not a linear slide
- [ ] Children stagger; they do not arrive as a block
- [ ] Each choice reads as arriving separately — at least 60ms apart, 85ms as specced
- [ ] A choice is clickable as soon as it starts animating, not once it settles
- [ ] The incorrect shake is small enough to read as a wrong answer, not a crash
- [ ] Every timing constant lives in `motion.ts`

**Accessibility**

- [ ] Fully playable start to finish with a keyboard alone
- [ ] Choices behave as a radio group under arrow keys
- [ ] Correct and incorrect are announced by a live region
- [ ] Focus moves to the new question on slide-in, and to `Next` when it enables
- [ ] Readable in monochrome — no state depends on hue alone
- [ ] Every specimen choice has a `describedAs` that describes without answering
- [ ] The typography quiz is completable with a screen reader
- [ ] Both state colours clear AA on the dark ground
- [ ] Under `prefers-reduced-motion`, all movement collapses to opacity while the meaning survives
- [ ] Targets are 44×44px; metadata is 12px or larger

**Quality**

- [ ] `astro check` passes with no errors
- [ ] Works at 320px, 720px and 1024px with no horizontal scroll
- [ ] Figure choices remain legible and tappable on a phone

---

## Open questions

1. **Timer?** Nothing here is timed. Adding a countdown per question would raise the stakes and make it more of a game, but it also punishes anyone reading slowly — a direct accessibility cost for a bit of tension. Currently proposed: no timer.
2. **Sound?** A short tone on correct and a duller one on wrong would fit the Web Audio thread running through the other explorations. Would need a mute control and must default to silent, since autoplay on a portfolio page is hostile.
3. **Shareable score?** A `?score=6` deep link into the result screen is cheap and makes the thing spread. Probably a follow-up rather than v1.
4. **A third quiz?** Two is enough to prove the point. A third only earns its place if it uses an answer kind the first two do not — colour, say, which would want swatches. Not before the first two are actually good.

5. **Author-facing input?** The brief mentions letting a user enter their own questions. That is a genuinely different product — it needs a form, validation, and somewhere to put the result. The engine's data contract is designed to accommodate it later (a builder would emit a `Quiz` object), but v1 reads from files only.

---

## Definition of done

The Quizzolator is complete when a visitor can play the farm animal quiz start to finish with a mouse or a keyboard alone; every transition is staggered and spring-driven; correct and incorrect states are unmistakable without relying on colour; the result screen reports the right band; the whole thing degrades to a static, readable, fully playable experience under reduced motion; and a third quiz would require touching only `src/data/quizzes/`.
