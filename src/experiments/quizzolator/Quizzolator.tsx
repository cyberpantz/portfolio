import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { QUIZ_INDEX, getQuiz, isRemote } from '../../data/quizzes';
import type { Quiz } from '../../data/quizzes/types';
import { useQuiz } from './useQuiz';
import { useRemoteQuiz } from './useRemoteQuiz';
import { QuestionCard } from './QuestionCard';
import { ResultCard } from './ResultCard';
import { FONT_WAIT_MS, itemVariants, stackVariants, stillStackVariants, stillVariants } from './motion';

/**
 * A specimen question is unanswerable if its fonts have not arrived —
 * four fallback serifs is not a Didone question, it is a broken one.
 * So wait, but never forever: past the ceiling the question is shown
 * regardless, because a stalled quiz is worse than a degraded one.
 *
 * Any wait extends the transition rather than showing a spinner. A
 * spinner announces that something went wrong; a slightly longer
 * transition just reads as pacing.
 */
function useFontsReady(quiz: Quiz) {
  const [ready, setReady] = useState(() => !quiz.fonts?.length);

  useEffect(() => {
    if (!quiz.fonts?.length) {
      setReady(true);
      return;
    }
    if (typeof document === 'undefined' || !('fonts' in document)) {
      setReady(true);
      return;
    }

    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setReady(true);
      }
    };

    const ceiling = setTimeout(finish, FONT_WAIT_MS);

    Promise.all(
      quiz.fonts.map((f) =>
        (document as Document).fonts.load(`400 24px "${f}"`).catch(() => undefined),
      ),
    )
      .then(finish)
      .catch(finish);

    return () => clearTimeout(ceiling);
  }, [quiz]);

  return ready;
}

export default function Quizzolator() {
  const prefersReduced = useReducedMotion();
  const still = !!prefersReduced;

  // Deep-linkable: /explorations/quizzolator?quiz=farm-animals
  const [quizId, setQuizId] = useState<string | null>(null);
  useEffect(() => {
    setQuizId(new URLSearchParams(window.location.search).get('quiz'));
  }, []);

  // A remote quiz arrives over the network; a bundled one is already
  // here. Until the fetch resolves we hold the bundled default so the
  // hooks below always have a quiz to work with.
  const remote = useRemoteQuiz(isRemote(quizId) ? quizId : null);
  const quiz = useMemo<Quiz>(
    () => (isRemote(quizId) ? (remote.quiz ?? getQuiz(null)) : getQuiz(quizId)),
    [quizId, remote.quiz],
  );
  const remotePending = isRemote(quizId) && remote.status !== 'ready';

  const fontsReady = useFontsReady(quiz);
  const q = useQuiz(quiz);

  // Kept for the result recap. useQuiz owns the score; this is only
  // for showing which ones went wrong at the end.
  const answersRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    if (q.phase === 'intro') answersRef.current = {};
  }, [q.phase]);

  const handlePick = useCallback(
    (id: string) => {
      if (q.question) answersRef.current[q.question.id] = id;
      q.pick(id);
    },
    [q],
  );

  const switchQuiz = useCallback((id: string) => {
    setQuizId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('quiz', id);
    window.history.replaceState({}, '', url);
  }, []);

  const gate = q.phase === 'question' && !fontsReady;

  return (
    <div className="mx-auto flex min-h-[inherit] w-full max-w-[900px] flex-col justify-center px-5 py-10 sm:px-8">
      <AnimatePresence mode="wait" initial={false}>
        {q.phase === 'intro' && (
          <motion.div
            key="intro"
            variants={still ? stillStackVariants : stackVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-7"
          >
            {/* Eyebrow, then the picker, THEN the chosen quiz.
                Selection has to precede commitment — listing the
                alternatives underneath a title and a Begin button
                asks someone to commit before telling them a choice
                existed. */}
            <motion.div variants={still ? stillVariants : itemVariants}>
              <p className="mb-4 text-exp-micro font-medium tracking-[0.2em] uppercase text-fg-muted">
                The Quizzolator
              </p>

              {/* All three, with the active one marked — a tab row,
                  not an "other quizzes" footnote. aria-current rather
                  than tab semantics, because these swap the whole
                  screen rather than a panel. */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a quiz">
                {QUIZ_INDEX.map((entry) => {
                  const active = entry.id === (isRemote(quizId) ? quizId : quiz.id);
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => switchQuiz(entry.id)}
                      aria-current={active ? 'true' : undefined}
                      className={[
                        'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-4',
                        'text-exp-micro tracking-[0.12em] uppercase transition-colors duration-300',
                        active
                          ? 'border-accent text-accent'
                          : 'border-rule-strong text-fg-muted hover:border-fg-muted hover:text-fg',
                      ].join(' ')}
                    >
                      {entry.title}
                      {entry.remote && (
                        <span
                          className={active ? 'text-accent/60' : 'text-exp-dim'}
                          title="Loaded from JSON at runtime"
                        >
                          ·&nbsp;json
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={still ? stillVariants : itemVariants}>
              <h1 className="max-w-[14ch] font-serif text-[clamp(40px,7vw,88px)] leading-[0.95] tracking-[-0.03em] text-fg">
                {remote.status === 'loading'
                  ? 'Fetching…'
                  : remote.status === 'error'
                    ? 'That did not load'
                    : quiz.title}
              </h1>
            </motion.div>

            <motion.p
              variants={still ? stillVariants : itemVariants}
              className="-mt-3 max-w-[50ch] text-[clamp(17px,1.6vw,21px)] leading-[1.5] text-exp-bright [text-wrap:pretty]"
              role={remote.status === 'error' ? 'alert' : undefined}
            >
              {remote.status === 'loading'
                ? 'This one lives in a JSON file rather than the bundle, so it has to travel.'
                : remote.status === 'error'
                  ? `The quiz could not be loaded — ${remote.error}. The bundled quizzes are unaffected; pick another above.`
                  : quiz.blurb}
            </motion.p>

            <motion.div
              variants={still ? stillVariants : itemVariants}
              className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6"
            >
              <button
                type="button"
                onClick={q.begin}
                disabled={remotePending}
                className="inline-flex min-h-11 cursor-pointer items-center gap-3 border border-accent
                           px-7 text-exp-micro font-medium tracking-[0.16em] uppercase text-accent
                           transition-colors duration-300 hover:bg-accent hover:text-ink
                           disabled:cursor-not-allowed disabled:border-rule disabled:text-exp-dim
                           disabled:hover:bg-transparent"
              >
                {remote.status === 'loading' ? 'Loading' : 'Begin'}
                <span aria-hidden="true">→</span>
              </button>
              {!remotePending && (
                <span className="text-exp-note text-exp-muted">
                  {quiz.questions.length} questions
                </span>
              )}
            </motion.div>
          </motion.div>
        )}

        {q.phase === 'question' && q.question && !gate && (
          <QuestionCard
            key={q.question.id}
            question={q.question}
            picked={q.picked}
            still={still}
            isLast={q.isLast}
            onPick={handlePick}
            onNext={q.next}
          />
        )}

        {q.phase === 'result' && (
          <ResultCard
            key="result"
            quiz={quiz}
            score={q.score}
            band={q.band}
            answers={answersRef.current}
            still={still}
            onRestart={q.restart}
          />
        )}
      </AnimatePresence>

      {q.phase === 'question' && (
        <div className="mt-10 flex items-center gap-4 border-t border-rule pt-5">
          <span className="text-exp-micro tracking-[0.16em] uppercase text-fg-muted [font-variant-numeric:tabular-nums]">
            {String(q.index + 1).padStart(2, '0')} / {String(q.total).padStart(2, '0')}
          </span>
          <progress
            className="h-[3px] flex-1 appearance-none overflow-hidden bg-rule
                       [&::-moz-progress-bar]:bg-accent
                       [&::-webkit-progress-bar]:bg-rule
                       [&::-webkit-progress-value]:bg-accent
                       [&::-webkit-progress-value]:transition-all
                       [&::-webkit-progress-value]:duration-500"
            value={q.index + (q.answered ? 1 : 0)}
            max={q.total}
            aria-label={`Question ${q.index + 1} of ${q.total}`}
          />
        </div>
      )}
    </div>
  );
}
