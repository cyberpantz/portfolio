import { useCallback, useMemo, useState } from 'react';
import { bandFor, type Quiz } from '../../data/quizzes/types';

export type Phase = 'intro' | 'question' | 'result';

export interface QuizState {
  phase: Phase;
  index: number;
  /** Chosen choice id for the current question, or null if unanswered. */
  picked: string | null;
  score: number;
}

export function useQuiz(quiz: Quiz) {
  const [state, setState] = useState<QuizState>({
    phase: 'intro',
    index: 0,
    picked: null,
    score: 0,
  });

  const question = quiz.questions[state.index];
  const total = quiz.questions.length;
  const isLast = state.index === total - 1;
  const answered = state.picked !== null;
  const wasCorrect = answered && state.picked === question?.correctId;

  const begin = useCallback(() => {
    setState({ phase: 'question', index: 0, picked: null, score: 0 });
  }, []);

  const pick = useCallback(
    (choiceId: string) => {
      setState((s) => {
        // One-shot. A second guess makes the score meaningless and
        // removes the small sting that makes getting it right feel
        // like anything.
        if (s.picked !== null) return s;
        const correct = quiz.questions[s.index].correctId === choiceId;
        return { ...s, picked: choiceId, score: s.score + (correct ? 1 : 0) };
      });
    },
    [quiz],
  );

  const next = useCallback(() => {
    setState((s) => {
      if (s.picked === null) return s;
      if (s.index >= quiz.questions.length - 1) return { ...s, phase: 'result' };
      return { ...s, index: s.index + 1, picked: null };
    });
  }, [quiz]);

  const restart = useCallback(() => {
    setState({ phase: 'intro', index: 0, picked: null, score: 0 });
  }, []);

  const band = useMemo(() => bandFor(quiz, state.score), [quiz, state.score]);

  return {
    ...state,
    question,
    total,
    isLast,
    answered,
    wasCorrect,
    band,
    begin,
    pick,
    next,
    restart,
  };
}
