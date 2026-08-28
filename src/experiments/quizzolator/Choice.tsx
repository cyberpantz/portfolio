import { motion } from 'framer-motion';
import type { AnswerKind, Choice as ChoiceData } from '../../data/quizzes/types';
import { Figure } from './figures';
import { CheckMark, CrossMark } from './Marks';
import {
  CORRECT_POP,
  CORRECT_SCALE,
  WRONG_SHAKE,
  WRONG_SHAKE_TRANSITION,
  itemVariants,
  stillVariants,
} from './motion';

export type ChoiceState = 'idle' | 'correct' | 'wrong' | 'muted';

interface Props {
  choice: ChoiceData;
  kind: AnswerKind;
  state: ChoiceState;
  answered: boolean;
  checked: boolean;
  still: boolean;
  onPick: (id: string) => void;
}

/** Colour is never the only signal — every state also changes the
 *  border weight and adds a drawn mark. */
const TONE: Record<ChoiceState, string> = {
  idle: 'border-rule-strong text-fg hover:border-fg-muted hover:bg-ink-surface',
  correct: 'border-accent text-accent',
  wrong: 'border-[color:var(--color-wrong)] text-[color:var(--color-wrong)]',
  muted: 'border-rule text-fg-muted opacity-45',
};

/**
 * Renders the label as type. Per-pair kerning is applied as inline
 * spans with negative margin — the whole point of the kerning
 * question is that the gaps differ, so it cannot be a single string.
 */
function Specimen({ choice }: { choice: ChoiceData }) {
  const s = choice.specimen!;
  const style: React.CSSProperties = {
    fontFamily: `'${s.fontFamily}', serif`,
    fontStyle: s.fontStyle ?? 'normal',
    fontWeight: s.fontWeight ?? 400,
    letterSpacing: s.letterSpacing,
    fontFeatureSettings: s.fontFeatureSettings,
    fontSize: `calc(clamp(30px, 5vw, 46px) * ${s.scale ?? 1})`,
    lineHeight: 1.1,
    transform: s.skewX ? `skewX(${s.skewX}deg)` : undefined,
    display: 'inline-block',
  };

  if (s.pairKerning) {
    return (
      <span style={style}>
        {choice.label.split('').map((ch, i) => (
          <span key={i} style={{ marginRight: s.pairKerning?.[i] }}>
            {ch}
          </span>
        ))}
      </span>
    );
  }
  return <span style={style}>{choice.label}</span>;
}

export function Choice({ choice, kind, state, answered, checked, still, onPick }: Props) {
  const isRow = kind === 'text';

  // The animate prop carries the state feedback. Correct swells and
  // settles; wrong shakes a little. Both are suppressed when the
  // visitor has asked for reduced motion — the colour and the drawn
  // mark still carry the meaning.
  const feedback =
    still || state === 'idle' || state === 'muted'
      ? {}
      : state === 'correct'
        ? { scale: CORRECT_SCALE, transition: CORRECT_POP }
        : { x: WRONG_SHAKE, transition: WRONG_SHAKE_TRANSITION };

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={answered}
      onClick={() => onPick(choice.id)}
      variants={still ? stillVariants : itemVariants}
      animate={feedback}
      className={[
        'group/choice relative flex w-full cursor-pointer items-center gap-4 border',
        'text-left transition-colors duration-300',
        'disabled:cursor-default',
        isRow ? 'min-h-14 px-5 py-4' : 'min-h-[132px] flex-col justify-center gap-3 p-5 text-center',
        TONE[state],
      ].join(' ')}
    >
      {kind === 'figure' && choice.figure && (
        <span className="block h-12 w-16 shrink-0" aria-hidden="true">
          <Figure id={choice.figure} />
        </span>
      )}

      {kind === 'specimen' ? (
        <>
          {/* The visible specimen is decorative to assistive tech; the
              factual description below is the accessible name. */}
          <span aria-hidden="true" className="flex min-h-[64px] items-center justify-center">
            <Specimen choice={choice} />
          </span>
          <span className="sr-only">{choice.describedAs}</span>
        </>
      ) : (
        <span className={isRow ? 'text-exp-label' : 'text-exp-note'}>{choice.label}</span>
      )}

      {/* Revealed after answering — naming a specimen before then
          would give the question away. */}
      {answered && choice.postLabel && (
        <span className="text-exp-micro tracking-[0.12em] uppercase text-fg-muted">
          {choice.postLabel}
        </span>
      )}

      {(state === 'correct' || state === 'wrong') && (
        <span
          className={isRow ? 'ml-auto shrink-0' : 'absolute top-3 right-3'}
          aria-hidden="true"
        >
          {state === 'correct' ? <CheckMark still={still} /> : <CrossMark still={still} />}
        </span>
      )}
    </motion.button>
  );
}
