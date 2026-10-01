/** The boss fight's rules, without a DOM. */
import { fight, start, tuning, quarter, ENTRANCE_MS, BURST_MS, RESPAWN_MS, GLITCH_MS, IDLE_MS } from '../components/boss/fight.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  FAIL ' + m); } };

const L = [
  { name: 'XAL-9000', card: '', greeting: '', taunts: [], rate: 5, seconds: 5 },
  { name: 'XAL-9001', card: '', greeting: '', taunts: [], rate: 6, seconds: 5 },
];
const step = fight(L);
const fighting = (level = 0) => (level ? start(0, 'level2') : step(start(0), { e: 'skip', t: 0 }));

/** Ticks every 16ms and presses at `rate`/s until `secs` pass or the phase changes. */
function mash(s, rate, secs, { repeat = false } = {}) {
  let t = s.at, next = t, first = true;
  const end = t + secs * 1000;
  while (t < end && s.phase === 'fighting') {
    t += 16;
    s = step(s, { e: 'tick', t });
    if (rate && t >= next) {
      s = step(s, { e: 'press', t, repeat: repeat && !first });
      first = false;
      next += 1000 / rate;
    }
  }
  return s;
}
const until = (s, ms) => step(s, { e: 'tick', t: s.at + ms + 1 });

let s = fighting();
const pressed = step(s, { e: 'press', t: 10 });
ok(pressed.size > 0 && pressed.size === tuning(L[0]).step, 'a press grows him by one step');
ok(step(pressed, { e: 'tick', t: 1010 }).size < pressed.size, 'a tick shrinks him');

const idle = step(pressed, { e: 'tick', t: 10 + IDLE_MS + 1 });
ok(idle.size === 0 && idle.idle && idle.phase === 'fighting', 'ten idle seconds settle him to rest and the fight waits');

ok(mash(fighting(), 5, 5.3).phase === 'burst', 'level 1 bursts at 5/s within 5.3s');
ok(mash(fighting(), 3.5, 30).phase === 'fighting', 'level 1 never bursts at 70% of the rate');
const held = mash(fighting(), 30, 10, { repeat: true });
ok(held.phase === 'fighting' && held.size < 0.2, 'a held key (auto-repeat) cannot win');
ok(mash(fighting(1), 5, 5.3).phase === 'fighting', 'level 2 is harder: level 1’s pace does not burst it in time');

const gap = step(pressed, { e: 'tick', t: 10 + 600_000 });
ok(Number.isFinite(gap.size) && gap.size >= 0 && gap.size <= 1, 'a hidden-tab gap leaves size finite and in range');

// The whole arc: burst → respawn at level 2 → glitch → failed.
let arc = mash(fighting(), 6, 6);
ok(arc.phase === 'burst' && arc.level === 0, 'first burst');
arc = until(arc, BURST_MS);
ok(arc.phase === 'respawn' && arc.level === 1 && arc.size === 0, 'respawns at level 2, at rest');
arc = until(arc, RESPAWN_MS);
ok(arc.phase === 'fighting', 'level 2 begins');
arc = mash(arc, 6.5, 8);
ok(arc.phase === 'glitch', 'the second burst glitches instead of exploding');
arc = until(arc, GLITCH_MS);
ok(arc.phase === 'failed', 'and then it fails');

ok(until(start(0), ENTRANCE_MS).phase === 'fighting', 'the entrance ends on its own');
ok(step(fighting(), { e: 'flee', t: 1 }).phase === 'fled', 'flee from level 1');
ok(step(fighting(1), { e: 'flee', t: 1 }).phase === 'fled', 'flee from level 2');
ok(start(0, 'failed').phase === 'failed', 'the state browser can open on the failure');
ok(quarter(0) === 0 && quarter(0.3) === 25 && quarter(1) === 75, 'size announces in 25% steps, never 100 before bursting');

const { isPressKey } = await import('../components/boss/keys.ts');
const btn = { closest: () => btn };
const leave = { closest: () => leave };
const body = { closest: () => null };
ok(isPressKey({ key: ' ', target: body }, btn), 'Space on the page is a press');
ok(isPressKey({ key: 'Enter', target: btn }, btn), 'Enter on the Cancel button is a press');
ok(!isPressKey({ key: 'Enter', target: leave }, btn), 'Enter on Return to chat is not a press');
ok(!isPressKey({ key: 'a', target: body }, btn), 'other keys are not presses');

console.log(fails ? `\n${fails} FAILED` : '  all fight assertions pass');
process.exit(fails ? 1 : 0);
