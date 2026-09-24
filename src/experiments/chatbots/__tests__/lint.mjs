/**
 * The two architectural guarantees the spec calls load-bearing.
 *
 * Both are enforced rather than reviewed, because a rule that depends on
 * someone remembering it erodes on the third busy afternoon.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
let fails = 0;
const fail = (m) => {
  fails++;
  console.error('  FAIL  ' + m);
};

/*
 * Comments are stripped before any scan. The first version flagged
 * safety.module.css for the sentence in its own header explaining that it
 * must not reference a skin token, and flagged classify.ts for the phrase
 * "invalid input" in a doc comment. A lint that fires on its own
 * documentation trains people to ignore it.
 */
const strip = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

/* 1 — safety declares no skin tokens ---------------------------------
 *
 * A theming system that can restyle a 911 screen is a bug. The guarantee
 * is that the component has nothing for a skin to reach.
 */
console.log('\nSafety is unskinnable');
const safety = strip(readFileSync(join(ROOT, 'components/safety.module.css'), 'utf8'));
if (/var\(--s-/.test(safety)) fail('safety.module.css references a --s-* skin token');
const safetyTsx = strip(readFileSync(join(ROOT, 'components/Safety.tsx'), 'utf8'));
if (/--s-/.test(safetyTsx)) fail('Safety.tsx references a --s-* skin token');
console.log('  no skin tokens in safety');

/* 2 — the apparatus is unskinnable too, for the opposite reason ------ */
console.log('\nApparatus is unskinnable');
const app = strip(readFileSync(join(ROOT, 'apparatus/apparatus.module.css'), 'utf8'));
if (/var\(--s-/.test(app)) fail('apparatus.module.css references a --s-* skin token');
console.log('  no skin tokens in apparatus');

/* 3 — no user-visible copy in components -----------------------------
 *
 * Copy lives in script data. A component that needs new copy needs a new
 * beat type, not a string literal.
 */
console.log('\nNo copy in components');
const ALLOW = [
  /*
   * Structural labels, not scenario copy.
   *
   * The distinction: scenario copy is what the assistant SAYS, and every
   * scenario would word it differently. These are what the interface
   * CALLS its own parts, and every scenario wants them identical — a
   * calendar export button says the same thing whether the appointment
   * is a clinic, a therapist or a vet.
   */
  'Send', 'Skin', 'Mode', 'Say', 'Conversation', 'Type a message',
  'Replay', 'All states', 'Try again', 'Still working',
  'Add to Google Calendar', 'Download .ics', 'Worth having ready',
];
const files = walk(join(ROOT, 'components')).filter((f) => f.endsWith('.tsx'));
for (const f of files) {
  if (f.endsWith('Safety.tsx')) continue; // no literals there anyway
  const src = strip(readFileSync(f, 'utf8'));
  // JSX text nodes of more than three words. Expressions are excluded —
  // `{cond && <X/>}` is logic, not copy.
  const text = [...src.matchAll(/>\s*([A-Z][^<>{}\n&|]{18,})\s*</g)].map((m) => m[1].trim());
  for (const t of text) {
    if (ALLOW.some((a) => t.startsWith(a))) continue;
    if (t.split(/\s+/).length > 3) fail(`${f.split('/').pop()}: JSX copy "${t.slice(0, 52)}…"`);
  }
}
console.log(`  ${files.length} component files scanned`);

/* 4 — banned strings anywhere in the product ------------------------- */
console.log('\nBanned strings');
const BANNED = [
  /Something went wrong/i, /\bOops\b/, /Loading\.\.\./, /Invalid input/i,
  /Are you sure\?/i, /Click here/i, />\s*Submit\s*</, />\s*Error\s*</,
  /*
   * Blame-deflection boilerplate. It arrives sounding kind and leaves
   * the reader knowing nothing: an error message's job is what was lost
   * and what to do, and a sentence spent establishing whose fault it is
   * spends the visitor's attention on a question they never asked.
   */
  /not your fault/i, /on our (end|side),? not yours/i, /nothing .{0,20}was lost/i,
];
for (const f of walk(ROOT).filter((p) => /\.(tsx?|css)$/.test(p) && !p.includes('__tests__'))) {
  const src = strip(readFileSync(f, 'utf8'));
  for (const re of BANNED) {
    if (re.test(src)) fail(`${f.split('/').pop()} contains banned string ${re}`);
  }
}
console.log('  clean');

/* 5 — no control waits for a hover to admit it is one ----------------
 *
 * `.pickBtn` was `border: 1px solid transparent; background: none`, and
 * drew its border only on `:hover`. Four buttons therefore rendered as
 * four lines of prose until you happened to point at one — and on a
 * touch screen, where there is no hover, the affordance never appeared
 * under any circumstances at all.
 *
 * The rule: if a selector grows a border or a fill on hover, it must
 * already have one of the two at rest. Hover may strengthen an
 * affordance; it may not be the thing that creates it.
 */
console.log('\nControls look like controls at rest');
const CSS_FILES = [
  ['product', join(ROOT, 'components/product.module.css')],
  ['apparatus', join(ROOT, 'apparatus/apparatus.module.css')],
];
// A state that means "no longer interactive" is allowed to drop its
// edges — a booked-out time slot SHOULD stop looking pressable.
const INERT = /:disabled|\[data-gone|\[data-state='passed'\]|\[aria-disabled/;
const visible = (v) => v && !/transparent|\bnone\b|^0/.test(v);
let restChecked = 0;
for (const [label, file] of CSS_FILES) {
  const css = strip(readFileSync(file, 'utf8'));
  const rules = new Map();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.set(m[1].trim(), m[2]);
  }
  const decl = (body, prop) =>
    (body.match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`)) ?? [])[1]?.trim();
  for (const [sel, body] of rules) {
    const base = /^(\.[A-Za-z0-9_-]+):hover$/.exec(sel)?.[1];
    if (!base || INERT.test(sel)) continue;
    const grows =
      decl(body, 'border-color') || decl(body, 'border') || decl(body, 'background');
    if (!grows) continue;
    const baseBody = rules.get(base);
    if (baseBody === undefined) continue;
    restChecked++;
    const hasEdge =
      visible(decl(baseBody, 'border')) || visible(decl(baseBody, 'border-color'));
    const hasFill =
      visible(decl(baseBody, 'background')) || visible(decl(baseBody, 'background-color'));
    if (!hasEdge && !hasFill) {
      fail(`${label}: "${base}" has no border and no fill until :hover`);
    }
  }
}
console.log(`  ${restChecked} hover-styled controls, all visible before the pointer arrives`);

/* 6 — contrast floors, computed not assumed -------------------------- */
console.log('\nContrast');
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (hex) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [x, y] = [L(a), L(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const PAIRS = [
  // [name, fg, bg, floor]
  ['care ink on ai', '#17171a', '#f2f2ee', 4.5],
  ['care accent-ink on accent', '#ffffff', '#2f5fd0', 4.5],
  ['care mute on surface', '#75757e', '#ffffff', 4.5],
  ['family accent-ink on accent', '#ffffff', '#5b4b8a', 4.5],
  ['family ink on ai', '#17171a', '#f5f4f9', 4.5],
  ['feline accent-ink on accent', '#ffffff', '#a5601c', 4.5],
  ['feline ink on ai', '#17171a', '#fbf3ea', 4.5],
  // The friendliest-looking skin is held to the same floor as the
  // others. A hostile scenario does not get to be inaccessible too.
  ['cancel accent-ink on accent', '#ffffff', '#5b3fd6', 4.5],
  ['cancel ink on ai', '#17171a', '#f6f4ff', 4.5],
  ['cancel mute on surface', '#6e6a85', '#fffdff', 4.5],
  // The FAILED tag on each scenario's assistant bubble. Three pairs,
  // because the bubble colour is a skin token and the tag is not.
  ['stage failed on care ai', '#b4321f', '#f2f2ee', 4.5],
  ['stage failed on feline ai', '#b4321f', '#f3f0e8', 4.5],
  ['stage failed on cancel ai', '#b4321f', '#f6f4ff', 4.5],
  ['safety headline on alert', '#b4321f', '#fdf6f5', 4.5],
  ['safety action ink', '#ffffff', '#b4321f', 4.5],
  ['tempo2 headline', '#4a3d73', '#f7f5fc', 4.5],
  ['tempo2 action ink', '#ffffff', '#5b4b8a', 4.5],
  ['tempo3 headline', '#8a4e16', '#fdf5ec', 4.5],
  ['reframe headline', '#8a5a08', '#fdfaf0', 4.5],
  ['reframe body', '#3a3226', '#fdfaf0', 4.5],
  // The cautious pair is tinted rather than filled, so its label is read
  // against the tint, not against a solid.
  ['reframe cautious label', '#6f4405', '#fbf0d8', 4.5],
  ['reframe away label', '#1a1a1a', '#ffffff', 4.5],
  ['stamp on surface', '#9a3412', '#ffffff', 4.5],
  // The apparatus sits on the page's dark ground, not on a panel of its
  // own. Measured against the LIGHTEST stop of that gradient, #2a2a2e,
  // which is the worst case for light text.
  ['apparatus ink', '#e8e8e0', '#2a2a2e', 4.5],
  ['apparatus body', '#b8b8b0', '#2a2a2e', 4.5],
  ['apparatus mute', '#9d9d95', '#2a2a2e', 4.5],
  ['tray ink', '#c3cfe8', '#2a2a2e', 4.5],
  // The "longer" tag is real text, so it is held to the text floor even
  // though the glyphs beside it at the same weight are aria-hidden.
  ['tray marker', '#8d9bbe', '#2a2a2e', 4.5],
  ['apparatus lead control', '#e8e8e0', '#2a2a2e', 4.5],
  // The one colour in the apparatus, and the only thing in it that
  // means something rather than labels something.
  ['disclaimer rule, roused', '#f08273', '#2a2a2e', 4.5],
];
for (const [name, fg, bg, floor] of PAIRS) {
  const r = ratio(fg, bg);
  if (r < floor) fail(`${name}: ${r.toFixed(2)}:1, floor ${floor}`);
  else console.log(`  ${r.toFixed(2)}:1  ${name}`);
}

console.log(fails ? `\n${fails} FAILED\n` : '\nAll lint checks passed\n');
process.exit(fails ? 1 : 0);
