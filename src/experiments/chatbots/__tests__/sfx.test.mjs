/** The sound module with a fake AudioContext: missing files are silence, never errors. */
import { createSfx, FILE_CUES } from '../sound/sfx.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  FAIL ' + m); } };

const param = () => ({ value: 1, setValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {} });
function fakeCtx({ decode = 'ok' } = {}) {
  const started = [];
  return {
    started,
    currentTime: 0,
    destination: {},
    resume: async () => {},
    createGain: () => ({ gain: param(), connect(n) { return n; } }),
    createDynamicsCompressor: () => ({ threshold: param(), ratio: param(), attack: param(), release: param(), knee: param(), connect(n) { return n; } }),
    createBufferSource() {
      const src = { buffer: null, loop: false, playbackRate: param(), connect(n) { return n; },
        start() { started.push(src); }, stop() { src.stopped = true; }, onended: null };
      return src;
    },
    decodeAudioData: async () => { if (decode === 'fail') throw new Error('bad mp3'); return { duration: 1 }; },
  };
}

// Missing file: play returns null, nothing throws.
{
  const ctx = fakeCtx();
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => null });
  await s.unlock(); await s.preload();
  ok(s.play('explosion') === null, 'a missing file plays nothing');
}
// Undecodable file: same.
{
  const ctx = fakeCtx({ decode: 'fail' });
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => new ArrayBuffer(8) });
  await s.unlock(); await s.preload();
  ok(s.play('explosion') === null, 'an undecodable file plays nothing');
}
// No Web Audio at all.
{
  const s = createSfx({ makeContext: () => null, fetchFile: async () => null });
  await s.unlock(); await s.preload();
  let threw = false;
  try { s.play('klaxon'); s.press(); s.charge(0.5); s.glitch(); s.chime(); s.stopAll(); } catch { threw = true; }
  ok(!threw, 'without an AudioContext every call is a silent no-op');
}
// Loaded file plays; stopAll stops it; disabled plays nothing and is remembered.
{
  const ctx = fakeCtx();
  let stored = null;
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => new ArrayBuffer(8), store: { get: () => stored, set: (v) => { stored = v; } } });
  await s.unlock(); await s.preload();
  ok(typeof s.play('boss-loop', { loop: true }) === 'function', 'a loaded file plays');
  s.stopAll();
  ok(ctx.started.every((x) => x.stopped), 'stopAll stops everything playing');
  s.setEnabled(false);
  ok(s.play('klaxon') === null && stored === '0', 'off means silent, and the choice is stored');
}

// Every gesture asks for a preload; a missing file is fetched once, not once per tap.
{
  const ctx = fakeCtx();
  let fetches = 0;
  const s = createSfx({ makeContext: () => ctx, fetchFile: async () => { fetches++; return null; } });
  await s.unlock();
  await Promise.all([s.preload(), s.preload()]);
  await s.preload();
  ok(fetches === FILE_CUES.length, `each cue is fetched once across repeated preloads (got ${fetches})`);
}

console.log(fails ? `\n${fails} FAILED` : '  all sound assertions pass');
process.exit(fails ? 1 : 0);
