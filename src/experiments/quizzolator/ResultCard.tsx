import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Quiz, ResultBand } from '../../data/quizzes/types';
import { BAND_DELAY_MS, COUNT_MS, itemVariants, stackVariants, stillStackVariants, stillVariants } from './motion';

interface Props {
  quiz: Quiz;
  score: number;
  band: ResultBand;
  answers: Record<string, string | null>;
  still: boolean;
  onRestart: () => void;
}

/** Counts up with an ease-out. Under reduced motion it simply is the
 *  final number — the score is meaning, not decoration. */
function useCountUp(target: number, ms: number, still: boolean) {
  const [n, setN] = useState(still ? target : 0);
  useEffect(() => {
    if (still) {
      setN(target);
      return;
    }
    if (target === 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, still]);
  return n;
}

export function ResultCard({ quiz, score, band, answers, still, onRestart }: Props) {
  const shown = useCountUp(score, COUNT_MS, still);
  const [bandVisible, setBandVisible] = useState(still);

  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => setBandVisible(true), COUNT_MS + BAND_DELAY_MS);
    return () => clearTimeout(t);
  }, [still]);

  return (
    <motion.div
      variants={still ? stillStackVariants : stackVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex w-full flex-col gap-8"
    >
      <motion.div variants={still ? stillVariants : itemVariants}>
        <p className="mb-4 text-exp-micro font-medium tracking-[0.2em] uppercase text-fg-muted">
          {quiz.title} — result
        </p>
        <p
          className="font-serif text-[clamp(64px,14vw,160px)] leading-[0.85] tracking-[-0.04em]
                     text-fg [font-variant-numeric:tabular-nums]"
        >
          {shown}
          <span className="text-exp-dim">/{quiz.questions.length}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: bandVisible ? 1 : 0 }}
        transition={{ duration: still ? 0.001 : 0.4 }}
        className="border-t border-rule pt-6"
      >
        <h2 className="font-serif text-[clamp(28px,4vw,48px)] leading-[1.05] tracking-[-0.02em] text-accent">
          {band.title}
        </h2>
        <p className="mt-4 max-w-[52ch] text-exp-body text-exp-bright [text-wrap:pretty]">
          {band.body}
        </p>
      </motion.div>

      {/* Recap strip — which ones went wrong, without re-reading the
          whole quiz. */}
      <motion.ol
        variants={still ? stillVariants : itemVariants}
        className="flex list-none flex-wrap gap-2 border-t border-rule pt-6"
      >
        {quiz.questions.map((q, i) => {
          const right = answers[q.id] === q.correctId;
          return (
            <li
              key={q.id}
              className={[
                'flex h-9 min-w-9 items-center justify-center border px-2',
                'text-exp-micro [font-variant-numeric:tabular-nums]',
                right
                  ? 'border-accent text-accent'
                  : 'border-[color:var(--color-wrong)] text-[color:var(--color-wrong)]',
              ].join(' ')}
            >
              <span aria-hidden="true">{right ? '✓' : '✕'}</span>
              <span className="sr-only">
                Question {i + 1}: {right ? 'correct' : 'incorrect'}
              </span>
              <span className="ml-1.5" aria-hidden="true">
                {i + 1}
              </span>
            </li>
          );
        })}
      </motion.ol>

      <motion.div
        variants={still ? stillVariants : itemVariants}
        className="flex flex-wrap items-center gap-x-8 gap-y-3"
      >
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 cursor-pointer items-center gap-3 border border-accent
                     px-6 text-exp-micro font-medium tracking-[0.16em] uppercase text-accent
                     transition-colors duration-300 hover:bg-accent hover:text-ink"
        >
          Play again
        </button>
        <a
          href="/explorations"
          className="ul-draw inline-flex min-h-11 items-center text-exp-micro font-medium
                     tracking-[0.16em] uppercase text-fg-muted hover:text-fg"
        >
          All explorations
        </a>
      </motion.div>
    </motion.div>
  );
}
