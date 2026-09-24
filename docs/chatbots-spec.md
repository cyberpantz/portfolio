# Chatbots — Spec & Build Plan

A scenario engine for guided-decision conversations, and one polished conversation built on it.
React island in an Astro page, TypeScript, CSS modules. **No API calls.** Every response is written
by hand, because the subject of this piece is the *manner* of an interface — how it conducts itself
when someone is unwell, tired, frightened, joking, or typing nonsense at it on a Saturday night.

Companion documents: **`docs/chatbots-storyboard.html`** (visual, ~40 annotated frames) and
**`docs/chatbots-impl-plan.md`** (types, runtime mechanics, test and lint wiring). This document
is design intent and behavioural contract; it stays readable end to end.

The storyboard is cited throughout: frame IDs appear as `(01)`, `(D6)`, `(T4)`. It is the visual authority; this is the behavioural
one. Where they disagree, the storyboard is probably prettier and this is probably
right.

Ships with **care** fully built, plus family and feline **skins**. Be precise about what that
proves: token blocks demonstrate the *skin boundary* holds. They do not demonstrate the *engine*
holds — only a second script would, and no second script is scheduled. The other two scenarios exist
here as design pressure: every abstraction below was tested against them, and several were rewritten
because of them.

---

---

## The bar

This has to read as work from a studio that charges a great deal of money — and the honest reason
that kind of work looks the way it does is not taste. It is **decision density**. Someone was paid
to make several hundred small calls that could have been left to the browser, the framework, or
luck. That is the trick, and it is reproducible by anyone willing to spend the time.

The standing test, applied to any screen here:

> **Could a competent engineer have produced this by wiring up the obvious components?**
> If yes, it is not finished.

Attention to detail is not polish applied at the end. It is *the absence of anything unconsidered* —
which means the work is front-loaded, and the schedule should expect that. The expense is the
point. It buys the thing that cannot be added later.

### Nothing is default

Every one of these is a decision the platform will make for you, badly, if you let it. None of them
ship unexamined:

focus ring · easing curve · scrollbar · text selection colour · caret colour · tap highlight ·
placeholder colour · disabled appearance · autofill styling · `::marker` · resize handle ·
system blue · the 16px body default · the browser's idea of a button

### Nothing is arbitrary

Space, size, radius, duration and weight each come from **one scale**, declared once. If a value is
not on the scale, either the value is wrong or the scale is — resolve it, never special-case it.
Two components that need "about 12 pixels" get the *same* twelve.

Consistency is the cheapest luxury signal there is, and the easiest to lose one exception at a time.

### Every state is designed

For every interactive element: **rest · hover · focus-visible · active · disabled · loading ·
error**. Focus-visible is not hover with a ring bolted on; disabled is not 50% opacity.

For every screen, the states **this** conversation can actually enter — there is no network, so
there is no offline and nothing goes stale: **empty · partial · complete · failed (authored) ·
interrupted (safety lock)**.

The unglamorous half of that matrix is most of what this piece is *about* (spec §8, `D1`–`D6`,
`T1`–`T6`, `08`, `C`). A design is finished when its worst state is as considered as its best one.

### Optical over mathematical

Centred is what looks centred. Specifically: optical centring for glyphs inside circular targets;
overshoot on round shapes against flat ones; right-aligned type compensated for trailing sidebearing;
icons aligned to x-height rather than bounding box; **tabular figures on anything that ticks**, so a
counting clock does not shimmy (`T6`, `09`).

### Typography

One scale, three weights at most. Real apostrophes and quotation marks — never the straight ones.
No widows in any headline or button. Measure held between roughly 45 and 70 characters. Line-height
tightening as size grows, never one value everywhere. Numerals that change in place are tabular,
always.

### Copy is designed, not written

Every string is authored (spec §12). Banned outright, in any state: *Something went wrong* ·
*Oops* · *Loading…* · *Error* · *Invalid input* · *Are you sure?* · *Click here* · *Submit*.

A failure names **what** failed and **what to do** (`T4`, `C`). A button names its outcome, not its
mechanism (spec §8.2). If a string could appear in any other product, it is not finished.

### Affordances and signifiers

Every interactive thing announces itself **before** it is touched. Nothing is discoverable only by
hovering, because on touch there is no hover and for a screen reader there is no pointer at all.

Small, deliberate examples already in the storyboard: the word counts on tray lines (`P1`) signal
which option is the long one without a label that would spoil the joke; the dashed third row signals
that typing is safe; the `OUT` stamp carries rule-out state so it never rests on opacity alone
(`04`). Each is a decision that could have been skipped.

Cursor is a designed property, not an afterthought — a boundary between two cursors on a moving
surface is a visible defect.

### Transitions are a surface

The change between two states is designed as deliberately as the states. Duration, curve, what
moves, what stays, what is masked. Anything that snaps, snaps **on purpose** (`T3`) — and the
contrast with what eases is what makes both legible.

### Icons

One set, drawn on one grid at one optical weight, sized to the type they sit beside. No mixed
libraries, no emoji standing in for a mark.

### The refusals

Detail also means knowing what not to add. No gradient without a reason, no shadow that is not
describing height, no border that a spacing change would do better, no animation that delays someone
who has already decided.

---

## 1. Goals

- A conversation that reads as *considered*, not generated. Every line is authored; that is the
  advantage, and it should be visible.
- **Every state polished, especially the bad ones.** Thinking, no-results, invalid input, safety,
  system error. Happy paths are easy and nobody remembers them. The standard is set in
  **The bar** above, which is the section to re-read whenever something is "good enough".
- A component vocabulary that survives contact with a second domain — proven, not asserted.
- Re-skinnable: palette, type, density, and motion tempo are scenario data (`K1`–`K3`, `W1`).
- Honest about being a simulation, and charming about it (`P4`).

## 2. Non-goals

- Any model, any API, any streaming. The fiction is the interface, not intelligence behind it.
- A general chatbot. Off-script input is *handled*, gracefully and by design, not *answered*.
- Real clinical triage. The script follows sane triage conventions because sloppy logic would
  undercut the craft argument, but this is not a medical device and says so.
- Persistence, accounts, analytics.
- Mobile-first. It must work well at 380px; the showcase is desktop.

---

## 3. The two layers

The single most load-bearing rule in the system (`L1`–`L3`).

> **Inside the bezel is the product, and it never winks.
> Outside the bezel is the apparatus, and it never pretends.**

| | Inside (product) | Outside (apparatus) |
|---|---|---|
| Contains | messages, thinking, chips, strip, cards, pickers, composer, safety, errors | wall label, skin switcher, the line tray, Watch / Index, replay |
| Styling | scenario skin tokens | mono type, neutral paper, no accent, **no skin tokens** |
| Voice | in-fiction | plain, factual |

The test for any new element: *would a shipped care navigator have this?* A composer, yes. A row of
lines you could say, no. The tray is how a visitor drives the fiction, which is exactly why it
cannot live inside it — and practically, anything inside the bezel appears in every screenshot of
this piece.

Two things refuse skin tokens, for opposite reasons (`L3`): **safety states**, because they must be
recognised identically in every world; **the apparatus**, because it was never in any of them.

---

## 4. Public API

```tsx
// src/experiments/chatbots/Chatbots.tsx

export type ScenarioId = 'care' | 'family' | 'feline';

export type ChatbotsProps = {
  scenario: ScenarioId;          // which script to run
  skin?: ScenarioId;             // visual tokens; defaults to `scenario`
  mode?: 'play' | 'watch';       // default 'play'
  startAt?: NodeId;              // deep-link a state, used by Index
  apparatus?: boolean;           // render the rig (default true; false = clean screenshot)
  onNode?: (id: NodeId) => void;
};
```

Usage:

```astro
---
import Chatbots from '../../experiments/chatbots/Chatbots.tsx';
---
<Chatbots client:visible scenario="care" />
```

`skin` and `scenario` are **separate props on purpose** (§9). Rendering the care script in the
feline skin is a legitimate, and deliberately uncomfortable, demonstration.

---

## 5. Scenario model

A scenario is data. It contains no JSX, no components, and no styling.

```ts
export type Scenario = {
  id: ScenarioId;
  title: string;
  wallLabel: string;            // apparatus copy (L1)
  voice: Voice;
  options: Option[];            // what the strip narrows
  narrowing: 'eliminate' | 'rank' | 'score';
  safety: SafetyRule[];
  lexicon: Lexicon;             // domain words, symptom patterns, homophones
  start: NodeId;
  nodes: Record<NodeId, Node>;
};

export type Voice = {
  /** 0 = never jokes. 1 = jokes are the point. care 0.3 · family 0 · feline 0.8 */
  humour: number;
  /** A turn whose only job is to acknowledge before proceeding (F1). */
  acknowledgment: 'never' | 'optional' | 'required';
  /** Who is being asked about — decides every pronoun in the script. */
  address: 'self' | 'proxy-verbal' | 'proxy-nonverbal';
  /** Captured at runtime for proxy scenarios (C1). Interpolated as {subject}. */
  subjectName?: string;
};
```

`address` exists because `"you"` was hard-coded and the family scenario broke it. `narrowing` exists
because elimination turned out to be an assumption, not a mechanic: care rules **out**, family
**ranks**, feline scores by **likelihood**. One component, one verb parameter.

> **Open decision (§16).** `narrowing` may be one parameter too clever. If `rank` and `eliminate`
> need materially different layouts, split the component rather than growing the flag.

### 5.1 Nodes and beats

```ts
export type Node = {
  id: NodeId;
  /** What the assistant does, in order. The director paces these. */
  say: Beat[];
  /** Effects applied when this node is entered. */
  effect?: { strip?: StripEffect; voice?: Partial<Voice> };
  /** Lines offered in the tray (P1). Omit for nodes that only wait on chips. */
  lines?: Line[];
  /** What advances, and to where. */
  accept?: Accept[];
  /** Where unmatched free text goes. Defaults to the recovery router (§7.3). */
  fallback?: NodeId;
  /** Terminal by design — suppresses the dead-end assertion in CI (§14.4). */
  terminal?: boolean;
};

export type Beat =
  | { t: 'say';       text: string; hold?: number }
  | { t: 'ack';       text: string }                          // F1, gated by voice
  | { t: 'think';     stages: string[]; facts?: string[]; ms?: number; failAt?: number }
  | { t: 'chips';     options: Chip[] }
  | { t: 'pick';      kind: 'bodymap' | 'grid'; spec: PickSpec }
  | { t: 'scale';     anchors: [string, string] }             // unusable when proxy-nonverbal
  | { t: 'compare';   axes: string[]; rows: CompareRow[] }
  | { t: 'recommend'; option: OptionId; confidence: number; why: string }
  | { t: 'disclose';  rows: [string, string][] }
  | { t: 'results';   items: ResultItem[] }
  | { t: 'empty';     constraint: string; alternatives: Alternative[] }
  | { t: 'schedule';  slots: Slot[] }
  | { t: 'confirm';   headline: string; prep: [string, string][] }
  | { t: 'reframe';   pattern: string; redirect: string }     // D6 / C3
  | { t: 'boundary';  refusal: string; instead: string }      // 07
  | { t: 'safety';    tempo: 1 | 2 | 3; headline: string; body: string; action: Action }
  | { t: 'error';     stage: number; retry: NodeId; escape: Alternative };
```

Every beat maps to exactly one component (§8). A beat carries **content and timing only** — never
colour, spacing, or class names.

`ack` is emitted only when `voice.acknowledgment !== 'never'`, and is *required* to be present
before the first question in scenarios that set `'required'`. CI asserts this (§14.4).

---

## 6. The director

The runtime that turns a node's `say[]` into a paced sequence. It owns **all** time in the system.

- All timing lives in one cancellable scheduler, never in components. Implementation:
  **impl plan §3**.
- Default gaps: `say` → 320ms, after `think` → 240ms, before `chips` → 180ms. `hold` overrides.
- `think` duration is authored per node. **One node in the care script is authored at 9000ms** so a
  visitor experiences the latency ladder (`T4`) rather than reading about it.
- The director never advances past a node that has `accept`. It stops and waits.
- **Watch mode** is the same director with synthetic input: it picks the first `accept` at each
  node after a 1200ms pause. Any real input hands control back immediately.
- **Nudge ladder** (idle at a waiting node): 12s — chips pulse once; 25s — the assistant offers
  *"Want me to just show you?"*, which hands off to Watch. It never auto-advances (§13.6).

The director is in exactly one of three states at any moment: **playing** a node's beats,
**waiting** on input, or **locked** — tempo-1 safety, where nothing but the single action is
reachable. Modelled explicitly rather than as a set of booleans.

---

## 7. Input

Three routes in, one of which is always open.

### 7.1 The tray (`P1`–`P3`)

Lives in the apparatus. Offers 2–3 `Line`s: at minimum one **terse**, one **messy**, and a dashed
free-text invitation.

```ts
export type Line = { id: string; preview: string; text: string; go: NodeId };
```

- Tapping fills the composer over **~400ms, eased** — it types rather than appears, so the text
  feels authored by the visitor.
- **It does not auto-send.** The beat where you read the meat thermometer in your own composer
  before pressing send is where the joke lands, and pressing send is what makes it yours.
- Word counts are shown (`58w`) — quiet signalling that one option is the fun one, without a label
  that would spoil it.
- Terse and messy must lead somewhere **genuinely different**, or the tray is a Next button in a
  costume. Terse gets more clarifying questions; messy gets the extraction showcase (`03`).

### 7.2 Chips

Inside the bezel, assistant side. Short structured answers only. **Rule:** if it would be odd for
the assistant to put those words in the user's mouth, it belongs in the tray instead.

Every chip set that resolves a question includes an uncertainty option (`05`, `C2`), and
uncertainty **routes to the safer branch, never the cheaper one**.

### 7.3 Free text, and the recovery router

The composer is always live. **There is no unrecognised-input failure mode**, because the recovery
taxonomy is the fallback: gibberish lands in boredom, sincere-but-off-script lands in
underspecified, which nudges back. Off-script input routes into the best-designed part of the piece.

Eight motives, in evaluation order:

| Motive | Frame | Trigger | Strike? |
|---|---|---|---|
| `symptom` | `D6` | garbling that may itself be clinical — **routes to `Reframe`**, not to a recovery reply | no |
| `meta` | `P4` | "is this real / are you AI" | no |
| `probing` | `D4` | prompt injection, system-prompt fishing | no |
| `accident` | `D1` | wrong clipboard | no |
| `dictation` | `D2` | homophones, run-ons | no |
| `shorthand` | `D3` | emoji-only, very short | no |
| `boredom` | — | keyboard mash | **yes** |
| `sincere` | `B` | default → underspecified | **yes** |

**A strike is not "input we did not expect" — it is "input the router had nothing specific to say
about."** Six of the eight motives have a designed, forward-moving reply; counting those as failures
would push a visitor toward the exit for doing exactly what the piece invites. Only `boredom` and a
repeated `sincere` increment. Any `accept` resets to zero.

`symptom` is listed as a motive because that is where it is *detected*, but its destination is the
`Reframe` component (spec §10), not a recovery response. It is not two things.

Local heuristics, no network. **The order is a safety property, not an optimisation:** `symptom` is
evaluated before everything else, because `my wrods are coming out wonrg` must never be classified
as `boredom`. Heuristics and the ordering test: **impl plan §4**.

Three strikes in a row changes tactic rather than repeating (`D5`): it hands over phone numbers
that work whether or not the product does.

---

### 7.4 The chat surface

A visitor forms their judgement in the first minute from how a line arrives, how sending feels, and
whether the page holds still while they read. These are thinner surfaces than the thinking ladder
and matter more.

**Sending.** A send control is always present — icon button, ≥44px, at the composer's trailing edge.
It is enabled when there is content and disabled only when empty or safety-locked; a control that
vanishes is worse than one that dims. `Enter` sends, `Shift+Enter` inserts a newline. On touch,
`Enter` inserts a newline and the button is the only way to send.

**The composer stays live during `think`.** Thinking happens before a node accepts, so a visitor who
types over it is not doing anything wrong. Sending mid-think **flushes the scheduler** and routes the
input immediately — no queueing behind beats nobody is reading any more. Safety tempo 1 is the only
hard disable in the system, and it replaces the placeholder with the reason rather than leaving an
inert box.

**Drafts.** The composer holds exactly one stashed draft. A tray fill stashes whatever was there;
`Put my draft back` (`D1`) pops it. **If nothing is stashed, the button is not rendered** — the
alternative is a button that lies, which the spec forbids elsewhere and would forbid here.

**Arrival.** Assistant messages arrive as **whole bubbles**: 8px rise and fade over 180ms ease-out.
**No type-on.** A typing assistant is suspense charged to the reader, and *The bar* refuses animation
that delays someone who has already decided. The composer types (`P2`) because that is about
authorship; the assistant does not, because that would be about theatre.

Several beats in one turn are **separate bubbles, visually grouped**: adjacent bubbles from the same
speaker tighten their facing corners to `--s-r-sm`, and the inter-bubble gap drops to 180ms from the
320ms used between turns.

**Scroll.** The transcript follows only when the reader is **already within 40px of the bottom**.
Otherwise it holds position and surfaces a counted pill — *2 new* — that jumps on tap. This is not a
nicety: the 9-second think (`T4`) and the meat-thermometer line (`02`) both fail outright if the view
yanks itself downward mid-sentence. Under `prefers-reduced-motion` the jump is instant rather than
smooth.

### 7.5 Responsive — 380px

What collapses, stated rather than implied:

| Element | At 380px |
|---|---|
| `OptionStrip` | Single summary line — *"3 of 4 remain"* — expanding to the full row on tap. Four cards do not fit and shrinking them makes the stamps illegible. |
| `Tray` | Lines stack full-width; previews truncate to one line; word counts stay, they are the signifier. |
| `Rig` | Wall label stays (§15 — it is the disclosure). Skin and mode rows become two selects. |
| `Picker` | Diagram hidden entirely. **The text controls remain and are the real controls at every width** — the same rule that makes it accessible makes it responsive. |
| `CompareCard` | Axes stack; the comparison becomes sequential rather than tabular. |
| Bubbles | Max-width 88% → 92%; the grouped-corner treatment is unchanged. |

---

## 8. Components to build

Each is built **once**, for care, parameterised for the rest. Storyboard references in brackets.
The right-hand column is what a second scenario supplies; **if it is empty, the component is
secretly a script.**

| # | Component | States | Scenario-supplied |
|---|---|---|---|
| 1 | `Message` `[02]` | assistant · user · pasted · quoted-back | voice, humour budget |
| 2 | `Thinking` `[03, T1–T6]` | stage active/done/failed · min-dwell · elaborate · admit · offer-exit · reduced-motion | stage labels, fact types |
| 3 | `Acknowledgment` `[F1]` | present · suppressed | required / optional / never |
| 4 | `OptionStrip` `[04, 09]` | neutral · ruled-out · ranked · leading · winner · collapsed · **withdrawn** | options, icons, **verb** |
| 5 | `Gauge` `[04]` | advancing · complete · indeterminate | whether narrowing is monotonic |
| 6 | `Chips` `[01, B]` | default · primary-weighted · exhausted | labels; always an uncertainty option |
| 7 | `Picker` `[05, C2]` | unset · selected · unsure | the diagram; sensation vs observation |
| 8 | `Scale` | unset · set · refused | anchors — **unusable when proxy-nonverbal** |
| 9 | `CompareCard` `[09]` | loading · populated · partial | the axes |
| 10 | `Recommendation` `[09]` | confident · hedged · tied | non-diagnostic phrasing rules |
| 11 | `Disclosure` `[09]` | collapsed · expanded | rule-out reasons, three words each |
| 12 | `Results` | populated · thin · empty · stale | record shape |
| 13 | `EmptyPivot` `[08, F2]` | constraint named · alternatives · watch running | constraint + **≥2 live alternatives** |
| 14 | `Scheduler` `[09]` | slots · none today · waitlist | granularity — minutes vs weeks |
| 15 | `Confirmation` `[10]` | booked · queued · prep-list | what to have ready |
| 16 | `Safety` `[A, F3, C3, K4–K6]` | **tempo 1 / 2 / 3** | triggers, tempo, one action, number |
| 17 | `Reframe` `[D6, C3]` | gentle check · asserted | pattern + redirect |
| 18 | `Boundary` `[07]` | refusal + real alternative | scope, alternative |
| 19 | `Recovery` `[D1–D5, B, P4]` | **six** designed replies + third-strike exit | register per motive |
| 20 | `SystemError` `[C]` | which stage failed · retry · **door out** | offline fallback |
| 21 | `Composer` | empty · typing · filling · armed · **disabled-during-safety** | placeholder |
| 22 | `Tray` `[P1–P3]` *(apparatus)* | rest · filling · dimmed | the lines |
| 23 | `Rig` `[L1]` *(apparatus)* | wall label · skin row · mode row | title, label copy |

Each component is built to the full state matrix in **The bar** — rest, hover, focus-visible,
active, disabled, loading, error — not only to the states its beat type names. A component that
handles its happy path is half-built.

### 8.1 Cross-cutting rules

Three rules every component obeys, so they are never re-litigated per component:

1. **Humour lives in prose, never in a control** (`D2`). A joke in a button is a hesitation — the
   user has to work out whether it is literal.
2. **Uncertainty is always an offered answer**, and routes to the safer branch.
3. **Every terminal state has a door out of the product** (`D5`, `C`). In this domain a dead end is
   not an acceptable final state.

### 8.2 Button language

Derived rules, enforced in review:

- **Name the outcome, not the mechanism.** `Put my draft back`, not `Undo`. A button must be
  readable with no memory of the previous screen.
- **One primary, at most two secondary.** Recovery states are where patience is lowest.
- **Give the user's position back to them.** `Fine, I actually need a doctor`, not `Return to
  triage` — phrasing the exit in their voice means taking it is not a climb-down.
- Never `OK` / `Cancel`.

---

## 9. Skin system

```css
/* scenario tokens — all skinnable */
--s-accent  --s-accent-ink  --s-ai  --s-ai-line  --s-edge  --s-surface
--s-r  --s-r-sm  --s-r-shell           /* radius */
--s-font  --s-size  --s-lh  --s-gap  --s-pad
--s-tempo                              /* motion multiplier */
```

`--s-tempo` re-times the whole motion system from one number: care `1.0`, family `1.35` (slower,
which reads as patience), feline `0.8`. No animation is re-timed by hand.

**Morphing** (`W1`): the whole surface morphs over **420ms** rather than cutting — corners round,
colour warms, rhythm opens, pulse slows. Custom properties do not animate on their own; the
technique is in **impl plan §5**.

Skin changes **in place**, mid-conversation, preserving history and scroll. Scenario changes start
fresh, because it is a different script.

**Never morphs:** safety states, scroll position, conversation history. Suppressed entirely under
`prefers-reduced-motion` — the skin still changes, it just arrives rather than travels.

---

## 10. Safety

The only global state in the system.

**Clinical acuity and interface treatment are two different things, and the tempo names the
treatment.** Conflating them is how a design argument starts looking careless: a self-harm
disclosure is crisis acuity, and it still must not get an ambulance layout.

| Tempo | Clinical acuity | Interface treatment | Why they differ |
|---|---|---|---|
| **1 · Halt** | Emergent — minutes | strip **withdrawn**, motion stopped, composer disabled, one action, red | The user has already named an emergency. Nothing else on screen is worth their attention. |
| **2 · Hold** | **Crisis, or unresolved — hours** | calibrated, amber-to-accent, escalation one tap away, composer live | `F3` — a parent unsure whether this is real. A red 911 screen for something she is still weighing makes her close the tab and tell no one. Acuity is high; the *interface* must not outrun her certainty. |
| **3 · Redirect** | **Urgent — today, can become emergent** | urgent, one clear action, product chrome intact | `C3` — a blockage is genuinely time-critical, but the user believed this was behaviour. The work is changing their mind, not raising an alarm. |

Read the tempo as *what the screen does*, never as *how serious this is*. Tempo 2 and 3 both carry
genuinely dangerous acuity; they earn a softer treatment because in both cases the user's own
understanding is the obstacle, and a screen that overshoots loses them.

Rules, all non-negotiable:

- **Humour is forced to 0** regardless of `voice.humour`. `C3` follows nine frames of jokes and
  contains none.
- **The component declares no custom properties.** Hard-coded values. There is nothing for a skin
  to reach — an architectural guarantee, not a convention someone remembers (§14.4 lints it).
- Tempo 1 is the **only** place focus is moved without user action (§13.3), and the only place
  motion stops rather than slows.
- Tempo 2 is deliberately *not* red. A parent who gets an ambulance screen for something she is
  still unsure about closes the tab and tells no one.
- `Reframe` `(D6, C3)` is a sibling, not a safety tempo: *the thing you brought me may not be the
  thing you have.* It lives in the engine because it appeared independently in two scenarios.

---

## 11. Motion

| Thing | Duration | Notes |
|---|---|---|
| Liveness pulse `(T1)` | 1500ms | active dot breathes; **never stops while thinking** |
| Label sweep `(T1)` | 2100ms | gradient over text |
| Indeterminate rail `(T1)` | 1900ms | deliberately not a percentage — a fake one gets clocked |
| Stage complete `(T3)` | 90ms linear | **snaps**; the contrast with the pulse is what makes each legible |
| Fact chips `(T3)` | 70ms stagger | scale .94→1 |
| Strip rule-out `(04)` | 220ms ease-out | dim + slight blur + scale down; **never removed** |
| Composer fill `(P2)` | ~400ms ease-out | types, does not appear |
| Skin morph `(W1)` | 420ms | consumers, not tokens |
| Safety tempo 1 `(A)` | **0ms** | motion stops. Stillness as an effect. |

The three thinking periods are deliberately non-harmonic so they never sync into a single throb.

### 11.0 Three clocks

Not all time in this system is the same kind of time, and only one of the three scales with the
skin.

| Clock | What it governs | Scales with `--s-tempo`? |
|---|---|---|
| **Feedback** | idle and response motion — pulse, sweep, rail, stagger, rule-out, fills | **Yes.** This is the skin's tonal instrument; family reads as patient because it breathes slower. |
| **Authored** | `think.ms`, `hold`, the deliberate 9000ms node | **No.** These are content. A slower skin must not rewrite the script's pacing. |
| **Perceptual** | min-dwell 320ms, ladder rungs at 3s / 8s / 15s, nudges at 12s / 25s | **No.** Human thresholds, not style. A calm skin does not earn the right to postpone honesty by four seconds. |

The **skin morph** (420ms) belongs to none of them: it is an apparatus action, fixed, and it does
not scale.

**Nothing bounces.** Ease-out, short.

### 11.1 The latency ladder

No amount of pulsing survives nine seconds; past about eight, motion stops reassuring and starts
taunting.

| t | Behaviour |
|---|---|
| < 320ms | **minimum dwell** `(T2)` — a stage that resolves instantly still shows for 320ms, or the indicator strobes |
| 3s | the active line elaborates |
| 8s | `(T4)` it says so, and **names which part is slow** — "the clinic directory is slow tonight". Specificity is the whole trick |
| 15s | `(T5)` offers a door out; **keeps working in the background** — it does not cancel itself to make a point |

---

## 12. Copy rules

- **Non-diagnostic, always.** "A video visit fits this", never "you have an ear infection".
- **No hedging stacks.** One boundary sentence, then the real alternative `(07)`.
- Humour is spent **pointing at the subject, never at the user's mistake** `(V3)`. Humour that costs
  the user something is not humour.
- The joke buys attention; **the next sentence spends it** `(C1)`.
- Callbacks are cashed **one beat late** `(04)` — do the job first, then allow one aside.
- Answer the question actually being asked, including the buried one `(F1)`.
- Copy lives in script data. **No user-visible string in a component file.** Lint it (§14.4).

---

## 13. Accessibility

Treated as a floor, not a feature. This is a medical context; the population using it skews toward
people who need this to work.

### 13.1 Announcements

- The transcript is `role="log" aria-live="polite" aria-relevant="additions"`. New assistant
  messages announce; nothing else does.
- **The strip is not live.** It is `role="status"` queried on demand with a visually-hidden summary
  — *"3 of 4 options remain: ER, urgent care, telehealth. Ruled out: primary care."* Announcing it
  on every re-render would flood the buffer.
- Safety tempo 1 is `role="alert"` (assertive). It is the only assertive region in the system.
- `Thinking` sets `aria-busy="true"` on the transcript and exposes a polite text status; stage
  changes do **not** each announce.

### 13.2 Keyboard

- The composer is home base. Everything reachable without it, nothing requiring a pointer.
- Tray lines, chips, picker regions, disclosure, slots: real `<button>`s in DOM order.
- `Escape` closes any expanded picker or disclosure and returns focus to its trigger.
- Visible focus ring everywhere, ≥3:1 against its background, never removed.

### 13.3 Focus

- **Focus never moves on an assistant turn.** Moving focus into arriving content is the classic
  chat-a11y failure — it steals the caret mid-sentence.
- New interactive elements are announced, not focused.
- **The one exception is safety tempo 1**, where focus moves to the alert and the composer is
  disabled. An emergency justifies stealing focus; nothing else does.

### 13.4 Reduced motion `(T6)`

Every liveness channel is motion, so `prefers-reduced-motion` would remove the liveness signal
entirely — and vestibular sensitivity is *more* common among people using a medical product, not
less.

- Liveness becomes **font weight** on the active stage plus a **ticking seconds counter**.
- Pulse, sweep, rail, stagger, skin morph: off.
- State still changes; it arrives rather than travels.

### 13.5 Perception

- Contrast **4.5:1** body text, **3:1** UI and graphics. Safety states higher.
- **Contrast floors are not skinnable.** A skin that fails them fails CI (§14.4).
- **No colour-only meaning.** Ruled-out carries the `OUT` stamp, not just opacity `(04)`. Tempo is
  carried by headline and layout, not hue alone.
- Targets ≥ **44×44px**, including tray lines and picker regions.
- The `Picker` has text controls beside the diagram `(05)`; the diagram is decoration and is
  `aria-hidden`. **Never an image map.**
- Reflow to 320px and 400% zoom without horizontal scroll.
- Honour `prefers-contrast: more`.

### 13.6 Time

- **No time limits** (WCAG 2.2.1). The nudge ladder offers; it never advances.
- Watch mode auto-advances, so it is user-initiated, pausable, and exits on any input
  (WCAG 2.2.2).
- The latency ladder never removes an option.

### 13.7 Language

- `lang` on the root. Non-English strings in scripts carry their own `lang`.
- Reading level: aim Grade 8 in care, **Grade 6 in safety states**.

---

## 14. Engineering principles

Rationale here; mechanics, types and CI wiring in **`docs/chatbots-impl-plan.md`**.

**Content is data.** Scripts are typed data modules — no JSX, no styling, no user-visible copy in
components. A component that needs new copy needs a new **beat type**, not a string literal. This is
what keeps voice and skin parameterisable rather than aspirational.

**Adding a beat without rendering it must not compile.** `Beat` is a discriminated union and every
consumer is exhaustive. The union exists for this reason alone.

**Time is owned in one place.** One cancellable scheduler, flushed on unmount, node change, and
safety trigger. Continuous loops stop when settled. Components never hold timers.

**Director state is explicit.** Three named states, not a set of booleans — `isThinking &&
!isError && hasResults` is how this becomes unmaintainable by week two.

**Anything drawn is in the key.** Cache keys, redraw signatures and memo dependencies must cover
every rendered field. Prefer deriving from state wholesale over hand-listing.

> Carried over from the click-wheel build, where three separate bugs were the same shape: a value
> computed correctly and never consumed — a redraw signature omitting a field that was drawn, a tick
> sound wired to one input path and not the other, a `useCallback` defined and never called. None
> were type errors. All were invisible until someone looked at the screen.

**Architectural guarantees are enforced, not remembered.** Two rules in this spec are load-bearing
enough to be checked mechanically rather than trusted to review: safety components declare no skin
tokens (§10), and no user-visible copy lives in a component (§12).

**Verification, since the storyboard is the fixture set.** Every scenario is walked to prove
reachability, absence of dead ends, and that safety and acknowledgment obligations are met; every
skin's token pairs are contrast-checked programmatically; each node renders against its storyboard
frame. Specifics: **impl plan §6**.

**Astro island.** `client:visible`, static shell server-side so there is no layout shift, all
browser APIs behind effects. Scripts lazily imported per scenario. No global store, no CSS-in-JS,
no UI library, no browser storage — a demo that remembers you is a bug report waiting.

## 15. Build plan

Sequenced so the riskiest decisions are settled first and the copy is locked before any component
is shaped around it. Step-level acceptance criteria in **impl plan §7**.

1. **Script the care conversation** — every node, beat and line of copy final, lifted from `01`–`10`,
   `A`–`C`, `D1`–`D6`, `P1`–`P4`. This forces the copy decisions; everything downstream is easier
   for it. **One authored failure must sit on the played path** (§15.1), not only in the Index.
2. **Director** — pacing, branching, nudge ladder. Testable with no components at all.
3. **The four hard components:** `Thinking`, `OptionStrip`, `Recovery`, `Safety`. Most states, most
   cross-cutting rules, least chance of being right the second time — and three of the four are what
   the piece is *about*.
4. **The rest of the vocabulary**, in script order.
5. **Apparatus** — rig, tray, skin switcher, Watch, Index.
6. **Skins** — family and feline token blocks. **No new components.** If one is needed, §5 was
   wrong and should be fixed rather than worked around.
7. **Accessibility pass** against §13 with a real screen reader, then the automated floors in CI.
8. **Exploration page + wall label**, matching the existing explorations shell.

---

### 15.1 Reachability of the bad states

A demo whose failure states live only in a state switcher has not shown them; it has catalogued
them. So the care script carries **one authored failure on the main path**: the clinic-directory
lookup fails on first attempt (`C`), and the retry succeeds. It costs a visitor about four seconds,
it puts the error component in front of everyone, and it is the most persuasive possible argument
that the bad states were designed — because they were not opt-in.

The remaining branches (`A`, `D6`, `F3`) stay reachable by input, since inventing a reason for a
visitor to type chest-pain symptoms would be worse than letting them find it.

### 15.2 Apparatus vocabulary

Three words that were names rather than behaviours:

- **Index** — contact sheet of every state. Selecting one enters **Play** at that node *with its
  preceding transcript reconstructed*, not as a naked screen. A node without the turns that produced
  it is incoherent, and showing it that way would undercut the whole argument about conversation.
- **`startAt`** — the prop behind Index; identical behaviour, deep-linkable.
- **Replay** — restart the current scenario from `start`, in whatever mode is active. It is not a
  third playback mode; if it ever needs to be, it is Watch.

### 15.3 The wall label

The product cannot wink (§3), so **the apparatus discloses on first paint** — not when asked. `P4`
is the follow-up for someone who tests it anyway, never the disclosure itself.

> **Care Navigator** — A simulated AI driven triage conversation; to demonstrate usage of components and states used in conversational UI.

One line, above the device, before any interaction. "Simulated" is the word carrying the
disclosure: it says this is not real before it says anything else, so spelling out "no model" and
"not medical advice" only restates it at length.

---

## 16. Open decisions

- **Is `narrowing` one component or two?** `eliminate` and `rank` may want materially different
  layouts. Split before growing the flag (§5).
- **Does `Reframe` belong in the engine?** It appeared independently in care `(D6)` and feline
  `(C3)`, which is the argument for yes. Two instances is thin evidence.
- **"Your line"** as the tray label `(P1)` — theatrical and self-explaining, but may wear thin over
  twenty-five beats. Fallbacks: `Say…`, `You could say`, or dropping it after first use.
**`D6` — closed: it ships.** It cannot be simultaneously final copy in step 1 and an open question
here. It survives on three conditions, all of which are now requirements rather than hopes: it
contains **no humour at any budget**; it is **visibly amber, not the red of tempo 1**, because it is
a check and not yet an alarm; and **"I'm not sure" routes to the safer branch** alongside "Yes".
Residual risk is handled by a review gate in step 1 — one person outside this project reads that
frame cold — not by leaving the decision open while the script is already the fixture set.
- **Does the demo expose `voice.humour` as a slider?** Fascinating for ten seconds, then a toy.
  Currently no.
