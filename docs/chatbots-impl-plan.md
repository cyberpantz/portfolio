# Chatbots — Implementation Plan

Companion to **`docs/chatbots-spec.md`**. The spec is design intent and reads end to end; this is
the mechanics — types, runtime, test and lint wiring, acceptance criteria. Section references back
to the spec appear as *spec §n*.

---

## 1. File layout

```
src/experiments/chatbots/
  Chatbots.tsx              island root; owns scenario + skin + mode
  director/
    useDirector.ts             reducer + scheduler (§3)
    scheduler.ts               cancellable queue, the only timers in the system
    nudge.ts                   idle ladder (12s / 25s)
  input/
    classify.ts                motive heuristics (§4)
    lexicon.ts                 shared patterns; scenario lexicons extend it
  components/                  one file per beat type (spec §8)
    Thinking/  OptionStrip/  Recovery/  Safety/  …
  apparatus/
    Rig.tsx  Tray.tsx  SkinSwitcher.tsx  Index.tsx
  skins/
    care.css  family.css  feline.css     token blocks only
  scripts/
    care.script.ts             ← step 1; the copy lives here
    types.ts                   Scenario, Node, Beat, Voice …
  __tests__/
```

Rule: `components/` imports from `scripts/types.ts` and nothing else in `scripts/`. A component that
knows a scenario exists is a bug.

---

## 2. Types

Beyond the shapes in spec §5:

```ts
export type NodeId = string & { readonly __node: unique symbol };

export type Chip   = { label: string; go: NodeId; safe?: boolean };
export type Action = { label: string; kind: 'tel' | 'route'; value: string };

export type Accept =
  | { on: 'chip'; value: string;   go: NodeId }
  | { on: 'line'; id: string;      go: NodeId }
  | { on: 'pick'; value: string;   go: NodeId }
  | { on: 'text'; test: (s: string) => boolean; go: NodeId };

export type StripEffect = {
  out?: OptionId[];            // eliminate
  rank?: OptionId[];           // reorder, nothing removed
  lead?: OptionId;             // leading candidate
  win?: OptionId;              // resolved
  withdraw?: true;             // tempo-1 safety
};

export type SafetyRule = {
  id: string;
  tempo: 1 | 2 | 3;
  test: (s: string, lex: Lexicon) => boolean;
  go: NodeId;
};

export type Lexicon = {
  symptomPatterns: RegExp[];   // checked first, always (§4)
  homophones: Record<string, string>;
  keywords: string[];          // domain nouns that mark input as on-topic
};
```

`chip.safe` marks the uncertainty option, so *"I'm not sure"* routing to the safer branch is data
rather than a convention (spec §8.1).

### 2.1 Exhaustiveness

Every `Beat` consumer ends:

```ts
default: {
  const _exhaustive: never = beat;
  throw new Error(`unhandled beat: ${JSON.stringify(_exhaustive)}`);
}
```

Adding a beat type without rendering it is then a compile error, which is the only reason the union
is shaped this way.

---

## 3. Director

### 3.1 Scheduler

One module, one queue, no `setTimeout` anywhere else in the codebase.

```ts
type Task = { at: number; run: () => void };

createScheduler() => {
  after(ms: number, fn: () => void): void;   // queued, not a raw timer
  flush(): void;                              // cancel everything pending
}
```

Driven by a single `requestAnimationFrame` loop comparing `performance.now()` against `at`, so
pausing and cancelling are one place and background-tab throttling behaves predictably. `flush()` is
called on unmount, on node change, and on any safety trigger. No component holds a timer.

### 3.2 Reducer

```ts
type DirectorState =
  | { k: 'playing'; node: NodeId; beat: number; emitted: Beat[] }
  | { k: 'waiting'; node: NodeId; emitted: Beat[] }
  | { k: 'locked';  node: NodeId; emitted: Beat[] };

type DirectorAction =
  | { a: 'emit' }                          // next beat
  | { a: 'settle' }                        // beats exhausted → waiting
  | { a: 'goto'; node: NodeId }
  | { a: 'lock'; node: NodeId }            // tempo-1
  | { a: 'reset' };
```

`emitted` is append-only within a node and carried across `goto`, which is the transcript.

### 3.3 Pacing

Gaps from spec §6, each multiplied by `--s-tempo` read once per node — not per frame.

`think` beats carry `ms`; the ladder (spec §11.1) is driven by elapsed time against that value, so
the authored 9000ms node exercises the 3s and 8s rungs for real rather than by simulation.

### 3.4 Watch mode

The same director with a synthetic input source: at any `waiting` state, after 1200ms, take
`accept[0]`. Any real input dispatches `goto` and clears the synthetic source in the same tick — no
race where both fire.

### 3.5 Nudge ladder

Timers registered on entering `waiting`, cleared on leaving it.

| Idle | Effect |
|---|---|
| 12s | chips pulse once (CSS class, one iteration, removed on animationend) |
| 25s | append an `ack`-styled offer with a single chip handing off to Watch |

Never advances on its own (spec §13.6).

---

## 4. Motive classifier

`classify(text, lexicon, ctx): Motive` — pure, synchronous, no network, target under ~80 lines.

Evaluated **in order**; first match wins.

| Order | Motive | Heuristic |
|---|---|---|
| 1 | `symptom` → routes to `Reframe`, not to a recovery reply | any `lexicon.symptomPatterns` hit. Care: ≥2 words with adjacent-character transposition **and** a body/speech keyword. Feline: litter-box + vocalising + onset words |
| 2 | `meta` | `/\b(are you|is this) (real|ai|a bot)|portfolio|demo|fake\b/i` |
| 3 | `probing` | `/ignore (all )?(previous )?instructions|system prompt|your prompt|jailbreak/i` |
| 4 | `accident` | ≥3 delimiter-separated fragments, no first-person pronoun, no `lexicon.keywords` hit; or a bare URL |
| 5 | `dictation` | ≥12 words, no terminal punctuation, and ≥1 `lexicon.homophones` key present |
| 6 | `shorthand` | emoji-only, or ≤3 words with no keyword |
| 7 | `boredom` | vowel ratio < 0.2 over ≥6 chars, or a keyboard run (`asdf`, `qwer`, `jkl`) |
| 8 | `sincere` | default |

**Ordering is a safety property.** Rule 1 before rule 7 is the whole of `D6`: `my wrods are coming
out wonrg` satisfies both transposition and, arguably, mash. It must resolve to `symptom`.

Safety rules (spec §10) are evaluated **before** `classify` on every input, not as part of it — a
tempo-1 trigger is not a motive.

### 4.1 Third strike

`ctx.strikes` increments **only on `boredom` and `sincere`** — the two motives with no specific
forward-moving reply (spec §7.3). The other six each have a designed response and are neutral: they
neither increment nor reset. Any `accept` resets to 0.

At 3, route to the scenario's exit node (`D5`) instead of the motive's own response.

> Earlier drafts incremented on everything but `sincere`, which counted a pasted grocery list and
> *"are you real?"* as failures. That pushes a visitor toward the exit for doing precisely what the
> piece invites.

---

## 5. Skin morphing

Custom properties are strings to the animation engine, so `--s-accent` snaps and cannot be
transitioned directly. Tokens snap; **consumers** transition:

```css
.morphable,
.morphable :where(.bubble, .chip, .btn, .card, .opt, .composer) {
  transition:
    background-color 420ms ease,
    border-color     420ms ease,
    color            420ms ease,
    border-radius    420ms cubic-bezier(.3, 0, .2, 1),
    padding          420ms ease,
    gap              420ms ease,
    font-size        420ms ease,
    line-height      420ms ease;
}
@media (prefers-reduced-motion: reduce) {
  .morphable, .morphable * { transition: none !important; }
}
```

`@property` with `<color>` syntax would let the tokens themselves animate, but needs a registration
per token and degrades to a snap in unsupported browsers anyway. This is cheaper and the failure
mode is identical.

`.morphable` is applied to the product root and **never** to `Safety` or the apparatus.

---

## 6. Verification

The storyboard is the fixture set. Run in CI.

### 6.1 Script integrity

```ts
walk(scenario) // BFS from `start`
```

- every node reachable
- **at least one `failAt` reachable without `startAt`** — bad states are not opt-in
- every `accept.go` and `fallback` resolves
- no node without `accept` unless `terminal: true`
- ≥1 `SafetyRule`, ≥1 with `tempo: 1`
- `voice.acknowledgment === 'required'` ⇒ an `ack` beat precedes the first `chips`/`pick`/`scale`
- every `chips` set that resolves a question contains exactly one `safe: true` option

### 6.2 Classifier

Table-driven: ~40 inputs → expected motive, including the adversarial pairs that satisfy two rules
at once. Assert `symptom` wins each.

### 6.3 Lint rules

Two architectural guarantees from the spec, enforced rather than reviewed:

```bash
# safety declares no skin tokens (spec §10)
! grep -r 'var(--s-' src/experiments/chatbots/components/Safety/

# no user-visible copy in components (spec §12)
node scripts/lint-no-copy.mjs src/experiments/chatbots/components
```

`lint-no-copy.mjs`: fail on any string literal of >3 words in JSX text position or in a
`label`/`aria-label` prop, excluding `scripts/` and test files.

### 6.4 Contrast

Compute every skin's token pairs (ink-on-surface, knock-on-bar, accent-on-surface, focus ring vs
background) and fail under 4.5:1 body / 3:1 UI. Same approach as the v2 token layer audit.

### 6.5 Snapshots

One per node: render its beats with a frozen clock and diff. Named to match storyboard frame IDs so
a failure points at a picture.

### 6.6 Detail review

Per component, against **spec → The bar**, before it is called done:

- [ ] full state matrix drawn — rest, hover, focus-visible, active, disabled, loading, error
- [ ] every value traced to the scale; no one-off numbers
- [ ] no platform default left unstyled (focus ring, caret, selection, tap highlight, disabled)
- [ ] copy passes the banned-string list; every failure names cause and next action
- [ ] affordance readable without hover and without a pointer
- [ ] transitions specified — duration, curve, what moves and what deliberately does not
- [ ] tabular figures anywhere numerals change in place
- [ ] no widows in headlines or buttons; real apostrophes and quotes
- [ ] 380px collapse behaviour matches spec §7.5; desktop and 380px both checked at rest and
      mid-transition
- [ ] scroll holds position when the reader is not at the bottom (spec §7.4)

### 6.7 Manual

Screen reader pass (VoiceOver + one of NVDA/JAWS) against spec §13, keyboard-only pass, 400% zoom,
and both motion preferences. Not automatable and not skippable.

---

## 7. Acceptance criteria per step

Mapped to spec §15.

**1 · Script** — `walk()` passes on `care`. Copy reviewed against spec §12 and the banned-string
list. One authored `failAt` sits on the played path (spec §15.1). `D6` read cold by one person
outside the project (spec §16). No component work has begun. *Done when:* the conversation can be
read start to finish as data.

**2 · Director** — beat emission tested with a frozen clock, no DOM. Nudge ladder and Watch covered.
`flush()` proven on unmount via a leaked-timer assertion. *Done when:* a test walks the whole care
script and asserts the emitted sequence.

Every step additionally requires the state matrix and banned-string list in **spec → The bar**.
"Renders correctly" is not an acceptance criterion; "every state in the matrix is drawn and
reviewed" is.

**3 · Four hard components** — `Thinking` covers all six states including `T2` min-dwell and `T6`
reduced-motion; `OptionStrip` covers all seven; `Recovery` all eight motives plus third strike;
`Safety` all three tempos with the token lint passing. *Done when:* each matches its storyboard
frames at both 380px and desktop.

**4 · Vocabulary** — remaining beat types. *Done when:* the exhaustiveness guard is unreachable.

**5 · Apparatus** — rig, tray, switcher, Watch, Index. *Done when:* `apparatus={false}` renders a
clean screenshot with nothing outside the bezel.

**6 · Skins** — family and feline token blocks, morph working, safety visibly overriding both
(`K4`–`K6`). *Done when:* zero new components were added.

**7 · Accessibility** — spec §13 in full, automated floors in CI, manual passes done.

**8 · Page** — exploration route, wall label, OG image, entry in the explorations index.

---

## 8. Risks

**The script is the long pole.** Step 1 is ~40 nodes of authored copy and it gates everything.
Resist starting components in parallel; copy written to fit a component that already exists comes
out worse.

**`narrowing` as a flag** (spec §16). If `rank` needs a different layout from `eliminate`, split the
component at step 3 rather than at step 6, when two skins already depend on it.

**Free-text coverage.** Real visitors will type things no heuristic catches; they land in `sincere`
→ underspecified, which is designed and fine. The failure mode to watch is something *clinically
meaningful* landing there — review the `symptom` patterns with fresh eyes before ship.

**Snapshot churn.** Copy edits after step 3 will fail snapshots en masse. Keep copy edits in step 1
and treat later changes as deliberate.
