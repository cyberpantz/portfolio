import { useEffect, useRef } from 'react';

/**
 * Pointer-driven tilt, and the glass parallax that goes with it.
 *
 * The device turns to face the pointer: flat when the pointer is directly
 * over its centre, leaning away as it moves off.
 *
 * This is a deliberate extension of the spec, not an implementation of
 * it. §4.2.6 and §8 both ask only for the glass highlight and backlight
 * hotspot to shift by at most 3px against pointer movement — parallax
 * WITHIN the screen, with the body static. Rotating the whole object is
 * the larger version of the same instinct, and it earns the extrusion
 * that the side wall already pays for.
 *
 * Both ship. The hook writes four properties: --rx/--ry for the body,
 * and --px/--py for the highlight, which stays inside the spec's 3px so
 * the screen still reads as glass over a panel rather than as a sticker
 * sliding around.
 *
 * Per spec §11 this writes CSS custom properties through a ref rather
 * than React state. A pointermove fires dozens of times a second and
 * re-rendering the player — twenty extruded slices and four canvases —
 * on each one would be a lot of work to move a shadow.
 */

export type TiltOptions = {
  /**
   * Degrees at full deflection.
   *
   * 16, not the 9 this shipped with. The old cap was set by a note
   * claiming the LCD keystones and moires past about 14 — measured, it
   * does not: at 14 the panel is clean and at 26 it is only slightly
   * soft on the receding edge, degrading gradually rather than falling
   * off a cliff. 16 is comfortably inside that.
   *
   * On a near-black stage the payoff is the SIDE WALL. The extrusion is
   * a quarter of the body width, so every extra degree of turn reveals
   * more of it — at 9 about 10px showed, at 16 nearly 18. Cast shadows
   * would do nothing here; they are dark on a dark ground.
   */
  max?: number;
  /**
   * How fast the rotation chases the pointer, 0-1 per frame.
   *
   * 0.16 rather than 0.09. At 0.09 the pod was still visibly catching up
   * half a second after the pointer stopped — measured while chasing an
   * unrelated bug — which reads as lag rather than as weight.
   */
  ease?: number;
  /** Glass highlight shift at full deflection, px. Spec §8 caps this at 3. */
  parallax?: number;
  /**
   * How far the body's specular sweeps at full deflection, px.
   *
   * Much larger than the glass parallax on purpose. A reflection is not
   * painted on the surface — it is an image of the room, so when the
   * object turns, the highlight travels across the face several times
   * faster than any feature ON the face does. Holding it still is what
   * makes a tilted object read as a tilted photograph.
   */
  specular?: number;
};

export function useTilt<T extends HTMLElement>({
  max = 16,
  ease = 0.16,
  parallax = 3,
  specular = 64,
}: TiltOptions = {}) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = { rx: 0, ry: 0 };
    const cur = { rx: 0, ry: 0 };
    let raf = 0;
    let idle = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      /*
       * Normalised against the device's own size, not the viewport: the
       * tilt should saturate close to the object, so it reads as
       * responding to the pointer near it rather than to the cursor's
       * absolute position on a large monitor.
       *
       * 1.5 body-widths, down from 2.2. At 2.2 an ordinary pass of the
       * mouse near the device only ever reached a fraction of the cap,
       * so raising the cap by itself would have changed almost nothing
       * about how this actually feels.
       */
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 1.5)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 1.15)));
      // Pointer right -> the right edge goes AWAY, which is +rotateY.
      // Pointer below -> the bottom goes away, which is -rotateX.
      target.ry = nx * max;
      target.rx = -ny * max * 0.55;   // less on the vertical; it reads stronger
      idle = 0;
      start();
    };

    // Pointer gone: return to flat rather than freezing mid-lean.
    const onLeave = () => {
      target.rx = 0;
      target.ry = 0;
      start();
    };

    const frame = () => {
      cur.rx += (target.rx - cur.rx) * ease;
      cur.ry += (target.ry - cur.ry) * ease;
      el.style.setProperty('--rx', `${cur.rx.toFixed(3)}deg`);
      el.style.setProperty('--ry', `${cur.ry.toFixed(3)}deg`);
      // Highlight drifts AGAINST the pointer — spec §4.2.6 — which is what
      // makes the glass sit above the panel rather than on it.
      el.style.setProperty('--px', `${((-cur.ry / max) * parallax).toFixed(2)}px`);
      el.style.setProperty('--py', `${((cur.rx / max) * parallax).toFixed(2)}px`);
      // The body's specular, sweeping far and fast. Same direction as the
      // glass parallax, an order of magnitude further.
      el.style.setProperty('--sx', `${((-cur.ry / max) * specular).toFixed(2)}px`);
      el.style.setProperty('--sy', `${((cur.rx / max) * specular * 0.6).toFixed(2)}px`);
      // Brightness of the window as it swings toward or away from the eye.
      const face = 1 - Math.min(1, (Math.abs(cur.ry) / max) * 0.55);
      el.style.setProperty('--spec', face.toFixed(3));

      // Stop the loop once it has settled AND stopped being driven, so an
      // idle page is not running rAF forever for a motionless object.
      const done =
        Math.abs(target.rx - cur.rx) < 0.01 && Math.abs(target.ry - cur.ry) < 0.01;
      if (done && ++idle > 30) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, [max, ease]);

  return ref;
}
