import { motion } from 'framer-motion';
import { VAULT_STEPS } from './cues';
import c from './ceremony.module.css';

const EASE = [0.65, 0, 0.25, 1] as const;
const MARKS = [120, 240, 352];

/** A watch-movement dial. Each step turns the hand to a mark; the third stops short and does not arrive. */
export function Vault({ lines, ms }: { lines: string[]; ms: number }) {
  const [title, ...rest] = lines;
  const failure = rest[rest.length - 1];
  const steps = rest.slice(0, -1);
  const s = ms / 1000;
  const [a, b, f] = VAULT_STEPS;

  return (
    <div className={c.vault} style={{ ['--fail' as string]: `${f * ms}ms` }}>
      <motion.p className={c.maison} initial={{ opacity: 0, letterSpacing: '0.42em' }} animate={{ opacity: 1, letterSpacing: '0.28em' }} transition={{ duration: 1.4, ease: EASE }}>
        {title}
      </motion.p>

      <div className={c.dial}>
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="92" className={c.dialRing} />
          <g className={c.dialTicks}>
            {Array.from({ length: 60 }, (_, i) => (
              <line key={i} x1="100" y1="12" x2="100" y2={i % 5 ? 16 : 21} transform={`rotate(${i * 6} 100 100)`} />
            ))}
          </g>
          <circle cx="100" cy="100" r="64" className={c.dialInner} />
          {MARKS.map((deg) => (
            <circle key={deg} cx="100" cy="42" r="2.2" className={c.dialMark} transform={`rotate(${deg === 352 ? 360 : deg} 100 100)`} />
          ))}
        </svg>
        <motion.div
          className={c.hand}
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 0, MARKS[0], MARKS[0], MARKS[1], MARKS[1], MARKS[2], MARKS[2] - 4, MARKS[2], MARKS[2]] }}
          transition={{ duration: s, times: [0, a - 0.07, a, b - 0.07, b, f - 0.07, f, f + 0.025, f + 0.05, 1], ease: EASE }}
        >
          <svg viewBox="0 0 200 200" aria-hidden>
            <line x1="100" y1="100" x2="100" y2="46" className={c.handLine} />
            <circle cx="100" cy="100" r="3.2" className={c.handPin} />
          </svg>
        </motion.div>
      </div>

      <ol className={c.steps}>
        {steps.map((step, i) => {
          const at = VAULT_STEPS[i];
          const last = i === steps.length - 1;
          return (
            <motion.li key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (at - 0.12) * s, duration: 0.6, ease: EASE }}>
              {step}
              <motion.span
                className={c.rule}
                data-last={last || undefined}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: last ? 0.82 : 1 }}
                transition={{ delay: (at - 0.1) * s, duration: 0.1 * s, ease: EASE }}
              />
            </motion.li>
          );
        })}
      </ol>

      <motion.p className={c.verdict} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (f + 0.07) * s, duration: 0.9, ease: EASE }}>
        {failure}
      </motion.p>
    </div>
  );
}
