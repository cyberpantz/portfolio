import type { Lexicon } from './types';

/**
 * Shared detection patterns. Scenario lexicons extend this.
 *
 * `symptomPatterns` is the one that matters: it is evaluated before every
 * other motive, because garbled typing in a medical context may itself be
 * clinical. See input/classify.ts.
 */
export const BASE: Lexicon = {
  symptomPatterns: [],
  homophones: {
    year: 'ear',
    soar: 'sore',
    tow: 'toe',
    knows: 'nose',
    heel: 'heal',
    thoat: 'throat',
  },
  keywords: [],
};
