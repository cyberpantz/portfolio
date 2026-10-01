import type { CeremonyPiece } from '../../scripts/types';
import { sfx, type FileCue } from '../../sound/sfx';

/** When each vault step lands, as a fraction of the ceremony. The third is the one that seizes. */
export const VAULT_STEPS = [0.16, 0.42, 0.68];

/** `frac` places a cue at a fraction of the ceremony's length rather than at fixed seconds. */
type Cue = { cue: FileCue; at?: number; frac?: number; gain?: number; for?: number };

export const CEREMONY_CUES: Record<CeremonyPiece, Cue[]> = {
  unveiling: [{ cue: 'curtain', at: 0.5 }, { cue: 'fanfare-short', at: 0.9 }],
  commendation: [{ cue: 'unfurl', at: 0 }, { cue: 'seal', at: 1.1 }, { cue: 'odometer', at: 1.5, for: 1.4, gain: 0.6 }],
  vault: [
    { cue: 'lock', frac: VAULT_STEPS[0], gain: 0.55 },
    { cue: 'lock', frac: VAULT_STEPS[1], gain: 0.55 },
    { cue: 'lock', frac: VAULT_STEPS[2], gain: 0.3 },
  ],
  coronation: [
    { cue: 'fanfare-long', at: 0 }, { cue: 'firework-1', at: 1.2 }, { cue: 'cheer', at: 1.4, gain: 0.5 },
    { cue: 'firework-2', at: 1.9 }, { cue: 'firework-1', at: 2.6, gain: 0.7 },
  ],
};

export function playCues(piece: CeremonyPiece, ms: number): (() => void)[] {
  return CEREMONY_CUES[piece].flatMap((c) => sfx().play(c.cue, { ...c, at: c.frac != null ? (c.frac * ms) / 1000 : c.at }) ?? []);
}
