/** Sound on/off, outside the bezel. The product would never offer you mute. */
import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { sfx } from '../sound/sfx';
import a from './apparatus.module.css';

export function SoundToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(sfx().enabled()), []);
  const flip = () => {
    const next = !on;
    sfx().setEnabled(next);
    setOn(next);
    if (next) void sfx().unlock();
  };
  return (
    /* Icon only: a fourth labelled button wraps the mode bar at the rig's 430px. */
    <button type="button" className={`${a.tab} ${a.iconTab}`} aria-pressed={on} aria-label="Sound" title="Sound" onClick={flip}>
      {on ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}
    </button>
  );
}
