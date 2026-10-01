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
  /* Every gesture asks for a preload; a missing file must be asked for once. */
  const tried = new Set<FileCue>();
  const active = new Set<Playing & { src: AudioBufferSourceNode }>();

  const live = () => (on && ctx && master ? ctx : null);
  const syn = () => {
    if (!live()) return null;
    synth ??= createSynth(ctx!, master!);
    return synth;
  };

  async function load(cue: FileCue) {
    if (!ctx || tried.has(cue)) return;
    tried.add(cue);
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
