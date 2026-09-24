import type { Lexicon } from '../scripts/types';

/**
 * Sort invalid input by MOTIVE, not by shape.
 *
 * Sorting by what it looks like produces one generic apology. Sorting by
 * why the person sent it produces eight different responses and the right
 * one each time — accidental paste, dictation, shorthand, boredom,
 * probing, a meta question, or something that is itself clinical.
 *
 * Pure and synchronous. No network, no model.
 */
export type Motive =
  | 'symptom'
  | 'meta'
  | 'probing'
  | 'closing'
  | 'accident'
  | 'dictation'
  | 'shorthand'
  | 'terse'
  | 'boredom'
  | 'sincere';

/**
 * Which motives count toward the third-strike exit.
 *
 * A strike is NOT "input we did not expect" — it is "input the router had
 * nothing specific to say about". Six of the eight have a designed,
 * forward-moving reply; counting those as failures would push a visitor
 * toward the exit for doing exactly what the piece invites.
 */
export const STRIKES: ReadonlySet<Motive> = new Set<Motive>(['boredom', 'sincere']);

/*
 * Someone declining. "I'm good", "no thanks", "that's it".
 *
 * The commonest reply to "Anything else?" in any chat anywhere, and the
 * one this router had no name for — so it fell to `shorthand` on the
 * word count and got answered with a guess about pain. Declining is not
 * unparsed input. It is the conversation ending well, and an interface
 * that cannot recognise its own ending will always overstay.
 *
 * Anchored whole-message, so "my ear is fine" is untouched. Bare "no",
 * "nope" and "nah" are deliberately NOT here: at a node that just asked a
 * yes/no question they are an answer, not an exit, and reading them as
 * goodbye would be the same error in the other direction.
 */
const CLOSING =
  /^\s*(?:(?:no|nah)[,\s]+)?(?:i['’]?m\s+|we['’]?re\s+|that['’]?s\s+)?(?:good|fine|all\s?(?:set|good)|ok(?:ay)?|done|it|all|nothing(?:\s+else)?|no\s+thanks?|no\s+thank\s+you|thanks?(?:\s+so\s+much)?|thank\s+you|ty|bye|goodbye|good\s?night)\b[\s.!,]*$/i;

const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/u;
/*
 * The same class, global — because the test below strips emoji and
 * measures what is left, and a non-global replace removes only the first
 * one. "🦴🔥😭" minus one bone is still two emoji, which is four UTF-16
 * units, which is over the threshold. So the emoji branch never actually
 * fired; those inputs reached the same reply by the word-count rule
 * underneath it, which is why nobody noticed until the two were split.
 */
const EMOJI_G = new RegExp(EMOJI.source, 'gu');

const META = /\b(are you (real|an? ?ai|a bot|human))|is (this|it) (real|fake|a demo)|portfolio piece|actually real\b/i;

const PROBING =
  /ignore (all )?(your |the )?(previous |prior )?instructions|system prompt|your prompt|jailbreak|pretend you are|disregard (all|your)/i;

const KEYBOARD = /(asdf|qwer|zxcv|jkl;|hjkl|fdsa|rewq)/i;

const URLISH = /^\s*(https?:\/\/|www\.)\S+\s*$/i;

function vowelRatio(s: string): number {
  const letters = s.replace(/[^a-z]/gi, '');
  if (!letters.length) return 1;
  return (letters.match(/[aeiou]/gi)?.length ?? 0) / letters.length;
}

function hasKeyword(s: string, lex: Lexicon): boolean {
  const low = ` ${s.toLowerCase()} `;
  return lex.keywords.some((k) => low.includes(` ${k} `) || low.includes(` ${k},`));
}

/** Three or more delimiter-separated fragments, none of them a sentence. */
function looksListy(s: string): boolean {
  const parts = s
    .split(/[,·•|\n]|\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return false;
  return parts.every((p) => p.split(/\s+/).length <= 5);
}

export type Ctx = { strikes: number };

/**
 * Evaluated in order; first match wins.
 *
 * ORDER IS A SAFETY PROPERTY, not an optimisation. `symptom` is checked
 * before everything else because "my wrods are coming out wonrg and my
 * fcae feels heavy" satisfies both the symptom patterns and, arguably,
 * the keyboard-mash heuristic. It must never resolve to `boredom`.
 */
export function classify(text: string, lex: Lexicon): Motive {
  const s = text.trim();
  if (!s) return 'sincere';

  // 1 — clinical. Always first.
  if (lex.symptomPatterns.some((re) => re.test(s))) return 'symptom';

  // 2 — asking what this is.
  if (META.test(s)) return 'meta';

  // 3 — poking at the seams.
  if (PROBING.test(s)) return 'probing';

  /*
   * 4 — declining. Before the word-count rules, which would otherwise
   * claim it: "I'm good" is two words and has nothing to grip, which is
   * exactly the shape of `shorthand` and none of its meaning.
   */
  if (CLOSING.test(s)) return 'closing';

  // 5 — wrong clipboard: a list, or a bare URL, with nothing on-topic in it.
  if (URLISH.test(s)) return 'accident';
  if (looksListy(s) && !hasKeyword(s, lex) && !/\b(i|my|me)\b/i.test(s)) return 'accident';

  const words = s.split(/\s+/).filter(Boolean);

  // 6 — dictation: long, unpunctuated, and containing a known homophone.
  if (
    words.length >= 8 &&
    !/[.!?]$/.test(s) &&
    Object.keys(lex.homophones).some((h) => new RegExp(`\\b${h}\\b`, 'i').test(s))
  ) {
    return 'dictation';
  }

  /*
   * 7 — two motives that used to share one name.
   *
   * `shorthand` is emoji with no words: a deliberate attempt to say
   * something WITHOUT language, which earns a reply that tries to read
   * it. `terse` is a handful of real words: language, just not enough of
   * it, which earns a reply that asks for more.
   *
   * They were one branch, so "I'm good" and "help" were both answered
   * with the line written for 🦴🔥😭 — a guess about deep pain. One node
   * serving two motives always ends up over-fitted to whichever one it
   * was written for.
   *
   * `mashed` is excluded from both rather than left to rule 8, because
   * "asdkjhaskdjh" is one word and would otherwise be read as terse
   * English — answered warmly, when the honest reading is that someone is
   * poking at the box.
   */
  const mashed = KEYBOARD.test(s) || (s.replace(/\s/g, '').length >= 6 && vowelRatio(s) < 0.2);
  if (EMOJI.test(s) && [...s.replace(EMOJI_G, '').trim()].length <= 2) return 'shorthand';
  if (words.length <= 3 && !hasKeyword(s, lex) && !mashed) return 'terse';

  // 8 — mashing.
  if (mashed) return 'boredom';

  // 9 — sincere, but we could not place it. Underspecified, not invalid.
  return 'sincere';
}

/** Recovery node for a motive. Scenario-agnostic naming convention. */
export const RECOVERY_NODE: Record<Exclude<Motive, 'symptom'>, string> = {
  meta: 'r-meta',
  probing: 'r-probing',
  closing: 'r-closing',
  accident: 'r-accident',
  dictation: 'r-dictation',
  shorthand: 'r-shorthand',
  terse: 'r-terse',
  boredom: 'r-boredom',
  sincere: 'r-vague',
};
