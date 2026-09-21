import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W } from './lcd/menu';
import { measure } from './lcd/text';
import { drawNowPlaying, marqueeOffset, type NowPlayingState } from './lcd/nowPlaying';

/**
 * Now Playing.
 *
 * Redraws only when something visible changes — which for a progress bar
 * means once a second, not sixty times. The signature below is deliberately
 * coarse: elapsed is rounded to whole seconds and buffered to a percent,
 * because those are the only resolutions the screen can actually show.
 */
export default function NowPlaying({ state }: { state: NowPlayingState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef(state);
  st.current = state;

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

    let raf = 0;
    let last = '';
    /*
     * measure() is a canvas measureText, so the title's width is cached
     * until the title itself changes rather than remeasured every frame.
     */
    let titleOf = '';
    let titleW = 0;
    const draw = () => {
      const s = st.current;
      if (s.track.title !== titleOf) {
        titleOf = s.track.title;
        titleW = measure(titleOf);
      }
      const now = performance.now();
      // Quantised to whole pixels: the marquee should wake the redraw when
      // the title actually MOVES, not sixty times a second while it eases.
      const slide = Math.round(marqueeOffset(titleW, LCD_W - 16, now));
      const sig = [
        s.track.src, s.index, s.total, s.playing,
        Math.floor(s.elapsed), Math.round(s.duration),
        Math.round(s.buffered * 100), s.battery, s.source,
        // Drawn, therefore in the key. Leaving these out is exactly how
        // the menu's checkmark went missing: the state changed, the
        // picture did not.
        s.error, s.loading,
        // Drawn, therefore in the key — same reason as the two above.
        slide,
      ].join('|');
      if (sig !== last) {
        drawNowPlaying(img, s, LCD_S, now);
        ctx.putImageData(img, 0, 0);
        last = sig;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label={state.error
        ? `${state.track.title}: ${state.error}`
        : `${state.playing ? 'Playing' : 'Paused'}: ${state.track.title}${
        state.track.artist ? ' by ' + state.track.artist : ''
      }, track ${state.index + 1} of ${state.total}`}
      aria-live="polite"
    />
  );
}
