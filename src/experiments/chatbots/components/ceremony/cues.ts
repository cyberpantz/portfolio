import type { CeremonyPiece } from '../../scripts/types';
import { sfx, type FileCue } from '../../sound/sfx';

type Cue = { cue: FileCue; at: number; gain?: number; for?: number };

export const CEREMONY_CUES: Record<CeremonyPiece, Cue[]> = {
  unveiling: [{ cue: 'curtain', at: 0.5 }, { cue: 'fanfare-short', at: 0.9 }],
  commendation: [{ cue: 'unfurl', at: 0 }, { cue: 'seal', at: 1.1 }, { cue: 'odometer', at: 1.5, for: 1.4, gain: 0.6 }],
  vault: [
    { cue: 'vault-servo', at: 0 }, { cue: 'laser', at: 0.4, for: 2.6, gain: 0.5 },
    { cue: 'lock', at: 1.6 }, { cue: 'lock', at: 2.2 }, { cue: 'lock', at: 2.8 },
  ],
  coronation: [
    { cue: 'fanfare-long', at: 0 }, { cue: 'firework-1', at: 1.2 }, { cue: 'cheer', at: 1.4, gain: 0.5 },
    { cue: 'firework-2', at: 1.9 }, { cue: 'firework-1', at: 2.6, gain: 0.7 },
  ],
};

export function playCues(piece: CeremonyPiece): (() => void)[] {
  return CEREMONY_CUES[piece].flatMap((c) => sfx().play(c.cue, c) ?? []);
}
