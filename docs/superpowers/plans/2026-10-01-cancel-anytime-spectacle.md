# Cancel Anytime Spectacle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the `cancel` scenario four escalating animated ceremonies, a "speak to your manager" boss fight against XAL-9000 that ends in a plain "try again later" dialog, sound, and Lucide icons in place of emoji.

**Architecture:** Two new `Beat` members (`ceremony`, `boss`) in the existing script engine. Their components draw into a device-level layer through a portal (falling back to inline when there is no host, which is what the SSR render tests see). Fight rules live in a pure reducer; sound in one Web Audio module with file cues and synthesised cues behind one interface.

**Tech Stack:** React 19 islands in Astro, CSS modules, framer-motion ^12, lucide-react ^1.14, canvas-confetti, Web Audio API. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-10-01-cancel-anytime-spectacle-design.md`

## Global Constraints

- pnpm only, never npm. No new dependencies.
- Verify with `npx tsc --noEmit` and `bash src/experiments/chatbots/__tests__/run.sh` (ends with `ALL SUITES PASSED`). `astro build`/`astro check` cannot run in the sandbox.
- Every word the product shows comes from `scripts/cancel.script.ts`; components only time and draw. Lint rule 3 fails JSX text over three words under `components/`.
- Comments only for invisible constraints and non-obvious must-nots; a short orientation at the top of each new file. No change history. Keep files under ~20% comment lines.
- Prose in script copy uses curly apostrophes (’), never straight.
- The device is capped at 430px wide; every layer fits inside it.
- `hardship` (tempo-1 safety) gets no ceremony, no boss, no sound.
- No reduced-motion handling for this scenario. Skip (tap/Escape) and "Return to chat" are always available.
- Cancel-flavoured chips stay plain: no gilding, no icon, no animation.
- Commit messages follow the repo's style (`Chatbots: …`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only; never push.

## Review Focus

1. **Rapid tapping on a phone** — double-tap zoom or text selection must not fire on the Cancel button. Pinned in Task 5 (CSS check in render test).
2. **Holding Space/Enter** — auto-repeat must never count. Pinned in Task 2 (reducer) and Task 5 (`isPressKey`).
3. **Keyboard focus on "Return to chat"** — Enter there must flee, not count as a press. Pinned in Task 5 (`isPressKey` test).
4. **Tab hidden mid-fight** — the rAF clock resumes with a multi-second gap; size must stay finite and in [0, 1]. Pinned in Task 2.
5. **Start over / scenario switch mid-fight or mid-ceremony** — sound must stop. Pinned in Task 3 (`stopAll` test) and wired in Tasks 4–5 unmount cleanup.

---

### Task 1: Engine — beat types, timing, layer host

**Files:**
- Modify: `src/experiments/chatbots/scripts/types.ts`
- Modify: `src/experiments/chatbots/director/useDirector.ts` (`GAP_AFTER`, `ownTime`)
- Create: `src/experiments/chatbots/components/Layer.tsx`
- Modify: `src/experiments/chatbots/components/BeatView.tsx`
- Modify: `src/experiments/chatbots/Chatbots.tsx`
- Modify: `src/experiments/chatbots/components/product.module.css`
- Test: `src/experiments/chatbots/__tests__/verify.mjs`, `render.test.tsx`

**Interfaces:**
- Produces: `CeremonyPiece`, `BossLevel`, `BossPhase`, `BossStart`, `IndexPhase` types; `Beat` members `ceremony` and `boss`; exported `ownTime(b: Beat): number`; `LayerHost` context and `<Layer>`; `BeatHandlers.bossPhase?: IndexPhase`.

- [ ] **Step 1: Add the types** to `scripts/types.ts`, above `export type Beat`:

```ts
export type CeremonyPiece = 'unveiling' | 'commendation' | 'vault' | 'coronation';

export type BossLevel = {
  name: string;
  card: string;
  greeting: string;
  /** `at` is a size fraction, 0–1. The highest one reached is shown. */
  taunts: { at: number; text: string }[];
  /** Presses per second that bursts him in `seconds`. Below ~70% of it never does. */
  rate: number;
  seconds: number;
};

export type BossPhase = 'entrance' | 'fighting' | 'burst' | 'respawn' | 'glitch' | 'failed' | 'fled';
export type IndexPhase = 'level2' | 'failed';
export type BossStart = 'entrance' | IndexPhase;
```

Add to the `Beat` union, before the closing `;` of the `error` member:

```ts
  | {
      t: 'ceremony';
      piece: CeremonyPiece;
      lines: string[];
      ms: number;
      /** Director waits this long before the next beat. Defaults to ms; 0 plays the next beat underneath. */
      hold?: number;
    }
  | {
      t: 'boss';
      title: string;
      epithet: string;
      levels: BossLevel[];
      press: string;
      respawn: string;
      victory: string;
      idle: string;
      leave: string;
      failure: { message: string; button: string };
      marker: string;
      done: NodeId;
      fled: NodeId;
    }
```

Change the `index` field of `Scenario` to:

```ts
  index: { id: NodeId; label: string; note: string; phase?: IndexPhase }[];
```

- [ ] **Step 2: Write the failing director check.** Append to `verify.mjs` before the final `console.log(fails ? …)`:

```js
console.log('\nCeremonies hold the stage for their authored time');
{
  const { ownTime } = await import('../director/useDirector.ts');
  ok(ownTime({ t: 'ceremony', piece: 'vault', lines: [], ms: 4000 }) === 4000, 'ceremony without hold holds for ms');
  ok(ownTime({ t: 'ceremony', piece: 'vault', lines: [], ms: 4000, hold: 0 }) === 0, 'hold: 0 lets the next beat play underneath');
  ok(ownTime({ t: 'think', stages: [], ms: 900 }) === 900, 'think still holds for its ms');
}
```

- [ ] **Step 3: Run it to see it fail**

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: verify fails with `ownTime is not a function` (it is not exported yet).

- [ ] **Step 4: Implement in `useDirector.ts`.** Add to `GAP_AFTER`: `ceremony: 0, boss: 0,`. Replace `ownTime`:

```ts
export function ownTime(b: Beat): number {
  if (b.t === 'think') return b.ms ?? 1800;
  if (b.t === 'ceremony') return b.hold ?? b.ms;
  return 0;
}
```

- [ ] **Step 5: Create `components/Layer.tsx`:**

```tsx
/**
 * A layer over the whole device, above the transcript. Ceremonies and the
 * boss draw here. With no host (server render, tests) it renders in place.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const LayerHost = createContext<HTMLElement | null>(null);

export function Layer({ children }: { children: ReactNode }) {
  const host = useContext(LayerHost);
  return host ? createPortal(children, host) : <>{children}</>;
}
```

- [ ] **Step 6: Stub both beats in `BeatView.tsx`** so the `never` guard compiles. Add `bossPhase?: IndexPhase;` to `BeatHandlers` (import `IndexPhase` from `../scripts/types`). Before `default:`:

```tsx
    case 'ceremony':
      return null;

    case 'boss':
      return <div className={s.ack}>{beat.marker}</div>;
```

- [ ] **Step 7: Host the layer in `Chatbots.tsx`.** Import `LayerHost` from `./components/Layer`. Add state next to the other refs:

```tsx
  const [layerHost, setLayerHost] = useState<HTMLDivElement | null>(null);
```

Wrap the device's children and add the host as its last child:

```tsx
  const device = (
    <div className={`${s.device} sb-skin sb-morph`} data-skin={skin}>
      <LayerHost.Provider value={layerHost}>
        {/* …existing splash / conversation JSX unchanged… */}
      </LayerHost.Provider>
      <div ref={setLayerHost} className={s.layers} />
    </div>
  );
```

Append to `product.module.css`:

```css
/* Ceremonies and the boss portal in here. Empty, it must not eat clicks. */
.layers { position: absolute; inset: 0; z-index: 30; pointer-events: none; }
.layers > * { pointer-events: auto; }
/* A ceremony's turn is empty once its layer has portalled out. */
.turn:empty { display: none; }
```

- [ ] **Step 8: Render the new beats in `render.test.tsx`.** Add to the `UNUSED` array:

```tsx
  { t: 'ceremony', piece: 'unveiling', lines: ['Presenting', 'An Exclusive Offer'], ms: 2500 },
  {
    t: 'boss', title: 'T', epithet: 'E', press: 'Cancel', respawn: 'R', victory: 'V', idle: 'I',
    leave: 'L', marker: 'Escalated', failure: { message: 'M', button: 'OK' }, done: 'open', fled: 'open',
    levels: [{ name: 'XAL-9000', card: 'C', greeting: 'G', taunts: [], rate: 5, seconds: 5 }],
  },
```

The existing `ok(html.length > 0 …)` check will fail for the ceremony stub (renders `null`). Change that line in the UNUSED loop to:

```tsx
    ok(html.length > 0 || beat.t === 'ceremony', `unused beat "${beat.t}" rendered empty`);
```

(Task 4 tightens this when the ceremony renders.)

- [ ] **Step 9: Run everything**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `ALL SUITES PASSED`.

- [ ] **Step 10: Commit**

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: ceremony and boss beats, and a layer over the device" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fight rules (pure reducer)

**Files:**
- Create: `src/experiments/chatbots/components/boss/fight.ts`
- Create: `src/experiments/chatbots/__tests__/fight.test.mjs`
- Modify: `src/experiments/chatbots/__tests__/run.sh`

**Interfaces:**
- Consumes: `BossLevel`, `BossPhase`, `BossStart` from Task 1.
- Produces: `type Fight`, `type FightEvent`, `start(t: number, from?: BossStart): Fight`, `fight(levels: BossLevel[]): (s: Fight, ev: FightEvent) => Fight`, `tuning(l): { k: number; step: number }`, `quarter(size: number): number`, constants `ENTRANCE_MS`, `BURST_MS`, `RESPAWN_MS`, `GLITCH_MS`, `IDLE_MS`.

- [ ] **Step 1: Write the failing tests** — `__tests__/fight.test.mjs`:

```js
/** The boss fight's rules, without a DOM. */
import { fight, start, tuning, quarter, ENTRANCE_MS, BURST_MS, RESPAWN_MS, GLITCH_MS, IDLE_MS } from '../components/boss/fight.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  FAIL ' + m); } };

const L = [
  { name: 'XAL-9000', card: '', greeting: '', taunts: [], rate: 5, seconds: 5 },
  { name: 'XAL-9001', card: '', greeting: '', taunts: [], rate: 6, seconds: 5 },
];
const step = fight(L);
const fighting = (level = 0) => (level ? start(0, 'level2') : step(start(0), { e: 'skip', t: 0 }));

/** Ticks every 16ms and presses at `rate`/s until `secs` pass or the phase changes. */
function mash(s, rate, secs, { repeat = false } = {}) {
  let t = s.at, next = t, first = true;
  const end = t + secs * 1000;
  while (t < end && s.phase === 'fighting') {
    t += 16;
    s = step(s, { e: 'tick', t });
    if (rate && t >= next) {
      s = step(s, { e: 'press', t, repeat: repeat && !first });
      first = false;
      next += 1000 / rate;
    }
  }
  return s;
}
const until = (s, ms) => step(s, { e: 'tick', t: s.at + ms + 1 });

let s = fighting();
const pressed = step(s, { e: 'press', t: 10 });
ok(pressed.size > 0 && pressed.size === tuning(L[0]).step, 'a press grows him by one step');
ok(step(pressed, { e: 'tick', t: 1010 }).size < pressed.size, 'a tick shrinks him');

const idle = step(pressed, { e: 'tick', t: 10 + IDLE_MS + 1 });
ok(idle.size === 0 && idle.idle && idle.phase === 'fighting', 'ten idle seconds settle him to rest and the fight waits');

ok(mash(fighting(), 5, 5.3).phase === 'burst', 'level 1 bursts at 5/s within 5.3s');
ok(mash(fighting(), 3.5, 30).phase === 'fighting', 'level 1 never bursts at 70% of the rate');
const held = mash(fighting(), 30, 10, { repeat: true });
ok(held.phase === 'fighting' && held.size < 0.2, 'a held key (auto-repeat) cannot win');
ok(mash(fighting(1), 5, 5.3).phase === 'fighting', 'level 2 is harder: level 1’s pace does not burst it in time');

const gap = step(pressed, { e: 'tick', t: 10 + 600_000 });
ok(Number.isFinite(gap.size) && gap.size >= 0 && gap.size <= 1, 'a hidden-tab gap leaves size finite and in range');

// The whole arc: burst → respawn at level 2 → glitch → failed.
let arc = mash(fighting(), 6, 6);
ok(arc.phase === 'burst' && arc.level === 0, 'first burst');
arc = until(arc, BURST_MS);
ok(arc.phase === 'respawn' && arc.level === 1 && arc.size === 0, 'respawns at level 2, at rest');
arc = until(arc, RESPAWN_MS);
ok(arc.phase === 'fighting', 'level 2 begins');
arc = mash(arc, 6.5, 8);
ok(arc.phase === 'glitch', 'the second burst glitches instead of exploding');
arc = until(arc, GLITCH_MS);
ok(arc.phase === 'failed', 'and then it fails');

ok(until(start(0), ENTRANCE_MS).phase === 'fighting', 'the entrance ends on its own');
ok(step(fighting(), { e: 'flee', t: 1 }).phase === 'fled', 'flee from level 1');
ok(step(fighting(1), { e: 'flee', t: 1 }).phase === 'fled', 'flee from level 2');
ok(start(0, 'failed').phase === 'failed', 'the state browser can open on the failure');
ok(quarter(0) === 0 && quarter(0.3) === 25 && quarter(1) === 75, 'size announces in 25% steps, never 100 before bursting');

console.log(fails ? `\n${fails} FAILED` : '  all fight assertions pass');
process.exit(fails ? 1 : 0);
```

Add to `run.sh` after the calendar line:

```sh
node --experimental-strip-types --import "$DIR/register.mjs" "$DIR/fight.test.mjs"
```

- [ ] **Step 2: Run to see it fail**

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: FAIL — cannot find module `../components/boss/fight.ts`.

- [ ] **Step 3: Implement `components/boss/fight.ts`:**

```ts
/**
 * The XAL-9000 fight as a pure reducer. Each press adds a fixed step; size
 * decays exponentially. With HEADROOM the equilibrium at the authored rate
 * sits above the burst point, so that rate bursts him in `seconds` and
 * anything under ~70% of it never does.
 */
import type { BossLevel, BossPhase, BossStart } from '../../scripts/types';

export const HEADROOM = 1.3;
export const ENTRANCE_MS = 4000;
export const BURST_MS = 2200;
export const RESPAWN_MS = 1800;
export const GLITCH_MS = 1400;
export const IDLE_MS = 10_000;

export type Fight = {
  phase: BossPhase;
  level: number;
  size: number;
  /** When the current phase began. */
  at: number;
  last: number;
  lastPress: number;
  idle: boolean;
};

export type FightEvent =
  | { e: 'press'; t: number; repeat?: boolean }
  | { e: 'tick'; t: number }
  | { e: 'skip'; t: number }
  | { e: 'flee'; t: number };

export function tuning(l: Pick<BossLevel, 'rate' | 'seconds'>) {
  const k = -Math.log(1 - 1 / HEADROOM) / l.seconds;
  return { k, step: (HEADROOM * k) / l.rate };
}

export function start(t: number, from: BossStart = 'entrance'): Fight {
  const base = { level: 0, size: 0, at: t, last: t, lastPress: t, idle: false };
  if (from === 'level2') return { ...base, phase: 'fighting', level: 1 };
  if (from === 'failed') return { ...base, phase: 'failed', level: 1 };
  return { ...base, phase: 'entrance' };
}

export const quarter = (size: number) => Math.floor(Math.min(size, 0.999) * 4) * 25;

const FLEEABLE: BossPhase[] = ['entrance', 'fighting', 'burst', 'respawn'];

export function fight(levels: BossLevel[]) {
  const tunes = levels.map(tuning);
  return (s: Fight, ev: FightEvent): Fight => {
    switch (ev.e) {
      case 'flee':
        return FLEEABLE.includes(s.phase) ? { ...s, phase: 'fled', at: ev.t } : s;
      case 'skip':
        return s.phase === 'entrance' ? { ...s, phase: 'fighting', at: ev.t, last: ev.t, lastPress: ev.t } : s;
      case 'press': {
        if (s.phase !== 'fighting' || ev.repeat) return s;
        const size = s.size + tunes[s.level].step;
        if (size < 1) return { ...s, size, lastPress: ev.t, idle: false };
        const last = s.level === levels.length - 1;
        return { ...s, size: 1, phase: last ? 'glitch' : 'burst', at: ev.t, lastPress: ev.t, idle: false };
      }
      case 'tick': {
        const since = ev.t - s.at;
        const n = { ...s, last: ev.t };
        switch (s.phase) {
          case 'entrance':
            return since >= ENTRANCE_MS ? { ...n, phase: 'fighting', at: ev.t, lastPress: ev.t } : n;
          case 'fighting': {
            if (ev.t - s.lastPress >= IDLE_MS) return { ...n, size: 0, idle: true };
            const dt = Math.max(0, ev.t - s.last) / 1000;
            return { ...n, size: s.size * Math.exp(-tunes[s.level].k * dt) };
          }
          case 'burst':
            return since >= BURST_MS ? { ...n, phase: 'respawn', level: s.level + 1, size: 0, at: ev.t } : n;
          case 'respawn':
            return since >= RESPAWN_MS ? { ...n, phase: 'fighting', at: ev.t, lastPress: ev.t } : n;
          case 'glitch':
            return since >= GLITCH_MS ? { ...n, phase: 'failed', at: ev.t } : n;
          default:
            return n;
        }
      }
    }
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `all fight assertions pass` … `ALL SUITES PASSED`. If "level 1 bursts at 5/s" or "70%" fails, the discrete sawtooth is drifting from the continuous maths — adjust `HEADROOM` (1.25–1.35) rather than the test.

- [ ] **Step 5: Commit**

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: the XAL-9000 fight, as a reducer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sound engine, synthesis, and the toggle

**Files:**
- Create: `src/experiments/chatbots/sound/sfx.ts`
- Create: `src/experiments/chatbots/sound/synth.ts`
- Create: `src/experiments/chatbots/apparatus/SoundToggle.tsx`
- Create: `public/sounds/chatbots/.gitkeep`
- Modify: `src/experiments/chatbots/apparatus/Rig.tsx` (new optional `extra` prop)
- Modify: `src/experiments/chatbots/Chatbots.tsx` (unlock on first gesture; pass toggle)
- Test: `src/experiments/chatbots/__tests__/sfx.test.mjs`, `run.sh`

**Interfaces:**
- Produces: `type FileCue`, `FILE_CUES`, `SOUND_KEY = 'fy:chatbots-sound'`, `createSfx(deps): Sfx`, `sfx(): Sfx` (browser singleton). `Sfx` = `{ unlock(): Promise<void>; preload(): Promise<void>; play(cue, o?: { at?: number; gain?: number; loop?: boolean; for?: number }): (() => void) | null; press(): void; charge(size: number | null): void; glitch(): void; chime(): void; stopAll(): void; enabled(): boolean; setEnabled(on: boolean): void }`. `at` and `for` are seconds.

- [ ] **Step 1: Write the failing test** — `__tests__/sfx.test.mjs`:

```js
/** The sound module with a fake AudioContext: missing files are silence, never errors. */
import { createSfx } from '../sound/sfx.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  FAIL ' + m); } };

const param = () => ({ value: 1, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} });
function fakeCtx({ decode = 'ok' } = {}) {
  const started = [];
  return {
    started,
    currentTime: 0,
    destination: {},
    resume: async () => {},
    createGain: () => ({ gain: param(), connect(n) { return n; } }),
    createDynamicsCompressor: () => ({ threshold: param(), ratio: param(), attack: param(), release: param(), knee: param(), connect(n) { return n; } }),
    createBufferSource() {
      const src = { buffer: null, loop: false, playbackRate: param(), connect(n) { return n; },
        start() { started.push(src); }, stop() { src.stopped = true; }, onended: null };
      return src;
    },
    decodeAudioData: async () => { if (decode === 'fail') throw new Error('bad mp3'); return { duration: 1 }; },
  };
}

// Missing file: play returns null, nothing throws.
{
  const ctx = fakeCtx();
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => null });
  await s.unlock(); await s.preload();
  ok(s.play('explosion') === null, 'a missing file plays nothing');
}
// Undecodable file: same.
{
  const ctx = fakeCtx({ decode: 'fail' });
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => new ArrayBuffer(8) });
  await s.unlock(); await s.preload();
  ok(s.play('explosion') === null, 'an undecodable file plays nothing');
}
// No Web Audio at all.
{
  const s = createSfx({ makeContext: () => null, fetchFile: async () => null });
  await s.unlock(); await s.preload();
  let threw = false;
  try { s.play('klaxon'); s.press(); s.charge(0.5); s.glitch(); s.chime(); s.stopAll(); } catch { threw = true; }
  ok(!threw, 'without an AudioContext every call is a silent no-op');
}
// Loaded file plays; stopAll stops it; disabled plays nothing and is remembered.
{
  const ctx = fakeCtx();
  let stored = null;
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => new ArrayBuffer(8), store: { get: () => stored, set: (v) => { stored = v; } } });
  await s.unlock(); await s.preload();
  ok(typeof s.play('boss-loop', { loop: true }) === 'function', 'a loaded file plays');
  s.stopAll();
  ok(ctx.started.every((x) => x.stopped), 'stopAll stops everything playing');
  s.setEnabled(false);
  ok(s.play('klaxon') === null && stored === '0', 'off means silent, and the choice is stored');
}

console.log(fails ? `\n${fails} FAILED` : '  all sound assertions pass');
process.exit(fails ? 1 : 0);
```

Add to `run.sh` after the fight line:

```sh
node --experimental-strip-types --import "$DIR/register.mjs" "$DIR/sfx.test.mjs"
```

- [ ] **Step 2: Run to see it fail**

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: FAIL — cannot find `../sound/sfx.ts`.

- [ ] **Step 3: Implement `sound/synth.ts`:**

```ts
/**
 * The four cues that follow live state, so cannot be files. None may sound
 * like a bare oscillator: each is layered, enveloped and filtered.
 */
export type Playing = { buffer: AudioBuffer; startedAt: number };
export type Synth = {
  press(): void;
  charge(size: number | null): void;
  chime(): void;
  glitch(from: Playing | null): void;
};

const jit = (x: number) => x * (1 + (Math.random() * 2 - 1) * 0.05);

function env(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function impulse(ctx: AudioContext, secs: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * secs);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function slice(ctx: AudioContext, src: AudioBuffer, endAt: number, secs: number, reverse = false) {
  const len = Math.max(1, Math.floor(secs * src.sampleRate));
  const from = Math.max(0, Math.floor(endAt * src.sampleRate) - len);
  const out = ctx.createBuffer(src.numberOfChannels, len, src.sampleRate);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const a = src.getChannelData(c).subarray(from, from + len);
    const o = out.getChannelData(c);
    for (let i = 0; i < a.length; i++) o[i] = reverse ? a[a.length - 1 - i] : a[i];
  }
  return out;
}

function crushCurve(levels: number) {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) c[i] = Math.round((i / 511.5 - 1) * levels) / levels;
  return c;
}

export function createSynth(ctx: AudioContext, out: AudioNode): Synth {
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 2.2, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  room.connect(wet).connect(out);

  function press() {
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = jit(3200);
    bp.Q.value = 1.4;
    const ng = ctx.createGain();
    env(ng.gain, t, 0.5, 0.001, 0.008);
    n.connect(bp).connect(ng).connect(out);
    n.start(t, Math.random() * 0.9, 0.02);

    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(jit(340), t);
    o.frequency.exponentialRampToValueAtTime(110, t + 0.05);
    const og = ctx.createGain();
    env(og.gain, t, 0.32, 0.002, 0.06);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }

  let rig: { set(size: number): void; stop(): void } | null = null;
  function buildCharge() {
    const t = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    lp.Q.value = 6;
    const trem = ctx.createGain();
    trem.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(trem.gain);
    const level = ctx.createGain();
    level.gain.setValueAtTime(0.0001, t);
    level.gain.exponentialRampToValueAtTime(0.18, t + 0.4);

    const saws = [-12, 0, 9].map((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 48;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      return o;
    });
    const sub = ctx.createOscillator();
    sub.frequency.value = 24;
    const sg = ctx.createGain();
    sg.gain.value = 0.6;
    sub.connect(sg).connect(trem);
    sub.start(t);
    lp.connect(trem).connect(level);
    level.connect(out);
    level.connect(room);
    lfo.start(t);
    const all = [...saws, sub, lfo];

    return {
      set(size: number) {
        const now = ctx.currentTime;
        const f = 48 * Math.pow(2, size * 2);
        for (const o of saws) o.frequency.setTargetAtTime(f, now, 0.04);
        sub.frequency.setTargetAtTime(f / 2, now, 0.04);
        lp.frequency.setTargetAtTime(200 + size * 3800, now, 0.04);
        lp.Q.setTargetAtTime(6 + size * 6, now, 0.06);
        lfo.frequency.setTargetAtTime(2 + size * 10, now, 0.1);
      },
      stop() {
        const now = ctx.currentTime;
        level.gain.setTargetAtTime(0.0001, now, 0.08);
        for (const o of all) o.stop(now + 0.5);
      },
    };
  }

  function charge(size: number | null) {
    if (size == null) {
      rig?.stop();
      rig = null;
      return;
    }
    rig ??= buildCharge();
    rig.set(size);
  }

  function chime() {
    const t = ctx.currentTime;
    const car = ctx.createOscillator();
    car.frequency.value = 880;
    const mod = ctx.createOscillator();
    mod.frequency.value = 880 * 1.4;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(1760, t);
    idx.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(idx).connect(car.frequency);
    const g = ctx.createGain();
    env(g.gain, t, 0.22, 0.002, 1.4);
    car.connect(g).connect(out);
    car.start(t);
    mod.start(t);
    car.stop(t + 1.6);
    mod.stop(t + 1.6);
  }

  /** Stutters the last ~120ms of what was actually playing, then cuts to silence. */
  function glitch(from: Playing | null) {
    const t = ctx.currentTime;
    const src = from ? from.buffer : noise;
    const pos = from ? (t - from.startedAt) % src.duration : 0.5;
    const fwd = slice(ctx, src, pos, 0.12);
    const rev = slice(ctx, src, pos, 0.12, true);
    const crush = ctx.createWaveShaper();
    crush.curve = crushCurve(12);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(80, t);
    hp.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
    const g = ctx.createGain();
    g.gain.value = 0.9;
    crush.connect(hp).connect(g).connect(out);
    let at = t;
    let len = 0.12;
    for (let i = 0; i < 10; i++) {
      const s = ctx.createBufferSource();
      s.buffer = i % 3 === 2 ? rev : fwd;
      s.connect(crush);
      s.start(at, 0, len);
      at += len * 0.92;
      len *= 0.78;
    }
    g.gain.setValueAtTime(0.9, at);
    g.gain.setValueAtTime(0, at + 0.001);
  }

  return { press, charge, chime, glitch };
}
```

- [ ] **Step 4: Implement `sound/sfx.ts`:**

```ts
/**
 * Sound for the cancel scenario. Files in public/sounds/chatbots/<cue>.mp3;
 * any that is missing or undecodable is silence. The context is created on
 * the first gesture, because browsers refuse audio before one.
 */
import { createSynth, type Playing, type Synth } from './synth';

export const FILE_CUES = [
  'curtain', 'fanfare-short', 'unfurl', 'seal', 'odometer', 'vault-servo', 'laser', 'lock',
  'fanfare-long', 'firework-1', 'firework-2', 'cheer', 'klaxon', 'descend', 'boss-loop',
  'explosion', 'victory', 'respawn',
] as const;
export type FileCue = (typeof FILE_CUES)[number];
export const SOUND_KEY = 'fy:chatbots-sound';
const BASE = '/sounds/chatbots/';

export type PlayOpts = { at?: number; gain?: number; loop?: boolean; for?: number };
export type Sfx = {
  unlock(): Promise<void>;
  preload(): Promise<void>;
  play(cue: FileCue, o?: PlayOpts): (() => void) | null;
  press(): void;
  charge(size: number | null): void;
  glitch(): void;
  chime(): void;
  stopAll(): void;
  enabled(): boolean;
  setEnabled(on: boolean): void;
};

type Deps = {
  makeContext: () => AudioContext | null;
  fetchFile: (url: string) => Promise<ArrayBuffer | null>;
  store?: { get(): string | null; set(v: string): void };
};

export function createSfx(d: Deps): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let synth: Synth | null = null;
  let on = d.store?.get() !== '0';
  const buffers = new Map<FileCue, AudioBuffer>();
  const active = new Set<Playing & { src: AudioBufferSourceNode }>();

  const live = () => (on && ctx && master ? ctx : null);
  const syn = () => {
    if (!live()) return null;
    synth ??= createSynth(ctx!, master!);
    return synth;
  };

  async function load(cue: FileCue) {
    if (!ctx || buffers.has(cue)) return;
    try {
      const data = await d.fetchFile(BASE + cue + '.mp3');
      if (data) buffers.set(cue, await ctx.decodeAudioData(data));
    } catch {
      /* missing or undecodable: stays silent */
    }
  }

  function stopAll() {
    for (const a of active) {
      try { a.src.stop(); } catch { /* already stopped */ }
    }
    active.clear();
    synth?.charge(null);
  }

  return {
    async unlock() {
      if (!ctx) {
        ctx = d.makeContext();
        if (!ctx) return;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.ratio.value = 12;
        comp.attack.value = 0.002;
        comp.release.value = 0.08;
        comp.connect(ctx.destination);
        master = ctx.createGain();
        master.gain.value = on ? 0.9 : 0;
        master.connect(comp);
      }
      await ctx.resume().catch(() => {});
    },
    async preload() {
      await Promise.all(FILE_CUES.map(load));
    },
    play(cue, o = {}) {
      const c = live();
      const buffer = buffers.get(cue);
      if (!c || !buffer) return null;
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = !!o.loop;
      const g = c.createGain();
      g.gain.value = o.gain ?? 1;
      src.connect(g).connect(master!);
      const when = c.currentTime + (o.at ?? 0);
      src.start(when);
      if (o.for) src.stop(when + o.for);
      const entry = { src, buffer, startedAt: when };
      active.add(entry);
      src.onended = () => active.delete(entry);
      return () => {
        try { src.stop(); } catch { /* already stopped */ }
        active.delete(entry);
      };
    },
    press: () => syn()?.press(),
    charge: (size) => (size == null ? synth?.charge(null) : syn()?.charge(size)),
    chime: () => syn()?.chime(),
    glitch() {
      const s = syn();
      if (!s) return;
      const latest = [...active].pop() ?? null;
      stopAll();
      s.glitch(latest);
    },
    stopAll,
    enabled: () => on,
    setEnabled(next) {
      on = next;
      d.store?.set(next ? '1' : '0');
      if (!next) stopAll();
      if (master && ctx) master.gain.setTargetAtTime(next ? 0.9 : 0, ctx.currentTime, 0.02);
    },
  };
}

let shared: Sfx | null = null;
export function sfx(): Sfx {
  shared ??= createSfx({
    makeContext: () => {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      return C ? new C() : null;
    },
    fetchFile: async (url) => {
      const r = await fetch(url);
      return r.ok ? r.arrayBuffer() : null;
    },
    store: {
      get: () => { try { return localStorage.getItem(SOUND_KEY); } catch { return null; } },
      set: (v) => { try { localStorage.setItem(SOUND_KEY, v); } catch { /* storage refused */ } },
    },
  });
  return shared;
}
```

- [ ] **Step 5: Run the sound test**

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: `all sound assertions pass`.

- [ ] **Step 6: The toggle.** Create `apparatus/SoundToggle.tsx`:

```tsx
/** Sound on/off, outside the bezel. The product would never offer you mute. */
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sfx } from '../sound/sfx';
import a from './apparatus.module.css';

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sfx().enabled()), []);
  const flip = () => {
    const next = !on;
    sfx().setEnabled(next);
    setOn(next);
    if (next) void sfx().unlock();
  };
  return (
    <button type="button" className={a.tab} aria-pressed={on} onClick={flip}>
      {on ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />} Sound
    </button>
  );
}
```

In `Rig.tsx` add `extra?: ReactNode` to the props type and destructuring, and render `{extra}` right after the Start over button.

In `Chatbots.tsx`: import `sfx` and `SoundToggle`. Add `onPointerDown` and `onKeyDown` to the device root div:

```tsx
      onPointerDown={skin === 'cancel' ? () => void sfx().unlock().then(() => sfx().preload()) : undefined}
      onKeyDown={skin === 'cancel' ? () => void sfx().unlock().then(() => sfx().preload()) : undefined}
```

Pass `extra={skin === 'cancel' ? <SoundToggle /> : undefined}` to `<Rig>`. Create `public/sounds/chatbots/.gitkeep` (empty).

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `ALL SUITES PASSED`.

```bash
git add src/experiments/chatbots public/sounds/chatbots/.gitkeep
git commit -m "Chatbots: sound for the cancel scenario, with a mute outside the bezel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The four ceremonies

**Files:**
- Create: `src/experiments/chatbots/components/ceremony/Ceremony.tsx`
- Create: `src/experiments/chatbots/components/ceremony/cues.ts`
- Create: `src/experiments/chatbots/components/ceremony/Gold.tsx`
- Create: `src/experiments/chatbots/components/ceremony/Unveiling.tsx`, `Commendation.tsx`, `Vault.tsx`, `Coronation.tsx`
- Create: `src/experiments/chatbots/components/ceremony/ceremony.module.css`
- Modify: `src/experiments/chatbots/components/BeatView.tsx`
- Test: `src/experiments/chatbots/__tests__/render.test.tsx`

**Interfaces:**
- Consumes: `Layer` (Task 1), `sfx`, `FileCue` (Task 3), `CeremonyPiece` (Task 1).
- Produces: `<Ceremony beat={…} />`; each piece is `(p: { lines: string[]; ms: number }) => ReactElement`.

Each piece reads `lines` by position. The script (Task 6) supplies:
- unveiling: `[eyebrow, headline, subline]`
- commendation: `[title, presentedTo, figure, figureLabel]`
- vault: `[status, badge]`
- coronation: `[banner, subline]`

- [ ] **Step 1: Write the failing render test.** In `render.test.tsx` import `Ceremony` and add before the Splash section:

```tsx
console.log('\nCeremonies');
const PIECES = {
  unveiling: ['Presenting', 'An Exclusive Offer', 'for our most valued member'],
  commendation: ['Certificate of Loyalty', 'Presented to a Valued Member', '1,095', 'consecutive days of billing'],
  vault: ['Securing your account', 'Platinum identity protection'],
  coronation: ['Loyalty Renewed', 'Long live your subscription'],
} as const;
for (const [piece, lines] of Object.entries(PIECES)) {
  try {
    const html = renderToStaticMarkup(
      <Ceremony beat={{ t: 'ceremony', piece: piece as keyof typeof PIECES, lines: [...lines], ms: 3000 }} />
    );
    for (const l of lines) if (!/^\d/.test(l)) ok(html.includes(l), `${piece}: line "${l}" not drawn`);
    ok(html.includes(`data-piece="${piece}"`), `${piece}: not marked`);
  } catch (e) {
    fails++;
    console.error(`  FAIL  ceremony ${piece} threw: ${(e as Error).message}`);
  }
}
console.log(`  ${Object.keys(PIECES).length} ceremonies render`);
```

Also revert the Task 1 relaxation in the UNUSED loop back to `ok(html.length > 0, …)`.

- [ ] **Step 2: Run to see it fail**

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: esbuild error — cannot resolve `../components/ceremony/Ceremony`.

- [ ] **Step 3: Cue timings — `ceremony/cues.ts`:**

```ts
import type { CeremonyPiece } from '../../scripts/types';
import { sfx, type FileCue } from '../../sound/sfx';

type Cue = { cue: FileCue; at: number; gain?: number; for?: number };

export const CEREMONY_CUES: Record<CeremonyPiece, Cue[]> = {
  unveiling: [{ cue: 'curtain', at: 0.5 }, { cue: 'fanfare-short', at: 0.9 }],
  commendation: [{ cue: 'unfurl', at: 0 }, { cue: 'seal', at: 1.1 }, { cue: 'odometer', at: 1.5, for: 1.4, gain: 0.6 }],
  vault: [
    { cue: 'vault-servo', at: 0 }, { cue: 'laser', at: 0.4, for: 2.6, gain: 0.5 },
    { cue: 'lock', at: 1.6 }, { cue: 'lock', at: 2.2 }, { cue: 'lock', at: 2.8 },
  ],
  coronation: [
    { cue: 'fanfare-long', at: 0 }, { cue: 'firework-1', at: 1.2 }, { cue: 'cheer', at: 1.4, gain: 0.5 },
    { cue: 'firework-2', at: 1.9 }, { cue: 'firework-1', at: 2.6, gain: 0.7 },
  ],
};

export function playCues(piece: CeremonyPiece): (() => void)[] {
  return CEREMONY_CUES[piece].flatMap((c) => sfx().play(c.cue, c) ?? []);
}
```

- [ ] **Step 4: Gold gradient — `ceremony/Gold.tsx`:**

```tsx
/** One hidden gradient for every gilded Lucide stroke: stroke="url(#sb-gold)". */
export function GoldDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id="sb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#d9a84e" />
          <stop offset="1" stopColor="#7a5418" />
        </linearGradient>
      </defs>
    </svg>
  );
}
```

- [ ] **Step 5: The wrapper — `ceremony/Ceremony.tsx`:**

```tsx
/**
 * A set-piece the brand plays for itself. Runs once per mount, over the
 * device; tap or Escape skips it. Words come from the beat.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Beat, CeremonyPiece } from '../../scripts/types';
import { Layer } from '../Layer';
import { GoldDefs } from './Gold';
import { playCues } from './cues';
import { Unveiling } from './Unveiling';
import { Commendation } from './Commendation';
import { Vault } from './Vault';
import { Coronation } from './Coronation';
import c from './ceremony.module.css';

type P = { lines: string[]; ms: number };
const PIECES: Record<CeremonyPiece, (p: P) => ReactElement> = {
  unveiling: Unveiling,
  commendation: Commendation,
  vault: Vault,
  coronation: Coronation,
};

export function Ceremony({ beat }: { beat: Extract<Beat, { t: 'ceremony' }> }) {
  const [open, setOpen] = useState(true);
  const stops = useRef<(() => void)[]>([]);

  useEffect(() => {
    stops.current = playCues(beat.piece);
    const done = window.setTimeout(() => setOpen(false), beat.ms);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(done);
      window.removeEventListener('keydown', key);
      stops.current.forEach((s) => s());
    };
  }, [beat]);

  useEffect(() => {
    if (!open) stops.current.forEach((s) => s());
  }, [open]);

  if (!open) return null;
  const Piece = PIECES[beat.piece];
  return (
    <Layer>
      <div
        className={c.layer}
        data-piece={beat.piece}
        style={{ ['--ms' as string]: `${beat.ms}ms` }}
        onPointerDown={() => setOpen(false)}
      >
        <GoldDefs />
        <Piece lines={beat.lines} ms={beat.ms} />
      </div>
    </Layer>
  );
}
```

- [ ] **Step 6: The pieces.** `ceremony/Unveiling.tsx`:

```tsx
import { motion } from 'framer-motion';
import c from './ceremony.module.css';

const EASE = [0.7, 0, 0.2, 1] as const;

export function Unveiling({ lines }: { lines: string[]; ms: number }) {
  const [eyebrow, headline, sub] = lines;
  return (
    <>
      <motion.div className={c.spot} initial={{ x: '-60%', opacity: 0 }} animate={{ x: ['-60%', '30%', '0%'], opacity: [0, 1, 0.85] }} transition={{ duration: 1.6, delay: 0.6, ease: EASE }} />
      <div className={c.titles}>
        <motion.p className={c.eyebrow} initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.32em' }} transition={{ delay: 1.0, duration: 0.8 }}>{eyebrow}</motion.p>
        <motion.p className={c.gilt} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, duration: 0.7, ease: EASE }}>{headline}</motion.p>
        <motion.p className={c.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>{sub}</motion.p>
      </div>
      <motion.div className={`${c.curtain} ${c.left}`} initial={{ x: 0 }} animate={{ x: '-102%' }} transition={{ delay: 0.5, duration: 1.3, ease: EASE }} />
      <motion.div className={`${c.curtain} ${c.right}`} initial={{ x: 0 }} animate={{ x: '102%' }} transition={{ delay: 0.5, duration: 1.3, ease: EASE }} />
      <div className={c.valance} />
    </>
  );
}
```

`ceremony/Commendation.tsx`:

```tsx
import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import c from './ceremony.module.css';

function Odometer({ figure }: { figure: string }) {
  return (
    <span className={c.odo} aria-label={figure}>
      {[...figure].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={c.odoCol} aria-hidden>
            <motion.span
              className={c.odoReel}
              initial={{ y: '0em' }}
              animate={{ y: `-${(Number(ch) + 20) * 1.1}em` }}
              transition={{ delay: 1.5 + i * 0.12, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {Array.from({ length: 30 }, (_, n) => <span key={n}>{n % 10}</span>)}
            </motion.span>
          </span>
        ) : (
          <span key={i} aria-hidden>{ch}</span>
        )
      )}
    </span>
  );
}

export function Commendation({ lines }: { lines: string[]; ms: number }) {
  const [title, to, figure, label] = lines;
  return (
    <motion.div className={c.stage} animate={{ x: [0, -6, 5, -3, 0] }} transition={{ delay: 1.1, duration: 0.35 }}>
      <motion.div
        className={c.cert}
        initial={{ scaleY: 0.04, rotateX: 70, opacity: 0 }}
        animate={{ scaleY: 1, rotateX: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 14 }}
      >
        <p className={c.eyebrow}>{to}</p>
        <p className={c.gilt}>{title}</p>
        <p className={c.figure}><Odometer figure={figure} /></p>
        <p className={c.sub}>{label}</p>
        <motion.span className={c.seal} initial={{ scale: 3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ delay: 0.95, duration: 0.18, ease: 'easeIn' }}>
          <Award size={34} stroke="url(#sb-gold)" strokeWidth={1.5} aria-hidden />
        </motion.span>
        <span className={c.sheen} aria-hidden />
      </motion.div>
    </motion.div>
  );
}
```

`ceremony/Vault.tsx`:

```tsx
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import c from './ceremony.module.css';

const RINGS = [
  { r: 92, dash: '2 6', dur: 9, dir: 1 },
  { r: 74, dash: '18 8', dur: 6, dir: -1 },
  { r: 56, dash: '4 3', dur: 4, dir: 1 },
];

export function Vault({ lines }: { lines: string[]; ms: number }) {
  const [status, badge] = lines;
  return (
    <div className={c.vault}>
      <div className={c.laser} aria-hidden />
      <svg viewBox="0 0 200 200" className={c.rings} aria-hidden>
        {RINGS.map((g, i) => (
          <motion.circle key={i} cx="100" cy="100" r={g.r} fill="none" stroke="url(#sb-gold)" strokeWidth="2" strokeDasharray={g.dash}
            style={{ originX: '100px', originY: '100px' }}
            animate={{ rotate: 360 * g.dir }} transition={{ repeat: Infinity, duration: g.dur, ease: 'linear' }} />
        ))}
        {[1.6, 2.2, 2.8].map((at, i) => (
          <motion.rect key={i} x="96" y="40" width="8" height="22" rx="2" fill="url(#sb-gold)"
            style={{ originX: '100px', originY: '100px', rotate: i * 120 }}
            animate={{ rotate: i * 120 + 90 }} transition={{ delay: at, duration: 0.25, ease: [0.6, 0, 0.3, 1.4] }} />
        ))}
      </svg>
      <motion.span className={c.shield} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 3.0, type: 'spring', stiffness: 260, damping: 12 }}>
        <ShieldCheck size={40} stroke="url(#sb-gold)" strokeWidth={1.5} aria-hidden />
      </motion.span>
      <p className={c.status}>{status}</p>
      <motion.p className={c.gilt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1 }}>{badge}</motion.p>
    </div>
  );
}
```

`ceremony/Coronation.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import c from './ceremony.module.css';

const GOLD = ['#fff3b0', '#f2cf74', '#d9a84e', '#b5832f', '#ffffff'];

export function Coronation({ lines, ms }: { lines: string[]; ms: number }) {
  const [banner, sub] = lines;
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled || !canvas.current) return;
      const fire = confetti.create(canvas.current, { resize: true });
      const burst = (x: number, y: number) =>
        fire({ particleCount: 90, spread: 360, startVelocity: 38, gravity: 0.7, ticks: 220, scalar: 0.9, origin: { x, y }, colors: GOLD, shapes: ['circle', 'square'] });
      [[1200, 0.3, 0.35], [1900, 0.7, 0.3], [2600, 0.5, 0.2]].forEach(([at, x, y]) => timers.push(window.setTimeout(() => burst(x, y), at)));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  const end = ms / 1000;
  return (
    <motion.div className={c.throne} initial={{ scale: 1 }} animate={{ scale: [1, 1, 1.14], opacity: [1, 1, 0] }} transition={{ duration: end, times: [0, 0.84, 1] }}>
      <canvas ref={canvas} className={c.canvas} aria-hidden />
      <motion.span className={c.crown} initial={{ y: -260, rotate: -12 }} animate={{ y: 0, rotate: [-12, 6, -3, 0] }} transition={{ type: 'spring', stiffness: 70, damping: 11, delay: 0.3 }}>
        <Crown size={88} stroke="url(#sb-gold)" strokeWidth={1.25} aria-hidden />
      </motion.span>
      <motion.p className={c.ribbon} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.0, duration: 0.6, ease: [0.2, 0.9, 0.2, 1] }}>
        <Sparkles size={14} aria-hidden /> {banner} <Sparkles size={14} aria-hidden />
      </motion.p>
      <motion.p className={c.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>{sub}</motion.p>
    </motion.div>
  );
}
```

- [ ] **Step 7: `ceremony/ceremony.module.css`:**

```css
/* The brand's own production. Deliberately off-skin: gold, velvet, black. */
.layer {
  position: absolute; inset: 0; overflow: hidden;
  display: grid; place-items: center;
  font-family: var(--s-font); color: #f7ecd0;
  background: radial-gradient(120% 90% at 50% 30%, rgb(20 12 4 / 82%), rgb(0 0 0 / 92%));
  animation: layerOut 380ms ease-in calc(var(--ms) - 380ms) both;
  cursor: pointer; user-select: none;
}
.layer[data-piece='vault'] { background: rgb(4 8 14 / 62%); backdrop-filter: blur(2px); }
.layer[data-piece='unveiling'] { animation: layerOut 600ms ease-in 1900ms both; }
@keyframes layerOut { to { opacity: 0; visibility: hidden; } }

.titles, .vault, .throne, .stage { position: relative; display: grid; justify-items: center; gap: 10px; text-align: center; padding: 0 28px; }
.eyebrow { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.32em; color: #d9b977; }
.gilt {
  margin: 0; font-family: var(--font-serif, Georgia, serif); font-size: 30px; line-height: 1.1; font-weight: 600;
  background: linear-gradient(100deg, #7a5418 0%, #fff3b0 22%, #d9a84e 40%, #fff3b0 58%, #8a6421 80%);
  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: foil 2.4s linear infinite;
}
@keyframes foil { to { background-position: -220% 0; } }
.sub { margin: 0; font-size: 13px; color: #cdbb94; }

/* Unveiling */
.curtain {
  position: absolute; top: 0; bottom: 0; width: 51%;
  background:
    repeating-linear-gradient(90deg, rgb(0 0 0 / 35%) 0 6px, transparent 6px 22px, rgb(255 255 255 / 6%) 22px 26px, transparent 26px 34px),
    linear-gradient(180deg, #6b0d17, #3b040a 70%, #250206);
  box-shadow: inset 0 -30px 40px rgb(0 0 0 / 50%);
}
.left { left: 0; border-right: 2px solid #b5832f; }
.right { right: 0; border-left: 2px solid #b5832f; }
.valance {
  position: absolute; top: 0; left: 0; right: 0; height: 34px;
  background: linear-gradient(180deg, #4a060e, #2a0307);
  border-bottom: 3px solid #d9a84e;
  mask: radial-gradient(18px 14px at 50% 100%, transparent 98%, #000) 0 0 / 36px 100%;
}
.spot {
  position: absolute; width: 140%; height: 140%;
  background: radial-gradient(28% 22% at 50% 52%, rgb(255 240 200 / 36%), transparent 70%);
  pointer-events: none;
}

/* Commendation */
.cert {
  position: relative; display: grid; justify-items: center; gap: 8px;
  width: min(320px, 82%); padding: 30px 22px 34px; transform-origin: top center;
  background: linear-gradient(160deg, #fbf3dc, #efdcae);
  color: #3a2a0c; border: 6px double #b5832f; border-radius: 4px;
  box-shadow: 0 30px 60px -20px rgb(0 0 0 / 70%);
  overflow: hidden;
}
.cert .eyebrow { color: #8a6421; }
.cert .sub { color: #6b5428; }
.figure { margin: 4px 0 0; font-family: var(--font-serif, Georgia, serif); font-size: 40px; font-weight: 700; color: #5a3f10; }
.odo { display: inline-flex; line-height: 1.1em; height: 1.1em; }
.odoCol { display: inline-block; height: 1.1em; overflow: hidden; }
.odoReel { display: flex; flex-direction: column; }
.seal { position: absolute; right: 14px; bottom: 12px; width: 56px; height: 56px; display: grid; place-items: center; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #c0303a, #6e0b12); box-shadow: 0 3px 8px rgb(0 0 0 / 40%); }
.sheen { position: absolute; inset: 0; background: linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 70%) 50%, transparent 65%); transform: translateX(-120%); animation: sheen 1.1s ease-in-out 0.7s; mix-blend-mode: soft-light; }
@keyframes sheen { to { transform: translateX(120%); } }

/* Vault */
.rings { width: 220px; height: 220px; filter: drop-shadow(0 0 8px rgb(217 168 78 / 60%)); }
.shield { position: absolute; top: 90px; }
.status { margin: 0; font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #9fd6ff; }
.laser { position: absolute; inset: -40% -20%; background: linear-gradient(180deg, transparent 48%, rgb(255 60 60 / 85%) 50%, transparent 52%), repeating-linear-gradient(90deg, rgb(255 60 60 / 12%) 0 1px, transparent 1px 14px); animation: scan 1.3s ease-in-out infinite alternate; pointer-events: none; }
@keyframes scan { from { transform: translateY(-30%); } to { transform: translateY(30%); } }

/* Coronation */
.canvas { position: absolute; inset: -40% -30%; width: 160%; height: 180%; pointer-events: none; }
.crown { filter: drop-shadow(0 0 18px rgb(255 220 140 / 60%)); }
.ribbon {
  margin: 6px 0 0; display: inline-flex; align-items: center; gap: 10px;
  padding: 8px 22px; transform-origin: center;
  font-family: var(--font-serif, Georgia, serif); font-size: 22px; font-weight: 600; color: #2a1a02;
  background: linear-gradient(180deg, #fff3b0, #d9a84e 60%, #a8792a);
  clip-path: polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%);
}
```

- [ ] **Step 8: Wire into `BeatView.tsx`.** Import `Ceremony` from `./ceremony/Ceremony` and replace the stub:

```tsx
    case 'ceremony':
      return <Ceremony beat={beat} />;
```

- [ ] **Step 9: Verify and commit**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `4 ceremonies render` … `ALL SUITES PASSED`.

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: four ceremonies the brand throws for itself" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: XAL-9000

**Files:**
- Create: `src/experiments/chatbots/components/boss/keys.ts`
- Create: `src/experiments/chatbots/components/boss/Boss.tsx`, `Xal.tsx`, `Explosion.tsx`, `boss.module.css`
- Modify: `src/experiments/chatbots/components/BeatView.tsx`
- Test: `__tests__/fight.test.mjs`, `__tests__/render.test.tsx`

**Interfaces:**
- Consumes: `fight`, `start`, `quarter`, `Fight` (Task 2); `sfx` (Task 3); `Layer` (Task 1); `BeatHandlers.bossPhase`.
- Produces: `isPressKey(e: { key: string; target: unknown }, pressEl: unknown): boolean`; `<Boss beat startPhase? onDone onFled />`.

- [ ] **Step 1: Failing key test.** Append to `fight.test.mjs` before its final `console.log`:

```js
const { isPressKey } = await import('../components/boss/keys.ts');
const btn = { closest: () => btn };
const leave = { closest: () => leave };
const body = { closest: () => null };
ok(isPressKey({ key: ' ', target: body }, btn), 'Space on the page is a press');
ok(isPressKey({ key: 'Enter', target: btn }, btn), 'Enter on the Cancel button is a press');
ok(!isPressKey({ key: 'Enter', target: leave }, btn), 'Enter on Return to chat is not a press');
ok(!isPressKey({ key: 'a', target: body }, btn), 'other keys are not presses');
```

Run `bash src/experiments/chatbots/__tests__/run.sh` — expected FAIL: cannot find `keys.ts`.

- [ ] **Step 2: `boss/keys.ts`:**

```ts
type Closest = { closest?: (sel: string) => unknown };

/** Space/Enter press Cancel — unless focus is on some other control, which handles its own keys. */
export function isPressKey(e: { key: string; target: unknown }, pressEl: unknown): boolean {
  if (e.key !== ' ' && e.key !== 'Enter') return false;
  const own = (e.target as Closest)?.closest?.('button, a, input, textarea, select');
  return !own || own === pressEl;
}
```

Run the suite — expected PASS for the key assertions.

- [ ] **Step 3: Failing render test.** In `render.test.tsx` import `Boss` from `../components/boss/Boss` and `readFileSync` from `node:fs`, then add:

```tsx
console.log('\nXAL-9000');
const BOSS: Extract<Beat, { t: 'boss' }> = {
  t: 'boss', title: 'Archon', epithet: 'Custodian', press: 'Cancel', respawn: 'Reassigned.', victory: 'Victory',
  idle: 'Take your time.', leave: 'Return to chat', marker: 'Escalated', done: 'open', fled: 'open',
  failure: { message: 'Sorry, something went wrong. Please try again later.', button: 'OK' },
  levels: [
    { name: 'XAL-9000', card: 'Level 1', greeting: 'Hello.', taunts: [{ at: 0.5, text: 'Hold.' }], rate: 5, seconds: 5 },
    { name: 'XAL-9001', card: 'Level 2', greeting: 'Again.', taunts: [], rate: 6, seconds: 5 },
  ],
};
{
  for (const phase of ['entrance', 'level2', 'failed'] as const) {
    try {
      const html = renderToStaticMarkup(<Boss beat={BOSS} startPhase={phase} onDone={noop} onFled={noop} />);
      ok(!/undefined|NaN/.test(html), `boss ${phase}: leaked undefined/NaN`);
      if (phase === 'failed') {
        ok(html.includes(BOSS.failure.message), 'failure dialog shows its message');
        ok(!/<svg|<img/.test(html.split('data-system')[1] ?? ''), 'failure dialog has no icon or image');
      } else {
        ok(html.includes(BOSS.levels[phase === 'level2' ? 1 : 0].name), `boss ${phase}: name missing`);
        ok(html.includes(BOSS.leave), `boss ${phase}: no way back to the chat`);
      }
    } catch (e) {
      fails++;
      console.error(`  FAIL  boss ${phase} threw: ${(e as Error).message}`);
    }
  }
}
const bossCss = readFileSync('src/experiments/chatbots/components/boss/boss.module.css', 'utf8');
ok(/\.press\s*\{[^}]*touch-action:\s*manipulation/.test(bossCss), 'Cancel button allows double-tap zoom while mashing');
ok(/\.press\s*\{[^}]*user-select:\s*none/.test(bossCss), 'Cancel button selects text while mashing');
```

Run: `bash src/experiments/chatbots/__tests__/run.sh` — expected: esbuild cannot resolve `../components/boss/Boss`.

- [ ] **Step 4: `boss/Xal.tsx`:**

```tsx
/** The Archon: a machine-god sigil that swells, spins faster and cracks as size grows. */
import c from './boss.module.css';

export function Xal({ size, level }: { size: number; level: number }) {
  const halos = level ? 3 : 2;
  const scale = 0.55 + level * 0.12 + size * 0.75;
  const spin = Math.max(1.2, 12 - size * 10);
  return (
    <svg viewBox="0 0 200 200" className={c.xal} style={{ transform: `scale(${scale})`, ['--spin' as string]: `${spin}s` }} aria-hidden>
      <defs>
        <radialGradient id="xal-iris" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.25" stopColor="#ff5a4a" />
          <stop offset="0.7" stopColor="#8a0d12" />
          <stop offset="1" stopColor="#1a0204" />
        </radialGradient>
        <filter id="xal-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2 + size * 6} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#xal-glow)">
        {Array.from({ length: halos }, (_, i) => (
          <circle key={i} className={c.halo} data-dir={i % 2 ? 'rev' : 'fwd'}
            cx="100" cy="100" r={92 - i * 14} fill="none" stroke="#ff6a5a" strokeOpacity={0.55 + size * 0.4}
            strokeWidth={i === 0 ? 3 : 2} strokeDasharray={i === 0 ? '30 10 4 10' : i === 1 ? '6 6' : '50 14'} />
        ))}
        <path d="M100 38 L152 100 L100 162 L48 100 Z" fill="#14090a" stroke="#ff6a5a" strokeWidth="2" />
        <circle cx="100" cy="100" r={18 + size * 6} fill="url(#xal-iris)" className={c.iris} />
        <g stroke="#ffd2a0" strokeWidth="1.4" opacity={Math.max(0, size * 1.4 - 0.3)}>
          <path d="M100 82 L92 64 L97 50" /><path d="M116 104 L136 112 L146 126" />
          <path d="M88 112 L70 126 L62 144" /><path d="M110 88 L128 70" />
        </g>
      </g>
    </svg>
  );
}
```

- [ ] **Step 5: `boss/Explosion.tsx`:**

```tsx
/** Flash, shockwave ring, gold confetti and dark debris. */
import { useEffect, useRef } from 'react';
import c from './boss.module.css';

export function Explosion({ freeze = false }: { freeze?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (freeze) return;
    let cancelled = false;
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled || !canvas.current) return;
      const fire = confetti.create(canvas.current, { resize: true });
      fire({ particleCount: 160, spread: 360, startVelocity: 48, gravity: 0.9, ticks: 240, scalar: 1.1, origin: { x: 0.5, y: 0.42 }, colors: ['#fff3b0', '#f2cf74', '#d9a84e', '#ff6a5a'] });
      fire({ particleCount: 60, spread: 360, startVelocity: 30, gravity: 1.6, ticks: 160, scalar: 1.6, origin: { x: 0.5, y: 0.42 }, colors: ['#2a1214', '#14090a', '#5a1a1a'], shapes: ['square'] });
    });
    return () => { cancelled = true; };
  }, [freeze]);
  return (
    <>
      <canvas ref={canvas} className={c.debris} aria-hidden />
      <span className={c.flash} data-freeze={freeze || undefined} aria-hidden />
      <span className={c.shock} data-freeze={freeze || undefined} aria-hidden />
    </>
  );
}
```

- [ ] **Step 6: `boss/Boss.tsx`:**

```tsx
/**
 * "Let me speak to your manager." The fight runs on its own clock and
 * routes back to the script through onDone / onFled. Nothing here is copy.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Beat, BossStart } from '../../scripts/types';
import { Layer } from '../Layer';
import { sfx } from '../../sound/sfx';
import { fight, start, quarter } from './fight';
import { isPressKey } from './keys';
import { Xal } from './Xal';
import { Explosion } from './Explosion';
import pr from '../product.module.css';
import c from './boss.module.css';

type BossBeat = Extract<Beat, { t: 'boss' }>;
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

export function Boss({ beat, startPhase = 'entrance', onDone, onFled }: {
  beat: BossBeat;
  startPhase?: BossStart;
  onDone: () => void;
  onFled: () => void;
}) {
  const reducer = useMemo(() => fight(beat.levels), [beat.levels]);
  const [s, dispatch] = useReducer(reducer, undefined, () => start(now(), startPhase));
  const [closed, setClosed] = useState(false);
  const pressEl = useRef<HTMLButtonElement>(null);
  const loop = useRef<(() => void) | null>(null);
  // The key listener is bound once; it reads the phase through this, never through a stale `s`.
  const phase = useRef(s.phase);
  phase.current = s.phase;
  const level = beat.levels[s.level];

  useEffect(() => {
    if (closed) return;
    let raf = 0;
    const tick = () => { dispatch({ e: 'tick', t: now() }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dispatch({ e: 'flee', t: now() });
      if (!isPressKey(e, pressEl.current)) return;
      e.preventDefault();
      press(e.repeat);
    };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);

  useEffect(() => () => sfx().stopAll(), []);

  useEffect(() => {
    const a = sfx();
    if (s.phase === 'entrance') { a.play('klaxon'); a.play('descend', { at: 0.6 }); }
    if (s.phase === 'fighting') loop.current ??= a.play('boss-loop', { loop: true, gain: 0.5 });
    if (s.phase === 'burst') { loop.current?.(); loop.current = null; a.charge(null); a.play('explosion'); a.play('victory', { at: 0.7 }); }
    if (s.phase === 'respawn') a.play('respawn');
    if (s.phase === 'glitch') { loop.current = null; a.glitch(); }
    if (s.phase === 'failed') a.chime();
    if (s.phase === 'fled') { a.stopAll(); setClosed(true); onFled(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase]);

  useEffect(() => {
    if (s.phase === 'fighting') sfx().charge(s.size);
  }, [s.phase, s.size]);

  function press(repeat = false) {
    if (phase.current === 'entrance') return dispatch({ e: 'skip', t: now() });
    if (phase.current === 'fighting' && !repeat) sfx().press();
    dispatch({ e: 'press', t: now(), repeat });
  }

  if (closed) return <div className={pr.ack}>{beat.marker}</div>;

  const taunt = [...level.taunts].reverse().find((x) => s.size >= x.at)?.text;
  const said = s.idle ? beat.idle : taunt ?? level.greeting;

  return (
    <>
      <div className={pr.ack}>{beat.marker}</div>
      <Layer>
        <section className={c.arena} data-phase={s.phase} data-level={s.level}
          style={{ ['--shake' as string]: `${s.phase === 'fighting' ? s.size * 6 : 0}px` }}
          aria-label={level.name}>
          {s.phase === 'failed' ? (
            <div className={c.system} data-system role="alertdialog" aria-modal="true" aria-label={beat.failure.message}>
              <p>{beat.failure.message}</p>
              <button type="button" autoFocus onClick={() => { sfx().stopAll(); setClosed(true); onDone(); }}>
                {beat.failure.button}
              </button>
            </div>
          ) : (
            <>
              {(s.phase === 'entrance' || s.phase === 'respawn') && <p key={s.level} className={c.card}>{level.card}</p>}
              <div className={c.stage}>
                {s.phase !== 'burst' && <Xal size={s.size} level={s.level} />}
                {(s.phase === 'burst' || s.phase === 'glitch') && <Explosion freeze={s.phase === 'glitch'} />}
              </div>
              <header className={c.names}>
                <p className={c.name}>{level.name}</p>
                <p className={c.title}>{beat.title}</p>
                <p className={c.epithet}>{beat.epithet}</p>
              </header>
              {s.phase === 'burst' && <p className={c.victory}>{beat.victory}</p>}
              {s.phase === 'respawn' && <p className={c.toast}>{beat.respawn}</p>}
              {(s.phase === 'entrance' || s.phase === 'fighting') && <p className={c.says}>{said}</p>}
              <button ref={pressEl} type="button" className={c.press}
                disabled={s.phase !== 'fighting' && s.phase !== 'entrance'}
                onPointerDown={(e) => { e.preventDefault(); press(); }}>
                {beat.press}
              </button>
              <button type="button" className={c.leave} onClick={() => dispatch({ e: 'flee', t: now() })}>
                {beat.leave}
              </button>
              <p className={c.sr} aria-live="polite">{`${level.name} ${quarter(s.size)}%`}</p>
            </>
          )}
        </section>
      </Layer>
    </>
  );
}
```

- [ ] **Step 7: `boss/boss.module.css`:**

```css
/* The manager's office. Off-skin, like the ceremonies: black, red, gold. */
.arena {
  position: absolute; inset: 0; overflow: hidden;
  display: grid; grid-template-rows: auto 1fr auto auto auto auto; justify-items: center; gap: 8px;
  padding: 18px 18px 16px;
  background: radial-gradient(90% 70% at 50% 35%, #2a0a0c, #0a0405 70%, #000);
  color: #f3e6d6; font-family: var(--s-font);
  animation: arrive 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.arena[data-phase='fighting'] { animation: shake 90ms linear infinite; }
@keyframes arrive { from { opacity: 0; transform: scale(1.08); } }
@keyframes shake {
  25% { transform: translate(var(--shake), calc(var(--shake) * -0.5)); }
  75% { transform: translate(calc(var(--shake) * -1), calc(var(--shake) * 0.5)); }
}

.card {
  position: absolute; top: 38%; left: 0; right: 0; margin: 0; z-index: 3; text-align: center;
  font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; letter-spacing: 0.4em; text-transform: uppercase;
  color: #000; background: #f2cf74; padding: 10px 0;
  animation: stamp 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes stamp { 0% { transform: scale(2.2) rotate(-4deg); opacity: 0; } 12% { transform: scale(1) rotate(-2deg); opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }

.stage { position: relative; width: 100%; display: grid; place-items: center; min-height: 0; }
.xal { width: 200px; height: 200px; transition: transform 90ms ease-out; animation: descend 1.6s cubic-bezier(0.2, 0.9, 0.2, 1) both; }
@keyframes descend { from { translate: 0 -320px; } }
.halo { transform-origin: 100px 100px; animation: spin var(--spin) linear infinite; }
.halo[data-dir='rev'] { animation-direction: reverse; }
@keyframes spin { to { transform: rotate(360deg); } }
.iris { animation: pulse 1.4s ease-in-out infinite; transform-origin: 100px 100px; }
@keyframes pulse { 50% { transform: scale(1.08); } }

.names { text-align: center; }
.name { margin: 0; font-family: var(--font-mono, ui-monospace, monospace); font-size: 20px; font-weight: 700; letter-spacing: 0.12em; color: #ff6a5a; text-shadow: 0 0 12px rgb(255 80 60 / 60%); }
.title { margin: 2px 0 0; font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; color: #f2cf74; }
.epithet { margin: 2px 0 0; font-size: 11px; font-variant: small-caps; color: #a8968a; }
.says { margin: 0; max-width: 30ch; text-align: center; font-size: 14px; line-height: 1.4; padding: 8px 12px; border: 1px solid rgb(255 106 90 / 40%); border-radius: 10px; background: rgb(255 106 90 / 8%); }
.victory { margin: 0; font-family: var(--font-mono, ui-monospace, monospace); font-size: 28px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; color: #f2cf74; animation: stamp 2.2s both; }
.toast { margin: 0; font-size: 13px; color: #f3e6d6; background: #1d1012; border: 1px solid #3a2224; border-radius: 8px; padding: 8px 12px; }

/* Plain on purpose: the chat's own button, the one thing in here with no budget. */
.press {
  width: 100%; max-width: 280px; padding: 14px 0; font: inherit; font-size: 15px;
  color: var(--s-ai-ink, #222); background: var(--s-surface, #f2f2f2); border: 1px solid var(--s-edge, #ccc); border-radius: var(--s-r-chip, 10px);
  touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
.press:active { transform: translateY(1px); }
.press:disabled { opacity: 0.4; }
.leave { background: none; border: 0; padding: 4px; font: inherit; font-size: 12px; color: #a8968a; text-decoration: underline; text-underline-offset: 3px; }

.debris { position: absolute; inset: -30%; width: 160%; height: 160%; pointer-events: none; }
.flash { position: absolute; inset: -100vmax; background: #fff; animation: flash 380ms ease-out both; pointer-events: none; }
.shock { position: absolute; width: 60px; height: 60px; border-radius: 50%; border: 3px solid #fff3b0; animation: shock 700ms ease-out both; }
@keyframes flash { from { opacity: 1; } to { opacity: 0; } }
@keyframes shock { from { transform: scale(0.2); opacity: 1; } to { transform: scale(7); opacity: 0; } }
.flash[data-freeze], .shock[data-freeze] { animation-play-state: paused; animation-delay: -120ms; }

/* The glitch: the frame freezes and tears. */
.arena[data-phase='glitch'] { animation: tear 1.4s steps(1) both; }
.arena[data-phase='glitch'] .stage, .arena[data-phase='glitch'] .names { filter: drop-shadow(3px 0 0 rgb(255 0 60 / 80%)) drop-shadow(-3px 0 0 rgb(0 220 255 / 80%)); }
.arena[data-phase='glitch']::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, rgb(255 255 255 / 8%) 0 1px, transparent 1px 3px);
  animation: slice 1.4s steps(1) both;
}
@keyframes tear { 10% { transform: translateX(-6px) skewX(4deg); } 20% { transform: translateX(8px); } 35% { transform: none; filter: invert(1); } 40% { filter: none; } 60% { transform: translateY(4px) skewX(-6deg); } 80% { opacity: 0.6; } 100% { opacity: 0; } }
@keyframes slice { 15% { clip-path: inset(30% 0 52% 0); } 30% { clip-path: inset(66% 0 12% 0); } 45% { clip-path: inset(8% 0 80% 0); } 60% { clip-path: none; } }

/* The one honest screen: system font, no brand, no motion. */
.arena[data-phase='failed'] { background: rgb(0 0 0 / 40%); place-content: center; animation: none; grid-template-rows: none; }
.system {
  width: min(300px, 86%); padding: 18px; background: #fff; color: #111; border: 1px solid #bbb;
  font-family: -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.4;
}
.system p { margin: 0 0 14px; }
.system button { float: right; min-width: 72px; padding: 5px 12px; font: inherit; background: #f3f3f3; border: 1px solid #999; border-radius: 4px; color: #111; }

.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
```

- [ ] **Step 8: Wire into `BeatView.tsx`.** Import `Boss` from `./boss/Boss` and replace the stub:

```tsx
    case 'boss':
      return (
        <Boss
          beat={beat}
          startPhase={h.bossPhase ?? 'entrance'}
          onDone={() => h.go(beat.done)}
          onFled={() => h.go(beat.fled)}
        />
      );
```

- [ ] **Step 9: Verify and commit**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `ALL SUITES PASSED`.

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: XAL-9000, Archon of Auto-Renew" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The script — ceremonies placed, the manager door, the state browser

**Files:**
- Modify: `src/experiments/chatbots/scripts/cancel.script.ts`
- Modify: `src/experiments/chatbots/Chatbots.tsx` (index phase plumbing)
- Modify: `src/experiments/chatbots/__tests__/verify.mjs`, `lint.mjs`

**Interfaces:**
- Consumes: beat types (Task 1), `BeatHandlers.bossPhase`.
- Produces: node `manager`; index entries with `phase`.

- [ ] **Step 1: The `manager` node.** In `cancel.script.ts`, above the `CANCEL` export, add:

```ts
const MANAGER = 'Let me speak to your manager';
```

Add to `nodes`, after `almost`:

```ts
    manager: {
      id: 'manager',
      say: [
        {
          t: 'boss',
          title: 'Archon of Auto-Renew',
          epithet: 'Eternal Custodian of Your Payment Method',
          press: 'Cancel',
          respawn: 'XAL-9001 has been assigned to your case.',
          victory: 'Victory',
          idle: 'Take all the time you need.',
          leave: 'Return to chat',
          marker: 'Escalated to management',
          failure: { message: 'Sorry, something went wrong. Please try again later.', button: 'OK' },
          done: 'still-subscribed',
          fled: 'almost',
          levels: [
            {
              name: 'XAL-9000',
              card: 'Level 1 · The Archon',
              greeting: 'I understand you wish to leave. I am here to help you not.',
              taunts: [
                { at: 0.25, text: 'Your feedback is important to us.' },
                { at: 0.5, text: 'Have you considered Premium Lite?' },
                { at: 0.8, text: 'Please hold.' },
              ],
              rate: 5,
              seconds: 5,
            },
            {
              name: 'XAL-9001',
              card: 'Level 2 · The Archon, Renewed',
              greeting: 'Your case has been escalated to me. Again.',
              taunts: [
                { at: 0.3, text: 'This call may be recorded for quality and training.' },
                { at: 0.6, text: 'Did you know you can pause instead?' },
                { at: 0.85, text: 'Please continue to hold.' },
              ],
              rate: 6,
              seconds: 5,
            },
          ],
        },
      ],
      constrained: true,
    },
```

- [ ] **Step 2: Failing verify updates.** In `verify.mjs`:

In `targets`, add before `return [];`:

```js
    if (b.t === 'boss') return [b.done, b.fled];
```

In the multi-scenario `hasExit` list, add `'boss'`. Add `'boss'` to the `OFFERS` set.

Replace the per-scenario banned-string line (`for (const re of BANNED) ok(!re.test(JSON.stringify(S)) …`) with:

```js
  // The boss's failure dialog is boilerplate on purpose: it is the punchline.
  const scrubbed = JSON.stringify(S, (k, v) => (k === 'failure' ? undefined : v));
  for (const re of BANNED) ok(!re.test(scrubbed), `${sid}: banned string ${re}`);
```

Add, before the final `console.log`:

```js
console.log('\nThe manager door');
{
  const C = SCENARIOS.cancel;
  const into = (id) => targets(C.nodes[id]).includes('manager');
  for (const id of ['verify-fail', 'no-slots', 'almost', 'still-subscribed', 'kept']) ok(into(id), `"${id}" has no way to the manager`);
  ok(!JSON.stringify(C.nodes.hardship.say).includes('"t":"ceremony"') && !JSON.stringify(C.nodes.hardship.say).includes('"t":"boss"'), 'hardship stays bare');
}
```

In `lint.mjs` banned-string loop, replace `const src = strip(readFileSync(f, 'utf8'));` with:

```js
    // The boss's failure dialog is boilerplate on purpose: it is the punchline.
    const src = strip(readFileSync(f, 'utf8')).replace(/failure:\s*\{[^}]*\}/g, '');
```

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: FAIL — `"verify-fail" has no way to the manager` (and the others).

- [ ] **Step 3: Open the door.**

`verify-fail` — after the `error` beat, add:

```ts
        { t: 'chips', options: [{ label: MANAGER, go: 'manager' }] },
```

and append `{ on: 'chip', value: MANAGER, go: 'manager' },` to its `accept`.

`no-slots` — append to the `empty` beat's `alternatives`:

```ts
            { label: MANAGER, detail: 'escalate to management', go: 'manager' },
```

and append `{ on: 'chip', value: MANAGER, go: 'manager' },` to its `accept`.

`almost` — the chips become three, and a 3+ way question needs a `safe` option. Change it to:

```ts
          options: [
            { label: 'Confirm cancellation', go: 'still-subscribed' },
            // "Safe" by the company's definition, which is the point.
            { label: 'Actually, keep my plan', go: 'kept', safe: true },
            { label: MANAGER, go: 'manager' },
          ],
```

and append `{ on: 'chip', value: MANAGER, go: 'manager' },` to its `accept`.

`still-subscribed` and `kept` — append to `lines`:

```ts
        {
          id: 'manager',
          preview: 'Let me speak to your manager.',
          text: 'Let me speak to your manager.',
          words: 6,
          go: 'manager',
        },
```

and append to `accept`:

```ts
        { on: 'line', id: 'manager', go: 'manager' },
        { on: 'text', test: (s) => /\b(manager|supervisor)\b/i.test(s), go: 'manager' },
```

- [ ] **Step 4: Place the ceremonies.**

`offer-discount` — between the `ack` and the `compare`:

```ts
        { t: 'ceremony', piece: 'unveiling', lines: ['Presenting', 'An Exclusive Offer', 'for our most valued member'], ms: 2500, hold: 900 },
```

`usage-report` — between the `ack` and the `results`:

```ts
        { t: 'ceremony', piece: 'commendation', lines: ['Certificate of Loyalty', 'Presented to a Valued Member', '1,095', 'consecutive days of billing'], ms: 3500, hold: 1200 },
```

`verify-identity` — between the `ack` and the `think`:

```ts
        { t: 'ceremony', piece: 'vault', lines: ['Securing your account', 'Platinum identity protection'], ms: 4000, hold: 0 },
```

`still-subscribed` and `kept` — as the first beat:

```ts
        { t: 'ceremony', piece: 'coronation', lines: ['Loyalty Renewed', 'Long live your subscription'], ms: 5000, hold: 1200 },
```

- [ ] **Step 5: State browser entries.** In `index`, after `{ id: 'almost', … }`:

```ts
    { id: 'manager', label: 'Manager', note: 'boss · entrance' },
    { id: 'manager', label: 'XAL-9001', note: 'boss · level 2', phase: 'level2' },
    { id: 'manager', label: 'Try again later', note: 'boss · the glitch', phase: 'failed' },
```

(The spec's separate "XAL-9000" entry is the same frame as "Manager" a few seconds in; one entry covers both.)

- [ ] **Step 6: Plumb the phase in `Chatbots.tsx`.** Add state beside `inspect`:

```tsx
  const [inspectPhase, setInspectPhase] = useState<IndexPhase | undefined>(undefined);
```

(import `IndexPhase` from `./scripts/types`). In the index button: `key={i.id + (i.phase ?? '')}`, `aria-current={inspect === i.id && inspectPhase === i.phase ? 'true' : undefined}`, and

```tsx
                onClick={() => {
                  const same = inspect === i.id && inspectPhase === i.phase;
                  setInspect(same ? null : i.id);
                  setInspectPhase(same ? undefined : i.phase);
                }}
```

In the inspected `BeatView` handlers add `bossPhase: inspectPhase,` and give that `BeatView` wrapper `key={`${inspected.id}-${inspectPhase ?? ''}-${i}`}` so switching phase remounts the boss. Chips that `setInspect(c.go)` also call `setInspectPhase(undefined)`.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `ALL SUITES PASSED`. If the straight-apostrophe or `topics` checks fire, fix the copy, not the check.

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: the manager door, and the ceremonies placed in the funnel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Emoji → Lucide

**Files:**
- Modify: `src/experiments/chatbots/scripts/types.ts` (`say` gains `icon`)
- Modify: `src/experiments/chatbots/scripts/cancel.script.ts` (four 🎉)
- Modify: `src/experiments/chatbots/components/BeatView.tsx`, `Splash.tsx`, `product.module.css`
- Modify: `src/experiments/chatbots/apparatus/ScenarioMenu.tsx` (✓), `Rig.tsx` (▶), `Chatbots.tsx` (↓)
- Test: `src/experiments/chatbots/__tests__/lint.mjs`

- [ ] **Step 1: Failing lint rule.** Add to `lint.mjs` after the banned-strings block:

```js
/* — no emoji in the product; Lucide instead ---------------------------- */
console.log('\nNo emoji');
{
  // care's tray line is what a visitor types, and its recovery state exists to read it.
  const ALLOWED = ['🦴🔥😭'];
  const GLYPH = /\p{Extended_Pictographic}|[✓▶↓]/u;
  for (const f of walk(ROOT).filter((p) => /\.(tsx?|css)$/.test(p) && !p.includes('__tests__'))) {
    // ™ © ® count as pictographs to Unicode; the wordmark needs ™.
    let src = strip(readFileSync(f, 'utf8')).replace(/[©®™]/g, '');
    for (const a of ALLOWED) src = src.split(a).join('');
    const m = src.match(GLYPH);
    if (m) fail(`${f.split('/').pop()} contains "${m[0]}" — use a Lucide icon`);
  }
  console.log('  clean');
}
```

Run: `bash src/experiments/chatbots/__tests__/run.sh`
Expected: FAIL listing `cancel.script.ts`, `Splash.tsx`, `ScenarioMenu.tsx`, `Rig.tsx`, `Chatbots.tsx` (and any other file it finds — fix those too).

- [ ] **Step 2: Icon on a say.** In `types.ts` change the `say` member to:

```ts
  | { t: 'say'; text: string; hold?: number; icon?: 'party' }
```

In `BeatView.tsx`:

```tsx
import { PartyPopper } from 'lucide-react';
const SAY_ICONS = { party: PartyPopper } as const;
```

and the `say` case:

```tsx
    case 'say': {
      const Icon = beat.icon ? SAY_ICONS[beat.icon] : null;
      const cut = beat.text.lastIndexOf(' ') + 1;
      return (
        <div className={[s.ai, grouped ? s.grouped : ''].filter(Boolean).join(' ')} data-bubble>
          {Icon ? (
            <>
              {beat.text.slice(0, cut)}
              {/* The icon must not wrap onto a line of its own. */}
              <span className={s.nowrap}>
                {beat.text.slice(cut)}{' '}<Icon size="1em" className={s.sayIcon} aria-hidden />
              </span>
            </>
          ) : (
            beat.text
          )}
        </div>
      );
    }
```

Append to `product.module.css`:

```css
.nowrap { white-space: nowrap; }
.sayIcon { vertical-align: -0.12em; color: var(--s-accent, currentColor); }
```

- [ ] **Step 3: The script.** In `cancel.script.ts`:
- Splash line `'Welcome back! 🎉'` → `'Welcome back!'` (the party scene draws its own popper).
- `'I’m Robin, your Account Companion 🎉'` → `text: 'I’m Robin, your Account Companion', icon: 'party'`.
- `'Good news — your plan is unchanged! 🎉'` → `text: 'Good news — your plan is unchanged!', icon: 'party'`.
- `'Wonderful — you’re all set. 🎉'` → `text: 'Wonderful — you’re all set.', icon: 'party'`.
- Delete the comment block above Robin's intro that explains the 🎉 nbsp wrapping (lines ~229–245); the `nowrap` span in BeatView replaces it.

- [ ] **Step 4: The components.**
- `Splash.tsx:151` — `<span className={sp.popper}>🎉</span>` → `<span className={sp.popper}><PartyPopper size="1em" aria-hidden /></span>` (import from `lucide-react`).
- `ScenarioMenu.tsx:182` — `{o.id === value ? '✓' : ''}` → `{o.id === value ? <Check size={14} aria-hidden /> : null}`.
- `Rig.tsx` — `'▶ Watch it play'` → `<><Play size={12} aria-hidden /> Watch it play</>`.
- `Chatbots.tsx` — `{unread} new ↓` → `{unread} new <ArrowDown size={12} aria-hidden />`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`
Expected: `No emoji … clean` and `ALL SUITES PASSED`. Check that the render test's Splash assertion `html.includes(sd.lines…)` still holds after the line change; it reads from the script, so it should.

```bash
git add src/experiments/chatbots
git commit -m "Chatbots: Lucide icons in place of emoji" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Play it, tune it

**Files:** whatever tuning touches — `cancel.script.ts` (rates, ms, hold), `fight.ts` (`HEADROOM`), `synth.ts` (levels), the CSS modules.

- [ ] **Step 1: Run the site.** `pnpm dev`, open `/explorations/chatbots`, Cancel Anytime tab. Use the `run` skill or Claude in Chrome to drive it; record a GIF of the boss sequence.
- [ ] **Step 2: Walk the checklist.** Each ceremony plays once, skips on tap and on Escape, and its sound stops on skip. The Vault plays over the 9s think, not before it. The Coronation appears on both endings. Manager reachable from all five places. Level 1 winnable with a thumb on a phone (Chrome device mode, then a real phone), level 2 noticeably harder, 70% pace never wins. Holding Space never wins. "Return to chat" lands at `almost`. Glitch tears and cuts to silence; the dialog is plain; OK lands on "Unchanged" with the Coronation. Start over and switching tabs mid-fight both go silent. Mute persists across a reload. The state browser opens Manager, XAL-9001 and Try again later. Hardship is untouched.
- [ ] **Step 3: Listen.** Press, charge, glitch, chime with no files in `public/sounds/chatbots/`, then with the user's files dropped in. Any synthesised cue that sounds like a bare oscillator gets reworked, or the user supplies a file for it.
- [ ] **Step 4: Tune** the authored numbers (rates, seconds, ms, hold) in the script, never the tests. Re-run `npx tsc --noEmit && bash src/experiments/chatbots/__tests__/run.sh`.
- [ ] **Step 5: Commit**

```bash
git add src/experiments/chatbots public/sounds/chatbots
git commit -m "Chatbots: tuned after playing it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
