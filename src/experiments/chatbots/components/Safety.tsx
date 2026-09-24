import { useEffect, useRef } from 'react';
import type { Action, Chip } from '../scripts/types';
import a from './safety.module.css';

/**
 * Safety states — the only global state in the system.
 *
 * The tempo names what the SCREEN does, never how serious this is.
 * Tempo 2 and 3 both carry genuinely dangerous acuity; they earn a softer
 * treatment because in both cases the user's own understanding is the
 * obstacle, and a screen that overshoots loses them entirely.
 *
 *   1 Halt      emergent, minutes   strip withdrawn, motion stopped, one action
 *   2 Hold      crisis, hours       calibrated, escalation one tap away
 *   3 Redirect  urgent, today       one clear action, chrome intact
 *
 * This component reads NO skin tokens. See safety.module.css.
 */
export function Safety({
  tempo,
  headline,
  body,
  action,
  alt,
  footnote,
  onAlt,
}: {
  tempo: 1 | 2 | 3;
  headline: string;
  body: string;
  action: Action;
  alt?: Chip;
  footnote?: string;
  onAlt?: (chip: Chip) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * The ONLY place in the system where focus moves without a user
   * action. Moving focus into arriving content is the classic chat-a11y
   * failure — it steals the caret mid-sentence. An emergency justifies
   * it; nothing else does.
   */
  useEffect(() => {
    if (tempo !== 1) return;
    ref.current?.focus();
  }, [tempo]);

  const cls = [a.alert, tempo === 2 ? a.tempo2 : '', tempo === 3 ? a.tempo3 : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      data-locked
      className={cls}
      role="alert"
      tabIndex={tempo === 1 ? -1 : undefined}
    >
      <h2 className={a.headline}>{headline}</h2>
      <p className={a.body}>{body}</p>

      {action.kind === 'tel' ? (
        <a className={a.action} href={`tel:${action.value}`}>
          {action.label}
        </a>
      ) : (
        <button type="button" className={a.action}>
          {action.label}
        </button>
      )}

      {alt && (
        <button type="button" className={a.alt} onClick={() => onAlt?.(alt)}>
          {alt.label}
        </button>
      )}

      {footnote && <p className={a.footnote}>{footnote}</p>}

      {/* Tempo 1 halts everything. Stillness as an effect, earned by
          everything around it being kinetic. */}
      {tempo === 1 && <p className={a.stilled}>Everything else stopped</p>}
    </div>
  );
}

/**
 * The reframe turn: "the thing you brought me may not be the thing you
 * have."
 *
 * Amber, and visibly not the red of tempo 1, because this is a check and
 * not yet an alarm — crying wolf on a genuine typo has its own cost. It
 * appeared independently in two scenarios, which is why it lives in the
 * engine rather than in any one script.
 */
export function Reframe({
  headline,
  body,
  options,
  onChoose,
}: {
  headline: string;
  body: string;
  options: Chip[];
  onChoose: (c: Chip) => void;
}) {
  return (
    <div data-locked className={`${a.alert} ${a.reframe}`} role="alert">
      <h2 className={a.headline}>{headline}</h2>
      <p className={a.body}>{body}</p>
      <div className={a.choices}>
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className={o.go === options[0].go ? a.action : a.alt}
            onClick={() => onChoose(o)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
