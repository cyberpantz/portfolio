import type { CeremonyPiece } from '../../scripts/types';
import { sfx, type FileCue } from '../../sound/sfx';

/** The vault's timeline, in seconds: when each step lands (the third seizes), then a pause, then the verdict. */
export const VAULT = { steps: [1.2, 3.15, 5.1], verdict: 6.2 };

type Cue = { cue: FileCue; at: number; gain?: number; for?: number };

export const CEREMONY_CUES: Record<CeremonyPiece, Cue[]> = {
  unveiling: [{ cue: 'curtain', at: 0.5 }, { cue: 'fanfare-short', at: 0.9 }],
  commendation: [{ cue: 'unfurl', at: 0 }, { cue: 'seal', at: 1.1 }, { cue: 'odometer', at: 1.5, for: 1.4, gain: 0.6 }],
  vault: [
    { cue: 'lock', at: VAULT.steps[0], gain: 0.55 },
    { cue: 'lock', at: VAULT.steps[1], gain: 0.55 },
    { cue: 'lock', at: VAULT.steps[2], gain: 0.3 },
  ],
  coronation: [{ cue: 'swell', at: 0.2, gain: 0.7 }],
};

export function playCues(piece: CeremonyPiece): (() => void)[] {
  return CEREMONY_CUES[piece].flatMap((c) => sfx().play(c.cue, c) ?? []);
}
