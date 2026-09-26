/**
 * The rig, checked against the file that actually ships.
 *
 * `check-rig.py` proves the bake is faithful to the source animation.
 * This proves the TypeScript that reads it agrees with the Python that
 * wrote it, and that the matrices handed to the GPU are in the layout the
 * shader expects — which is the one thing in this piece that can be
 * completely wrong while every number involved is perfectly finite.
 */
import { readFileSync } from 'node:fs';
import { parseRig, sampleClip, composeWorld, subtrees, turnSubtree, skinMatrices, BONE } from './.bundle.mjs';

let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : 'FAIL  ') + name + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
};

const raw = readFileSync('public/cat.bin');
const rig = parseRig(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));

ok('the file parses to the end', rig.bones > 0);
ok('every clip named by the behaviour layer exists',
   ['sit', 'rise', 'sneak', 'settle', 'swipe'].every((n) => rig.clips.has(n)),
   [...rig.clips.keys()].join(', '));
ok('parents always come before their children',
   Array.from(rig.parent).every((p, i) => p === 255 || p < i));
ok('every joint the behaviour layer steers is a real bone',
   ['RigSpine1', 'RigChest', 'RigNeck3', 'RigNeck4', 'RigHead', 'RigTail1', 'RigTail6']
     .every((n) => BONE[n] !== undefined && BONE[n] < rig.bones));

const nv = rig.mesh.pos.length / 3;
ok('every weight references a bone that exists',
   Array.from(rig.mesh.idx).every((i) => i < rig.bones));
{
  let bad = 0;
  for (let v = 0; v < nv; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += rig.mesh.wgt[v * 4 + k];
    if (Math.abs(s - 1) > 0.02) bad++;
  }
  /* A vertex whose weights sum to zero falls to the origin and takes a
     visible piece of the cat with it. */
  ok('every vertex is fully weighted', bad === 0, `${bad} of ${nv} off`);
}

/* --- every clip stands in the same place ------------------------------- */
{
  /*
   * Root motion is flattened per clip so a walk cycle does not travel.
   * Flattened onto ZERO rather than onto a shared home, each clip lands
   * somewhere slightly different and the cat jumps sideways every time it
   * stands up or sits down — and a single-frame clip like the sit loses
   * its placement entirely, because its mean IS its only value. That moved
   * the whole animal half a head and put it outside its own framing.
   */
  /* Root translations are still in the source's axes, where Z is UP — so
     the two that are flattened, and the two to compare, are X and Y. The
     third is left free on purpose: the rise and fall of the body is the
     gait, and the swipe rears a whole body-height off the floor. */
  /* Each clip's AVERAGE position, not each frame's. A clip is allowed to
     travel inside itself — the swipe lunges most of a body-length forward
     and comes back — and flattening is about where it sits on average. */
  const mean = (clip) => {
    let x = 0, y = 0;
    for (let f = 0; f < clip.frames; f++) { x += clip.t[f * 3]; y += clip.t[f * 3 + 1]; }
    return [x / clip.frames, y / clip.frames];
  };
  const home = mean(rig.clips.get('sit'));
  let worst = 0, where = '';
  for (const [name, clip] of rig.clips) {
    const m = mean(clip);
    const d = Math.hypot(m[0] - home[0], m[1] - home[1]);
    if (d > worst) { worst = d; where = name; }
  }
  ok('every clip is rooted in the same place', worst < 1e-3,
     `worst ${worst.toExponential(1)} (${where})`);
}

/* --- the bind mesh is framed where the sit expects it ------------------ */
{
  const q = new Float32Array(rig.bones * 4), t = new Float32Array(3);
  const world = new Float32Array(rig.bones * 16), M = new Float32Array(rig.bones * 16);
  sampleClip(rig, rig.clips.get('sit'), 0, q, t);
  composeWorld(rig, q, t, world);
  skinMatrices(rig, world, M);
  const mesh = rig.mesh, nv = mesh.pos.length / 3;
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let v = 0; v < nv; v++) {
    const o = [0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const w = mesh.wgt[v * 4 + k];
      if (!w) continue;
      const b = mesh.idx[v * 4 + k] * 16;
      const m = (r, c) => M[b + c * 4 + r];
      for (let r = 0; r < 3; r++) {
        o[r] += w * (m(r, 0) * mesh.pos[v * 3] + m(r, 1) * mesh.pos[v * 3 + 1]
                   + m(r, 2) * mesh.pos[v * 3 + 2] + m(r, 3));
      }
    }
    for (let r = 0; r < 3; r++) { lo[r] = Math.min(lo[r], o[r]); hi[r] = Math.max(hi[r], o[r]); }
  }
  /* The normalisation fits the SIT into a box two units across centred on
     the origin, so this is the one pose whose extent is known exactly. Any
     drift here means something has shifted the cat out of its framing. */
  const off = Math.max(Math.abs(lo[0] + 1), Math.abs(hi[0] - 1), Math.abs(lo[1] + hi[1]));
  ok('the sitting cat sits inside its own framing', off < 0.05,
     `x ${lo[0].toFixed(2)}..${hi[0].toFixed(2)}  y ${lo[1].toFixed(2)}..${hi[1].toFixed(2)}`);
}

/* --- the layout the shader reads --------------------------------------- */
{
  const q = new Float32Array(rig.bones * 4);
  const t = new Float32Array(3);
  const world = new Float32Array(rig.bones * 16);
  const gpu = new Float32Array(rig.bones * 16);
  sampleClip(rig, rig.clips.get('sneak'), 1.4, q, t);
  composeWorld(rig, q, t, world);
  turnSubtree(world, subtrees(rig), BONE.RigHead, 0.4, -0.2);
  skinMatrices(rig, world, gpu);

  ok('the bone matrices are finite', Array.from(gpu).every(Number.isFinite));

  /*
   * The shader builds each matrix with mat4(a, b, c, d), and GLSL's mat4
   * constructor takes COLUMNS. So texel k of a bone must be column k.
   * Reading it back that way has to reproduce the row-major product —
   * and if it does not, the cat draws as a spray of shredded fans while
   * every number in the buffer stays perfectly finite.
   */
  const b = BONE.RigHead;
  const asColumns = (r, c) => gpu[b * 16 + c * 4 + r];
  let worstRow = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const want = r === 3 ? (c === 3 ? 1 : 0) : null;
      if (want !== null) worstRow = Math.max(worstRow, Math.abs(asColumns(r, c) - want));
    }
  }
  /* Read as columns, the bottom row must be (0, 0, 0, 1) — the signature
     of an affine transform the right way up. Transposed, it is the
     translation instead, which is never (0, 0, 0, 1) for a moving bone. */
  ok('bone matrices are stored column-major, as the shader reads them',
     worstRow < 1e-6, `bottom row off by ${worstRow.toExponential(1)}`);

  const tx = asColumns(0, 3), ty = asColumns(1, 3), tz = asColumns(2, 3);
  ok('and the head bone actually carries a translation',
     Math.hypot(tx, ty, tz) > 1e-3, `|t| = ${Math.hypot(tx, ty, tz).toFixed(3)}`);
}

/* --- clips stay on one side of the quaternion double cover ------------- */
{
  const q = new Float32Array(rig.bones * 4);
  const t = new Float32Array(3);
  const prev = new Float32Array(rig.bones * 4);
  let worst = 1;
  let where = '';
  for (const [name, clip] of rig.clips) {
    for (let f = 0; f < clip.frames; f++) {
      const at = clip.frames <= 1 ? 0 : (f / (clip.frames - 1)) * clip.seconds;
      sampleClip(rig, clip, at, q, t);
      if (f) {
        for (let b = 0; b < rig.bones; b++) {
          let d = 0;
          for (let k = 0; k < 4; k++) d += q[b * 4 + k] * prev[b * 4 + k];
          if (d < worst) { worst = d; where = `${name} bone ${b} frame ${f}`; }
        }
      }
      prev.set(q);
    }
  }
  /*
   * A NEGATIVE dot is the failure. A quaternion and its negative are the
   * same rotation, so a sign flip between adjacent frames is invisible in
   * the data and sends the interpolation the long way round — a leg
   * swinging through the cat instead of under it. The bake normalises the
   * sign across each clip; this is what proves it.
   *
   * A small positive dot is not a bug, it is a fast frame. The swipe's
   * ankle turns about sixty degrees in a thirtieth of a second, which is
   * what a cat striking at something looks like.
   */
  ok('no bone flips sign between frames', worst > 0, `closest dot ${worst.toFixed(3)} (${where})`);
  ok('and no frame is an implausible jump', worst > 0.6, `closest dot ${worst.toFixed(3)}`);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
