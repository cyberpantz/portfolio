import type { Scenario, ScenarioId } from './types';
import { CARE } from './care.script';
import { FELINE } from './feline.script';
import { CANCEL } from './cancel.script';

/**
 * Every scenario the engine can play.
 *
 * The picker lists what is IN here, rather than listing the skins. Those
 * had drifted apart: three skins existed and one script did, so choosing
 * "Feline" recoloured a conversation that carried on talking about an
 * ear. A control that changes less than its label implies is the exact
 * failure this piece spends its time arguing against.
 *
 * `family` keeps its token block in skins.css, unlisted, waiting for the
 * script that earns it. An unlisted skin is honest; an unbacked menu
 * entry is not.
 */
export const SCENARIOS: Record<string, Scenario> = { care: CARE, feline: FELINE, cancel: CANCEL };
/*
 * Order is an argument, and this one changed.
 *
 * It ran care → feline → cancel, on the reasoning that the funnel only
 * reads as an argument once you have seen two well-behaved bots to
 * measure it against. That reasoning assumed the visitor stays for all
 * three, which is the assumption a portfolio piece has least right to
 * make. The real risk is not being misunderstood, it is not being
 * clicked, and "a subscription that will not let you cancel" is the
 * one of the three that everybody has personally lived through.
 *
 * So the funnel leads, and the other two reframe it in retrospect —
 * which is arguably the better version of the same argument. You meet
 * the components being used against you first, and then watch the
 * identical parts behave well, and the second reading is the one that
 * lands: nothing changed except who was authoring.
 */
/*
 * Tab labels are short, and `title` keeps the full name.
 *
 * These were the full titles, which fitted while there were two of them
 * and wrapped to a second line at three — "Care Navigator · Feline
 * Forensics · Cancel Anytime" is about 440px of glyphs and the rig is
 * capped at 430. A wrapped tab bar reads as broken, and no container
 * change can fix it, because 430px IS the device.
 *
 * Shortening beats shrinking. Dropping the type to fit would have put
 * the navigation below the body copy it sits above, which inverts the
 * hierarchy to save two words.
 *
 * "Cancel Anytime" keeps both of its, because unlike the other two it
 * is not describing a subject — it is quoting the promise the scenario
 * is about, and "Cancel" alone would read as a button that aborts
 * something rather than the name of a place to go.
 */
export const SCENARIO_LIST: { id: ScenarioId; label: string }[] = [
  { id: 'cancel', label: 'Cancel Anytime' },
  { id: 'care', label: 'Medical' },
  { id: 'feline', label: 'Cats' },
];
