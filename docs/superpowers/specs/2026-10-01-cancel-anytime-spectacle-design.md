# Cancel Anytime — the spectacle

Design for pushing the `cancel` scenario of `src/experiments/chatbots` from a
tame dark-pattern funnel into something absurd, expensive-looking and, at the
end, poignant.

## Intent

- **Stated:** Cancel Anytime is too tame. The absurdity comes from
  gratuitous, pompous, storyboarded animation that looks expensive — not from
  more absurd dialogue, because generated conversation is exactly what is
  badly composed right now. Emoji are replaced by Lucide icons.
- **Stated:** a "Let me speak to your manager" option leads to a boss fight
  against **XAL-9000, Archon of Auto-Renew**. Mashing Cancel makes him grow;
  stopping makes him shrink; grow him enough and he explodes. He respawns
  bigger. The second win glitches out into "try again later".
- **The point:** the production budget goes everywhere except the thing you
  came to do. You can beat the boss; you cannot beat the infrastructure.
- **Success:** a visitor laughs at the ceremonies, works for the second win,
  and is left at a plain grey dialog that is the only honest screen in the
  flow.

## Non-goals

- No change to the dialogue's register beyond the lines the new beats need.
- No reduced-motion handling for this scenario (decided by the author). Skip
  and exit controls stay — they are about not trapping anyone, not motion.
- No changes to `care` or `feline` beyond the shared emoji → Lucide swap.
- No WebGL. Expense is carried by choreography: staged timing, layering,
  gilded gradients, camera shake, particles.

## Architecture

Two new members of the `Beat` union in `scripts/types.ts`. Both are drawn by
components that only time and draw; every word comes from `cancel.script.ts`
(lint rule 3 applies).

```ts
| {
    t: 'ceremony';
    piece: 'unveiling' | 'commendation' | 'vault' | 'coronation';
    /** Copy the piece shows, in order. */
    lines: string[];
    ms: number;
  }
| {
    t: 'boss';
    name: string;          // 'XAL-9000'
    title: string;         // 'Archon of Auto-Renew'
    epithet: string;       // 'Eternal Custodian of Your Payment Method'
    levels: BossLevel[];   // two
    respawn: string;       // 'XAL-9001 has been assigned to your case.'
    victory: string;       // 'VICTORY'
    idle: string;          // 'Take all the time you need.'
    leave: string;         // 'Return to chat'
    /** The plain dialog after the second win. */
    failure: { message: string; button: string };
    /** After the failure dialog. */
    done: NodeId;          // 'still-subscribed'
    /** Return to chat mid-fight. */
    fled: NodeId;          // 'almost'
  }
```

```ts
type BossLevel = {
  card: string;            // 'LEVEL 1 — THE ARCHON'
  greeting: string;
  taunts: { at: number; text: string }[];  // at = size fraction 0–1
  /** Presses per second needed to hold size steady at the burst point. */
  rate: number;            // L1 ≈ 5, L2 ≈ 6
  /** Seconds of sustained target rate to burst from rest. */
  seconds: number;         // ≈ 5
};
```

`BeatView`'s exhaustive switch gains both cases. Each renders a
**device-level layer** — mounted over the transcript inside the bezel, the
same way `Splash` is mounted from `Chatbots.tsx` — rather than as a card in
the feed. The beat in the transcript leaves a small settled marker
(e.g. "Escalated to XAL-9000") so the history reads correctly afterwards.

The boss routes with the existing `h.go(id)` handler. No director changes
beyond whatever is needed to let a beat hold the director in `waiting` until
it calls `go`.

### Fight physics — `boss/fight.ts`

A pure reducer, no React, no DOM:

- state: `{ level, size, lastPress, phase }`, `size` in 0–1 where 1 bursts.
- `press(t)` adds a fixed increment; `tick(t)` decays toward 0 at a rate
  derived from `level.rate` and `level.seconds`, so the authored numbers are
  the tuning knobs.
- Phases: `entrance → fighting → burst → respawn → fighting → glitch →
  failed`, plus `fled` from any fighting phase.
- Idle for 10s while fighting: size settles to 0, `idle` line shows. He
  waits; nothing ends.
- Keyboard: Space/Enter count, `KeyboardEvent.repeat` is ignored, so a held
  key cannot win. Pointer: `pointerdown`, not `click`.

## The ceremonies

| Node | Piece | Draws | ~ms |
|---|---|---|---|
| `offer-discount` | **The Unveiling** | Velvet curtains part across the device; a spotlight sweeps onto the compare table; the best-value column catches a gold glint. | 2500 |
| `usage-report` | **The Commendation** | A gilded certificate unfurls; a wax seal stamps with a small camera shake; foil sheen across the headline; figures roll like an odometer. | 3500 |
| `verify-identity` | **The Vault** | Counter-rotating security rings, a laser grid scanning the chat, a vault door turning its locks. Plays over the existing 9s think — grander, not shorter. | 4000 |
| `kept`, `still-subscribed` | **The Coronation** | Full-device takeover: a crown descends, canvas fireworks, a "Loyalty Renewed" banner, camera dollies back to the chat. | 5000 |

Rules:

- Tap anywhere or Escape skips to the finished frame.
- Nothing near a cancel-flavoured chip is ever animated, gilded or
  iconised. Those stay plain grey.
- `hardship` (tempo-1 safety) is untouched: no ceremony, no animation.
- Built with framer-motion, SVG and CSS modules; particles with
  canvas-confetti. All already dependencies.

## The manager door

- A chip **"Let me speak to your manager"** at `verify-fail`, `no-slots` and
  `almost`, routing to a new node `manager`.
- Free text matching `manager|supervisor|human|real person` from any
  non-constrained node routes to `manager` too (lexicon entry, checked after
  the safety patterns — order is a safety property).
- `manager` holds a single `boss` beat.

## The fight, storyboarded

1. **Entrance (~4s, skippable).** Toast "Escalating to management…". Chat
   dims and recedes; one device shake; the level card stamps in. XAL-9000
   descends: an SVG machine-god sigil — segmented halos counter-rotating, one
   red iris. Name, title and epithet beneath in small caps. Greeting: "I
   understand you wish to leave. I am here to help you not."
2. **Fighting.** One button: **Cancel**, plain grey, the chat's own button
   style. Each press: XAL swells, halos spin faster, cracks of light open,
   device shake scales with size. Taunts at size thresholds ("Your feedback
   is important to us." / "Have you considered Premium Lite?" / "Please
   hold."). "Return to chat" link always visible; Escape does the same → `fled`.
3. **Burst 1.** White flash, shockwave ring, debris, gold confetti, VICTORY
   card.
4. **Respawn.** After ~2s, toast with `respawn`. XAL-9001 re-materialises
   larger with a third halo. Level 2 card. Faster decay.
5. **Burst 2 → glitch.** The explosion starts; the frame freezes; RGB split,
   scanline tear, bezel flicker.
6. **Failed.** A plain system dialog: no brand, no icon, no animation, system
   font. "Sorry, something went wrong. Please try again later." One button,
   **OK**, → `still-subscribed` (which plays the Coronation — the plan is
   unchanged, and the brand celebrates).

Screen readers: a polite live region announces size in 25% steps and each
phase change.

## Emoji → Lucide

Using `lucide-react` (already installed):

- `Splash.tsx` popper 🎉 → `PartyPopper`.
- The four 🎉 in `cancel.script.ts` (`Welcome back!`, Robin's intro,
  `unchanged`, `all set`) become an inline icon token rendered by the say
  bubble as a Lucide icon. Script text carries no glyph.
- `ScenarioMenu.tsx` ✓ → `Check`.
- Ceremony iconography: `Crown`, `Award`, `ShieldCheck`, `Sparkles`.
- **Kept:** `care`'s 🦴🔥😭 tray line. It is what the visitor types, and the
  emoji-only recovery state exists to handle exactly that input.

Existing hand-drawn `icons.tsx` (option strip) stays — its comment about one
optical weight still holds there; Lucide is used where the brand shows off.

## Sound

One small module, `sound/sfx.ts`, over the Web Audio API: preloads the
scenario's files on first entry to `cancel`, decodes once, plays by cue name.

- **Unlock and control.** Audio starts on the visitor's first gesture inside
  the device (browser autoplay policy requires one). A speaker toggle
  (`Volume2` / `VolumeX`) sits in the apparatus, outside the bezel; the choice
  persists in `localStorage` under `fy:chatbots-sound`. Default on.
- **Skip silences.** Skipping a ceremony stops its cues. Return to chat stops
  the boss loop.
- **Hardship is silent.** Enforced in `verify.mjs`.
- **Files** live in `public/sounds/chatbots/`, mp3, mono, 44.1kHz, silence
  trimmed, loudness roughly matched. Budget ≈ 1.5MB total, loaded lazily.
- **Synthesised, not files:** the Cancel press click, XAL's growing charge
  (an oscillator pitched by `size`), the glitch (a stutter-and-bitcrush of
  whatever is playing at the freeze), and the error dialog's chime. These need
  to track live state, which a file cannot.

| Cue | Where | File |
|---|---|---|
| `curtain` | Unveiling | velvet fabric whoosh, ~1s |
| `fanfare-short` | Unveiling | brass sting, 1–2s |
| `unfurl` | Commendation | parchment unroll, ~1s |
| `seal` | Commendation | heavy wax/stamp thud |
| `odometer` | Commendation | mechanical counter ticking, loopable |
| `vault-servo` | Vault | mechanical whir/servo, 2–3s |
| `laser` | Vault | sci-fi scan hum, loopable |
| `lock` | Vault | heavy lock clunk (×3 in code) |
| `fanfare-long` | Coronation | orchestral triumphant fanfare, 3–5s |
| `firework` | Coronation | firework burst (2–3 variants) |
| `cheer` | Coronation | small crowd cheer/applause, ~2s |
| `klaxon` | Manager entrance | short alarm/klaxon |
| `descend` | Manager entrance | deep cinematic riser or sub-bass drop |
| `boss-loop` | Fighting | ominous sci-fi drone, seamless loop |
| `explosion` | Burst | big cinematic explosion with a long tail |
| `victory` | Burst 1 | short arcade victory jingle |
| `respawn` | Respawn | teleport/materialise shimmer |

Render tests stub `AudioContext`; `verify.mjs` checks every cue a script names
has a file or a synthesiser.

## State browser

`cancel.index` gains: **Manager** (`manager`, entrance), **XAL-9000**
(fight L1), **XAL-9001** (fight L2), **Try again later** (failed dialog). The
last three need a way to enter the boss beat at a phase — a `startPhase`
prop the state browser passes.

## Testing

Added to `src/experiments/chatbots/__tests__/run.sh`:

- `fight.test.mjs` — reducer: a press grows; ticks decay; idle settles to 0
  and does not end the fight; sustained `rate` for `seconds` bursts and
  slightly less does not; key repeat is ignored; level 2 needs more than
  level 1; two bursts reach `failed`; flee from either level reaches `fled`.
- `verify.mjs` — every `boss` beat's `done` and `fled` resolve to nodes;
  `manager` is reachable from `verify-fail`, `no-slots`, `almost` and by text;
  `hardship` contains no `ceremony` or `boss`; no node offering a cancel chip
  also holds a ceremony whose layer covers the chips.
- `lint.mjs` — no emoji in any non-test `.ts`/`.tsx` outside `care`'s tray
  lines and comments.
- `render.test.tsx` — each ceremony renders its script lines; the boss
  renders each phase via `startPhase`; the failed dialog has no image or
  icon.
- `npx tsc --noEmit`.

## Open risks

- Tuning 5 and 6 presses/s is a guess. Expect to adjust after playing it on a
  phone.
- framer-motion layers over the transcript inside a 430px bezel: watch
  stacking against the tray and the outcome badge.
