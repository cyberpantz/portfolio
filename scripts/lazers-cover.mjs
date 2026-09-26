/**
 * Pose the cat for its cover shot, and hand the result to the renderer.
 *
 *   node scripts/lazers-cover.mjs
 *
 * This half runs the REAL behaviour and the REAL rig — the same Cat, the
 * same clips, the same camera and pointer plane the page uses — for a few
 * seconds with the laser parked where it makes the best picture, then
 * writes out the skinned vertices, the heading, and where the dot ended
 * up. `scripts/lazers-cover.py` draws it.
 *
 * It is split in two because the behaviour is TypeScript and the drawing
 * is numpy, and neither wants to be the other. The seam is a pose.
 *
 * Why not a browser: the cover for every other exploration is a Playwright
 * screenshot of the live page, which is the right way to do this and needs
 * a Chromium that will launch. Where that is available, prefer it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src/experiments/lazers');
const TMP = resolve(ROOT, '.scratch');
mkdirSync(TMP, { recursive: true });

/* The behaviour and the rig, bundled from source so this cannot drift from
   what ships. esbuild is a devDependency; if it is missing, say so. */
const entry = resolve(TMP, 'cover-entry.ts');
writeFileSync(entry, `export * from '${SRC}/rig';\nexport * from '${SRC}/behaviour';\nexport * from '${SRC}/stage';\n`);
const bundle = resolve(TMP, 'cover.mjs');
execFileSync('npx', ['esbuild', entry, '--bundle', '--format=esm', '--loader:.json=json',
                     `--outfile=${bundle}`, '--log-level=warning'], { stdio: 'inherit' });

const {
  parseRig, sampleClip, blendPose, composeWorld, subtrees, turnSubtree, skinMatrices,
  Cat, BONE, CAM_FOV, CAM_DIR, CAM_DIST, CAM_LOOK, planeNormal,
} = await import(`file://${bundle}`);

const raw = readFileSync(resolve(ROOT, 'public/cat.bin'));
const rig = parseRig(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
const kids = subtrees(rig);

/* ---- the camera, exactly as the page builds it ---- */
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

/* The cover is 4:3, and the page widens the shot on narrow aspects the
   same way — so the framing here is the framing a 4:3 window would get. */
const ASPECT = 4 / 3;
const dist = CAM_DIST / Math.min(1, ASPECT * 0.85);
const eye = CAM_DIR.map((x) => x * dist);
const fwd = unit([CAM_LOOK[0]-eye[0], CAM_LOOK[1]-eye[1], CAM_LOOK[2]-eye[2]]);
const right = unit(cross(fwd, [0, 1, 0]));
const up = cross(right, fwd);
const n = planeNormal(fwd);
const th = Math.tan((CAM_FOV * Math.PI) / 180 / 2);

const laserAt = (u, v) => {
  const d = unit([0, 1, 2].map((i) => fwd[i] + right[i] * u * th * ASPECT + up[i] * v * th));
  const k = -dot(n, eye) / dot(n, d);
  return { x: eye[0]+d[0]*k, y: eye[1]+d[1]*k, z: eye[2]+d[2]*k, present: true };
};

/*
 * Where to put the dot.
 *
 * Up and to the right, which is chosen for the silhouette rather than for
 * any number. The cat lifts its head to it instead of dropping its chin,
 * so the ears stay up and the line of the back and tail is unbroken —
 * whereas a dot near the floor buys a pose where the skull hides the face
 * and the animal reads as a hunched lump.
 *
 * High enough that it stays sitting rather than getting up to stalk, and
 * far enough off the body that the dot is not sitting on the cat.
 *
 * SHOT_U and SHOT_V override it, for trying others without editing this.
 */
const SHOT = {
  u: Number(process.env.SHOT_U ?? 0.55),
  v: Number(process.env.SHOT_V ?? 0.30),
  seconds: 9,
};

const q = new Float32Array(rig.bones * 4), t = new Float32Array(3);
const q2 = new Float32Array(rig.bones * 4), t2 = new Float32Array(3);
const world = new Float32Array(rig.bones * 16), M = new Float32Array(rig.bones * 16);
const dt = 1 / 60;

/* A fixed sequence for the cat's small unpredictabilities, so the cover is
   the same picture every time it is generated. */
let seed = 7;
const steady = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const cat = new Cat(steady);

let head = [0.58, 0.53, -0.19];
let paw = [0.9, -0.76, -0.09];
let drive;
const laser = laserAt(SHOT.u, SHOT.v);
for (let i = 0; i < SHOT.seconds / dt; i++) {
  drive = cat.update(dt, laser, head, paw);
  sampleClip(rig, rig.clips.get(drive.clip), drive.time, q, t);
  if (drive.from && drive.blend < 1) {
    sampleClip(rig, rig.clips.get(drive.from), drive.fromTime, q2, t2);
    blendPose(rig.bones, q, t, q2, t2, 1 - drive.blend);
  }
  composeWorld(rig, q, t, world);
  for (const tn of drive.turns) turnSubtree(rig, world, kids, tn.joint, tn.yaw, tn.pitch);
  const h = BONE.RigHead * 16, w = BONE.RigLFLegAnkle * 16;
  head = [world[h+3], world[h+7], world[h+11]];
  if (drive.clip !== 'swipe') paw = [world[w+3], world[w+7], world[w+11]];
}
if (drive.clip !== 'sit') {
  throw new Error(`cover wanted a sitting cat and got "${drive.clip}" — move SHOT`);
}

/* ---- skin, then swing by the heading exactly as the scene graph does ---- */
skinMatrices(rig, world, M);
const mesh = rig.mesh, nv = mesh.pos.length / 3;
const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
const c = Math.cos(drive.facing), s = Math.sin(drive.facing);
const [px, , pz] = drive.pivot;
for (let v = 0; v < nv; v++) {
  let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
  for (let k = 0; k < 4; k++) {
    const wt = mesh.wgt[v*4+k];
    if (!wt) continue;
    const o = mesh.idx[v*4+k] * 16;
    const m = (r, cc) => M[o + cc*4 + r];
    const ax = mesh.pos[v*3], ay = mesh.pos[v*3+1], az = mesh.pos[v*3+2];
    const bx = mesh.nrm[v*3], by = mesh.nrm[v*3+1], bz = mesh.nrm[v*3+2];
    x += wt*(m(0,0)*ax + m(0,1)*ay + m(0,2)*az + m(0,3));
    y += wt*(m(1,0)*ax + m(1,1)*ay + m(1,2)*az + m(1,3));
    z += wt*(m(2,0)*ax + m(2,1)*ay + m(2,2)*az + m(2,3));
    nx += wt*(m(0,0)*bx + m(0,1)*by + m(0,2)*bz);
    ny += wt*(m(1,0)*bx + m(1,1)*by + m(1,2)*bz);
    nz += wt*(m(2,0)*bx + m(2,1)*by + m(2,2)*bz);
  }
  const X = x - px, Z = z - pz;
  P[v*3] = px + X*c + Z*s; P[v*3+1] = y; P[v*3+2] = pz - X*s + Z*c;
  const NX = nx, NZ = nz, l = Math.hypot(nx, ny, nz) || 1;
  N[v*3] = (NX*c + NZ*s) / l; N[v*3+1] = ny / l; N[v*3+2] = (-NX*s + NZ*c) / l;
}

writeFileSync(resolve(TMP, 'cover.bin'), Buffer.from(new Float32Array([...P, ...N]).buffer));
writeFileSync(resolve(TMP, 'cover.json'), JSON.stringify({
  nv, tris: Array.from(mesh.tris), aspect: ASPECT,
  eye, fwd, right, up, fov: CAM_FOV,
  laser: [laser.x, laser.y, laser.z],
  clip: drive.clip, facing: drive.facing,
}));
console.log(`posed: ${drive.clip}, facing ${(drive.facing * 180 / Math.PI).toFixed(0)}°, laser at ` +
            `(${laser.x.toFixed(2)}, ${laser.y.toFixed(2)}, ${laser.z.toFixed(2)})`);
