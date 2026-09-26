/**
 * What the cat must keep doing.
 *
 * No GPU here, so the shader cannot be run — but the behaviour is pure
 * arithmetic over a pose, and every one of these assertions exists because
 * the cat once got it wrong on screen.
 */
import { Cat, JOINT, TUNING } from './.bundle.mjs';
const dt = 1/60;
const run = (cat, pt, secs) => { let r; for (let i=0;i<secs/dt;i++) r = cat.update(dt, pt); return r; };
const deg = x => (x*180/Math.PI).toFixed(1);
let fail = 0;
const ok = (name, cond, extra='') => { console.log((cond?'  ok  ':'FAIL  ')+name+(extra?'   '+extra:'')); if(!cond) fail++; };

// 1. crouch: low pointer drops the chest, high pointer does not
const a = new Cat(); const hi = run(a, {x:1.4,y:0.6,z:0.2,present:true}, 6);
const b = new Cat(); const lo = run(b, {x:1.4,y:-0.75,z:0.2,present:true}, 6);
const cz = p => (p.get(JOINT.RigChest)||[0,0,0])[2];
ok('chest level when the laser is high', Math.abs(cz(hi.pose)) < 3*Math.PI/180, `chest ${deg(cz(hi.pose))}°`);
ok('chest drops when the laser is on the floor', cz(lo.pose) < -12*Math.PI/180, `chest ${deg(cz(lo.pose))}°`);

// head keeps its aim through the crouch
const chainPitch = p => TUNING.chain.reduce((s,[n])=> s + ((p.get(JOINT[n])||[0,0,0])[2]), 0);
const netLo = cz(lo.pose) + chainPitch(lo.pose);
const wantLo = Math.atan2(-0.75-0.529, Math.hypot(1.4-0.576, 0.2+0.189));
ok('head still aimed at the floor target', Math.abs(netLo - Math.max(wantLo,-TUNING.pitchMax)) < 6*Math.PI/180,
   `net ${deg(netLo)}° vs wanted ${deg(Math.max(wantLo,-TUNING.pitchMax))}°`);

// 2. the crouch releases when the pointer leaves
const rel = run(b, {x:0,y:0,z:0,present:false}, 4);
ok('crouch releases when the pointer goes', Math.abs(cz(rel.pose)) < 3*Math.PI/180, `chest ${deg(cz(rel.pose))}°`);

// 3. non-rigid turn: mid-turn the chest is twisted and the hips lag
const c = new Cat(); const pt = {x:-1.2,y:0.1,z:1.1,present:true};
let sawTwist = 0, hipsBehind = false;
for (let i=0;i<Math.round(1.2/dt);i++) {
  const r = c.update(dt, pt);
  const t = (r.pose.get(JOINT.RigChest)||[0,0,0])[1];
  sawTwist = Math.max(sawTwist, Math.abs(t));
  if (Math.abs(t) > 2*Math.PI/180) hipsBehind = true;
}
ok('the chest twists during a turn (hips lag)', hipsBehind && sawTwist > 4*Math.PI/180, `peak twist ${deg(sawTwist)}°`);
const settled = run(c, pt, 6);
const tw = (settled.pose.get(JOINT.RigChest)||[0,0,0])[1];
ok('the twist unwinds once the turn finishes', Math.abs(tw) < 1.5*Math.PI/180, `twist ${deg(tw)}°`);
ok('the turn is bounded by the spine', sawTwist <= TUNING.twistMax + 1e-6);

// 4. nothing has gone non-finite
const all = [...settled.pose.values(), ...lo.pose.values()].flat();
ok('every angle is finite', all.every(Number.isFinite) && Number.isFinite(settled.facing));
console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail?1:0);
