/**
 * Animation: poses as functions of time, stacked.
 *
 * ── Layers, not a timeline ──────────────────────────────────────────────
 *
 * A cat is never doing one thing. It is breathing AND its tail is drifting
 * AND an ear just twitched AND it is watching your cursor, all at once and
 * on unrelated clocks. A single timeline cannot express that without
 * authoring every combination, so poses are additive: each layer emits only
 * the joints it cares about, and they sum.
 *
 *   rest
 *   + idle(t)        always on — breath, weight shift, tail drift
 *   + twitch(t)      occasional, brief, fired at random
 *   + clip(t)        an authored gesture, when one is playing
 *   + aim(pointer)   the head, whenever there is a pointer
 *
 * ── Euler angles, additively, and when that stops working ───────────────
 *
 * Summing euler triples is not composing rotations, and for large or
 * opposed angles it is visibly wrong. It is fine here because every layer
 * is small — the largest is a 40 degree head yaw, and the layers beneath it
 * are a few degrees each — and the alternative, quaternion blending per
 * joint per layer, costs more than the error it removes at this scale.
 * If a layer ever needs to swing a joint past about 60 degrees, this is the
 * thing that will break first.
 */

import type { Pose, V3 } from './rig';

const DEG = Math.PI / 180;

/* --------------------------------------------------------- combining */

/** Add `layer` into `into`, scaled by `w`. Mutates and returns `into`. */
export function addLayer(into: Pose, layer: Pose, w = 1): Pose {
  if (w === 0) return into;
  for (const name in layer) {
    const src = layer[name];
    const dst = (into[name] ??= {});
    if (src.r) {
      dst.r ??= [0, 0, 0];
      dst.r[0] += src.r[0] * w;
      dst.r[1] += src.r[1] * w;
      dst.r[2] += src.r[2] * w;
    }
    if (src.t) {
      dst.t ??= [0, 0, 0];
      dst.t[0] += src.t[0] * w;
      dst.t[1] += src.t[1] * w;
      dst.t[2] += src.t[2] * w;
    }
  }
  return into;
}

/* ------------------------------------------------------------- clips */

export type Key = { at: number; r?: V3; t?: V3 };
export type Clip = {
  name: string;
  duration: number;
  loop?: boolean;
  tracks: Record<string, Key[]>;
};

/* Smoothstep between keys rather than linear. Linear interpolation of
   rotations gives a constant angular velocity that starts and stops
   instantly, and nothing alive moves like that. */
const ease = (t: number) => t * t * (3 - 2 * t);

const lerp3 = (a: V3 | undefined, b: V3 | undefined, k: number): V3 | undefined => {
  if (!a && !b) return undefined;
  const p = a ?? [0, 0, 0], q = b ?? [0, 0, 0];
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
};

/** Sample a clip at `time` seconds. Returns only the joints it touches. */
export function sampleClip(clip: Clip, time: number): Pose {
  const t = clip.loop ? ((time % clip.duration) + clip.duration) % clip.duration : Math.min(time, clip.duration);
  const out: Pose = {};
  for (const joint in clip.tracks) {
    const keys = clip.tracks[joint];
    if (keys.length === 0) continue;
    if (t <= keys[0].at) { out[joint] = { r: keys[0].r, t: keys[0].t }; continue; }
    const last = keys[keys.length - 1];
    if (t >= last.at) { out[joint] = { r: last.r, t: last.t }; continue; }
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].at < t) i++;
    const a = keys[i], b = keys[i + 1];
    const k = ease((t - a.at) / Math.max(1e-6, b.at - a.at));
    out[joint] = { r: lerp3(a.r, b.r, k), t: lerp3(a.t, b.t, k) };
  }
  return out;
}

/* --------------------------------------------------- authored gestures */

/**
 * One ear, flicked.
 *
 * Fast out, slower back — the asymmetry is the whole gesture. A symmetric
 * flick reads as a mechanism returning to centre; a real one snaps and then
 * relaxes.
 */
const earFlick = (ear: 'earL' | 'earR'): Clip => ({
  name: `flick-${ear}`,
  duration: 0.55,
  tracks: {
    [ear]: [
      { at: 0, r: [0, 0, 0] },
      { at: 0.07, r: [0, 0, (ear === 'earL' ? -1 : 1) * 26 * DEG] },
      { at: 0.16, r: [0, 0, (ear === 'earL' ? 1 : -1) * 9 * DEG] },
      { at: 0.55, r: [0, 0, 0] },
    ],
  },
});

export const CLIPS = {
  flickL: earFlick('earL'),
  flickR: earFlick('earR'),

  /* A shake — the whole-body shudder a cat does on waking. Travels down
     the spine, which is why the keys are staggered rather than aligned. */
  shake: {
    name: 'shake',
    duration: 0.9,
    tracks: {
      head: [
        { at: 0, r: [0, 0, 0] }, { at: 0.10, r: [0, 16 * DEG, 8 * DEG] },
        { at: 0.22, r: [0, -14 * DEG, -7 * DEG] }, { at: 0.34, r: [0, 9 * DEG, 4 * DEG] },
        { at: 0.5, r: [0, 0, 0] },
      ],
      neck: [
        { at: 0.04, r: [0, 0, 0] }, { at: 0.16, r: [0, -9 * DEG, -4 * DEG] },
        { at: 0.3, r: [0, 6 * DEG, 3 * DEG] }, { at: 0.5, r: [0, 0, 0] },
      ],
      chest: [
        { at: 0.1, r: [0, 0, 0] }, { at: 0.24, r: [0, 5 * DEG, 0] },
        { at: 0.4, r: [0, -4 * DEG, 0] }, { at: 0.6, r: [0, 0, 0] },
      ],
      earL: [{ at: 0.06, r: [0, 0, 0] }, { at: 0.14, r: [0, 0, -22 * DEG] }, { at: 0.45, r: [0, 0, 0] }],
      earR: [{ at: 0.06, r: [0, 0, 0] }, { at: 0.14, r: [0, 0, 22 * DEG] }, { at: 0.45, r: [0, 0, 0] }],
    },
  } satisfies Clip,
} as const;

/* ------------------------------------------------ procedural layers */

/**
 * Breath, weight and tail — the things that never stop.
 *
 * Procedural rather than keyframed because they must not repeat. A looping
 * two-second breath clip is detectable within about ten seconds; three sines
 * on incommensurable periods never quite line up again, and the cat stays
 * alive as long as the page is open.
 */
export function idle(t: number): Pose {
  const breath = Math.sin(t * 1.35);
  const sway = Math.sin(t * 0.41);
  const drift = Math.sin(t * 0.29);

  return {
    /* The ribcage lifting. Small — 12 thousandths of a cat — and the piece
       is dead without it. */
    chest: { t: [0, 0.012 * breath, 0], r: [0, 0, 1.1 * DEG * breath] },
    spine: { r: [0, 0.8 * DEG * sway, 0.6 * DEG * breath] },
    /* Weight shifting between the hips, on a slower clock than the breath
       so the two never sync. */
    pelvis: { t: [0, 0.004 * Math.sin(t * 0.63), 0.006 * sway] },
    neck: { r: [0.9 * DEG * Math.sin(t * 0.77), 0, 0] },

    /* The tail, as a travelling wave down the chain. Each joint lags the
       one before it, which is why a tail looks like a tail and not a
       windscreen wiper. */
    tail0: { r: [0, 3.2 * DEG * Math.sin(t * 0.52), 1.8 * DEG * drift] },
    tail1: { r: [0, 3.8 * DEG * Math.sin(t * 0.52 - 0.5), 2.2 * DEG * Math.sin(t * 0.29 - 0.4)] },
    tail2: { r: [0, 4.4 * DEG * Math.sin(t * 0.52 - 1.0), 2.6 * DEG * Math.sin(t * 0.29 - 0.8)] },
    tail3: { r: [0, 5.0 * DEG * Math.sin(t * 0.52 - 1.5), 3.0 * DEG * Math.sin(t * 0.29 - 1.2)] },
    tail4: { r: [0, 5.6 * DEG * Math.sin(t * 0.52 - 2.0), 3.4 * DEG * Math.sin(t * 0.29 - 1.6)] },
  };
}

/* ---------------------------------------------------------- the driver */

type Playing = { clip: Clip; started: number; weight: number };

/**
 * Runs the layers and decides when to fire a gesture.
 *
 * The scheduling is the part that matters. Twitches at a fixed interval
 * read as a metronome, so the next one is always a random wait inside a
 * range, rolled fresh each time. A cat's ear moves when it moves.
 */
export class Animator {
  private t = 0;
  private playing: Playing[] = [];
  private nextTwitch = 2 + Math.random() * 5;

  /** Play a gesture now. Several may overlap; they simply sum. */
  play(clip: Clip, weight = 1): void {
    this.playing.push({ clip, started: this.t, weight });
  }

  /**
   * Advance and produce this frame's pose.
   *
   * `aim` is whatever the pointer wants the head to do, passed in rather
   * than computed here — the animator knows about time and gestures, and
   * deliberately nothing about input.
   */
  update(dt: number, aim?: Pose): Pose {
    this.t += dt;

    if (this.t >= this.nextTwitch) {
      this.play(Math.random() < 0.5 ? CLIPS.flickL : CLIPS.flickR);
      /* Occasionally a whole shake instead, which is rare enough to be a
         small event when it happens. */
      if (Math.random() < 0.12) this.play(CLIPS.shake);
      this.nextTwitch = this.t + 2.5 + Math.random() * 7;
    }

    const pose: Pose = {};
    addLayer(pose, idle(this.t));

    this.playing = this.playing.filter((p) => this.t - p.started <= p.clip.duration || p.clip.loop);
    for (const p of this.playing) addLayer(pose, sampleClip(p.clip, this.t - p.started), p.weight);

    if (aim) addLayer(pose, aim);
    return pose;
  }

  get time(): number {
    return this.t;
  }
}
