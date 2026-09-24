import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Beat, Chip, Node, NodeId, Scenario, StripEffect } from '../scripts/types';
import { createScheduler } from './scheduler';
import { classify, RECOVERY_NODE, STRIKES, type Motive } from '../input/classify';

/**
 * The director: turns a node's beats into a paced sequence, routes input,
 * and owns every millisecond in the system.
 *
 * Three phases, named rather than inferred from booleans. `isThinking &&
 * !isError && hasResults` is how this becomes unmaintainable by week two.
 */

export type Turn =
  | { who: 'user'; text: string; id: number }
  | { who: 'ai'; beat: Beat; id: number; grouped: boolean };

export type Phase = 'playing' | 'waiting' | 'locked';

export type StripState = {
  out: Set<string>;
  rank: string[];
  lead?: string;
  win?: string;
  withdrawn: boolean;
};

type State = {
  phase: Phase;
  node: NodeId;
  /** How many of the current node's beats have been emitted. */
  beat: number;
  turns: Turn[];
  strip: StripState;
  seq: number;
};

type Action =
  | { a: 'enter'; node: Node }
  | { a: 'emit'; beat: Beat }
  | { a: 'settle'; locked: boolean }
  | { a: 'user'; text: string }
  | { a: 'reset'; node: Node };

const EMPTY_STRIP: StripState = { out: new Set(), rank: [], withdrawn: false };

function applyStrip(s: StripState, e?: StripEffect): StripState {
  if (!e) return s;
  if (e.withdraw) return { ...s, withdrawn: true };
  const out = new Set(s.out);
  for (const id of e.out ?? []) out.add(id);
  return { out, rank: e.rank ?? s.rank, lead: e.lead ?? s.lead, win: e.win ?? s.win, withdrawn: false };
}

/**
 * A thinking indicator is transient: whatever comes next takes its place.
 *
 * It used to stay in the transcript as a completed turn, so the log
 * filled up with the residue of every pause — no chat keeps its typing
 * indicator in history, because the indicator was never a message. It was
 * the absence of one.
 *
 * Applies to a user turn too: sending mid-think replaces the indicator
 * rather than stranding it above the new message.
 */
function dropPendingThink(turns: Turn[]): Turn[] {
  const last = turns[turns.length - 1];
  return last && last.who === 'ai' && last.beat.t === 'think' ? turns.slice(0, -1) : turns;
}

function reduce(st: State, act: Action): State {
  switch (act.a) {
    case 'enter':
      return {
        ...st,
        phase: 'playing',
        node: act.node.id,
        beat: 0,
        strip: applyStrip(st.strip, act.node.effect?.strip),
      };
    case 'emit': {
      const base = dropPendingThink(st.turns);
      const prev = base[base.length - 1];
      /*
       * Adjacent `say` bubbles from the assistant group: tighter facing
       * corners and a shorter gap. Turn boundaries stay loose, so a run
       * of three lines reads as one thought rather than three.
       */
      const grouped =
        !!prev && prev.who === 'ai' && act.beat.t === 'say' && prev.beat.t === 'say';
      return {
        ...st,
        beat: st.beat + 1,
        seq: st.seq + 1,
        turns: [...base, { who: 'ai', beat: act.beat, id: st.seq, grouped }],
      };
    }
    case 'settle':
      return { ...st, phase: act.locked ? 'locked' : 'waiting' };
    case 'user':
      return {
        ...st,
        seq: st.seq + 1,
        turns: [...dropPendingThink(st.turns), { who: 'user', text: act.text, id: st.seq }],
      };
    case 'reset':
      return {
        phase: 'playing',
        node: act.node.id,
        beat: 0,
        turns: [],
        strip: applyStrip(EMPTY_STRIP, act.node.effect?.strip),
        seq: 0,
      };
    default: {
      const _x: never = act;
      throw new Error(`unhandled action ${JSON.stringify(_x)}`);
    }
  }
}

/* --------------------------------------------------------------- timing */

/*
 * Three clocks, and only one of them scales with the skin (spec §11.0).
 *
 *   feedback   — idle and response motion, in CSS. Scales with --s-tempo.
 *   authored   — think.ms and hold, below. Content, so it does NOT scale.
 *   perceptual — nudge rungs, below. Human thresholds, so they do not
 *                scale either: a calm skin does not earn the right to
 *                postpone honesty by four seconds.
 */
const GAP_AFTER: Record<Beat['t'], number> = {
  say: 320,
  ack: 460,
  think: 240,
  chips: 0,
  pick: 0,
  scale: 0,
  compare: 300,
  recommend: 320,
  disclose: 260,
  results: 300,
  empty: 320,
  schedule: 260,
  timegrid: 260,
  appointment: 0,
  reframe: 0,
  boundary: 360,
  safety: 0,
  error: 0,
};
const GROUPED_GAP = 180;
/** Beat before a self-continuing node moves on, so its last line reads. */
const AUTO_GAP = 520;

/* ---------------------------------------------------------- watch pace
 *
 * Watch lingered a flat 1200ms on every turn before answering it — the
 * same pause after "No." as after a question with three options and a
 * clause about Saturday closing times.
 *
 * That one number is standing in for everything the visitor would
 * otherwise have done: read the assistant's turn, read the options,
 * decide between them, click. Play mode needs none of this because YOU
 * set the pace and the interface waits; Watch has to impersonate a
 * reader, and a reader's pace is a function of how much is on screen.
 *
 * So it scales. ~30ms per character is a deliberate skim — slower than
 * silent reading (≈25ms/char at 200wpm), because someone watching a
 * demo is also looking AT the interface, not only reading it. Options
 * cost extra on top, because choosing is its own beat and three chips
 * are three things to weigh.
 *
 * Perceptual clock: these are human thresholds, so like the nudge rungs
 * they do NOT scale with --s-tempo. A calm skin does not get to decide
 * how fast you read.
 */
const WATCH_BASE = 900;
const WATCH_PER_CHAR = 30;
const WATCH_PER_OPTION = 240;
const WATCH_MIN = 1500;
const WATCH_MAX = 5500;

function watchDwell(node: Node): number {
  let chars = 0;
  let options = 0;
  for (const b of node.say) {
    if (b.t === 'say' || b.t === 'ack') chars += b.text.length;
    else if (b.t === 'boundary') chars += b.refusal.length + b.instead.length;
    else if (b.t === 'recommend') chars += b.why.length;
    else if (b.t === 'safety' || b.t === 'reframe') chars += b.headline.length + b.body.length;
    else if (b.t === 'empty') {
      chars += b.constraint.length + b.title.length;
      options += b.alternatives.length;
    } else if (b.t === 'pick') {
      chars += b.spec.prompt.length;
      options += b.spec.choices.length;
    } else if (b.t === 'chips') options += b.options.length;
    else if (b.t === 'schedule') options += b.slots.length;
    else if (b.t === 'timegrid') {
      chars += b.title.length;
      // A grid is scanned, not read cell by cell: charge per column and
      // a little per row, not the full count of twelve times.
      options += b.days.length * 2;
    }
    else if (b.t === 'results') {
      chars += b.items.reduce((n, i) => n + i.name.length + i.detail.length, 0);
    } else if (b.t === 'error') {
      // The stage list is read even when there is no sentence under it.
      chars += (b.message?.length ?? 0) + b.stages.join('').length;
    } else if (b.t === 'appointment') chars += b.title.length + 36;
  }
  const ms = WATCH_BASE + chars * WATCH_PER_CHAR + options * WATCH_PER_OPTION;
  return Math.min(WATCH_MAX, Math.max(WATCH_MIN, ms));
}
const NUDGE_HINT = 12_000;
const NUDGE_OFFER = 25_000;

/** How long a beat occupies the stage on its own account. */
function ownTime(b: Beat): number {
  return b.t === 'think' ? (b.ms ?? 1800) : 0;
}

function gapBetween(prev: Beat, next: Beat | undefined): number {
  if (prev.t === 'say' && prev.hold != null) return prev.hold;
  if (prev.t === 'say' && next?.t === 'say') return GROUPED_GAP;
  return GAP_AFTER[prev.t];
}

/* -------------------------------------------------------------- hook */

export type DirectorOptions = {
  scenario: Scenario;
  startAt?: NodeId;
  watch?: boolean;
};

export function useDirector({ scenario, startAt, watch = false }: DirectorOptions) {
  const entry = scenario.nodes[startAt ?? scenario.start] ?? scenario.nodes[scenario.start];

  const [st, dispatch] = useReducer(reduce, undefined, (): State => ({
    phase: 'playing',
    node: entry.id,
    beat: 0,
    turns: [],
    strip: applyStrip(EMPTY_STRIP, entry.effect?.strip),
    seq: 0,
  }));

  const sched = useMemo(() => createScheduler(), []);
  const strikes = useRef(0);
  const [nudge, setNudge] = useState<'none' | 'hint' | 'offer'>('none');
  const [handOff, setHandOff] = useState(false);
  /*
   * The one thing the director remembers about a choice.
   *
   * A grid of twelve times cannot have twelve confirmation nodes, and
   * the two-slot scheduler already proved what happens when several
   * options share one ending: it confirmed 7:16 to someone who picked
   * 7:40. So the chosen time travels, and the appointment beat reads it
   * through `@picked`.
   *
   * Deliberately narrow. This is not a variable store and should not
   * become one — the moment a script can stash arbitrary state, the
   * copy stops being readable as a script.
   */
  const [picked, setPicked] = useState<{ at: string; day: 'today' | 'tomorrow' } | null>(null);

  /*
   * Falls back to the entry node, because the id can outlive the script.
   *
   * `st` is reducer state initialised once, so switching scenario mid
   * conversation left `st.node` naming a node from the script you just
   * left — "verify-identity" looked up in the care script, "first-cut"
   * looked up in the funnel. Every miss returned undefined and the next
   * line read `.say` off it, which is a white screen rather than a
   * degraded one.
   *
   * It survived two scenarios by luck: care and feline both happen to
   * call their opening node `open`, so switching on the first frame
   * worked and switching at any point after it did not. Nobody switched
   * mid-chat until there were three tabs worth switching between.
   *
   * This guard alone would be a lie — it would carry on rendering the
   * new script's opening beats underneath the old script's transcript —
   * so the effect below does the real work of resetting. The fallback
   * exists because that effect runs AFTER the render that would have
   * thrown, and a crash is not an acceptable way to spend one frame.
   */
  const node = scenario.nodes[st.node] ?? entry;

  /*
   * Declared before every effect that uses it. A `const` referenced above
   * its declaration is a runtime TDZ error that tsc does not catch — the
   * exact shape of a bug shipped earlier in this codebase.
   */
  const go = useCallback(
    (id: NodeId) => {
      const next = scenario.nodes[id];
      if (!next) return;
      sched.flush();
      setNudge('none');
      dispatch({ a: 'enter', node: next });
    },
    [scenario, sched]
  );

  /* ---- play the current node's beats ----------------------------- */
  useEffect(() => {
    if (st.phase !== 'playing') return;
    const beats = node.say;

    if (st.beat >= beats.length) {
      // Tempo-1 safety locks: nothing but the single action is reachable.
      const locked = beats.some((b) => b.t === 'safety' && b.tempo === 1);
      dispatch({ a: 'settle', locked });
      return;
    }

    /*
     * Each beat waits out the PREVIOUS beat before it lands, so the first
     * one arrives immediately and a 9-second think genuinely holds the
     * stage for nine seconds.
     */
    const prev = st.beat > 0 ? beats[st.beat - 1] : null;
    const delay = prev ? ownTime(prev) + gapBetween(prev, beats[st.beat]) : 0;

    sched.after(delay, () => dispatch({ a: 'emit', beat: beats[st.beat] }));
    return () => sched.flush();
  }, [st.phase, st.beat, st.node, node.say, sched]);

  /* ---- nodes that continue on their own ---------------------------
   *
   * Deliberately a separate effect on its own timer rather than part of
   * the beat loop: that loop flushes the scheduler on every phase change,
   * which would cancel this the instant it was queued.
   */
  useEffect(() => {
    if (st.phase !== 'waiting' || !node.auto) return;
    const target = node.auto;
    const t = window.setTimeout(() => go(target), AUTO_GAP);
    return () => window.clearTimeout(t);
  }, [st.phase, st.node, node.auto, go]);

  /* ---- nudge ladder ---------------------------------------------- */
  useEffect(() => {
    if (st.phase !== 'waiting') {
      setNudge('none');
      return;
    }
    const a = window.setTimeout(() => setNudge('hint'), NUDGE_HINT);
    const b = window.setTimeout(() => setNudge('offer'), NUDGE_OFFER);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [st.phase, st.node]);

  /* ---- watch mode ------------------------------------------------- */
  useEffect(() => {
    if (!(watch || handOff)) return;
    if (st.phase !== 'waiting') return;
    // A node that continues on its own is already moving; Watch must not
    // race it.
    if (node.auto) return;
    /*
     * Stop at the end rather than looping.
     *
     * Watch took accept[0] at every waiting node, and the closing node
     * accepts anything and points at ITSELF — so it re-entered forever,
     * one identical bubble every 1200ms. Terminal means the conversation
     * is over, and a self-referencing accept is a place to wait, never a
     * place to be sent.
     */
    if (node.terminal) return;
    const first = node.accept?.[0];
    if (!first || first.go === node.id) return;
    const t = window.setTimeout(() => go(first.go), watchDwell(node));
    return () => window.clearTimeout(t);
  }, [watch, handOff, st.phase, st.node, node, node.accept, node.auto, node.terminal, node.id, go]);

  useEffect(() => () => sched.flush(), [sched]);

  /* ---- input ------------------------------------------------------ */

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      if (st.phase === 'locked') return;

      // Sending mid-think flushes rather than queueing behind beats
      // nobody is reading any more.
      sched.flush();
      setHandOff(false);
      dispatch({ a: 'user', text });

      // Safety runs BEFORE everything. A tempo-1 trigger is an interrupt,
      // not a motive, and not something a tray line can outrank.
      const rule = scenario.safety.find((r) => r.test(text));
      if (rule) return go(rule.go);

      /*
       * A line taken from the tray is AUTHORED text, not free text.
       *
       * The tray fills the composer and the visitor presses send, so by
       * the time it arrives here it looks like anything else someone
       * typed — and the first version classified it as such, which sent
       * every single tray line to the vague-recovery branch. Choosing
       * "ok find me somewhere" from the tray was answered with "that
       * counts, people are usually right about that part."
       *
       * Matched on normalised text rather than a remembered id, so it
       * still works if the visitor clears the box and retypes it, and
       * correctly stops applying the moment they edit it — an edited
       * line is genuinely their own words again.
       */
      const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
      const chosen = node.lines?.find((l) => norm(l.text) === norm(text));
      if (chosen) {
        strikes.current = 0;
        return go(chosen.go);
      }

      const m: Motive = classify(text, scenario.lexicon);
      if (m === 'symptom') {
        strikes.current = 0;
        return go('reframe');
      }

      // Does this node take free text directly?
      const hit = node.accept?.find(
        (a): a is Extract<typeof a, { on: 'text' }> => a.on === 'text' && a.test(text)
      );
      if (hit) {
        strikes.current = 0;
        return go(hit.go);
      }

      if (STRIKES.has(m)) strikes.current += 1;
      if (strikes.current >= 3) {
        strikes.current = 0;
        return go('r-exit');
      }

      const target = node.fallback ?? RECOVERY_NODE[m];
      go(scenario.nodes[target] ? target : 'r-vague');
    },
    [go, node, scenario, sched, st.phase]
  );

  const choose = useCallback(
    (chip: Chip) => {
      if (st.phase === 'locked' && chip.go !== 'safety-911') return;
      sched.flush();
      setHandOff(false);
      strikes.current = 0;
      dispatch({ a: 'user', text: chip.label });
      go(chip.go);
    },
    [go, sched, st.phase]
  );

  const pick = useCallback(
    (label: string, to: NodeId) => {
      sched.flush();
      setHandOff(false);
      strikes.current = 0;
      dispatch({ a: 'user', text: label });
      go(to);
    },
    [go, sched]
  );

  /**
   * A grid cell. Same routing as `pick`, plus the one fact worth
   * carrying — which time, in the form a calendar can use.
   */
  const pickTime = useCallback(
    (at: string, label: string, day: string, to: NodeId) => {
      sched.flush();
      setHandOff(false);
      strikes.current = 0;
      setPicked({ at, day: /tomorrow/i.test(day) ? 'tomorrow' : 'today' });
      dispatch({ a: 'user', text: label });
      go(to);
    },
    [go, sched]
  );

  const restart = useCallback(() => {
    sched.flush();
    strikes.current = 0;
    setHandOff(false);
    setPicked(null);
    setNudge('none');
    dispatch({ a: 'reset', node: scenario.nodes[scenario.start] });
  }, [scenario, sched]);

  /*
   * A new script is a new conversation.
   *
   * Changing scenario has to clear everything, not just the node: the
   * transcript, the strip, the strike count, the pending scheduler, the
   * time someone picked from a grid. Leaving any of it behind produces
   * a conversation that is half one script and half another — the cat
   * consultation opening underneath a booked clinic appointment, three
   * strikes carried into a funnel that has no recovery nodes.
   *
   * `restart` already does exactly that for the Start over button, so
   * this reuses it rather than keeping a second list of things to
   * forget. Two reset paths drift; the one that is used less drifts
   * first, and this is the one that is used less.
   *
   * Keyed on `scenario.id` rather than the object, because a scenario
   * is a module-level constant and object identity would be a stricter
   * test than the thing actually being asked.
   */
  const playing = useRef(scenario.id);
  useEffect(() => {
    if (playing.current === scenario.id) return;
    playing.current = scenario.id;
    restart();
  }, [scenario.id, restart]);

  return {
    turns: st.turns,
    phase: st.phase,
    node,
    strip: st.strip,
    nudge,
    watching: watch || handOff,
    send,
    choose,
    pick,
    pickTime,
    picked,
    go,
    restart,
    acceptWatch: () => setHandOff(true),
  };
}
