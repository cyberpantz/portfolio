import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W, PALETTE } from './lcd/menu';
import { MARK_H, MARK_W, markBits } from './lcd/mark';

/**
 * The boot screen: a banana, scaling in with a bounce.
 *
 * Where the original showed a piece of fruit, this shows a different one.
 * It also keeps the screen clear of trade dress — the rule is no wordmark
 * and no logo, and a banana is emphatically neither.
 */

const DURATION = 900;

/*
 * Final size as a fraction of the raster mark. The mark is stored at
 * 212x208 device px, which on a 352x264 panel would fill 60% of the width
 * at 1.0 — too big for a boot logo, which should sit in the middle of the
 * screen with air around it rather than press against the bezel.
 */
const MARK_SCALE = 0.68;

/**
 * Penner's ease-out-bounce. Four parabolic arcs of decreasing height,
 * which is what gives it the settle rather than a single overshoot.
 */
function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

export default function BootMark() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;

    const W = LCD_W * LCD_S;
    const H = LCD_H * LCD_S;
    el.width = W;
    el.height = H;

    const bits = markBits();
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /*
     * The mark is scaled by resampling the 1-bit source per frame, NOT by
     * a CSS transform on the canvas. A transform would resample the whole
     * panel — including the LCD ground and, later, the pixel grid — and
     * at fractional scales it softens the very pixel edges the screen is
     * supposed to have. Sampling nearest-neighbour into the raster keeps
     * every frame genuinely 1-bit.
     */
    const drawAt = (k: number) => {
      const bg = PALETTE.bg;
      const ink = PALETTE.ink;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = bg[0]; d[i + 1] = bg[1]; d[i + 2] = bg[2]; d[i + 3] = 255;
      }
      if (k > 0.01) {
        /*
         * One mark pixel -> one RASTER pixel, not one logical pixel.
         *
         * The mark is stored at device resolution precisely so it can be
         * drawn this way: blitting it at logical size would expand every
         * pixel into a 2x2 block and stair-step every curve at twice the
         * coarseness the panel can show.
         */
        const dw = Math.max(1, Math.round(MARK_W * k));
        const dh = Math.max(1, Math.round(MARK_H * k));
        const ox = Math.round((W - dw) / 2);
        const oy = Math.round((H - dh) / 2);
        for (let y = 0; y < dh; y++) {
          const yy = oy + y;
          if (yy < 0 || yy >= H) continue;
          const sy = Math.min(MARK_H - 1, ((y * MARK_H) / dh) | 0);
          for (let x = 0; x < dw; x++) {
            const xx = ox + x;
            if (xx < 0 || xx >= W) continue;
            const sx = Math.min(MARK_W - 1, ((x * MARK_W) / dw) | 0);
            if (!bits[sy * MARK_W + sx]) continue;
            const i = (yy * W + xx) * 4;
            d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2];
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    if (reduced) {
      drawAt(MARK_SCALE);
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      drawAt(easeOutBounce(t) * MARK_SCALE);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label="Starting up"
    />
  );
}
