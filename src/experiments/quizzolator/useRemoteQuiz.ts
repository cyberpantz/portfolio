import { useEffect, useState } from 'react';
import { assertValidQuiz, type Quiz } from '../../data/quizzes/types';
import { remoteRef } from '../../data/quizzes';

export type RemoteState =
  | { status: 'idle'; quiz: null; error: null }
  | { status: 'loading'; quiz: null; error: null }
  | { status: 'ready'; quiz: Quiz; error: null }
  | { status: 'error'; quiz: null; error: string };

/**
 * Fetches a quiz from JSON and validates it against the same contract
 * the bundled quizzes satisfy.
 *
 * Validation is the important part. Remote data is untrusted input:
 * a missing correctId, or one matching no choice, would render a
 * question nobody can answer. Better to fail at the boundary with a
 * message than to ship a broken question and blame the visitor.
 *
 * Nothing from this response is ever rendered as markup. Figures and
 * specimens key into registries in code, so remote JSON can name a
 * shape but never supply one.
 */
export function useRemoteQuiz(id: string | null): RemoteState {
  const [state, setState] = useState<RemoteState>({
    status: 'idle',
    quiz: null,
    error: null,
  });

  useEffect(() => {
    const ref = remoteRef(id);
    if (!ref) {
      setState({ status: 'idle', quiz: null, error: null });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', quiz: null, error: null });

    fetch(ref.url, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((raw) => {
        if (cancelled) return;
        // Throws on a malformed quiz — caught below and surfaced.
        const quiz = assertValidQuiz(raw as Quiz);
        setState({ status: 'ready', quiz, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          quiz: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
