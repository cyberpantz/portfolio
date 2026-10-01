/**
 * A set-piece the brand plays for itself. Runs once per mount, over the
 * device; tap or Escape skips it. Words come from the beat.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { Beat, CeremonyPiece } from '../../scripts/types';
import { Layer } from '../Layer';
import { GoldDefs } from './Gold';
import { playCues } from './cues';
import { Unveiling } from './Unveiling';
import { Commendation } from './Commendation';
import { Vault } from './Vault';
import { Coronation } from './Coronation';
import c from './ceremony.module.css';

type P = { lines: string[]; ms: number };
const PIECES: Record<CeremonyPiece, (p: P) => ReactElement> = {
  unveiling: Unveiling,
  commendation: Commendation,
  vault: Vault,
  coronation: Coronation,
};

/** `played`: already shown in this conversation, so the transcript remounting must not replay it. */
export function Ceremony({ beat, played = false }: { beat: Extract<Beat, { t: 'ceremony' }>; played?: boolean }) {
  const [open, setOpen] = useState(!played);
  const stops = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!open) return;
    stops.current = playCues(beat.piece, beat.ms);
    const done = window.setTimeout(() => setOpen(false), beat.ms);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(done);
      window.removeEventListener('keydown', key);
      stops.current.forEach((s) => s());
    };
  }, [beat]);

  useEffect(() => {
    if (!open) stops.current.forEach((s) => s());
  }, [open]);

  if (!open) return null;
  const Piece = PIECES[beat.piece];
  return (
    <Layer>
      <div
        className={c.layer}
        data-piece={beat.piece}
        style={{ ['--ms' as string]: `${beat.ms}ms` }}
        onPointerDown={() => setOpen(false)}
      >
        <GoldDefs />
        <Piece lines={beat.lines} ms={beat.ms} />
      </div>
    </Layer>
  );
}
