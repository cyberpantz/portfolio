import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Question } from '../../data/quizzes/types';
import { Choice, type ChoiceState } from './Choice';
import {
  REVEAL_CORRECT_DELAY,
  REVEAL_FADE,
  STILL,
  itemVariants,
  stackVariants,
  stillStackVariants,
  stillVariants,
} from './motion';

interface Props {
  question: Question;
  picked: string | null;
  still: boolean;
  onPick: (id: string) => void;
  onNext: () => void;
  isLast: boolean;
}

export function QuestionCard({ question, picked, still, onPick, onNext, isLast }: Props) {
  const answered = picked !== null;
  const correct = answered && picked === question.correctId;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // The correct answer is revealed a beat after a wrong one, so the
  // two facts land in order — you were wrong, then here is right —
  // rather than arriving as one confusing frame.
  const [showCorrect, setShowCorrect] = useState(false);
  useEffect(() => {
    if (!answered) {
      setShowCorrect(false);
      return;
    }
    if (correct || still) {
      setShowCorrect(true);
      return;
    }
    const t = setTimeout(() => setShowCorrect(true), REVEAL_CORRECT_DELAY * 1000);
    return () => clearTimeout(t);
  }, [answered, correct, still]);

  // Focus lands on the new question rather than at the top of the
  // document, then moves to Next once it is live — so the whole quiz
  // is answer, read, Enter, without touching the mouse.
  useEffect(() => {
    headingRef.current?.focus();
  }, [question.id]);

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  const stateFor = (choiceId: string): ChoiceState => {
    if (!answered) return 'idle';
    if (choiceId === question.correctId) return showCorrect ? 'correct' : 'muted';
    if (choiceId === picked) return 'wrong';
    return 'muted';
  };

  const gridClass =
    question.kind === 'text'
      ? 'flex flex-col gap-3'
      : 'grid grid-cols-2 gap-3 sm:grid-cols-4';

  return (
    <motion.div
      variants={still ? stillStackVariants : stackVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className="flex w-full flex-col gap-6"
    >
      <motion.div variants={still ? stillVariants : itemVariants}>
        <h2
          ref={headingRef}
          tabIndex={-1}
          id={`q-${question.id}`}
          className="max-w-[24ch] font-serif text-[clamp(26px,3.6vw,44px)] leading-[1.08]
                     tracking-[-0.02em] text-fg outline-none [text-wrap:balance]"
        >
          {question.prompt}
        </h2>
      </motion.div>

      {question.aside && (
        <motion.p
          variants={still ? stillVariants : itemVariants}
          className="-mt-3 max-w-[46ch] text-exp-body text-exp-muted [text-wrap:pretty]"
        >
          {question.aside}
        </motion.p>
      )}

      <div
        role="radiogroup"
        aria-labelledby={`q-${question.id}`}
        aria-disabled={answered || undefined}
        className={gridClass}
      >
        {question.choices.map((c) => (
          <Choice
            key={c.id}
            choice={c}
            kind={question.kind}
            state={stateFor(c.id)}
            answered={answered}
            checked={picked === c.id}
            still={still}
            onPick={onPick}
          />
        ))}
      </div>

      {/* Announced politely rather than by colour, and never as an
          alert — this is information, not an emergency. */}
      <p role="status" aria-live="polite" className="sr-only">
        {answered
          ? correct
            ? `Correct. ${question.reveal}`
            : `Not quite. ${question.reveal}`
          : ''}
      </p>

      <motion.div
        variants={still ? stillVariants : itemVariants}
        className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: answered ? 1 : 0 }}
          transition={still ? STILL : REVEAL_FADE}
          className="max-w-[54ch] text-exp-body text-exp-bright [text-wrap:pretty]"
          aria-hidden="true"
        >
          {answered ? question.reveal : ''}
        </motion.p>

        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          disabled={!answered}
          className="ml-auto inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-3
                     border border-accent px-6 text-exp-micro font-medium tracking-[0.16em]
                     uppercase text-accent transition-colors duration-300
                     hover:bg-accent hover:text-ink
                     disabled:cursor-not-allowed disabled:border-rule disabled:text-exp-dim
                     disabled:hover:bg-transparent"
        >
          {isLast ? 'See score' : 'Next'}
          <span aria-hidden="true">→</span>
        </button>
      </motion.div>
    </motion.div>
  );
}
