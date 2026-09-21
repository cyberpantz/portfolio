import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W } from './lcd/menu';
import { clockRows, drawClockList, reconcileClocks } from './lcd/clockList';

/**
 * Extras > Clock.
 *
 * A list of world clocks rather than one clock, which is what the real
 * device showed here: several cities live at once, each with its own
 * time, date and a small analogue face drawn in negative where it is
 * night. Selection is owned by the player so the wheel can drive it —
 * this component only draws.
 *
 * Redraws when something visible changes rather than every frame. For a
 * clock that means once a minute, plus immediately whenever the selected
 * row moves; the signature below covers both, which is why it carries the
 * rendered times rather than a timestamp.
 */
export default function ClockScreen({ selected = 0 }: { selected?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sel = useRef(selected);
  sel.current = selected;

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

    /*
     * Scroll lives across frames, not in React.
     *
     * It is a consequence of the selection rather than a second piece of
     * state — reconcileClocks derives it — and keeping it here means the
     * wheel can move the selection without the player having to know how
     * many rows fit on the screen.
     */
    let scroll = 0;
    let raf = 0;
    let last = '';

    const draw = () => {
      const rows = clockRows(new Date());
      const st = reconcileClocks(sel.current, scroll, rows.length);
      scroll = st.scroll;

      const sig = `${st.selected}|${st.scroll}|${rows.map((r) => r.time + r.night).join(',')}`;
      if (sig !== last) {
        drawClockList(img, { rows, selected: st.selected, scroll: st.scroll }, LCD_S);
        ctx.putImageData(img, 0, 0);
        last = sig;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rows = clockRows(new Date());
  const here = rows[Math.max(0, Math.min(rows.length - 1, selected))];

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label={
        here
          ? `World clocks. ${here.label}, ${here.time}, ${here.weekday} ${here.date}.`
          : 'World clocks'
      }
      aria-live="polite"
    />
  );
}
