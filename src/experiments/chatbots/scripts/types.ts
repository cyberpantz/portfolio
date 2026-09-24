/**
 * Chatbots — the scenario model.
 *
 * Pure data types. No React, no DOM, no styling. A scenario is a script
 * plus a voice plus a set of options to narrow; everything visual is a
 * token block (skins/) and everything behavioural is the director.
 *
 * Spec: docs/chatbots-spec.md §5.
 */

export type NodeId = string;
export type OptionId = string;

/* ---------------------------------------------------------------- voice */

/**
 * Voice is scenario data, not a house style.
 *
 * This is the finding that makes the thing an engine rather than one
 * script with a config file: dry humour about your own earache is charm,
 * the same sentence to a frightened parent is a failure, and to someone
 * whose sofa is in ribbons it is the reason they keep typing.
 */
export type Voice = {
  /** 0 = never jokes, 1 = jokes are the point. care 0.3 · family 0 · feline 0.8 */
  humour: number;
  /** A turn whose only job is to acknowledge before proceeding. */
  acknowledgment: 'never' | 'optional' | 'required';
  /**
   * Who is being asked about. `"you"` was hard-coded until a parent asked
   * on someone else's behalf, and sensation questions assumed a subject
   * who could answer until the subject was a cat.
   */
  address: 'self' | 'proxy-verbal' | 'proxy-nonverbal';
  /** Captured at runtime for proxy scenarios. Interpolated as {subject}. */
  subjectName?: string;
};

/* --------------------------------------------------------------- beats */

export type Chip = {
  label: string;
  go: NodeId;
  /**
   * The uncertainty option. Marked in data rather than by convention so
   * "I'm not sure routes to the safer branch" is enforceable.
   */
  safe?: boolean;
};

export type Action = { label: string; kind: 'tel' | 'route'; value: string };
export type Alternative = { label: string; detail: string; go?: NodeId };
export type CompareRow = { label: string; cells: string[] };
export type ResultItem = { name: string; detail: string; meta?: string };
export type Slot = { label: string; detail: string; go: NodeId };

/**
 * One cell in a time grid.
 *
 * `label` is what a person reads, `at` is what a calendar needs, and
 * they are stored separately because 7:40pm and 19:40 are the same
 * instant written for two different readers.
 */
export type GridTime = {
  label: string;
  /** Local 24h "HH:MM". */
  at: string;
  /** Shown struck through and unclickable. A full day is information. */
  gone?: boolean;
};

export type PickSpec = {
  prompt: string;
  /**
   * Text controls. These are the real controls at every width.
   *
   * `go` per choice, falling back to the beat's own. The ear map does
   * not need it — every part of an ear leads to the same next question —
   * but a body map does: an ear belongs to this script's story and a
   * stomach does not, and without per-choice routing the picker had to
   * send everyone down the ear branch regardless of where they pointed.
   */
  choices: { label: string; value: string; go?: NodeId }[];
  /** Decorative diagram, aria-hidden, hidden below 380px. */
  diagram?: 'ear' | 'sofa' | 'grid';
  /** Column headers when `diagram === 'grid'`. */
  columns?: string[];
};

/**
 * One assistant action. Carries content and timing only — never colour,
 * spacing or class names.
 *
 * Adding a member here without rendering it is a compile error; see the
 * `never` guard in components/Beat.tsx. That is the only reason this is
 * a discriminated union.
 */
export type Beat =
  | { t: 'say'; text: string; hold?: number }
  | { t: 'ack'; text: string }
  | {
      t: 'think';
      stages: string[];
      facts?: string[];
      /** Authored duration. Does NOT scale with the skin — it is content. */
      ms?: number;
      /** Index of the stage that fails, for the authored error path. */
      failAt?: number;
      /** Shown at 3s and again, elaborated, at 8s. Names what is slow. */
      slowNote?: string;
      /** Label for the 15s door out. */
      exitLabel?: string;
      /** Where that door leads. */
      exitGo?: NodeId;
    }
  | { t: 'chips'; options: Chip[] }
  | { t: 'pick'; spec: PickSpec; go: NodeId }
  | {
      /**
       * An ordered spectrum, with every step named.
       *
       * It was two anchors and five anonymous segments, which asks the
       * visitor to infer what the third of five means — and five small
       * filled bars are the universal look of a progress READOUT, so the
       * control did not even announce itself as one. Naming each step
       * fixes both: it is obviously input because it is obviously a set
       * of choices, and obviously a scale because they are joined and in
       * order.
       */
      t: 'scale';
      steps: string[];
      go: NodeId;
    }
  | { t: 'compare'; title: string; axes: string[]; rows: CompareRow[] }
  | { t: 'recommend'; option: OptionId; confidence: number; why: string }
  | { t: 'disclose'; summary: string; rows: [string, string][] }
  | { t: 'results'; items: ResultItem[] }
  | { t: 'empty'; constraint: string; title: string; alternatives: Alternative[] }
  | { t: 'schedule'; slots: Slot[] }
  | {
      /**
       * The full grid — days across, times down.
       *
       * The scheduler beat above offers two or three times inline, which
       * is right for "here is the next thing available". This is for
       * when a visitor wants to see the shape of the week, and a shape
       * is exactly what a row of chips cannot show: which day is busy,
       * where the gaps are, that Sunday morning is gone entirely.
       *
       * Every cell shares one destination. The alternative — a node per
       * time — is how the two-slot scheduler ended up confirming 7:16
       * for someone who picked 7:40, only twelve times worse. The chosen
       * time travels with the visitor instead; see `@picked` on the
       * appointment beat.
       */
      t: 'timegrid';
      title: string;
      days: { label: string; note?: string; times: GridTime[] }[];
      go: NodeId;
    }
  | {
      /**
       * A booked appointment, rendered as a calendar entry with real
       * exports.
       *
       * The date is relative rather than absolute — a demo that hands you
       * an appointment in the past is worse than no appointment at all —
       * so the component resolves `day` + `time` against the moment it
       * renders.
       */
      t: 'appointment';
      title: string;
      day: 'today' | 'tomorrow' | '@picked';
      /**
       * Local 24h "HH:MM", or `@picked` to take whatever time the
       * visitor chose from a grid.
       *
       * The sentinel exists because a grid of twelve times cannot have
       * twelve confirmation nodes, and the one thing worse than no
       * scheduler is a scheduler that books a different time from the
       * one you tapped.
       */
      time: string;
      minutes: number;
      /** Omitted for anything that does not happen somewhere. */
      location?: string;
      prep?: [string, string][];
    }
  | { t: 'reframe'; headline: string; body: string; options: Chip[] }
  | { t: 'boundary'; refusal: string; instead: string }
  | {
      t: 'safety';
      /** Names what the SCREEN does, never how serious this is. */
      tempo: 1 | 2 | 3;
      headline: string;
      body: string;
      action: Action;
      /** Secondary escape, e.g. "she may be in danger now". */
      alt?: Chip;
      /** Plain line beneath, for things people do not know. */
      footnote?: string;
    }
  | {
      t: 'error';
      stage: number;
      stages: string[];
      /**
       * Optional, and usually omitted.
       *
       * The stage list names what failed and the two controls name what
       * to do about it. A sentence in between has to earn its place
       * against both, and the first three attempts here could not:
       * one apologised, one deflected blame, one explained what a
       * directory is to someone who had just been told the directory
       * was unreachable and understood perfectly.
       *
       * Left in the type because another scenario may fail in a way that
       * genuinely needs a word — but the default is silence.
       */
      message?: string;
      retry: NodeId;
      escape: Alternative;
    };

/* --------------------------------------------------------------- nodes */

export type Line = {
  id: string;
  preview: string;
  text: string;
  go: NodeId;
  /**
   * Shown in the tray so the long option announces itself.
   *
   * Optional, because a line made entirely of emoji has no word count
   * worth printing — "3w" next to 🦴🔥😭 is the interface counting
   * something nobody asked it to count.
   */
  words?: number;
};

export type Accept =
  | { on: 'chip'; value: string; go: NodeId }
  | { on: 'line'; id: string; go: NodeId }
  | { on: 'pick'; value: string; go: NodeId }
  | { on: 'text'; test: (s: string) => boolean; go: NodeId };

export type StripEffect = {
  out?: OptionId[];
  rank?: OptionId[];
  lead?: OptionId;
  win?: OptionId;
  /** Tempo-1 safety withdraws the strip entirely. Not dimmed — gone. */
  withdraw?: true;
};

export type Node = {
  id: NodeId;
  say: Beat[];
  effect?: { strip?: StripEffect; voice?: Partial<Voice> };
  lines?: Line[];
  accept?: Accept[];
  /**
   * Continue here once the beats finish, with no input.
   *
   * Some nodes are pure narration — a thinking state resolving, a booking
   * confirming — and have nothing to ask. Before this existed they faked
   * it with a catch-all text accept, which meant they did not advance at
   * all unless the visitor typed something into a screen that was not
   * asking them anything.
   */
  auto?: NodeId;
  /** Unmatched free text. Defaults to the recovery router. */
  fallback?: NodeId;
  /** Terminal by design — suppresses the dead-end assertion. */
  terminal?: boolean;
  /**
   * This node asked a closed question and supplied its own answers, so
   * free typing is closed until one is chosen.
   *
   * The demo has no model in it. Everywhere the conversation is genuinely
   * open — the cold open, the ending, the recovery nodes — free text is
   * the point, and the motive classifier has a designed reply for it.
   * But once the assistant has narrowed to "tonight or tomorrow
   * morning", anything typed gets classified from scratch against the
   * whole lexicon and can leave the rails mid-flow. Better to close the
   * door than to answer badly through it.
   *
   * It is a soft close, not the tempo-1 safety lock: the field stays
   * focusable and readable, the tray still fills it, and the authored
   * off-script line at `narrowed` — the one offering to Venmo for
   * antibiotics — still works, because a canned input is exactly what
   * this node can take.
   */
  constrained?: boolean;
};

/* ----------------------------------------------------------- scenarios */

export type Option = { id: OptionId; label: string; icon: string };

export type SafetyRule = {
  id: string;
  tempo: 1 | 2 | 3;
  test: (s: string) => boolean;
  go: NodeId;
};

export type Lexicon = {
  /** Checked before every other motive. Order is a safety property. */
  symptomPatterns: RegExp[];
  homophones: Record<string, string>;
  /** Domain nouns that mark input as on-topic. */
  keywords: string[];
};

export type ScenarioId = 'care' | 'family' | 'feline' | 'cancel';

export type Scenario = {
  id: ScenarioId;
  title: string;
  /** Discloses on first paint. The product cannot wink; this can. */
  wallLabel: string;
  /**
   * The plain statement that this is not advice. REQUIRED.
   *
   * Not optional, and not a nicety. A convincing triage interface that
   * names real-sounding clinics and books real-looking appointments is
   * exactly the thing someone could screenshot out of context — and the
   * more the craft succeeds, the more plausible the screenshot. The
   * disclosure in `wallLabel` says the conversation is simulated; that
   * is a different claim from "do not act on this", and only one of
   * them is the one that matters if someone is actually unwell.
   *
   * It lives in the apparatus, on first paint, never inside the bezel —
   * the product cannot break character to warn you, so the rig does it
   * before the product gets a chance to be persuasive.
   */
  disclaimer: {
    /**
     * The one line that always shows. Under about sixty characters,
     * because the whole point is that it survives being glanced at.
     */
    short: string;
    /** The rest, behind a disclosure. */
    more: string;
  };
  voice: Voice;
  options: Option[];
  /**
   * What the strip is a list OF, e.g. "Where to go tonight".
   *
   * Scenario copy, so it lives here rather than in the component. It is a
   * section label on a readout, not the assistant narrating its own
   * mechanic — the distinction being that a label is part of the object
   * and a narration is a line of dialogue about the object.
   */
  stripLabel: string;
  narrowing: 'eliminate' | 'rank' | 'score';
  safety: SafetyRule[];
  lexicon: Lexicon;
  start: NodeId;
  nodes: Record<NodeId, Node>;
  /**
   * What the state browser offers, in the order it offers it.
   *
   * It lived in the island as one hard-coded list, which was fine while
   * there was one script and silently wrong the moment there were two:
   * a feline conversation was offered "Dictation" and "Third strike",
   * states it does not contain.
   */
  /**
   * Words this script may only use once the conversation has supplied
   * them, as regex sources.
   *
   * Care declares `ears?`, because "where in the ear is it worst?" is a
   * sensible question only if an ear has come up — three routes reached
   * it from conversations where none had. Feline declares `he|him|his`,
   * because the gender arrives from the visitor's own line and nowhere
   * else; today every tray line happens to supply it, which is luck
   * rather than structure, and the first neutral line added would break
   * three assistant turns silently.
   *
   * Enforced in verify.mjs over every inbound edge of every node.
   */
  topics?: string[];
  index: { id: NodeId; label: string; note: string }[];
};
