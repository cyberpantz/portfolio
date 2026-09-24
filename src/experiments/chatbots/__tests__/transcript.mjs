/**
 * Print the script as CONVERSATIONS, not as a list of nodes.
 *
 *   node --experimental-strip-types \
 *     --import ./src/experiments/chatbots/__tests__/register.mjs \
 *     src/experiments/chatbots/__tests__/transcript.mjs
 *
 * The first version walked the node map and printed each node's lines in
 * file order. That catches a bad sentence and is blind to every bug that
 * only exists BETWEEN two nodes — the read-back quoting a message this
 * path never sent, the shared node naming one of its two inbound
 * answers, the picker answering a question the bubble above it did not
 * ask. All three shipped, all three were found by eye in a browser, and
 * none of them is visible in a per-node dump.
 *
 * So this enumerates every route from the cold open to an ending and
 * prints each one as a transcript with the visitor's own turns in it.
 * Read them in sequence; the seams are obvious and nowhere else.
 */
import { SCENARIOS } from '../scripts/index.ts';

/** Which script to read. Defaults to care; pass an id to switch. */
const CARE = SCENARIOS[process.argv[2]] ?? SCENARIOS.care;

/*
 * Depth-first with a small cap explored ONE tray line exhaustively and
 * never reached the other four — 60 paths that were all the same
 * conversation with different endings, which is the least useful way to
 * spend a read-through. Raised, and the caller can narrow by prefix.
 */
const MAX_PATHS = 2000;
const MAX_STEPS = 26;
/** Optional: only paths whose route contains this node. */
const ONLY = process.argv[3];

/** Every way out of a node, as [what the visitor did, where it leads]. */
function exits(n) {
  if (n.auto) return [[null, n.auto]];
  const out = [];
  for (const b of n.say) {
    if (b.t === 'chips' || b.t === 'reframe') {
      for (const o of b.options) out.push([o.label, o.go]);
    } else if (b.t === 'pick') {
      for (const c of b.spec.choices) out.push([`(points at ${c.label})`, c.go ?? b.go]);
    } else if (b.t === 'scale') {
      for (const st of b.steps) out.push([st, b.go]);
    } else if (b.t === 'schedule') {
      for (const s of b.slots) out.push([`${s.label} · ${s.detail}`, s.go]);
    } else if (b.t === 'empty') {
      for (const a of b.alternatives) if (a.go) out.push([a.label, a.go]);
    } else if (b.t === 'error') {
      out.push(['Try again', b.retry]);
      if (b.escape.go) out.push([b.escape.label, b.escape.go]);
    }
  }
  for (const l of n.lines ?? []) out.push([l.text, l.go]);
  return out;
}

/** What the assistant puts on screen, in order. */
function speech(n) {
  const said = [];
  for (const b of n.say) {
    if (b.t === 'say') said.push(['AI', b.text]);
    else if (b.t === 'ack') said.push(['AI', b.text]);
    else if (b.t === 'think') said.push(['··', b.stages.join(' → ') + (b.ms ? `  [${b.ms}ms]` : '')]);
    else if (b.t === 'boundary') { said.push(['AI', b.refusal]); said.push(['AI', b.instead]); }
    else if (b.t === 'empty') { said.push(['AI', b.constraint]); said.push(['▤', b.title]); }
    else if (b.t === 'recommend') said.push(['AI', b.why]);
    else if (b.t === 'results') said.push(['▤', b.items.map((i) => `${i.name} — ${i.detail}`).join(' · ')]);
    else if (b.t === 'disclose') said.push(['▾', b.summary]);
    else if (b.t === 'appointment') said.push(['▤', `${b.title} · ${b.day} ${b.time}${b.location ? ' · ' + b.location : ''}`]);
    else if (b.t === 'error') { said.push(['✕', b.stages.join(' → ')]); if (b.message) said.push(['AI', b.message]); }
    else if (b.t === 'safety') said.push(['‼', `${b.headline} / ${b.body}`]);
    else if (b.t === 'reframe') said.push(['⚠', `${b.headline} / ${b.body}`]);
    else if (b.t === 'pick') said.push(['[?]', b.spec.prompt]);
  }
  return said;
}

const paths = [];
(function walk(id, trail, said) {
  if (paths.length >= MAX_PATHS || trail.length > MAX_STEPS) return;
  const n = CARE.nodes[id];
  if (!n) return;
  const here = [...said, ['·node·', id], ...speech(n)];
  const next = exits(n).filter(([, to]) => !trail.includes(to));
  if (!next.length || n.terminal) {
    paths.push(here);
    return;
  }
  for (const [label, to] of next) {
    walk(to, [...trail, to], label == null ? here : [...here, ['YOU', label]]);
  }
})(CARE.start, [CARE.start], []);

let i = 0;
const wanted = ONLY ? paths.filter((p) => p.some(([w, t]) => w === '·node·' && t === ONLY)) : paths;
for (const p of wanted) {
  i++;
  const route = p.filter(([w]) => w === '·node·').map(([, t]) => t);
  console.log(`\n\n${'═'.repeat(66)}\n  PATH ${i}  ·  ${route.join(' → ')}\n${'═'.repeat(66)}`);
  for (const [who, text] of p) {
    if (who === '·node·') continue;
    if (who === 'YOU') console.log(`\n        YOU  ${text}\n`);
    else console.log(`   ${who.padStart(3)}  ${text}`);
  }
}
console.log(`\n\n${wanted.length} of ${paths.length} paths. Read them; the seams only show here.\n`);
