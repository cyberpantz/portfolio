/**
 * The Quizzolator's only contract.
 *
 * The engine renders whatever satisfies these types and has no idea
 * where the object came from — static import today, a build-time
 * database query later, without the engine changing.
 */

export type AnswerKind = 'text' | 'figure' | 'specimen';

/** Keys into the shape registry in figures.tsx. Never markup. */
export type FigureId =
  | 'cow'
  | 'pig'
  | 'chicken'
  | 'sheep'
  | 'goat'
  | 'horse'
  | 'duck'
  | 'goose';

/** Faces the explorations shell actually loads. A specimen may only
 *  name one of these — an arbitrary string is a request for a font
 *  the page does not have. */
export type SpecimenFont =
  | 'Bodoni Moda'
  | 'Archivo'
  | 'EB Garamond'
  | 'Libre Franklin'
  | 'JetBrains Mono';

export interface SpecimenStyle {
  fontFamily: SpecimenFont;
  fontStyle?: 'normal' | 'italic';
  fontWeight?: number;
  letterSpacing?: string;
  /** Per-pair kerning, applied as inline spans. Index is the gap
   *  after that character. Used by the kerning question. */
  pairKerning?: Record<number, string>;
  /** Shear in degrees — fakes an oblique so a question can ask
   *  which italic was actually drawn. */
  skewX?: number;
  fontFeatureSettings?: string;
  /** Multiplier on the base specimen size, for x-height questions
   *  where the point size must be identical but the face differs. */
  scale?: number;
}

export interface Choice {
  id: string;
  /** Always present. For figure and specimen choices this is both
   *  the visible caption and part of the accessible name. */
  label: string;
  figure?: FigureId;
  specimen?: SpecimenStyle;
  /** Specimen only: a factual description of what is shown, used as
   *  the accessible name. Describes without answering — see the
   *  accessibility section of the spec. */
  describedAs?: string;
  /** Revealed after answering. Usually the name of the thing, held
   *  back because naming it up front gives the question away. */
  postLabel?: string;
}

export interface Question {
  id: string;
  kind: AnswerKind;
  prompt: string;
  /** Optional second line — setup, or the joke. */
  aside?: string;
  choices: Choice[];
  correctId: string;
  /** Shown after answering, either way. Where the wit lives. */
  reveal: string;
}

export interface ResultBand {
  /** Minimum correct, inclusive. Bands are ordered highest first. */
  min: number;
  title: string;
  body: string;
}

export interface Quiz {
  id: string;
  title: string;
  blurb: string;
  /** Fonts this quiz needs resident before its specimen questions
   *  can be shown. Empty for quizzes with no specimen choices. */
  fonts?: SpecimenFont[];
  questions: Question[];
  results: ResultBand[];
}

/**
 * Fails loudly at the boundary rather than rendering a question
 * nobody can get right. Cheap enough to run on every quiz at module
 * load; the alternative is discovering a typo in production.
 */
export function assertValidQuiz(quiz: Quiz): Quiz {
  if (!quiz.questions.length) {
    throw new Error(`Quiz "${quiz.id}" has no questions.`);
  }
  for (const q of quiz.questions) {
    if (q.choices.length < 2) {
      throw new Error(`Question "${q.id}" needs at least two choices.`);
    }
    if (!q.choices.some((c) => c.id === q.correctId)) {
      throw new Error(
        `Question "${q.id}" has correctId "${q.correctId}", which matches no choice.`,
      );
    }
    const ids = new Set(q.choices.map((c) => c.id));
    if (ids.size !== q.choices.length) {
      throw new Error(`Question "${q.id}" has duplicate choice ids.`);
    }
    if (q.kind === 'specimen') {
      for (const c of q.choices) {
        if (!c.specimen) throw new Error(`Choice "${c.id}" is missing specimen settings.`);
        if (!c.describedAs) {
          throw new Error(
            `Choice "${c.id}" is missing describedAs — a specimen with no description ` +
              `cannot be answered without sight.`,
          );
        }
      }
    }
    if (q.kind === 'figure') {
      for (const c of q.choices) {
        if (!c.figure) throw new Error(`Choice "${c.id}" is missing a figure id.`);
      }
    }
  }
  if (!quiz.results.some((b) => b.min === 0)) {
    throw new Error(`Quiz "${quiz.id}" has no band covering a score of zero.`);
  }
  return quiz;
}

/** Highest band whose threshold the score clears. */
export function bandFor(quiz: Quiz, score: number): ResultBand {
  return (
    [...quiz.results].sort((a, b) => b.min - a.min).find((b) => score >= b.min) ??
    quiz.results[quiz.results.length - 1]
  );
}
