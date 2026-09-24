import { useState } from 'react';
import type { Alternative, Chip, CompareRow, PickSpec, ResultItem, Slot } from '../scripts/types';
import { EarDiagram } from './EarDiagram';
import { SofaDiagram } from './SofaDiagram';
import s from './product.module.css';

/**
 * Shared chip row. Every option carries identical weight.
 *
 * The first chip used to be filled with the accent colour, and in a chat
 * a filled pill among outlined ones reads as the one you already chose —
 * so the question arrived looking half-answered, with the interface's
 * preferred answer pre-ticked.
 *
 * Three things were wrong with it. It invented a recommendation nobody
 * authored, out of nothing but array order. It put a SELECTED appearance
 * on an unselected control, which is the plainest kind of affordance
 * lying. And it broke this file's own documented rule — that the
 * uncertainty option is never styled as secondary — because making one
 * chip primary makes every other chip secondary by definition, and
 * "I'm not sure" was always last in the array.
 *
 * These are peers: answers to a question, not an action with
 * alternatives. Filled accent is now reserved for the recovery action
 * after a failure, where there genuinely is one thing to do next.
 */
export function Chips({
  options,
  onChoose,
  pulse,
  chosen,
}: {
  options: Chip[];
  onChoose: (c: Chip) => void;
  pulse?: boolean;
  chosen?: string;
}) {
  const settled = chosen != null;
  return (
    <div className={s.chips}>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          className={[s.chip, pulse && !settled ? s.pulse : ''].filter(Boolean).join(' ')}
          /*
           * `disabled` rather than a click guard: a control that cannot
           * be used must also leave the tab order, or the keyboard still
           * walks through four dead buttons per answered question.
           */
          disabled={settled}
          data-state={settled ? (o.label === chosen ? 'taken' : 'passed') : undefined}
          onClick={() => onChoose(o)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Point at it.
 *
 * The question no message bubble asks well — and the component that only
 * a non-verbal subject forced into existence, since with no sensation to
 * ask about the evidence is entirely when-and-where.
 *
 * The text controls ARE the controls, and the diagram is a pointer-only
 * shortcut to them — aria-hidden, out of the tab order, hidden entirely
 * below 420px. One rule serving accessibility and reflow at once.
 *
 * "Decoration" is what this used to say, and it stopped being true once
 * the regions took clicks. The distinction that survives is the one that
 * matters: the drawing can do nothing the buttons cannot, so losing it
 * costs a visitor speed and never an answer.
 */
export function Picker({
  spec,
  onPick,
  chosen,
}: {
  spec: PickSpec;
  onPick: (label: string, value: string, go?: string) => void;
  chosen?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const settled = chosen != null;
  /* A click on the drawing answers as the matching button would. */
  const fromRegion = (value: string) => {
    const c = spec.choices.find((x) => x.value === value);
    if (c) onPick(c.label, c.value, c.go);
  };
  return (
    <div className={s.card} data-card>
      <p className={s.cardTitle}>{spec.prompt}</p>
      <div className={s.pickWrap}>
        {/*
         * One `hover` state drives both halves, so pointing at the
         * drawing lights the matching button and vice versa. A region
         * whose value has no button — "Honestly not sure" has no place
         * on an ear — simply never fires.
         */}
        {spec.diagram === 'ear' && (
          <span className={s.pickDiagram}>
            <EarDiagram active={hover} frozen={settled} onHover={setHover} onPick={fromRegion} />
          </span>
        )}
        {spec.diagram === 'sofa' && (
          <span className={s.pickDiagram}>
            <SofaDiagram active={hover} frozen={settled} onHover={setHover} onPick={fromRegion} />
          </span>
        )}
        <div className={s.pickList}>
          {spec.choices.map((c) => (
            <button
              key={c.value}
              type="button"
              className={s.pickBtn}
              disabled={chosen != null}
              data-state={chosen != null ? (c.label === chosen ? 'taken' : 'passed') : undefined}
              onMouseEnter={() => setHover(c.value)}
              onFocus={() => setHover(c.value)}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onClick={() => onPick(c.label, c.value, c.go)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Compare({
  title,
  axes,
  rows,
}: {
  title: string;
  axes: string[];
  rows: CompareRow[];
}) {
  /*
   * A real table, because it was pretending to be one.
   *
   * The first version put the label on the left and `cells.join(' · ')`
   * on the right, which is three columns of data rendered as one string
   * of prose. Nothing lined up — "$40 · One evening · Usually" and
   * "$120 · An afternoon · Reliably" share no vertical edge — so the
   * only way to compare two options on cost was to read both rows and
   * parse out the first token. That is the exact work a comparison
   * table exists to do for you, and the layout was handing it back.
   *
   * The header row had the same shape and was worse: "Cost · Effort ·
   * Works" floated right, sitting above nothing in particular. It named
   * the columns without being able to point at them.
   *
   * So: `<table>`, `<th scope="col">` per axis, `<th scope="row">` per
   * option. The semantics are not decoration here — a screen reader
   * reading the joined version announced a row as one run-on sentence
   * with no way to ask which axis a value belonged to. With scopes it
   * announces "Cat tree by the window, Cost, $120".
   */
  return (
    <div className={s.card} data-card>
      <p className={s.cardTitle} id={`cmp-${slug(title)}`}>
        {title}
      </p>
      {/*
       * The scroll container is focusable and named, because a region
       * that scrolls but cannot be focused cannot be scrolled from a
       * keyboard — the content is reachable by screen reader and
       * unreachable by arrow key, which is a worse failure for being
       * invisible in an audit that only counts labels.
       */}
      <div
        className={s.compareScroll}
        role="region"
        aria-labelledby={`cmp-${slug(title)}`}
        tabIndex={0}
      >
        <table className={s.compare}>
          <thead>
            <tr>
              {/*
               * The corner cell is empty and stays empty. It heads the
               * column of option names, and every label for it ("Option",
               * "Approach") is a word the reader does not need — the rows
               * are self-evidently the things being compared. An empty
               * `<th>` is the standard way to say so.
               */}
              <th />
              {axes.map((axis) => (
                <th key={axis} scope="col" className={s.compareAxis}>
                  {axis}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className={s.compareLabel}>
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={axes[i] ?? i} className={s.compareCell}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A title is authored copy, so it cannot be trusted as a raw id. */
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Confidence as a drawn arc — non-diagnostic copy carries the meaning. */
export function Recommendation({ why, confidence }: { why: string; confidence: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <div className={s.card} data-card>
      <div className={s.confidence}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
          <circle cx="11" cy="11" r={r} fill="none" stroke="var(--s-rule)" strokeWidth="2.5" />
          <circle
            cx="11"
            cy="11"
            r={r}
            fill="none"
            stroke="var(--s-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${c * confidence} ${c}`}
            transform="rotate(-90 11 11)"
          />
        </svg>
        <span>{Math.round(confidence * 100)}% FIT</span>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--s-size)', lineHeight: 'var(--s-lh)' }}>{why}</p>
    </div>
  );
}

/** The strip's history as a receipt. Transparency with no reading cost. */
export function Disclosure({
  summary,
  rows,
}: {
  summary: string;
  rows: [string, string][];
}) {
  return (
    <details className={`${s.card} ${s.disclose}`} data-card>
      <summary className={s.discloseSummary}>{summary}</summary>
      {rows.map(([k, v]) => (
        <div key={k} className={s.row}>
          <b>{k}</b>
          <span>{v}</span>
        </div>
      ))}
    </details>
  );
}

export function Results({ items }: { items: ResultItem[] }) {
  return (
    <div className={s.card} data-card>
      {items.map((it) => (
        <div key={it.name} className={s.row}>
          <span>
            <b>{it.name}</b>
            <br />
            {it.detail}
          </span>
          {it.meta && <span>{it.meta}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * The empty state, and the beat worth fighting for.
 *
 * Not sympathetic — useful. It names the constraint precisely so the user
 * can verify the reasoning, then offers live actions, so even the dead
 * end leaves something running.
 */
export function EmptyPivot({
  constraint,
  title,
  alternatives,
  onChoose,
  chosen,
}: {
  constraint: string;
  title: string;
  alternatives: Alternative[];
  onChoose: (label: string, go?: string) => void;
  chosen?: string;
}) {
  return (
    <>
      <div className={s.ai} data-bubble>
        {constraint}
      </div>
      <div className={s.card} data-card>
        <p className={s.cardTitle}>{title}</p>
        {alternatives.map((alt) => (
          <button
            key={alt.label}
            type="button"
            className={s.pickBtn}
            style={{ width: '100%' }}
            disabled={chosen != null}
            data-state={chosen != null ? (alt.label === chosen ? 'taken' : 'passed') : undefined}
            onClick={() => onChoose(alt.label, alt.go)}
          >
            <span className={s.row} style={{ border: 0, padding: 0, width: '100%' }}>
              <b>{alt.label}</b>
              <span>{alt.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function Scheduler({
  slots,
  onPick,
  chosen,
}: {
  slots: Slot[];
  onPick: (label: string, go: string) => void;
  chosen?: string;
}) {
  return (
    <div className={s.chips}>
      {slots.map((sl) => (
        <button
          key={sl.label}
          type="button"
          className={s.chip}
          disabled={chosen != null}
          data-state={chosen != null ? (chosen.startsWith(sl.label) ? 'taken' : 'passed') : undefined}
          onClick={() => onPick(sl.label, sl.go)}
        >
          {sl.label} <span style={{ opacity: 0.7 }}>· {sl.detail}</span>
        </button>
      ))}
    </div>
  );
}

/** One sentence, then the real alternative. A refusal that immediately
    offers the real path is barely felt as a refusal. */
export function Boundary({ refusal, instead }: { refusal: string; instead: string }) {
  return (
    <>
      <div className={s.ai} data-bubble>
        {refusal}
      </div>
      <div className={`${s.ai} ${s.grouped}`} data-bubble>
        {instead}
      </div>
    </>
  );
}

/**
 * System error, landing INSIDE the thinking component — the same stages,
 * with the failed one red — so you can see exactly how far it got.
 *
 * Two recoveries, one of which abandons the product entirely and hands
 * over phone numbers. Offering that is the most trustworthy thing here.
 */
export function SystemError({
  stages,
  stage,
  message,
  escape,
  onRetry,
  onEscape,
}: {
  stages: string[];
  stage: number;
  message?: string;
  escape: Alternative;
  onRetry: () => void;
  onEscape: () => void;
}) {
  /*
   * The failed stage says it failed, in words.
   *
   * It used to be a red dot and nothing else. "Verifying your identity"
   * is a present participle — it reads as still happening — so the list
   * showed three steps in progress and then offered a "Try again"
   * button with no stated reason to try anything again.
   *
   * Two failures in one. Comprehension: nothing on screen said the word
   * "failed". And WCAG 1.4.1, because the single red dot was the ONLY
   * carrier of which step broke; anyone who cannot separate #b4321f from
   * #1d7a4f got a list of identical lines, and a screen reader got no
   * state at all, since the dots are decorative spans with no text.
   *
   * Fixed here rather than in the scripts, and that is the load-bearing
   * decision. `stages` is ONE array serving two beats: the `think` beat
   * plays it forward while the work is happening, where "Verifying your
   * identity" is exactly right, and the `error` beat freezes it after
   * the work has stopped, where it is exactly wrong. Rewriting the copy
   * to "Unable to verify identity" would fix the error state and break
   * the nine seconds of thinking that precede it. One array, two
   * tenses — so the tense belongs to the component that knows which
   * moment it is rendering, and this fix lands in every scenario at
   * once rather than being re-typed per script.
   */
  return (
    <>
      <div className={s.think}>
        {stages.map((label, i) => (
          <div className={s.stage} key={label}>
            <span className={[s.dot, i === stage ? s.failed : s.done].join(' ')} />
            <span>{label}</span>
            {i === stage ? (
              <span className={s.stageFailed}>Failed</span>
            ) : (
              /*
               * The completed steps carry their state too, for a reader
               * who is hearing this rather than seeing it. Marking only
               * the failure would leave the other two ambiguous out
               * loud — "Sending a code to your email" with no verdict.
               */
              <span className={s.srOnly}>Done</span>
            )}
          </div>
        ))}
      </div>
      {message && (
        <div className={s.ai} data-bubble>
          {message}
        </div>
      )}
      <div className={s.chips}>
        <button type="button" className={`${s.chip} ${s.chipPrimary}`} onClick={onRetry}>
          Try again
        </button>
        <button type="button" className={s.chip} onClick={onEscape}>
          {escape.label}
        </button>
      </div>
    </>
  );
}
