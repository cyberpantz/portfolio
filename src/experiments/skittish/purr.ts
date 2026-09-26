/**
 * The purr.
 *
 * ── What a purr actually is ─────────────────────────────────────────────
 *
 * Not a tone. A cat's purr is broadband noise gated by the larynx at
 * roughly 25 cycles a second — you hear the gating as a rumble and the noise
 * as breath. Synthesising it is therefore two things: brown noise for the
 * body, and an amplitude modulator slow enough to feel rather than hear,
 * since 25Hz sits right at the bottom edge of pitch perception.
 *
 * Two modulators, very slightly apart, because one is too regular. A real
 * purr drifts; a single LFO is a machine, and at this frequency the ear
 * reads the difference immediately.
 *
 * ── Why it is behind an interface ───────────────────────────────────────
 *
 * This is the placeholder. A recording of an actual cat will beat it, and
 * the moment there is one, `SampledPurr` replaces `SynthPurr` and nothing
 * else in the piece changes — the field only knows how to say "I am being
 * stirred this much".
 */

export type Purr = {
  /** Resume the context. Must be called from a real user gesture. */
  start(): Promise<void>;
  /** 0..1, how hard the field is being disturbed. */
  setEnergy(e: number): void;
  stop(): void;
  readonly running: boolean;
};

/* Audible floor, so the cat is purring before you touch it — quietly, the
   way a sleeping cat does — and touching it brings the sound up. */
const BED = 0.16;
const PEAK = 0.85;

/** Brown noise: white noise integrated, which is why it sits low. */
function brownNoise(ctx: AudioContext, seconds = 3): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  /* Cross-fade the tail into the head so the loop has no seam. At three
     seconds a click every three seconds is the only thing anyone hears. */
  const fade = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    d[i] = d[i] * k + d[n - fade + i] * (1 - k);
  }
  return buf;
}

export class SynthPurr implements Purr {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  running = false;

  async start(): Promise<void> {
    if (this.running) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    await ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = brownNoise(ctx);
    src.loop = true;

    /* Two poles at 320Hz. A purr has almost nothing above that, and the
       difference between filtered and unfiltered noise here is the
       difference between a cat and a radiator. */
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.7;

    /* Roll off the very bottom too, or it is felt as pressure rather than
       heard, and it swamps small speakers. */
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 45;

    /* The gate. A sine at 25Hz, plus a second at 26.4 so the two drift in
       and out of phase and the rumble breathes instead of buzzing. */
    const depth = ctx.createGain();
    depth.gain.value = 0.55;
    const lfoA = ctx.createOscillator(); lfoA.frequency.value = 25;
    const lfoB = ctx.createOscillator(); lfoB.frequency.value = 26.4;
    const mixB = ctx.createGain(); mixB.gain.value = 0.45;
    lfoA.connect(depth);
    lfoB.connect(mixB).connect(depth);

    /* depth rides on a 1.0 offset, so the modulator swings the amplitude
       rather than inverting it. */
    const gate = ctx.createGain();
    gate.gain.value = 0.55;
    depth.connect(gate.gain);

    const out = ctx.createGain();
    out.gain.value = 0;

    src.connect(hp).connect(lp).connect(gate).connect(out).connect(ctx.destination);
    src.start(); lfoA.start(); lfoB.start();

    this.ctx = ctx;
    this.gain = out;
    this.nodes = [src, lfoA, lfoB];
    this.running = true;
    this.setEnergy(0);
  }

  setEnergy(e: number): void {
    if (!this.ctx || !this.gain) return;
    const v = BED + (PEAK - BED) * Math.min(1, Math.max(0, e));
    /* A ramp, not an assignment. Setting gain directly on every frame steps
       the signal and every step is a click. */
    this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12);
  }

  stop(): void {
    if (!this.ctx) return;
    this.nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
    void this.ctx.close();
    this.ctx = null;
    this.gain = null;
    this.nodes = [];
    this.running = false;
  }
}
