/**
 * What the cat must keep doing.
 *
 * No GPU here, so the shader cannot be run — but everything above it is
 * arithmetic, and every one of these assertions exists because the cat once
 * got it wrong on screen.
 */
import { Cat, BONE, TUNING, CLIP_META } from './.bundle.mjs';

const dt = 1 / 60;
const HEAD = [0.58, 0.53, -0.19];
const deg = (x) => ((x * 180) / Math.PI).toFixed(1);

let fail = 0;
const ok = (name, cond, extra = '') => {
  console.log((cond ? '  ok  ' : 'FAIL  ') + name + (extra ? '   ' + extra : ''));
  if (!cond) fail++;
};

/** Run for `secs` with a fixed pointer, returning the last drive and a log. */
function run(cat, pt, secs, log) {
  let d;
  for (let i = 0; i < secs / dt; i++) {
    d = cat.update(dt, pt, HEAD);
    if (log && (!log.length || log[log.length - 1] !== d.clip)) log.push(d.clip);
  }
  return d;
}

const HIGH = { x: 1.5, y: 0.55, z: 0.3, present: true };
const FLOOR = { x: 1.0, y: -0.8, z: 0.15, present: true };
const turn = (d, j) => d.turns.find((t) => t.joint === j) ?? { yaw: 0, pitch: 0 };

/* --- the cat sits until something goes near the floor ------------------ */
{
  const cat = new Cat();
  const log = [];
  ok('starts sitting', run(cat, HIGH, 3, log).clip === 'sit', log.join(' → '));
}

/* --- and gets up properly, rather than snapping into the crouch -------- */
{
  const cat = new Cat();
  const log = [];
  run(cat, HIGH, 1, log);
  run(cat, FLOOR, 6, log);
  /* Either is a pass: a laser on the floor is also within paw range, so
     the crouched cat is entitled to be mid-swipe when the clock stops. */
  ok('crouches when the laser goes to the floor', log.includes('sneak'), log.join(' → '));
  ok('gets there through the stand-up transition', log.includes('rise'), log.join(' → '));

  /* --- and sits back down when it goes away --------------------------- */
  const back = [];
  const up = run(cat, HIGH, 6, back);
  ok('sits back down when the laser leaves the floor', up.clip === 'sit', back.join(' → '));
  ok('sits down through a transition too', back.includes('settle'), back.join(' → '));
}

/* --- the swipe is a real clip, and it is not continuous ---------------- */
{
  const cat = new Cat();
  run(cat, HIGH, 1);
  run(cat, FLOOR, 3);
  let swipes = 0;
  let was = '';
  const near = { x: 0.95, y: -0.8, z: 0.05, present: true };
  for (let i = 0; i < 20 / dt; i++) {
    const d = cat.update(dt, near, HEAD);
    if (d.clip === 'swipe' && was !== 'swipe') swipes++;
    was = d.clip;
  }
  const swipeLen = CLIP_META.find((c) => c.name === 'swipe').seconds;
  /* Twenty seconds, a swipe of about a second, and a rest of at least
     `pawEvery[0]` after each. More than this many means the cooldown is
     being measured from the wrong end — which it was. */
  const most = 20 / (swipeLen + TUNING.pawEvery[0]);
  ok('swipes at a laser by the paw', swipes >= 3, `${swipes} in 20s`);
  ok('rests between swipes', swipes <= most, `${swipes} of at most ${most.toFixed(0)}`);
}

/* --- it does not swat at something above its own head ------------------ */
{
  const cat = new Cat();
  const log = [];
  run(cat, { x: 0.95, y: 0.7, z: 0.05, present: true }, 12, log);
  ok('ignores a laser it cannot reach', !log.includes('swipe'), log.join(' → '));
}

/* --- the turn is not rigid: the spine twists, then unwinds -------------- */
{
  const cat = new Cat();
  const behind = { x: -1.2, y: 0.1, z: 1.1, present: true };
  let peak = 0;
  for (let i = 0; i < 1.2 / dt; i++) {
    peak = Math.max(peak, Math.abs(turn(cat.update(dt, behind, HEAD), BONE.RigSpine1).yaw));
  }
  ok('the spine twists during a turn', peak > 4 * (Math.PI / 180), `peak ${deg(peak)}°`);
  ok('the twist is bounded by the spine', peak <= TUNING.twistMax + 1e-9);
  const settled = run(cat, behind, 6);
  ok('the twist unwinds once the turn finishes',
     Math.abs(turn(settled, BONE.RigSpine1).yaw) < 1.5 * (Math.PI / 180));
}

/* --- the sitting cat is not a statue ----------------------------------- */
{
  const cat = new Cat();
  const seen = new Set();
  let tail = 0;
  for (let i = 0; i < 6 / dt; i++) {
    const d = cat.update(dt, HIGH, HEAD);
    seen.add(turn(d, BONE.RigChest).pitch.toFixed(4));
    tail = Math.max(tail, Math.abs(turn(d, BONE.RigTail4).yaw));
  }
  /* The sitting clip is one frame that does not move at all, so if these
     are flat the cat is a taxidermy exhibit. */
  ok('breathes while sitting', seen.size > 50, `${seen.size} distinct chest angles`);
  ok('switches its tail while sitting', tail > 0.5 * (Math.PI / 180), `${deg(tail)}°`);
}

/* --- and nothing has gone non-finite ----------------------------------- */
{
  const cat = new Cat();
  run(cat, HIGH, 2);
  const d = run(cat, FLOOR, 8);
  const all = d.turns.flatMap((t) => [t.yaw, t.pitch]).concat(d.facing, d.pivot, d.blend, d.time);
  ok('every number is finite', all.every(Number.isFinite));
  ok('the blend is a fraction', d.blend >= 0 && d.blend <= 1);
}

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
