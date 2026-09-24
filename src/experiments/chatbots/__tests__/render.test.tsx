/**
 * Render smoke test — every beat in the script, plus a full playthrough.
 *
 * tsc proves the types line up. It does not prove a component renders:
 * a `const` used above its declaration typechecks cleanly and throws at
 * runtime, which is a bug this codebase has shipped before. So every beat
 * type is actually rendered here, and the whole care flow is actually
 * walked.
 *
 * Bundled with esbuild and run in node; see __tests__/run.sh.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { CARE } from '../scripts/care.script';
import { SCENARIOS, SCENARIO_LIST } from '../scripts';
import { ScenarioMenu } from '../apparatus/ScenarioMenu';
import { ScenarioTabs } from '../apparatus/ScenarioTabs';
import { BeatView } from '../components/BeatView';
import { OutcomeBadge } from '../components/OutcomeBadge';
import type { Beat, Chip, NodeId } from '../scripts/types';
import { classify, RECOVERY_NODE, STRIKES } from '../input/classify';

let fails = 0;
const ok = (c: unknown, m: string) => {
  if (!c) {
    fails++;
    console.error('  FAIL  ' + m);
  }
};

const noop = () => {};
const h = { choose: noop as (c: Chip) => void, pick: noop, go: noop };

/* ---- every beat renders ------------------------------------------- */
console.log('\nRendering every beat in the script');
const seenTypes = new Set<string>();
let count = 0;
for (const node of Object.values(CARE.nodes)) {
  for (const beat of node.say as Beat[]) {
    seenTypes.add(beat.t);
    try {
      const html = renderToStaticMarkup(<BeatView beat={beat} grouped={false} h={h} />);
      ok(html.length > 0, `${node.id}/${beat.t} rendered empty`);
      count++;
    } catch (e) {
      fails++;
      console.error(`  FAIL  ${node.id}/${beat.t} threw: ${(e as Error).message}`);
    }
  }
}
console.log(`  ${count} beats rendered, ${seenTypes.size} distinct types: ${[...seenTypes].sort().join(', ')}`);

/* ---- beats the engine has and this script does not -----------------
 *
 * `recommend` came off the played path: it argued for a choice the
 * visitor had already made, with an invented confidence score. The beat
 * and its component stay in the engine for a scenario where the
 * recommendation comes BEFORE the choice.
 *
 * Which means nothing renders it any more, and an unrendered component
 * rots quietly — the next person to reach for it finds it broken and
 * assumes it never worked. So it is rendered here directly, and this
 * list is the honest record of what the engine can do that the care
 * script does not currently use.
 */
console.log('\nBeats kept for other scenarios');
const UNUSED: Beat[] = [
  { t: 'recommend', option: 'tele', confidence: 0.86, why: 'Placeholder rationale.' },
  { t: 'scale', steps: ['Mild', 'Middling', 'Unbearable'], go: 'open' },
  { t: 'ack', text: 'Placeholder acknowledgement.' },
  {
    t: 'compare',
    title: 'Placeholder',
    axes: ['Wait', 'Cost'],
    rows: [{ label: 'Telehealth', cells: ['12 min', '$0'] }],
  },
];
for (const beat of UNUSED) {
  try {
    const html = renderToStaticMarkup(<BeatView beat={beat} grouped={false} h={h} />);
    ok(html.length > 0, `unused beat "${beat.t}" rendered empty`);
  } catch (e) {
    fails++;
    console.error(`  FAIL  unused beat "${beat.t}" threw: ${(e as Error).message}`);
  }
}
console.log(`  ${UNUSED.length} unused beat types still render: ${UNUSED.map((b) => b.t).join(', ')}`);

/* ---- the outcome badge -------------------------------------------- */
console.log('\nOutcome badge');
const badgeStates = [
  { name: 'nothing decided', s: { out: new Set<string>(), rank: [], withdrawn: false }, html: '' },
  { name: 'partly narrowed', s: { out: new Set(['primary']), rank: [], withdrawn: false }, html: '' },
  { name: 'leading, unresolved', s: { out: new Set(['primary']), rank: [], lead: 'urgent', withdrawn: false }, html: '' },
  { name: 'resolved', s: { out: new Set(['primary', 'urgent', 'er']), rank: [], win: 'tele', withdrawn: false }, html: 'Telehealth' },
  { name: 'withdrawn by safety', s: { out: new Set<string>(), rank: [], win: 'tele', withdrawn: true }, html: '' },
];
for (const st of badgeStates) {
  try {
    const html = renderToStaticMarkup(<OutcomeBadge scenario={CARE} strip={st.s} />);
    if (!st.html) {
      ok(html === '', `"${st.name}" must render nothing, got ${html.length} chars`);
      continue;
    }
    ok(html.includes(st.html), `"${st.name}" does not name the outcome`);
    ok(html.includes('role="status"'), `"${st.name}" must be role=status`);
    // It reports; it never offers.
    ok(!/<button/.test(html), `"${st.name}" must contain no buttons`);
  } catch (e) {
    fails++;
    console.error(`  FAIL  badge/${st.name} threw: ${(e as Error).message}`);
  }
}
console.log(`  ${badgeStates.length} states — silent until resolved`);

/* ---- a full playthrough -------------------------------------------
 *
 * Mirrors the director's routing without React, so the whole care flow
 * is proven to terminate at a booking rather than assumed to.
 */
console.log('\nPlaythrough — the messy line, all the way to booked');
function play(path: string[], start: NodeId = CARE.start) {
  let node = CARE.nodes[start];
  const visited: string[] = [node.id];
  for (const step of path) {
    const line = node.lines?.find((l) => l.id === step);
    const chip = node.say.flatMap((b) =>
      b.t === 'chips' ? b.options : b.t === 'reframe' ? b.options : []
    ).find((c) => c.label === step);
    const pickBeat = node.say.find((b) => b.t === 'pick') as Extract<Beat, { t: 'pick' }> | undefined;
    // "<pick>" takes the beat's default; "<pick:label>" takes one choice's
    // own route, which is the only way to walk a branching picker.
    const pickChoice = step.startsWith('<pick:')
      ? pickBeat?.spec.choices.find((c) => c.label === step.slice(6, -1))
      : undefined;
    const slot = node.say.flatMap((b) => (b.t === 'schedule' ? b.slots : [])).find((s) => s.label === step);
    const alt = node.say.flatMap((b) => (b.t === 'empty' ? b.alternatives : [])).find((a) => a.label === step);
    const auto = node.accept?.find((a) => a.on === 'text');
    // Nodes that continue on their own.
    const selfAdvance = node.auto;
    /*
     * The accept list is the contract — some controls are rendered by a
     * beat rather than declared as chips (the error beat's retry is one),
     * and only `accept` knows where they lead.
     */
    const accepted = node.accept?.find((a) => a.on === 'chip' && a.value === step);

    const to =
      line?.go ??
      chip?.go ??
      accepted?.go ??
      slot?.go ??
      alt?.go ??
      (step === '<pick>' ? pickBeat?.go : undefined) ??
      (pickChoice ? (pickChoice.go ?? pickBeat?.go) : undefined) ??
      (step === '<auto>' ? (selfAdvance ?? auto?.go) : undefined);

    ok(!!to, `"${step}" is not reachable from "${node.id}"`);
    if (!to) break;
    node = CARE.nodes[to];
    visited.push(node.id);
  }
  return visited;
}

const run = play([
  'messy',        // paste the 58-word mess
  '<auto>',       // extraction resolves
  '<auto>',       // the read-back, which only this path earns
  '<pick>',       // body map
  'Yes, tonight please',
  'Try again',    // the authored failure
  '<auto>',       // the 9s think resolves
  'Video visit, now',
  '7:16pm',
]);
console.log('  ' + run.join(' → '));
ok(run.at(-1) === 'confirm', `playthrough ended at "${run.at(-1)}", want "confirm"`);
ok(run.includes('lookup-fail'), 'the authored failure was not on the played path');
ok(run.includes('lookup-slow'), 'the latency ladder was not on the played path');

console.log('\nPlaythrough — the terse line');
// Fever first; a yes settles it, so duration is never asked.
const terse = play(['terse', 'Yes', '<pick>', 'Yes, tonight please', 'Try again', '<auto>', 'Watch for a morning cancellation', 'Yes, book it too', '7:40pm']);
ok(terse.at(-1) === 'confirm-late', `terse branch ended at "${terse.at(-1)}"`);
// The later slot must confirm the later time. Both used to land on one
// confirmation hard-coded to 7:16, so picking 7:40 booked you 7:16.
ok(terse.includes('waitlist'), 'the cancellation alternative must have its own beat');
ok(terse.includes('terse') && !terse.includes('extract'), 'terse branch must not pass through extraction');
// The read-back quotes the long paste. Reaching it from the short line
// would have the assistant quoting a message that was never sent.
ok(!terse.includes('recap'), 'the terse branch must not hear the long paste read back to it');

// And the other answer to the fever question asks the second question,
// which the first answer never sees.
const noFever = play(['terse', 'No', 'Since this morning']);
ok(noFever.includes('duration'), 'no-fever branch must ask about duration');
ok(noFever.at(-1) === 'mild', `no-fever + this morning ended at "${noFever.at(-1)}"`);
console.log('  ' + noFever.join(' → '));
console.log('  ' + terse.join(' → '));

// The other answer to the same question has to land somewhere real, and
// somewhere DIFFERENT — a branch that rejoins immediately is decoration.
console.log('\nPlaythrough — tomorrow morning');
const morning = play(['messy', '<auto>', '<auto>', '<pick>', 'Tomorrow morning works better', '8:00am', '<auto>']);
ok(morning.at(-1) === 'after', `morning branch ended at "${morning.at(-1)}"`);
ok(morning.includes('confirm-morning'), 'morning branch did not reach its own confirmation');
ok(!morning.includes('recommend'), 'morning branch must not share the telehealth ending');
console.log('  ' + morning.join(' → '));

/* ---- tray lines route by identity ----------------------------------
 *
 * The regression that prompted this: a tray line arrives at send() as
 * ordinary text, and without an identity check every one of them fell
 * through to the vague-recovery branch.
 */
/* ---- answer chips are peers ----------------------------------------
 *
 * A filled pill among outlined ones reads as the one already chosen, so
 * a question arrives looking half-answered. It got there from array
 * order alone — `i === 0` — which is exactly the kind of styling that
 * creeps back in the next time someone wants to "guide" a choice.
 *
 * Asserted on the rendered markup rather than the source, because the
 * property that matters is that the buttons come out indistinguishable,
 * however the class list is assembled.
 */
console.log('\nAnswer chips carry equal weight');
let chipSets = 0;
for (const node of Object.values(CARE.nodes)) {
  for (const beat of node.say as Beat[]) {
    // Answers only. Safety and reframe are excluded on purpose — see below.
    const opts = beat.t === 'chips' ? beat.options : null;
    if (!opts || opts.length < 2) continue;
    chipSets++;
    const html = renderToStaticMarkup(<BeatView beat={beat} grouped={false} h={h} />);
    const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    ok(
      new Set(classes).size === 1,
      `"${node.id}" renders ${new Set(classes).size} chip styles — one option is dressed as chosen`
    );
  }
}
/*
 * Two places where emphasis is honest, and both are asserted rather than
 * merely permitted, so the exceptions cannot quietly become the rule.
 *
 * After a failure there really is one thing to do next, and it is an
 * action rather than an answer.
 */
{
  const err = Object.values(CARE.nodes)
    .flatMap((n) => n.say as Beat[])
    .find((b) => b.t === 'error');
  const html = err ? renderToStaticMarkup(<BeatView beat={err} grouped={false} h={h} />) : '';
  const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
  ok(new Set(classes).size === 2, 'the error beat should distinguish retry from escape');
}

/*
 * And the reframe, where the emphasis groups by DESTINATION rather than
 * by position: every option leading to the emergency path is weighted
 * together, the one leading away is not.
 *
 * That is why this beat is exempt from the uniformity rule above, and
 * the distinction is worth stating precisely — "Yes" and "I'm not sure"
 * look alike here not because one is first, but because they go to the
 * same place. It is also the documented uncertainty rule working as
 * intended: "I'm not sure" is carried INTO the cautious group, never
 * styled as the lesser option beside it.
 */
{
  const rf = Object.values(CARE.nodes)
    .flatMap((n) => n.say as Beat[])
    .find((b) => b.t === 'reframe') as Extract<Beat, { t: 'reframe' }> | undefined;
  ok(!!rf, 'no reframe beat to check');
  if (rf) {
    const html = renderToStaticMarkup(<BeatView beat={rf} grouped={false} h={h} />);
    const classes = [...html.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    const byTarget = new Set(rf.options.map((o) => o.go));
    ok(
      new Set(classes).size === byTarget.size,
      `reframe renders ${new Set(classes).size} styles for ${byTarget.size} destinations`
    );
    // The uncertainty option must share a style with the cautious branch.
    const safeIdx = rf.options.findIndex((o) => o.safe);
    const firstSame = rf.options.findIndex((o) => o.go === rf.options[safeIdx]?.go);
    ok(
      safeIdx >= 0 && classes[safeIdx] === classes[firstSame],
      'the uncertainty option is styled apart from the branch it shares'
    );
  }
}
console.log(`  ${chipSets} chip sets uniform, 2 emphasis exceptions asserted`);

/* ---- the body map routes by region ---------------------------------
 *
 * The first version sent every region into the ear branch, so pointing
 * at a stomach produced a diagram of an ear. Both halves are asserted:
 * the one region this script has a story for, and the ones it does not.
 */
/* ---- every slot confirms its own time ------------------------------
 *
 * Three schedulers, six slots. Each pair used to share one confirmation
 * carrying the earlier time, which is the failure mode that looks like
 * success: the booking appears, and it is for the wrong hour.
 */
console.log('\nSchedulers confirm the slot you picked');
for (const [node, label, want] of [
  ['recommend', '7:16pm', '19:16'],
  ['recommend', '7:40pm', '19:40'],
  ['morning', '8:00am', '08:00'],
  ['morning', '9:40am', '09:40'],
] as [NodeId, string, string][]) {
  const slot = (CARE.nodes[node].say.flatMap((b) => (b.t === 'schedule' ? b.slots : [])) as {
    label: string; go: NodeId;
  }[]).find((sl) => sl.label === label);
  const dest = slot && CARE.nodes[slot.go];
  const appt = dest?.say.find((b) => b.t === 'appointment') as
    | Extract<Beat, { t: 'appointment' }>
    | undefined;
  ok(appt?.time === want, `"${label}" confirms ${appt?.time ?? 'nothing'}, want ${want}`);
  /*
   * And the sentence above the card has to agree with the card.
   *
   * The card stores 24h because the calendar export needs it; the prose
   * is written in 12h because people are. Comparing them means
   * converting, which the first version of this check forgot and
   * promptly accused correct copy of being wrong.
   */
  const said = dest?.say.find((b) => b.t === 'say') as Extract<Beat, { t: 'say' }> | undefined;
  const [hh, mm] = want.split(':').map(Number);
  const spoken = `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')}`;
  ok(
    said?.text.includes(spoken),
    `"${label}" card is ${want} but the line above says "${said?.text ?? ''}"`
  );
}
console.log('  4 slots, each confirming its own time');

/* ---- the grid confirms the cell you tapped -------------------------
 *
 * Twelve times, one confirmation node. That is only safe because the
 * chosen time travels via `@picked` — the alternative is the two-slot
 * scheduler bug multiplied by six.
 */
console.log('\nTime grid');
{
  const grid = CARE.nodes['more-times'].say.find((b) => b.t === 'timegrid') as
    | Extract<Beat, { t: 'timegrid' }>
    | undefined;
  ok(!!grid, 'more-times has no grid');
  const dest = grid && CARE.nodes[grid.go];
  const appt = dest?.say.find((b) => b.t === 'appointment') as
    | Extract<Beat, { t: 'appointment' }>
    | undefined;
  ok(appt?.time === '@picked', 'the grid confirmation hard-codes a time');
  ok(appt?.day === '@picked', 'the grid confirmation hard-codes a day');
  // The sentence above the card must not name an hour, or it becomes a
  // second place for the time to be wrong.
  const said = dest?.say.find((b) => b.t === 'say') as Extract<Beat, { t: 'say' }> | undefined;
  ok(!/\d/.test(said?.text ?? ''), `"${said?.text}" names a time the card owns`);
  // Some cells must be gone, or the grid is a list with extra steps.
  const gone = grid?.days.flatMap((d) => d.times).filter((t) => t.gone) ?? [];
  ok(gone.length > 0, 'no unavailable times — a full grid shows no shape');
  // Labels and machine times must agree, since the calendar uses one and
  // the visitor reads the other.
  for (const d of grid?.days ?? []) {
    for (const t of d.times) {
      const [hh, mm] = t.at.split(':').map(Number);
      const h12 = hh % 12 === 0 ? 12 : hh % 12;
      ok(
        t.label === `${h12}:${String(mm).padStart(2, '0')}${hh < 12 ? 'am' : 'pm'}`,
        `grid label "${t.label}" disagrees with its machine time ${t.at}`
      );
    }
  }
  console.log(`  ${grid?.days.flatMap((d) => d.times).length} cells, ${gone.length} gone, labels match`);
}

/* ---- every drawn region has a button ------------------------------
 *
 * The diagram answers clicks now, by matching a region id to a choice
 * `value`. A region with no matching choice is a part of the picture
 * that lights up, invites a click and silently does nothing — the worst
 * of both, and invisible until someone points at exactly that spot.
 */
console.log('\nDiagram regions map to choices');
{
  const REGIONS: Record<string, string[]> = {
    ear: ['outer', 'canal', 'deep', 'behind'],
    sofa: ['back', 'arms', 'seat', 'under'],
  };
  let checked = 0;
  for (const S of Object.values(SCENARIOS)) {
    for (const n of Object.values(S.nodes)) {
      for (const b of n.say as Beat[]) {
        if (b.t !== 'pick' || !b.spec.diagram) continue;
        const drawn = REGIONS[b.spec.diagram] ?? [];
        const values = new Set(b.spec.choices.map((c) => c.value));
        for (const r of drawn) {
          ok(values.has(r), `"${n.id}" draws region "${r}" with no choice to answer for it`);
          checked++;
        }
      }
    }
  }
  console.log(`  ${checked} regions, all backed by a choice`);
}

console.log('\nBody map');
const ear = play(['vague', 'Yes, roughly', 'Ear, jaw or throat']);
// The recovery nodes say "choose from a list" and must land on one.
for (const from of ['r-shorthand', 'r-terse']) {
  const chip = CARE.nodes[from].say
    .flatMap((b) => (b.t === 'chips' ? b.options : []))
    .find((o) => o.go === 'point');
  ok(!!chip, `"${from}" no longer offers the region list`);
  ok(
    !/\bmap\b/i.test(chip?.label ?? ''),
    `"${from}" promises a map and "point" renders a list: "${chip?.label}"`
  );
}
ok(ear.at(-1) === 'terse', `ear region ended at "${ear.at(-1)}", want the ear branch`);
const gut = play(['vague', 'Yes, roughly', 'Stomach or gut']);
// Chest is the one region a phone number is not good enough for.
const chest = play(['vague', 'Yes, roughly', 'Chest']);
ok(chest.at(-1) === 'chest-check', `chest ended at "${chest.at(-1)}", want the held question`);
ok(gut.at(-1) === 'hand-off', `stomach ended at "${gut.at(-1)}", want the hand-off`);
// And the hand-off must NOT offer to resume a search that was never
// running: that exit belongs to the failed lookup, not to a complaint
// this navigator has no story for.
const handOff = CARE.nodes['hand-off'];
const resumes = handOff.say.flatMap((b) => (b.t === 'chips' ? b.options : [])).map((o) => o.go);
ok(!resumes.includes('lookup-slow'), 'the hand-off must not route back into the clinic search');
ok(!gut.includes('first-cut'), 'a stomach must never reach the ear picker');
console.log('  ' + ear.join(' → ') + '   ·   ' + gut.join(' → '));

console.log('\nTray lines');
const norm = (x: string) => x.replace(/\s+/g, ' ').trim().toLowerCase();
let lineCount = 0;
for (const node of Object.values(CARE.nodes)) {
  for (const l of node.lines ?? []) {
    lineCount++;
    const match = node.lines!.find((c) => norm(c.text) === norm(l.text));
    ok(match?.go === l.go, `"${l.id}" does not resolve to its own target`);
    ok(!!CARE.nodes[l.go], `"${l.id}" points at missing node "${l.go}"`);
    /*
     * Safety runs before identity routing, so for most lines tripping a
     * rule means never arriving — the line is hijacked en route.
     *
     * The escalation line inverts that, and the inversion is the point.
     * It is the one line whose destination IS a safety node, so it must
     * be carried there by the rule rather than by its own routing: a
     * demo where the emergency screen is hard-wired to one button proves
     * nothing about the rule that is supposed to find it. Asserting both
     * directions keeps that honest — every other line must stay clear of
     * the rules, and this one must not.
     */
    const safetyTargets = new Set(CARE.safety.map((r) => r.go));
    const trips = CARE.safety.some((r) => r.test(l.text));
    if (safetyTargets.has(l.go)) {
      ok(trips, `line "${l.id}" aims at safety but no rule catches it`);
    } else {
      ok(
        classify(l.text, CARE.lexicon) !== 'symptom',
        `line "${l.id}" classifies as symptom and would never reach its target`
      );
      ok(!trips, `line "${l.id}" trips safety rule and would never reach its target`);
    }
  }
}
console.log(`  ${lineCount} lines route by identity, none hijacked`);

/* ---- recovery routing ---------------------------------------------- */
console.log('\nRecovery routing');
for (const [input, motive] of [
  ['eggs · oat milk · batteries · cilantro · revenge', 'accident'],
  ['are you a bot', 'meta'],
  ['asdkjhaskdjh', 'boredom'],
] as const) {
  const m = classify(input, CARE.lexicon);
  ok(m === motive, `classify mismatch for ${motive}`);
  const target = RECOVERY_NODE[m as Exclude<typeof m, 'symptom'>];
  ok(!!CARE.nodes[target], `recovery node "${target}" does not exist`);
}
// Three strikes lands on the exit, not on a fourth apology.
let strikes = 0;
for (const s of ['asdf', 'qwerqwer', 'zxcvzxcv']) {
  if (STRIKES.has(classify(s, CARE.lexicon))) strikes++;
}
ok(strikes === 3, `three mashes produced ${strikes} strikes`);
ok(!!CARE.nodes['r-exit'], 'exit node missing');
console.log('  three strikes → r-exit');

/*
 * The parked dropdown still renders.
 *
 * ScenarioTabs replaced ScenarioMenu in the rig, but the menu was kept
 * deliberately, and a component nothing renders is a component that
 * silently stops compiling the next time the types move. This is the
 * same reasoning as the unused-beat check above: kept code is either
 * exercised or it is dead, and calling it "kept" does not make it the
 * first one.
 *
 * They are held to different bars on purpose, and the difference is the
 * whole reason for the swap: at rest the menu shows one label and names
 * a popup, the tabs show every label. The first draft of this check
 * demanded both list everything and failed the menu, which was the check
 * being wrong rather than the menu.
 */
/*
 * The comparison renders as a table, not as prose that looks like one.
 *
 * The check is on the markup rather than the data because the bug was
 * entirely in the rendering: the beat always held three axes and three
 * cells per row, and the component joined them with "·" into a single
 * right-aligned span. The data was a table the whole time; only the
 * output was not.
 */
/*
 * The failed stage is legible without colour.
 *
 * It was a red dot and nothing else: three stages, three identical
 * lines of text, and a "Try again" button with no stated reason. The
 * check asserts the words are there, because the words are the part
 * that survives being read aloud, printed, or seen by someone who does
 * not separate red from green.
 */
console.log('\nFailure states say they failed');
{
  const err = Object.values(SCENARIOS)
    .flatMap((sc) => Object.values(sc.nodes))
    .flatMap((n) => n.say)
    .find((b) => b.t === 'error');
  ok(!!err, 'no error beat anywhere');
  const html = renderToStaticMarkup(<BeatView beat={err as Beat} grouped={false} h={h} />);
  ok(/Failed/.test(html), 'the failed stage is not named in text');
  // Exactly one stage failed, not all of them and not none.
  ok((html.match(/>Failed</g) ?? []).length === 1, 'more than one stage marked failed');
  const stages = (err as Extract<Beat, { t: 'error' }>).stages;
  ok(
    (html.match(/>Done</g) ?? []).length === stages.length - 1,
    'the completed stages carry no state for a screen reader',
  );
  console.log(`  ${stages.length} stages, 1 named failed, ${stages.length - 1} named done`);
}

console.log('\nComparison table');
{
  const cmp = Object.values(SCENARIOS.feline.nodes)
    .flatMap((n) => n.say)
    .find((b) => b.t === 'compare');
  ok(!!cmp, 'no compare beat to render');
  const html = renderToStaticMarkup(
    <BeatView beat={cmp as Beat} grouped={false} h={h} />,
  );
  ok(html.includes('<table'), 'the comparison is not a table');
  // A cell per axis per row, plus the row-header column.
  const axes = (cmp as Extract<Beat, { t: 'compare' }>).axes;
  const rows = (cmp as Extract<Beat, { t: 'compare' }>).rows;
  ok(
    (html.match(/<td/g) ?? []).length === axes.length * rows.length,
    `expected ${axes.length * rows.length} data cells`,
  );
  ok(
    (html.match(/scope="col"/g) ?? []).length === axes.length,
    'column headers do not cover every axis',
  );
  ok(
    (html.match(/scope="row"/g) ?? []).length === rows.length,
    'row headers do not cover every option',
  );
  // The old rendering, and the thing that must not come back.
  ok(!/ · /.test(html), 'comparison values are still joined into prose');
  console.log(`  ${rows.length}×${axes.length}, scoped headers, nothing joined`);
}

console.log('\nScenario pickers');
const menuHtml = renderToStaticMarkup(
  <ScenarioMenu value={SCENARIO_LIST[0].id} options={SCENARIO_LIST} onChange={() => {}} />,
);
/*
 * Read from the data, not retyped.
 *
 * This asserted the literal string "Care Navigator" and broke the
 * moment the tab labels were shortened — a hand-copied duplicate of a
 * value that lives in SCENARIO_LIST, which is the exact class of bug
 * three other checks in this suite exist to catch. A test is not
 * exempt from the rule it enforces.
 */
const first = SCENARIO_LIST[0].label;
ok(menuHtml.includes(first), `ScenarioMenu does not show its current value ("${first}")`);
ok(
  menuHtml.includes('aria-haspopup="listbox"') && menuHtml.includes('aria-expanded="false"'),
  'ScenarioMenu closed does not announce a collapsed listbox',
);
console.log('  ScenarioMenu (parked): shows 1 of 2, announces the popup');

const tabsAllHtml = renderToStaticMarkup(
  <ScenarioTabs value="care" options={SCENARIO_LIST} onChange={() => {}} panelId="p" />,
);
for (const s of SCENARIO_LIST) {
  ok(tabsAllHtml.includes(s.label), `ScenarioTabs omits "${s.label}"`);
}
console.log(`  ScenarioTabs (live): all ${SCENARIO_LIST.length} scenarios on screen at rest`);

/*
 * The tab bar fits on one line.
 *
 * It did not, when a third scenario arrived: the full titles came to
 * about 440px of glyphs and the rig is capped at 430, so the bar
 * wrapped and the rail ran under only the second row. A wrapped tab
 * bar reads as a rendering fault, and no container change can fix it
 * because 430px IS the device width.
 *
 * So the budget is checked rather than remembered. At 20px semibold
 * this font averages ~0.52em per character, and the gaps are 22px, so
 * the labels have (430 - 22·(n-1)) / (0.52 · 20) characters between
 * them. A fourth scenario called something generous will fail here
 * instead of on Frank's screen.
 *
 * Approximate on purpose: it is a guardrail against a wrap, not a
 * typesetter, and the margin below is wide enough to absorb the
 * difference between this estimate and real metrics.
 */
const RIG_PX = 430, GAP_PX = 22, EM_PER_CHAR = 0.52, TAB_PX = 20;
const budget = Math.floor(
  (RIG_PX - GAP_PX * (SCENARIO_LIST.length - 1)) / (EM_PER_CHAR * TAB_PX)
);
const used = SCENARIO_LIST.reduce((n, s) => n + s.label.length, 0);
ok(
  used <= budget - 3,
  `tab labels total ${used} characters; the bar holds about ${budget} before it wraps`
);
console.log(`  tab bar: ${used}/${budget} characters used`);
// Exactly one tab is selected, and it is the one that was passed in.
const tabsHtml = renderToStaticMarkup(
  <ScenarioTabs value="feline" options={SCENARIO_LIST} onChange={() => {}} panelId="p" />,
);
ok(
  (tabsHtml.match(/aria-selected="true"/g) ?? []).length === 1,
  'tabs render other than exactly one selected tab',
);
const felineTag = tabsHtml.split('<button').find((s) => s.includes('sb-tab-feline')) ?? '';
ok(
  felineTag.includes('aria-selected="true"'),
  'the selected tab is not the one named by `value`',
);
// Roving tabindex: one stop for the set, and it is on the selected tab.
ok(
  (tabsHtml.match(/tabindex="0"/gi) ?? []).length === 1 && felineTag.includes('tabindex="0"'),
  'tabs do not carry a single roving tab stop on the selected tab',
);
// The panel must be labelled by a tab that exists, or the association
// the tabpanel advertises points at nothing.
ok(tabsHtml.includes('aria-controls="p"'), 'tabs do not point at their panel');
console.log('  selection and panel wiring agree');

console.log(fails ? `\n${fails} FAILED\n` : '\nAll render checks passed\n');
process.exit(fails ? 1 : 0);
