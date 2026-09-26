/**
 * Skittish — a particle field that settles into a cat and flinches from you.
 *
 * This file owns the things that are not physics: whether the machine can
 * run it at all, whether the visitor wants motion and sound, and what to
 * show when the answer to any of those is no.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Stir } from './Field';
import { SynthPurr, type Purr } from './purr';
/* Astro types an image import as ImageMetadata, not a string — `.src` is the
   resolved, content-hashed URL. */
import mask from './cat-mask.png';
import s from './skittish.module.css';

/* ~600KB of three.js has no business loading for someone who will be shown
   a still image. */
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
  /*
   * Three separate facts, for the same reason chapter three of The Tilt
   * keeps them apart: conflating capability with preference produces a
   * control that cannot be undone.
   */
  const [able, setAble] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [sound, setSound] = useState(false);

  const stir = useRef<Stir>({ energy: 0 });
  const purr = useRef<Purr | null>(null);

  useEffect(() => {
    setAble(canRunWebGL());
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    setReduced(!!mq?.matches);
  }, []);

  /* The audio follows the field on a timer rather than per frame. The field
     writes energy into a ref sixty times a second; the purr only needs to
     know roughly, and a ramp is already smoothing it. */
  useEffect(() => {
    if (!sound) return;
    const id = window.setInterval(() => purr.current?.setEnergy(stir.current.energy), 80);
    return () => window.clearInterval(id);
  }, [sound]);

  useEffect(() => () => purr.current?.stop(), []);

  const toggleSound = useCallback(async () => {
    if (sound) {
      purr.current?.stop();
      purr.current = null;
      setSound(false);
      return;
    }
    /* Started from the click, because every browser requires a gesture and
       a context created anywhere else arrives suspended and silent. */
    const p = new SynthPurr();
    await p.start();
    purr.current = p;
    setSound(p.running);
  }, [sound]);

  const showField = able === true && !reduced;

  return (
    <div className={s.wrap}>
      <div className={s.stage}>
        {showField ? (
          <Suspense fallback={<Still label="Settling…" />}>
            <Field maskUrl={mask.src} stir={stir} />
          </Suspense>
        ) : (
          <Still
            label={
              able === false
                ? 'This one needs WebGL, which this browser is not offering.'
                : reduced
                  ? 'Held still, because your system asks for reduced motion.'
                  : ''
            }
          />
        )}
      </div>

      <div className={s.bar}>
        <p className={s.hint} aria-hidden="true">
          {showField ? 'Move across it' : ''}
        </p>
        {showField && (
          <button type="button" className={s.sound} onClick={toggleSound} aria-pressed={sound}>
            {sound ? 'Sound on' : 'Sound off'}
          </button>
        )}
      </div>

      {/*
        The field is a canvas, which is opaque to assistive technology
        however it is labelled, and its content is a picture of a cat that
        does not change. So the accessible version is not a description of
        the animation — it is the thing the animation is of.
      */}
      <p className={s.srOnly}>
        A field of small particles settled into the silhouette of a sitting cat, drifting as if
        in a light breeze. Moving a pointer across it pushes the particles aside; they flow back
        into place when the pointer moves on.
      </p>
    </div>
  );
}

/**
 * The still.
 *
 * Deliberately the mask itself rather than a screenshot of the field. A
 * screenshot would show a moment of a thing that is not happening, which is
 * a worse answer than showing what the field is made of.
 */
function Still({ label }: { label: string }) {
  return (
    <div className={s.still}>
      <img src={mask.src} alt="" width={mask.width} height={mask.height} className={s.stillImg} />
      {label && <p className={s.stillNote}>{label}</p>}
    </div>
  );
}
