import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W } from './lcd/menu';
import { drawNowPlaying, type NowPlayingState } from './lcd/nowPlaying';

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
    const draw = () => {
      const s = st.current;
      const sig = [
        s.track.src, s.index, s.total, s.playing,
        Math.floor(s.elapsed), Math.round(s.duration),
        Math.round(s.buffered * 100), s.battery, s.source,
        // Drawn, therefore in the key. Leaving these out is exactly how
        // the menu's checkmark went missing: the state changed, the
        // picture did not.
        s.error, s.loading,
      ].join('|');
      if (sig !== last) {
        drawNowPlaying(img, s, LCD_S);
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
