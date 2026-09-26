/**
 * The skeleton, and how the cloud is bound to it.
 *
 * ── Why a rig rather than the bone ids it had ───────────────────────────
 *
 * Every point belonged to exactly one part with weight 1. That is rigid
 * binding, and it tears: turn the head and the last ring of skull particles
 * goes with it while the first ring of neck particles does not, opening a
 * seam. The flat version hit this and papered over it with a blend band in
 * one dimension. In three dimensions the same fix is just a rig.
 *
 * ── The weights are computed, not painted ───────────────────────────────
 *
 * Normally this is the laborious part — someone sits in Blender assigning
 * vertices to bones. Here the points are generated, so every one can be
 * asked how far it is from each bone SEGMENT and weighted accordingly. Near
 * the middle of a bone one weight dominates; near a joint two are close and
 * blend, which is precisely where a blend is wanted. Falloff is inverse
 * distance squared, top four influences, normalised — the same shape as
 * Blender's bone heat, without the heat equation.
 */

export type Joint = {
  name: string;
  /** Rest position, in cat space. */
  at: [number, number, number];
  /** Index into JOINTS, or -1 for the root. */
  parent: number;
};

/**
 * A sitting cat's skeleton, ordered so that a parent always precedes its
 * children — which lets the matrices be composed in one forward pass
 * instead of a recursive walk.
 */
export const JOINTS: Joint[] = [
  { name: 'pelvis', at: [0.14, -0.46, 0], parent: -1 },
  { name: 'spine', at: [-0.01, -0.16, 0], parent: 0 },
  { name: 'chest', at: [-0.14, 0.10, 0], parent: 1 },
  { name: 'neck', at: [-0.24, 0.34, 0], parent: 2 },
  { name: 'head', at: [-0.37, 0.56, 0], parent: 3 },
  /* The ears are their own joints so they can flick independently — a cat
     that tracks you with its ears before its head is doing the thing that
     makes people say it noticed them. */
  { name: 'earL', at: [-0.38, 0.70, 0.185], parent: 4 },
  { name: 'earR', at: [-0.38, 0.70, -0.185], parent: 4 },

  { name: 'shoulderL', at: [-0.25, -0.08, 0.125], parent: 2 },
  { name: 'elbowL', at: [-0.29, -0.50, 0.135], parent: 7 },
  { name: 'pawL', at: [-0.31, -0.86, 0.14], parent: 8 },
  { name: 'shoulderR', at: [-0.24, -0.08, -0.125], parent: 2 },
  { name: 'elbowR', at: [-0.28, -0.50, -0.135], parent: 10 },
  { name: 'pawR', at: [-0.30, -0.86, -0.14], parent: 11 },

  /* Five tail joints, because a tail's whole charm is that it is a chain:
     a small rotation at the root becomes a large sweep at the tip, and the
     curl arrives late. Fewer joints and it hinges like a lever. */
  { name: 'tail0', at: [0.48, -0.44, 0], parent: 0 },
  { name: 'tail1', at: [0.68, -0.64, 0.06], parent: 13 },
  { name: 'tail2', at: [0.76, -0.85, 0.17], parent: 14 },
  { name: 'tail3', at: [0.62, -0.94, 0.32], parent: 15 },
  { name: 'tail4', at: [0.30, -0.95, 0.39], parent: 16 },
];

export const JOINT = Object.fromEntries(JOINTS.map((j, i) => [j.name, i])) as Record<string, number>;

/** How many joints may move one point. Four is the usual bargain. */
export const INFLUENCES = 4;

type V3 = [number, number, number];

/**
 * Distance from a point to a bone — the SEGMENT from a joint to its parent,
 * not the joint itself.
 *
 * Measuring to joints alone weights by proximity to the ends of bones, so
 * the middle of a long bone like a thigh ends up pulled equally by both of
 * its neighbours and collapses when either moves. Measuring to the segment
 * gives the whole length of the bone its proper claim.
 */
function distToBone(p: V3, j: Joint, parent: Joint | null): number {
  if (!parent) return Math.hypot(p[0] - j.at[0], p[1] - j.at[1], p[2] - j.at[2]);
  const a = parent.at, b = j.at;
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const d2 = bax * bax + bay * bay + baz * baz;
  const t = d2 > 0
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * bax + (p[1] - a[1]) * bay + (p[2] - a[2]) * baz) / d2))
    : 0;
  return Math.hypot(p[0] - (a[0] + bax * t), p[1] - (a[1] + bay * t), p[2] - (a[2] + baz * t));
}

export type Skin = {
  /** INFLUENCES joint indices per point. */
  idx: Uint8Array;
  /** INFLUENCES weights per point, summing to 1. */
  wgt: Float32Array;
};

/**
 * Bind a cloud to the skeleton.
 *
 * `sharpness` decides how local the binding is. Low values spread every
 * point across many joints and the cat moves like rubber; very high values
 * approach rigid binding and it tears again. 3 is a cat.
 */
export function bindSkin(pos: Float32Array, count: number, sharpness = 3): Skin {
  const idx = new Uint8Array(count * INFLUENCES);
  const wgt = new Float32Array(count * INFLUENCES);
  const d: { i: number; w: number }[] = JOINTS.map((_, i) => ({ i, w: 0 }));

  for (let p = 0; p < count; p++) {
    const q: V3 = [pos[p * 3], pos[p * 3 + 1], pos[p * 3 + 2]];

    for (let j = 0; j < JOINTS.length; j++) {
      const dist = distToBone(q, JOINTS[j], JOINTS[j].parent >= 0 ? JOINTS[JOINTS[j].parent] : null);
      /* The epsilon is not cosmetic: a point sitting exactly on a bone would
         otherwise take infinite weight and every other influence would round
         to zero, making that one point rigid in a field of soft ones. */
      d[j].i = j;
      d[j].w = 1 / Math.pow(dist + 0.02, sharpness);
    }

    d.sort((a, b) => b.w - a.w);
    let sum = 0;
    for (let k = 0; k < INFLUENCES; k++) sum += d[k].w;
    for (let k = 0; k < INFLUENCES; k++) {
      idx[p * INFLUENCES + k] = d[k].i;
      wgt[p * INFLUENCES + k] = d[k].w / sum;
    }
  }
  return { idx, wgt };
}

/* ------------------------------------------------------------- posing */

export type Mat4 = Float32Array;

const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function multiply(a: Mat4, b: Mat4, out: Mat4): Mat4 {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = v;
    }
  }
  return out;
}

/** Rotation about x, then y, then z, applied around `pivot`. */
export function jointMatrix(pivot: readonly [number, number, number], rx: number, ry: number, rz: number): Mat4 {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  /* Column-major, the way GL wants it. */
  const r = new Float32Array([
    cy * cz, cy * sz, -sy, 0,
    sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy, 0,
    cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy, 0,
    0, 0, 0, 1,
  ]);
  /* Translate so the rotation happens about the joint rather than the
     origin: T(pivot) · R · T(-pivot), folded into the last column. */
  r[12] = pivot[0] - (r[0] * pivot[0] + r[4] * pivot[1] + r[8] * pivot[2]);
  r[13] = pivot[1] - (r[1] * pivot[0] + r[5] * pivot[1] + r[9] * pivot[2]);
  r[14] = pivot[2] - (r[2] * pivot[0] + r[6] * pivot[1] + r[10] * pivot[2]);
  return r;
}

export type Pose = Record<string, [number, number, number]>;

/**
 * Compose local rotations down the chain into one matrix per joint.
 *
 * Because JOINTS is ordered parent-first, this is a single forward pass:
 * by the time a joint is reached its parent's world matrix is already
 * final. The output is what the shader multiplies points by — there is no
 * separate inverse-bind step, because the local matrices already rotate
 * about the joint's rest position, which makes them identity at rest.
 */
export function poseMatrices(pose: Pose): Mat4[] {
  const out: Mat4[] = [];
  for (let i = 0; i < JOINTS.length; i++) {
    const j = JOINTS[i];
    const r = pose[j.name];
    const local = r ? jointMatrix(j.at, r[0], r[1], r[2]) : identity();
    out[i] = j.parent >= 0 ? multiply(out[j.parent], local, new Float32Array(16)) : local;
  }
  return out;
}

/** Apply the skin on the CPU. Used by the offline preview, not at runtime. */
export function skinPoint(
  p: V3, n: V3, idx: Uint8Array, wgt: Float32Array, at: number, mats: Mat4[],
): [V3, V3] {
  const o: V3 = [0, 0, 0], m: V3 = [0, 0, 0];
  for (let k = 0; k < INFLUENCES; k++) {
    const w = wgt[at * INFLUENCES + k];
    if (w <= 0) continue;
    const M = mats[idx[at * INFLUENCES + k]];
    o[0] += w * (M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]);
    o[1] += w * (M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]);
    o[2] += w * (M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]);
    /* Normals take the rotation only — no translation — which for a rigid
       joint transform is the upper 3x3 and needs no inverse transpose. */
    m[0] += w * (M[0] * n[0] + M[4] * n[1] + M[8] * n[2]);
    m[1] += w * (M[1] * n[0] + M[5] * n[1] + M[9] * n[2]);
    m[2] += w * (M[2] * n[0] + M[6] * n[1] + M[10] * n[2]);
  }
  const l = Math.hypot(m[0], m[1], m[2]) || 1;
  return [o, [m[0] / l, m[1] / l, m[2] / l]];
}
