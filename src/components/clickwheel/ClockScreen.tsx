import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W, PALETTE } from './lcd/menu';
import { drawText, measure } from './lcd/text';

/**
 * Extras > Clock.
 *
 * The device's real clock, minus the analogue face: big time, date under
 * it, a hairline between. Redraws once a second rather than every frame —
 * a clock has nothing to say sixty times a second, and the rasteriser
 * caches each distinct string anyway.
 */

const BIG = 'bold 30px Helvetica, Arial, sans-serif';
const SMALL = 'bold 12px Helvetica, Arial, sans-serif';

function fmt(d: Date) {
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return {
    time: `${h}:${m}`,
    ampm: h24 < 12 ? 'AM' : 'PM',
    date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

export default function ClockScreen() {
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
    const img = ctx.createImageData(W, H);

    const paint = () => {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = PALETTE.bg[0]; d[i + 1] = PALETTE.bg[1]; d[i + 2] = PALETTE.bg[2]; d[i + 3] = 255;
      }
      const { time, ampm, date } = fmt(new Date());

      // Time and meridiem are measured together so the pair is centred as
      // one block; centring the time alone leaves it visibly off-axis.
      const tw = measure(time, BIG);
      const aw = measure(ampm, SMALL);
      const total = tw + 4 + aw;
      const x = Math.round((LCD_W - total) / 2);
      drawText(img, time, x, 40, PALETTE.ink, LCD_S, BIG);
      drawText(img, ampm, x + tw + 4, 55, PALETTE.ink, LCD_S, SMALL);

      // hairline
      for (let px = 34; px < LCD_W - 34; px++) {
        for (let s = 0; s < LCD_S; s++) {
          const i = ((80 * LCD_S + s) * W + px * LCD_S) * 4;
          d[i] = PALETTE.rule[0]; d[i + 1] = PALETTE.rule[1]; d[i + 2] = PALETTE.rule[2];
          const i2 = i + 4;
          d[i2] = PALETTE.rule[0]; d[i2 + 1] = PALETTE.rule[1]; d[i2 + 2] = PALETTE.rule[2];
        }
      }

      const dw = measure(date, SMALL);
      drawText(img, date, Math.round((LCD_W - dw) / 2), 90, PALETTE.ink, LCD_S, SMALL);
      ctx.putImageData(img, 0, 0);
    };

    paint();
    // Tick on the second boundary, not every 1000ms from mount, so the
    // display changes when the minute actually does.
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        paint();
        schedule();
      }, 1000 - (Date.now() % 1000));
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label="Clock"
    />
  );
}
