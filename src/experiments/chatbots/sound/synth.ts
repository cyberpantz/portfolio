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
