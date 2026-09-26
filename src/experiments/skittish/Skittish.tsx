/**
 * Skittish — a cat made of points, watching a laser dot.
 *
 * This file owns everything that is not the cat: whether the machine can
 * draw it, whether the visitor wants motion or sound, and what to show when
 * the answer to either is no.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { SynthPurr, type Purr } from './purr';
import s from './skittish.module.css';

/* ~600KB of three.js has no business loading for someone who will be shown
   a sentence. */
const Field = lazy(() => import('./Field'));

function canRunWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function Skittish() {
  /* Three separate facts. Conflating capability with preference is how you
     build a control that cannot be undone. */
  const [able, setAble] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [sound, setSound] = useState(false);
  const purr = useRef<Purr | null>(null);

  useEffect(() => {
    setAble(canRunWebGL());
    setReduced(!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => () => purr.current?.stop(), []);

  const toggleSound = useCallback(async () => {
    if (sound) {
      purr.current?.stop();
      purr.current = null;
      setSound(false);
      return;
    }
    /* Created inside the click, because every browser requires a gesture
       and a context made anywhere else arrives suspended and silent. */
    const p = new SynthPurr();
    await p.start();
    p.setEnergy(0.35);
    purr.current = p;
    setSound(p.running);
  }, [sound]);

  const deciding = able === null;
  const showCat = able === true && !reduced;

  return (
    <div className={s.wrap}>
      {/* The cursor is hidden across the whole stage rather than only the
          canvas — a pointer reappearing in the margin breaks the illusion
          faster than its absence ever did. */}
      <div className={showCat ? `${s.stage} ${s.hideCursor}` : s.stage}>
        {deciding ? null : showCat ? (
          <Suspense fallback={<div className={s.blank} aria-hidden="true" />}>
            <Field meshUrl="/cat.bin" />
          </Suspense>
        ) : (
          <Still
            label={
              able === false
                ? 'This one needs WebGL, which this browser is not offering.'
                : 'Held still, because your system asks for reduced motion.'
            }
          />
        )}
      </div>

      <div className={s.bar}>
        <p className={s.hint} aria-hidden="true">{showCat ? 'Move the laser' : ''}</p>
        {showCat && (
          <button type="button" className={s.sound} onClick={toggleSound} aria-pressed={sound}>
            {sound ? 'Purr on' : 'Purr off'}
          </button>
        )}
      </div>

      {/*
        A canvas is opaque to assistive technology however it is labelled,
        and what it holds is a cat rather than information. So this is not a
        description of an animation — it is the thing the animation is of.
      */}
      <p className={s.srOnly}>
        A sitting cat drawn entirely from small points of light. A red laser dot follows your
        pointer; the cat watches it, turning its head to track it, and swipes at it with a front
        paw when it comes close to the floor beside them.
      </p>
    </div>
  );
}

/**
 * The still.
 *
 * Text, and no picture of the cat. An image here kept finding its way onto
 * the screen a moment before the real thing and giving away what was
 * coming; the failure mode is now a sentence appearing, which is
 * recoverable.
 */
function Still({ label }: { label: string }) {
  return (
    <div className={s.still}>
      <p className={s.stillNote}>{label}</p>
    </div>
  );
}
