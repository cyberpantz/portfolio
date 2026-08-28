import type { Quiz, SpecimenFont } from './types';
import { farmAnimals } from './farm-animals';
import { typography } from './typography';

export * from './types';

/**
 * Bundled quizzes. Statically imported, so they are type-checked at
 * build and cannot fail to arrive.
 */
export const QUIZZES: Quiz[] = [typography, farmAnimals];

/**
 * Quizzes fetched at runtime from JSON.
 *
 * This exists to prove the engine's contract is genuinely a contract:
 * the same components render a quiz that was never part of the build.
 * The cost is visible and lands on the interaction — a loading state
 * before the first question and an error state when the fetch fails —
 * which is exactly the tradeoff the spec described.
 *
 * Text only, deliberately. `figure` and `specimen` choices reference
 * code (a shape registry, a loaded font), so remote data may name
 * them by id but can never supply them. Nothing here is ever rendered
 * as markup.
 */
export interface RemoteQuizRef {
  id: string;
  title: string;
  url: string;
}

export const REMOTE_QUIZZES: RemoteQuizRef[] = [
  { id: 'css', title: 'CSS', url: '/quizzes/css.json' },
];

export const isRemote = (id: string | null | undefined) =>
  REMOTE_QUIZZES.some((r) => r.id === id);

export const remoteRef = (id: string | null | undefined) =>
  REMOTE_QUIZZES.find((r) => r.id === id) ?? null;

/** Every quiz that can be picked, bundled or remote. */
export const QUIZ_INDEX = [
  ...QUIZZES.map((q) => ({ id: q.id, title: q.title, remote: false })),
  ...REMOTE_QUIZZES.map((r) => ({ id: r.id, title: r.title, remote: true })),
];

export const getQuiz = (id: string | null | undefined): Quiz =>
  QUIZZES.find((q) => q.id === id) ?? QUIZZES[0];

/** Every face any bundled quiz needs, for preloading in the head. */
export const ALL_SPECIMEN_FONTS: SpecimenFont[] = Array.from(
  new Set(QUIZZES.flatMap((q) => q.fonts ?? [])),
);
