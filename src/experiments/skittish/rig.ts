/**
 * The skeleton, the clips, and the code that plays them.
 *
 * Knows nothing about three.js, about pointers, or about cats. It turns a
 * time and a blend into an array of bone matrices, which is the only thing
 * the shader wants. Keeping it that way is what lets it be tested in node
 * against the same numbers the bake script produced.
 */

export type Clip = {
  name: string;
  loop: boolean;
  seconds: number;
  frames: number;
  /** frames × bones × 4, quantised to int16 over [-1, 1]. */
  q: Int16Array;
  /** frames × 3 — the root's local translation, in the source's units. */
  t: Float32Array;
};

export type Rig = {
  bones: number;
  /** Parent index per bone, 255 for a root. Parents always come first. */
  parent: Uint8Array;
  restT: Float32Array;
  restQ: Float32Array;
  /** Bone space to mesh space, with the normalisation folded in. */
  invBind: Float32Array;
  /** The normalisation, applied at the root. */
  S: Float32Array;
  clips: Map<string, Clip>;
  mesh: {
    pos: Float32Array;
    nrm: Float32Array;
    idx: Uint8Array;
    wgt: Float32Array;
    tris: Uint16Array;
  };
};

const VSTRIDE = 18; // 3×i16 + 3×i8 + 4×u8 + 4×u8 + 1 pad

export function parseRig(buf: ArrayBuffer): Rig {
  const d = new DataView(buf);
  const magic = String.fromCharCode(d.getUint8(0), d.getUint8(1), d.getUint8(2), d.getUint8(3));
  if (magic !== 'CATS') throw new Error('skittish: not a cat rig');
  const nv = d.getUint32(4, true);
  const nt = d.getUint32(8, true);
  const nb = d.getUint32(12, true);
  const nc = d.getUint32(16, true);
  const span = d.getFloat32(20, true);
  let o = 24;

  const S = new Float32Array(buf.slice(o, o + 64));
  o += 64;

  const parent = new Uint8Array(nb);
  const restT = new Float32Array(nb * 3);
  const restQ = new Float32Array(nb * 4);
  const invBind = new Float32Array(nb * 16);
  for (let b = 0; b < nb; b++) {
    parent[b] = d.getUint8(o); o += 1;
    for (let k = 0; k < 3; k++) restT[b * 3 + k] = d.getFloat32(o + k * 4, true);
    o += 12;
    for (let k = 0; k < 4; k++) restQ[b * 4 + k] = d.getFloat32(o + k * 4, true);
    o += 16;
    for (let k = 0; k < 16; k++) invBind[b * 16 + k] = d.getFloat32(o + k * 4, true);
    o += 64;
  }

  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  const idx = new Uint8Array(nv * 4);
  const wgt = new Float32Array(nv * 4);
  for (let v = 0; v < nv; v++) {
    const p = o + v * VSTRIDE;
    for (let k = 0; k < 3; k++) {
      pos[v * 3 + k] = (d.getInt16(p + k * 2, true) / 32767) * span;
      nrm[v * 3 + k] = d.getInt8(p + 6 + k) / 127;
    }
    for (let k = 0; k < 4; k++) idx[v * 4 + k] = d.getUint8(p + 9 + k);
    for (let k = 0; k < 4; k++) wgt[v * 4 + k] = d.getUint8(p + 13 + k) / 255;
  }
  o += nv * VSTRIDE;
  if (o % 2) o += 1;
  const tris = new Uint16Array(buf.slice(o, o + nt * 6));
  o += nt * 6;

  const clips = new Map<string, Clip>();
  for (let c = 0; c < nc; c++) {
    const len = d.getUint8(o);
    const loop = d.getUint8(o + 1) === 1;
    const frames = d.getUint16(o + 2, true);
    const seconds = d.getFloat32(o + 4, true);
    o += 8;
    let name = '';
    for (let k = 0; k < len; k++) name += String.fromCharCode(d.getUint8(o + k));
    o += len;
    if (o % 2) o += 1;
    const q = new Int16Array(buf.slice(o, o + frames * nb * 8));
    o += frames * nb * 8;
    const t = new Float32Array(buf.slice(o, o + frames * 12));
    o += frames * 12;
    clips.set(name, { name, loop, seconds, frames, q, t });
  }
  if (o !== buf.byteLength) throw new Error(`skittish: rig has ${buf.byteLength - o} bytes left over`);

  return { bones: nb, parent, restT, restQ, invBind, S, clips, mesh: { pos, nrm, idx, wgt, tris } };
}

/* ------------------------------------------------------------ sampling */

/**
 * Shortest-arc interpolation between two quaternions.
 *
 * `nlerp`, not `slerp`: at thirty frames a second adjacent frames are a
 * few degrees apart, where the two agree to far better than the sixteen
 * bits the rotations are stored in. The sign check is not optional though
 * — a quaternion and its negative are the same rotation, and interpolating
 * between them without flipping takes the long way round, which is a leg
 * swinging through the cat instead of under it.
 */
function nlerp(a: Float32Array | Int16Array, ao: number, b: Float32Array | Int16Array, bo: number,
               f: number, out: Float32Array, oo: number, scale = 1): void {
  let d = 0;
  for (let k = 0; k < 4; k++) d += a[ao + k] * b[bo + k];
  const s = d < 0 ? -1 : 1;
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const v = (a[ao + k] * (1 - f) + b[bo + k] * s * f) * scale;
    out[oo + k] = v;
    n += v * v;
  }
  n = 1 / (Math.sqrt(n) || 1);
  for (let k = 0; k < 4; k++) out[oo + k] *= n;
}

const Q16 = 1 / 32767;

/** A clip at a time, into `outQ` (bones × 4) and `outT` (3). */
export function sampleClip(rig: Rig, clip: Clip, time: number, outQ: Float32Array, outT: Float32Array): void {
  const nb = rig.bones;
  let f: number;
  if (clip.frames <= 1) {
    f = 0;
  } else if (clip.loop) {
    /* The last frame of a loop is a repeat of the first, so the cycle is
       one step SHORTER than the frame count — using the full count holds
       the pose for a frame at the seam, which reads as a limp. */
    const span = clip.frames - 1;
    f = (((time / clip.seconds) * span) % span + span) % span;
  } else {
    f = Math.min(clip.frames - 1, Math.max(0, (time / clip.seconds) * (clip.frames - 1)));
  }
  const i = Math.floor(f);
  const j = Math.min(clip.frames - 1, i + 1);
  const g = f - i;

  for (let b = 0; b < nb; b++) {
    nlerp(clip.q, (i * nb + b) * 4, clip.q, (j * nb + b) * 4, g, outQ, b * 4, Q16);
  }
  for (let k = 0; k < 3; k++) outT[k] = clip.t[i * 3 + k] * (1 - g) + clip.t[j * 3 + k] * g;
}

/** Blend `b` into `a` by `f`, in place. Used to cross-fade clips. */
export function blendPose(nb: number, a: Float32Array, at: Float32Array,
                          b: Float32Array, bt: Float32Array, f: number): void {
  if (f <= 0) return;
  for (let i = 0; i < nb; i++) nlerp(a, i * 4, b, i * 4, f, a, i * 4);
  for (let k = 0; k < 3; k++) at[k] = at[k] * (1 - f) + bt[k] * f;
}

/* ------------------------------------------------------------ matrices */

function quatToMat(q: Float32Array, qo: number, t: ArrayLike<number>, to: number,
                   out: Float32Array, o: number): void {
  const x = q[qo], y = q[qo + 1], z = q[qo + 2], w = q[qo + 3];
  out[o] = 1 - 2 * (y * y + z * z); out[o + 1] = 2 * (x * y - z * w); out[o + 2] = 2 * (x * z + y * w); out[o + 3] = t[to];
  out[o + 4] = 2 * (x * y + z * w); out[o + 5] = 1 - 2 * (x * x + z * z); out[o + 6] = 2 * (y * z - x * w); out[o + 7] = t[to + 1];
  out[o + 8] = 2 * (x * z - y * w); out[o + 9] = 2 * (y * z + x * w); out[o + 10] = 1 - 2 * (x * x + y * y); out[o + 11] = t[to + 2];
  out[o + 12] = 0; out[o + 13] = 0; out[o + 14] = 0; out[o + 15] = 1;
}

/** `out = a · b`, row-major 4×4, at the given offsets. */
function mul(out: Float32Array, oo: number, a: Float32Array, ao: number, b: Float32Array, bo: number): void {
  for (let r = 0; r < 4; r++) {
    const a0 = a[ao + r * 4], a1 = a[ao + r * 4 + 1], a2 = a[ao + r * 4 + 2], a3 = a[ao + r * 4 + 3];
    for (let c = 0; c < 4; c++) {
      out[oo + r * 4 + c] = a0 * b[bo + c] + a1 * b[bo + 4 + c] + a2 * b[bo + 8 + c] + a3 * b[bo + 12 + c];
    }
  }
}

/**
 * Local rotations to world matrices, one forward pass.
 *
 * The bones ship parents-first, so a child's parent is always already
 * resolved and no recursion or sort is needed. The root carries the
 * normalisation from the bake, which is where the scale lives.
 */
export function composeWorld(rig: Rig, q: Float32Array, t: Float32Array, world: Float32Array): void {
  const local = composeWorld.scratch ??= new Float32Array(16);
  for (let b = 0; b < rig.bones; b++) {
    const p = rig.parent[b];
    if (p === 255) {
      quatToMat(q, b * 4, t, 0, local, 0);
      mul(world, b * 16, rig.S, 0, local, 0);
    } else {
      quatToMat(q, b * 4, rig.restT, b * 3, local, 0);
      mul(world, b * 16, world, p * 16, local, 0);
    }
  }
}
composeWorld.scratch = undefined as Float32Array | undefined;

/**
 * Turn a joint and everything below it about a world axis.
 *
 * The head is aimed after the clip has been composed, not before, because
 * the bones were authored with arbitrary local orientations — one ear's
 * local y is not the other's — and a rotation expressed in world axes
 * needs to know none of that. The pivot is read from the joint's CURRENT
 * world matrix, so applying these down a chain accumulates correctly:
 * by the time the head is turned, the neck has already moved it.
 */
export function turnSubtree(rig: Rig, world: Float32Array, subtree: Uint8Array[], joint: number,
                            yaw: number, pitch: number): void {
  if (!yaw && !pitch) return;
  const A = turnSubtree.a ??= new Float32Array(16);
  const T = turnSubtree.t ??= new Float32Array(16);
  const px = world[joint * 16 + 3], py = world[joint * 16 + 7], pz = world[joint * 16 + 11];

  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  /* Pitch about z then yaw about y, about the pivot — the same order the
     aim was measured in. */
  A[0] = cy * cp;  A[1] = -cy * sp; A[2] = sy;  A[3] = 0;
  A[4] = sp;       A[5] = cp;       A[6] = 0;   A[7] = 0;
  A[8] = -sy * cp; A[9] = sy * sp;  A[10] = cy; A[11] = 0;
  A[12] = 0; A[13] = 0; A[14] = 0; A[15] = 1;
  A[3] = px - (A[0] * px + A[1] * py + A[2] * pz);
  A[7] = py - (A[4] * px + A[5] * py + A[6] * pz);
  A[11] = pz - (A[8] * px + A[9] * py + A[10] * pz);

  const kids = subtree[joint];
  for (let i = 0; i < kids.length; i++) {
    const b = kids[i];
    T.set(world.subarray(b * 16, b * 16 + 16));
    mul(world, b * 16, A, 0, T, 0);
  }
}
turnSubtree.a = undefined as Float32Array | undefined;
turnSubtree.t = undefined as Float32Array | undefined;

/** For each bone, itself and every descendant — precomputed once. */
export function subtrees(rig: Rig): Uint8Array[] {
  const out: number[][] = Array.from({ length: rig.bones }, () => []);
  for (let b = 0; b < rig.bones; b++) {
    out[b].push(b);
    for (let p = rig.parent[b]; p !== 255; p = rig.parent[p]) out[p].push(b);
  }
  return out.map((a) => Uint8Array.from(a));
}

/** `world · invBind` per bone, which is what the shader consumes. */
export function skinMatrices(rig: Rig, world: Float32Array, out: Float32Array): void {
  for (let b = 0; b < rig.bones; b++) mul(out, b * 16, world, b * 16, rig.invBind, b * 16);
}
