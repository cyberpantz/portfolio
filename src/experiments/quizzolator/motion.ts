import type { Transition, Variants } from 'framer-motion';

/**
 * Every timing constant for the Quizzolator.
 *
 * Tuning the feel means editing this file and nothing else. If a
 * duration or easing appears in a component, it belongs here instead.
 *
 * Numbers are a considered starting point, not gospel — feel cannot
 * be specified from a table. Play the whole quiz twice before
 * deciding any of them are right.
 */

/** Entry spring. Damping against stiffness gives roughly one visible
 *  overshoot — the bounce, without the wobble. */
export const ENTER_SPRING: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.9,
};

export const EXIT_EASE: Transition = {
  duration: 0.26,
  ease: [0.4, 0, 1, 1], // easeIn — accelerate away
};

/** 85ms. Below about 60ms a stagger stops reading as a sequence and
 *  just looks like an imprecise simultaneous entrance: you pay the
 *  delay without buying the legibility. */
export const STAGGER_STEP = 0.085;
export const STAGGER_DELAY = 0.15;

/** Distance travelled on enter and exit. Enough to read as motion,
 *  short enough not to feel like a slide deck. */
export const ENTER_X = 72;
export const EXIT_X = -64;

export const slideVariants: Variants = {
  enter: { x: ENTER_X, opacity: 0 },
  center: { x: 0, opacity: 1, transition: ENTER_SPRING },
  exit: { x: EXIT_X, opacity: 0, transition: EXIT_EASE },
};

/** Container drives the stagger; children inherit it. */
export const stackVariants: Variants = {
  enter: {},
  center: {
    transition: { staggerChildren: STAGGER_STEP, delayChildren: STAGGER_DELAY },
  },
  exit: {
    transition: { staggerChildren: 0.03, staggerDirection: -1 },
  },
};

export const itemVariants: Variants = {
  enter: { x: ENTER_X, opacity: 0 },
  center: { x: 0, opacity: 1, transition: ENTER_SPRING },
  exit: { x: EXIT_X * 0.5, opacity: 0, transition: EXIT_EASE },
};

/** Correct: a small swell and settle. Reads as confirmation, not
 *  celebration. */
export const CORRECT_POP: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 18,
};
export const CORRECT_SCALE = [1, 1.04, 1];

/** Wrong: deliberately small. A violent shake reads as a crash
 *  rather than a wrong guess. */
export const WRONG_SHAKE = [0, -7, 6, -4, 3, 0];
export const WRONG_SHAKE_TRANSITION: Transition = { duration: 0.38, ease: 'easeInOut' };

/** The gap before the correct answer is highlighted after a wrong
 *  one, so the two facts land in order — you were wrong, then here
 *  is right — instead of arriving as one confusing frame. */
export const REVEAL_CORRECT_DELAY = 0.2;

/** Checkmark and cross draw themselves rather than appearing. */
export const MARK_DRAW: Transition = { duration: 0.3, ease: 'easeOut' };

/** Reveal text and the Next button, after a choice is locked. */
export const REVEAL_FADE: Transition = { duration: 0.32, delay: 0.24, ease: 'easeOut' };

/** Result screen score count-up. */
export const COUNT_MS = 900;
export const BAND_DELAY_MS = 300;

/** Ceiling on waiting for a specimen font. A permanently stalled
 *  quiz is worse than a degraded question. */
export const FONT_WAIT_MS = 1200;

/** Collapses every transition to an imperceptible fade. Meaning —
 *  state colours, drawn marks, the final score — survives; movement
 *  does not. framer-motion does not honour the media query on its
 *  own, so this is applied explicitly via useReducedMotion. */
export const STILL: Transition = { duration: 0.001 };

export const stillVariants: Variants = {
  enter: { x: 0, opacity: 0 },
  center: { x: 0, opacity: 1, transition: STILL },
  exit: { x: 0, opacity: 0, transition: STILL },
};

export const stillStackVariants: Variants = {
  enter: {},
  center: { transition: { staggerChildren: 0, delayChildren: 0 } },
  exit: { transition: { staggerChildren: 0 } },
};
