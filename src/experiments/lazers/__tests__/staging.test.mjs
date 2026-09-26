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

/* A fixed sequence in place of Math.random, so "did it swipe" is a fact
   about the code rather than about this particular run. */
const steady = () => { let i = 0; return () => ((i = (i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };

function hold(u, v, secs = 14) {
  const cat = new Cat(steady());
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
  /* Ear fold and head pitch, summed the way the rig applies them, so what
     is measured is what the cat actually does rather than one term of it. */
  const ear = -(d.turns.filter((x) => x.joint === BONE.RigLEar1)
    .reduce((a, x) => a + x.pitch, 0)) * 180 / Math.PI;
  const look = TUNING.chain.reduce(
    (a, [n]) => a + d.turns.filter((x) => x.joint === BONE[n]).reduce((b, x) => b + x.pitch, 0), 0
  ) * 180 / Math.PI;
  return { clip: d.clip, face: relative(d.facing), y: laserAt(u, v).y, seen, travel, ears: ear, look };
}

const deg = (x) => `${x.toFixed(0)}°`;

{
  const r = hold(0, 0.85);
  ok('pointer top centre: the cat turns its back to the viewer',
     Math.abs(Math.abs(r.face) - 180) < 30, `facing ${deg(r.face)} off the camera`);
  ok('and stays sitting up there', r.clip === 'sit', [...r.seen].join('/'));
}
{
  /*
   * Low and near: the dot is at the cat's feet, where there is nothing to
   * stalk. It sits up and stares down at it instead — measured at about
   * 0.95 from the cat, inside the 1.2 it takes to be worth stalking.
   */
  const r = hold(0, -0.85);
  ok('pointer bottom centre: the cat faces the viewer',
     Math.abs(r.face) < 35, `facing ${deg(r.face)} off the camera`);
  ok('and sits up rather than stalking it', !r.seen.has('sneak'), [...r.seen].join('/'));
  ok('and puts its ears back about it', r.ears > 20, `${deg(r.ears)} of ear`);
  ok('and looks down far enough to actually see it', r.look < -35,
     `head pitched ${deg(r.look)}`);
}
{
  /* Low and off to the side: far enough away to be worth getting up for. */
  const r = hold(-0.9, -0.8, 18);
  ok('pointer low and to the side: it does stalk', r.seen.has('sneak'),
     [...r.seen].join('/'));
  ok('and its ears stay up while it does', r.ears < 8, `${deg(r.ears)} of ear`);
}
{
  /* On top of the cat there is no direction to face, so it should stop
     rather than pick one. A few degrees of settling is fine; a turn is not. */
  const r = hold(0, 0);
  ok('pointer on the cat: it stops turning',
     (r.travel * 180) / Math.PI < 15, `${deg((r.travel * 180) / Math.PI)} travelled`);
  /*
   * And stays sitting. With the camera aimed lower, the middle of the frame
   * falls near the cat's front feet rather than on its body — so a paw may
   * well come up for it, which is fine. What it must not do is get up.
   */
  ok('and does not get up for it',
     !r.seen.has('sneak') && !r.seen.has('rise'), [...r.seen].join('/'));
}
{
  const l = hold(-0.85, 0.1), r = hold(0.85, 0.1);
  ok('and it still turns left and right', Math.abs(l.face - r.face) > 45,
     `left ${deg(l.face)} vs right ${deg(r.face)}`);
}

/* --- a dot going back and forth, anywhere in the middle ---------------- */
{
  /*
   * The neck does this, not the hips.
   *
   * Sitting and fixed on something underfoot, a sideways sweep of the hand
   * should move the head and leave the body alone — the dot is close, so a
   * small move swings a large angle at the pivot, and a body that answers
   * every one of them shuffles on the spot forever. The neck reaches 62°
   * either way, which is most of the frame at that distance.
   */
  const cat = new Cat(steady());
  let head = [0.58, 0.53, -0.19];
  let paw = [0.9, -0.76, -0.09];
  let bodyTravel = 0, prevBody = 0;
  let minYaw = 1e9, maxYaw = -1e9;

  for (let i = 0; i < 26 / dt; i++) {
    const now = i * dt;
    /* Settle facing it for six seconds, then sweep left and right. */
    /* ±0.30 of the frame. Measured: at this distance the dot sits 0.58
       from the cat, and the neck's 62° covers out to about ±0.38 — past
       that the body genuinely has to help, and should. */
    const u = now < 6 ? 0 : 0.30 * Math.sin((now - 6) * 1.5);
    const d = cat.update(dt, laserAt(u, -0.5), head, paw);

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

    if (now > 6) {
      bodyTravel += Math.abs(d.facing - prevBody);
      const yaw = TUNING.chain.reduce(
        (a, [n]) => a + d.turns.filter((x) => x.joint === BONE[n]).reduce((b, x) => b + x.yaw, 0), 0
      );
      minYaw = Math.min(minYaw, yaw);
      maxYaw = Math.max(maxYaw, yaw);
    }
    prevBody = d.facing;
  }

  const swept = ((maxYaw - minYaw) * 180) / Math.PI;
  ok('a dot sweeping at its feet is followed by the head',
     swept > 30, `${swept.toFixed(0)}° of neck`);
  ok('and the body stays where it is',
     (bodyTravel * 180) / Math.PI < 20, `${deg((bodyTravel * 180) / Math.PI)} of body`);
}

/* --- the same, with its back to you ------------------------------------ */
{
  /*
   * A dot at the top of the frame puts the cat's back to the viewer, and a
   * sweep there should move the same things a sweep at its feet does: the
   * head, and not the hips. Before, the body was dragged through 113° by a
   * dot that swung 64°, while the head sat three degrees off centre and
   * did not track at all — the movement test measured x and y and the
   * sweep was mostly in z.
   */
  const cat = new Cat(steady());
  let head = [0.58, 0.53, -0.19];
  let paw = [0.9, -0.76, -0.09];
  let bodyTravel = 0, prevBody = 0, started = false;
  let minYaw = 1e9, maxYaw = -1e9, earSwing = 0;

  for (let i = 0; i < 26 / dt; i++) {
    const now = i * dt;
    const u = now < 8 ? 0 : 0.30 * Math.sin((now - 8) * 1.5);
    const d = cat.update(dt, laserAt(u, 0.85), head, paw);

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

    if (now > 8) {
      if (!started) { prevBody = d.facing; started = true; }
      bodyTravel += Math.abs(d.facing - prevBody);
      prevBody = d.facing;
      const yaw = TUNING.chain.reduce(
        (a, [nm]) => a + d.turns.filter((x) => x.joint === BONE[nm]).reduce((b, x) => b + x.yaw, 0), 0
      );
      minYaw = Math.min(minYaw, yaw);
      maxYaw = Math.max(maxYaw, yaw);
      earSwing = Math.max(earSwing,
        Math.abs(d.turns.filter((x) => x.joint === BONE.RigLEar1).reduce((b, x) => b + x.yaw, 0)));
    }
  }

  const swept = ((maxYaw - minYaw) * 180) / Math.PI;
  ok('a dot sweeping behind it is followed by the head', swept > 30, `${swept.toFixed(0)}° of neck`);
  ok('and the body stays there too',
     (bodyTravel * 180) / Math.PI < 20, `${deg((bodyTravel * 180) / Math.PI)} of body`);
  ok('and the ears swivel with it', (earSwing * 180) / Math.PI > 2,
     `${deg((earSwing * 180) / Math.PI)} of ear`);
}

/* --- it can see movement that is purely in depth ----------------------- */
{
  /*
   * The test for "has the dot moved" is what gates re-aiming, and it used
   * to ignore z. On the tilted pointer plane a sideways sweep is mostly x
   * and z, so a movement with no x or y component at all — which this is —
   * was invisible: the cat would watch the first position forever.
   */
  const cat = new Cat(steady());
  const head = [0.58, 0.53, -0.19], paw = [0.32, -0.76, -0.10];
  const yaws = [];
  for (let i = 0; i < 14 / dt; i++) {
    const now = i * dt;
    const z = now < 6 ? -1.2 : -1.2 + 1.6 * Math.sin((now - 6) * 1.2);
    const d = cat.update(dt, { x: 1.4, y: 0.25, z, present: true }, head, paw);
    if (now > 6) {
      yaws.push(TUNING.chain.reduce(
        (a, [nm]) => a + d.turns.filter((x) => x.joint === BONE[nm]).reduce((b, x) => b + x.yaw, 0), 0));
    }
  }
  const range = ((Math.max(...yaws) - Math.min(...yaws)) * 180) / Math.PI;
  ok('a dot moving only in depth is noticed', range > 15, `${range.toFixed(0)}° of neck`);
}

/* --- the paw goes up before it comes down ------------------------------ */
{
  const cat = new Cat(steady());
  let head = [0.58, 0.53, -0.19];
  let paw = [0.9, -0.76, -0.09];
  let poised = 0, struck = 0, wasSwipe = false;
  for (let i = 0; i < 30 / dt; i++) {
    /* Low and close in — where the cat sits up, stares, and swats. A dot
       further out is something it stalks instead, and never reaches. */
    const d = cat.update(dt, laserAt(0, -0.25), head, paw);
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
