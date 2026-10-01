/** Flash, shockwave ring, gold confetti and dark debris. */
import { useEffect, useRef } from 'react';
import c from './boss.module.css';

export function Explosion({ freeze = false }: { freeze?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (freeze) return;
    let cancelled = false;
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled || !canvas.current) return;
      const fire = confetti.create(canvas.current, { resize: true });
      fire({ particleCount: 160, spread: 360, startVelocity: 48, gravity: 0.9, ticks: 240, scalar: 1.1, origin: { x: 0.5, y: 0.42 }, colors: ['#fff3b0', '#f2cf74', '#d9a84e', '#ff6a5a'] });
      fire({ particleCount: 60, spread: 360, startVelocity: 30, gravity: 1.6, ticks: 160, scalar: 1.6, origin: { x: 0.5, y: 0.42 }, colors: ['#2a1214', '#14090a', '#5a1a1a'], shapes: ['square'] });
    });
    return () => { cancelled = true; };
  }, [freeze]);
  return (
    <>
      <canvas ref={canvas} className={c.debris} aria-hidden />
      <span className={c.flash} data-freeze={freeze || undefined} aria-hidden />
      <span className={c.shock} data-freeze={freeze || undefined} aria-hidden />
    </>
  );
}
