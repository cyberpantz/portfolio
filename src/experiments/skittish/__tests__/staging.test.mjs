/**
 * The staging: where the cat ends up facing, for a pointer on the screen.
 *
 * This is a brief rather than a derivation — the piece is supposed to read
 * a particular way, and that reading is the requirement:
 *
 *   pointer in the middle, top half   →  back to the viewer, watching it
 *   pointer dead centre, on the cat   →  stops turning, sits idle
 *   pointer near the bottom           →  facing the viewer, down over it
 *
 * It drives the real rig, because the head and the paw come back OUT of
 * the rig and go back INTO the decision. A harness that guesses where they
 * are will pass a cat that spins on the spot, which is exactly what an
 * earlier one did.
 *
 * The camera and the pointer plane are imported, not restated. Everything
 * here depends on them jointly, and a copy that drifts would quietly start
 * checking a different piece.
 */
import { readFileSync } from 'node:fs';
import {
  parseRig, sampleClip, blendPose, composeWorld, subtrees, turnSubtree,
  Cat, BONE, TUNING, CAM_FOV, CAM_DIR, CAM_DIST, CAM_LOOK, planeNormal,
} from './.bundle.mjs';

let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : 'FAIL  ') + name + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
};

const raw = readFileSync('public/cat.bin');
const rig = parseRig(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const kids = subtrees(rig);

/* --- the camera, built the way the renderer builds it ------------------ */
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const eye = CAM_DIR.map((x) => x * CAM_DIST);
const fwd = unit([CAM_LOOK[0] - eye[0], CAM_LOOK[1] - eye[1], CAM_LOOK[2] - eye[2]]);
const right = unit(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);
const n = planeNormal(fwd);
const th = Math.tan((CAM_FOV * Math.PI) / 180 / 2);
const ASPECT = 16 / 9;

/** Where the laser lands, for a pointer at (u, v) in [-1, 1], v up. */
function laserAt(u, v) {
  const d = unit([0, 1, 2].map((i) => fwd[i] + right[i] * u * th * ASPECT + up[i] * v * th));
  const k = -dot(n, eye) / dot(n, d);
  return { x: eye[0] + d[0] * k, y: eye[1] + d[1] * k, z: eye[2] + d[2] * k, present: true };
}

/** The heading that points at the camera. Zero means facing the viewer. */
const CAM_HEADING = (-Math.atan2(CAM_DIR[2], CAM_DIR[0]) * 180) / Math.PI;
const relative = (facing) => (((facing * 180) / Math.PI - CAM_HEADING + 540) % 360) - 180;

/* --- run the real thing ------------------------------------------------ */
const q = new Float32Array(rig.bones * 4), t = new Float32Array(3);
const q2 = new Float32Array(rig.bones * 4), t2 = new Float32Array(3);
const world = new Float32Array(rig.bones * 16);
const dt = 1 / 60;

function hold(u, v, secs = 14) {
  const cat = new Cat();
  let head = [0.58, 0.53, -0.19];
  let paw = [0.9, -0.76, -0.09];
  const seen = new Set();
  let d, travel = 0, prev = 0;
  for (let i = 0; i < secs / dt; i++) {
    d = cat.update(dt, laserAt(u, v), head, paw);
    seen.add(d.clip);
    travel += Math.abs(d.facing - prev);
    prev = d.facing;

    sampleClip(rig, rig.clips.get(d.clip), d.time, q, t);
    if (d.from && d.blend < 1) {
      sampleClip(rig, rig.clips.get(d.from), d.fromTime, q2, t2);
      blendPose(rig.bones, q, t, q2, t2, 1 - d.blend);
    }
    composeWorld(rig, q, t, world);
    for (const tn of d.turns) turnSubtree(rig, world, kids, tn.joint, tn.yaw, tn.pitch);

    const h = BONE.RigHead * 16, w = BONE.RigLFLegAnkle * 16;
    head = [world[h + 3], world[h + 7], world[h + 11]];
    /* Only while the paw is down: once it lifts, the thing being reached
       for must not move with the reaching. */
    if (d.clip !== 'swipe') paw = [world[w + 3], world[w + 7], world[w + 11]];
  }
  return { clip: d.clip, face: relative(d.facing), y: laserAt(u, v).y, seen, travel };
}

const deg = (x) => `${x.toFixed(0)}°`;

{
  const r = hold(0, 0.85);
  ok('pointer top centre: the cat turns its back to the viewer',
     Math.abs(Math.abs(r.face) - 180) < 30, `facing ${deg(r.face)} off the camera`);
  ok('and stays sitting up there', r.clip === 'sit', [...r.seen].join('/'));
}
{
  const r = hold(0, -0.85);
  ok('pointer bottom centre: the cat faces the viewer',
     Math.abs(r.face) < 35, `facing ${deg(r.face)} off the camera`);
  ok('and is down over it, not sitting', r.clip !== 'sit', [...r.seen].join('/'));
  ok('and gets close enough to swipe at it', r.seen.has('swipe'), [...r.seen].join('/'));
}
{
  /* On top of the cat there is no direction to face, so it should stop
     rather than pick one. A few degrees of settling is fine; a turn is not. */
  const r = hold(0, 0);
  ok('pointer on the cat: it stops turning and idles',
     r.travel * 180 / Math.PI < 15 && r.clip === 'sit',
     `${deg((r.travel * 180) / Math.PI)} travelled, ended ${r.clip}`);
}
{
  const l = hold(-0.85, 0.1), r = hold(0.85, 0.1);
  ok('and it still turns left and right', Math.abs(l.face - r.face) > 45,
     `left ${deg(l.face)} vs right ${deg(r.face)}`);
}

/* --- the paw goes up before it comes down ------------------------------ */
{
  const cat = new Cat();
  let head = [0.58, 0.53, -0.19];
  let paw = [0.9, -0.76, -0.09];
  let poised = 0, struck = 0, wasSwipe = false;
  for (let i = 0; i < 30 / dt; i++) {
    const d = cat.update(dt, laserAt(0, -0.85), head, paw);
    if (d.clip === 'swipe') {
      if (!wasSwipe) poised++;
      if (d.time > TUNING.poiseAt + 1e-6) struck++;
    }
    wasSwipe = d.clip === 'swipe';

    sampleClip(rig, rig.clips.get(d.clip), d.time, q, t);
    if (d.from && d.blend < 1) {
      sampleClip(rig, rig.clips.get(d.from), d.fromTime, q2, t2);
      blendPose(rig.bones, q, t, q2, t2, 1 - d.blend);
    }
    composeWorld(rig, q, t, world);
    for (const tn of d.turns) turnSubtree(rig, world, kids, tn.joint, tn.yaw, tn.pitch);
    const h = BONE.RigHead * 16, w = BONE.RigLFLegAnkle * 16;
    head = [world[h + 3], world[h + 7], world[h + 11]];
    if (d.clip !== 'swipe') paw = [world[w + 3], world[w + 7], world[w + 11]];
  }
  ok('it raises the paw at a dot by its foot', poised >= 2, `${poised} times in 30s`);
  /* Held frames, not struck frames: the hold is most of the gesture. */
  ok('and holds it up before committing', struck > 0 && struck < 30 / dt * 0.5,
     `${struck} frames past the poise`);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
