import { motion } from 'framer-motion';
import { MARK_DRAW, STILL } from './motion';

/**
 * The check and cross draw themselves via pathLength.
 *
 * These exist so no state depends on colour alone — a monochrome
 * screenshot of this quiz has to stay readable, which is the test.
 */

interface MarkProps {
  still?: boolean;
}

export function CheckMark({ still }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <motion.path
        d="M5 13l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: still ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={still ? STILL : MARK_DRAW}
      />
    </svg>
  );
}

export function CrossMark({ still }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <motion.path
        d="M6 6l12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        initial={{ pathLength: still ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={still ? STILL : MARK_DRAW}
      />
      <motion.path
        d="M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        initial={{ pathLength: still ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={still ? STILL : { ...MARK_DRAW, delay: 0.1 }}
      />
    </svg>
  );
}
