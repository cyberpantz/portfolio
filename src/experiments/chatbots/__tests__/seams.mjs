/**
 * Every join in the script, printed once.
 *
 * The path walker was the right idea and the wrong unit: 2000 routes is
 * the same twenty conversations recombined, and nobody reads that. The
 * bugs all live in ONE place — the hinge between what the visitor just
 * chose and what the assistant says next — and there are only ever as
 * many hinges as there are edges.
 *
 * So: last thing said, what you tapped, first thing said back. Every
 * edge, once, whatever route reaches it.
 */
import { SCENARIOS } from '../scripts/index.ts';

/** Which script to read. Defaults to care; pass an id to switch. */
const CARE = SCENARIOS[process.argv[2]] ?? SCENARIOS.care;

const speech = (n) =>
  n.say.flatMap((b) =>
    b.t === 'say' || b.t === 'ack' ? [b.text]
    : b.t === 'boundary' ? [b.refusal, b.instead]
    : b.t === 'empty' ? [b.constraint, '▤ ' + b.title]
    : b.t === 'recommend' ? [b.why]
    : b.t === 'safety' || b.t === 'reframe' ? ['‼ ' + b.headline + ' — ' + b.body]
    : b.t === 'pick' ? ['[?] ' + b.spec.prompt]
    : b.t === 'think' ? ['··· ' + b.stages.join(' → ')]
    : b.t === 'error' ? ['✕ ' + b.stages[b.stage]]
    : b.t === 'appointment' ? ['▤ ' + b.title + ' · ' + b.time]
    : b.t === 'results' ? ['▤ ' + b.items.map((i) => i.name).join(' · ')]
    : []
  );

const edges = [];
for (const [id, n] of Object.entries(CARE.nodes)) {
  const push = (label, to) => edges.push([id, label, to]);
  if (n.auto) push('(continues)', n.auto);
  for (const b of n.say) {
    if (b.t === 'chips' || b.t === 'reframe') b.options.forEach((o) => push(o.label, o.go));
    else if (b.t === 'pick') b.spec.choices.forEach((c) => push(`points at “${c.label}”`, c.go ?? b.go));
    else if (b.t === 'schedule') b.slots.forEach((s) => push(`${s.label} (${s.detail})`, s.go));
    else if (b.t === 'empty') b.alternatives.forEach((a) => a.go && push(a.label, a.go));
    else if (b.t === 'error') { push('Try again', b.retry); if (b.escape.go) push(b.escape.label, b.escape.go); }
  }
  (n.lines ?? []).forEach((l) => push(`“${l.text.slice(0, 64)}${l.text.length > 64 ? '…' : ''}”`, l.go));
}

let i = 0;
for (const [from, label, to] of edges) {
  i++;
  const before = speech(CARE.nodes[from]).slice(-2);
  const after = speech(CARE.nodes[to]).slice(0, 3);
  console.log(`\n── ${String(i).padStart(2)} ${from} → ${to} ${'─'.repeat(Math.max(0, 44 - from.length - to.length))}`);
  before.forEach((t) => console.log('    AI   ' + t));
  console.log('   YOU   ' + label);
  after.forEach((t) => console.log('    AI   ' + t));
}
console.log(`\n${edges.length} joins.\n`);
