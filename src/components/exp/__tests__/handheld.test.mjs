/**
 * The handheld notice, driven against stubs.
 *
 * It runs the script EXTRACTED FROM THE COMPONENT rather than a copy of
 * it, because the thing worth checking is the one that ships. The failure
 * modes here are all invisible: a notice that never appears, one that
 * appears every single time, or one that throws in a privacy mode and
 * takes the page down with it.
 */
import { readFileSync } from 'node:fs';

const astro = readFileSync('src/components/exp/HandheldNote.astro', 'utf8');
const match = astro.match(/<script is:inline define:vars=\{\{ KEY \}\}>([\s\S]*?)<\/script>/);
if (!match) {
  console.log('FAIL  could not find the inline script in HandheldNote.astro');
  process.exit(1);
}
const KEY = (astro.match(/const KEY = '([^']+)'/) || [])[1];
if (!KEY) {
  console.log('FAIL  could not find the storage key');
  process.exit(1);
}
const src = `const KEY = ${JSON.stringify(KEY)};\n${match[1]}`;

function run({ coarse, stored, storageThrows = false, noMatchMedia = false, noNote = false }) {
  const on = {};
  const note = {
    hidden: true,
    querySelector: () => ({ addEventListener: (_, fn) => { on.click = fn; } }),
  };
  const store = new Map();
  if (stored) store.set(KEY, '1');
  const localStorage = {
    getItem: (k) => { if (storageThrows) throw new Error('denied'); return store.get(k) ?? null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('denied'); store.set(k, v); },
  };
  const window = noMatchMedia
    ? {}
    : { matchMedia: (q) => ({ matches: q.includes('coarse') && coarse }) };
  const document = {
    getElementById: () => (noNote ? null : note),
    addEventListener: (ev, fn) => { if (ev === 'keydown') on.key = fn; },
  };
  new Function('window', 'document', 'localStorage', src)(window, document, localStorage);
  return { note, on, store };
}

let fail = 0;
const ok = (n, c, extra = '') => {
  console.log((c ? '  ok  ' : 'FAIL  ') + n + (extra ? '   ' + extra : ''));
  if (!c) fail++;
};
const safely = (n, fn) => {
  try { fn(); } catch (e) { ok(`${n} — threw: ${e.message}`, false); }
};

ok('a hovering pointer never sees it', run({ coarse: false, stored: false }).note.hidden === true);

{
  const r = run({ coarse: true, stored: false });
  ok('a fingertip sees it once', r.note.hidden === false);
  r.on.click();
  ok('dismissing hides it', r.note.hidden === true);
  ok('and writes it down', r.store.get(KEY) === '1');
}

ok('and does not see it again', run({ coarse: true, stored: true }).note.hidden === true);

{
  const r = run({ coarse: true, stored: false });
  r.on.key({ key: 'Escape' });
  ok('Escape dismisses it', r.note.hidden === true);
  const s = run({ coarse: true, stored: false });
  s.on.key({ key: 'a' });
  ok('and other keys do not', s.note.hidden === false);
}

/*
 * Storage throws outright in some privacy modes. Showing the notice again
 * is a small annoyance; taking the page down with an uncaught error on
 * every exploration is not.
 */
safely('a locked-down browser', () => {
  const r = run({ coarse: true, stored: false, storageThrows: true });
  ok('storage denied: still shows', r.note.hidden === false);
  r.on.click();
  ok('storage denied: dismiss still works', r.note.hidden === true);
});

safely('a browser with no matchMedia', () => {
  ok('no matchMedia: stays out of the way',
     run({ coarse: false, noMatchMedia: true, stored: false }).note.hidden === true);
});

safely('a page without the markup', () => {
  run({ coarse: true, stored: false, noNote: true });
  ok('missing element: exits quietly', true);
});

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
