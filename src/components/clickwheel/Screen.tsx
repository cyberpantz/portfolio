import { useEffect, useRef } from 'react';
import { drawMenu, LCD_H, LCD_S, LCD_W, type MenuState } from './lcd/menu';

/**
 * The LCD.
 *
 * Owns a canvas and a rAF loop. React re-renders this component only when
 * the *identity* of the state changes — the loop itself reads from a ref
 * every frame, so scrubbing the wheel never re-renders the object.
 *
 * Ghosting (spec §4.2 layer 4) is done by compositing the previous frame
 * over the new one at falling opacity for ~80ms. It is a cheap trick and
 * it is most of what makes the panel read as liquid crystal rather than a
 * screenshot: real LCDs of this era smeared on every transition.
 */

export type ScreenProps = {
  state: MenuState;
};

const GHOST_MS = 80;

export default function Screen({ state }: ScreenProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;

    const W = LCD_W * LCD_S;
    const H = LCD_H * LCD_S;
    el.width = W;
    el.height = H;

    /*
     * THREE buffers, and the reason is a bug worth recording.
     *
     * The first version kept only a ghost canvas and composited it over
     * the visible one, redrawing the base only when the state changed.
     * Once the ghost window expired it stopped compositing — but it also
     * never redrew the clean frame, so the canvas kept the last composite
     * forever and every row that had ever been selected stayed half-lit.
     * The screen accumulated highlights instead of showing one.
     *
     * So: `base` always holds the current CLEAN frame, `prev` the previous
     * clean frame, and the visible canvas is composed from them each frame
     * while a ghost is in flight. Neither offscreen is ever composited
     * into, which is what stops it compounding.
     */
    const img = ctx.createImageData(W, H);
    const mk = () => {
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      return { c, x: c.getContext('2d') };
    };
    const base = mk();
    const prev = mk();

    let raf = 0;
    let lastSig = '';
    let changedAt = -Infinity;
    let dirty = true;

    const draw = (now: number) => {
      const st = stateRef.current;
      // Only re-rasterise when something actually changed. A static menu
      // costs nothing; without this the loop would redraw 176x132 pixels
      // sixty times a second to produce an identical picture.
      /*
       * The signature must cover everything DRAWN, not just the text.
       *
       * It was built from labels alone, so toggling Backlight flipped the
       * state, re-rendered React, and then this loop compared two identical
       * signatures and skipped the repaint — the checkmark never appeared
       * and the row looked dead. Chevron and check are drawn, so they
       * count.
       */
      const sig = [
        st.title,
        st.selected,
        st.scroll,
        st.items.length,
        st.items.map((i) => `${i.label}${i.chevron ? '>' : ''}${i.check ? '*' : ''}`).join(','),
      ].join('|');
      if (sig !== lastSig) {
        if (prev.x && lastSig) {
          prev.x.clearRect(0, 0, W, H);
          prev.x.drawImage(base.c, 0, 0);       // the previous CLEAN frame
        }
        drawMenu(img, st, LCD_S);
        base.x?.putImageData(img, 0, 0);
        changedAt = now;
        lastSig = sig;
        dirty = true;
      }

      const age = now - changedAt;
      const ghosting = age < GHOST_MS && lastSig !== '';

      // Recompose only while something is moving, then once more to settle.
      if (dirty || ghosting) {
        ctx.drawImage(base.c, 0, 0);
        if (ghosting) {
          ctx.save();
          ctx.globalAlpha = 0.45 * (1 - age / GHOST_MS);
          ctx.drawImage(prev.c, 0, 0);
          ctx.restore();
        }

        /* The backlight is NOT painted here any more. It moved to two CSS
           layers over the canvas, because an edge-lit panel needs a halo
           hugging the border and a canvas-wide fill cannot express that —
           it could only ever dim everything evenly, which reads as a
           brightness slider rather than as a lamp behind glass. */

        if (!ghosting) dirty = false;   // settled; idle until the next change
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvas}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label={`${state.title}. ${state.items[state.selected]?.label ?? 'empty'} selected.`}
    />
  );
}
