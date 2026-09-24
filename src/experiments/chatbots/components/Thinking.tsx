import { useEffect, useRef, useState } from 'react';
import s from './product.module.css';

/**
 * The thinking state.
 *
 * Two independent motion channels plus an honesty ladder, because the
 * obvious implementation — staged text — only moves when a stage
 * COMPLETES. Hang for eight seconds and the screen is perfectly still,
 * which reads as dead.
 *
 *   liveness  the active dot breathes, 1500ms   "I am alive"
 *   working   the active label sweeps, 2100ms   "I am on this line"
 *   rail      indeterminate, 1900ms             "I don't know how long"
 *
 * Non-harmonic on purpose so they never sync into a single throb. All
 * three scale with --s-tempo; none of the thresholds below do.
 */

/** Perceptual clock. Human thresholds, so they do not scale. */
const MIN_DWELL = 320;
/*
 * The one string this component owns, because it is structural rather
 * than scenario copy: every scenario's 8s admission is prefixed with it,
 * and the scenario supplies the half that names what is slow.
 */
const LATE_PREFIX = 'Longer than it should be.';
const ELABORATE = 3_000;
const ADMIT = 8_000;
const OFFER = 15_000;

export function Thinking({
  stages,
  facts,
  ms = 1800,
  failAt,
  slowNote,
  exitLabel,
  onExit,
}: {
  stages: string[];
  facts?: string[];
  ms?: number;
  failAt?: number;
  slowNote?: string;
  exitLabel?: string;
  onExit?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(performance.now());
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setElapsed(performance.now() - started.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /*
   * Minimum dwell, and it matters as much as the ladder at the other end:
   * a stage that resolves in 80ms makes the indicator STROBE, which is
   * worse than showing nothing at all.
   */
  const per = Math.max(MIN_DWELL, ms / Math.max(1, stages.length));
  const reached = Math.min(stages.length - 1, Math.floor(elapsed / per));
  const failed = failAt != null && reached >= failAt;

  const showFacts = facts && facts.length > 0 && reached >= Math.min(1, stages.length - 1);
  const late = elapsed > ADMIT;
  const veryLate = elapsed > OFFER;

  return (
    <div className={s.think} aria-hidden="false">
      {stages.map((label, i) => {
        const done = i < reached;
        const active = i === reached;
        const isFail = failed && i === failAt;
        return (
          <div key={label}>
            <div className={s.stage}>
              <span
                className={[
                  s.dot,
                  isFail ? s.failed : done ? s.done : active ? s.now : s.todo,
                ].join(' ')}
              />
              <span className={active && !isFail && !reduced ? s.sweep : undefined}>
                {label}
              </span>
            </div>
            {active && !isFail && !reduced && (
              <div className={s.rail} aria-hidden="true">
                <i />
              </div>
            )}
          </div>
        );
      })}

      {showFacts && (
        <div className={s.facts}>
          {facts!.map((f, i) => (
            <span key={f} className={s.fact} style={{ animationDelay: `${i * 70}ms` }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/*
       * Liveness without motion. Every channel above is animation, so
       * under reduced-motion the signal would vanish entirely — and
       * vestibular sensitivity is MORE common among people using a
       * medical product, not less. Weight plus a ticking counter.
       */}
      {reduced && (
        <p className={s.patient}>
          <span className={s.elapsed}>Still working · {Math.floor(elapsed / 1000)}s</span>
        </p>
      )}

      {/* 3s: the active line elaborates. */}
      {!late && elapsed > ELABORATE && slowNote && <p className={s.patient}>{slowNote}</p>}

      {/*
       * 8s: no amount of pulsing survives this — past here motion stops
       * reassuring and starts taunting. So it says so, and names WHICH
       * part is slow. Specificity is the whole trick: "the clinic
       * directory" is a system with a problem, "please wait" is a system
       * with nothing to say.
       */}
      {late && slowNote && (
        <p className={s.patient}>
          <span>{LATE_PREFIX}</span> {slowNote}
        </p>
      )}

      {/* 15s: a door out. It keeps working — it does not cancel itself to
          make a point — but waiting becomes a choice. */}
      {veryLate && onExit && exitLabel && (
        <div className={s.chips} style={{ marginTop: 6 }}>
          <button type="button" className={s.chip} onClick={onExit}>
            {exitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
