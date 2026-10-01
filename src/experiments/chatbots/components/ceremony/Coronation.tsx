import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Crown, Sparkles } from 'lucide-react';
import c from './ceremony.module.css';

const GOLD = ['#fff3b0', '#f2cf74', '#d9a84e', '#b5832f', '#ffffff'];

export function Coronation({ lines, ms }: { lines: string[]; ms: number }) {
  const [banner, sub] = lines;
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled || !canvas.current) return;
      const fire = confetti.create(canvas.current, { resize: true });
      const burst = (x: number, y: number) =>
        fire({ particleCount: 90, spread: 360, startVelocity: 38, gravity: 0.7, ticks: 220, scalar: 0.9, origin: { x, y }, colors: GOLD, shapes: ['circle', 'square'] });
      [[1200, 0.3, 0.35], [1900, 0.7, 0.3], [2600, 0.5, 0.2]].forEach(([at, x, y]) => timers.push(window.setTimeout(() => burst(x, y), at)));
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  const end = ms / 1000;
  return (
    <motion.div className={c.throne} initial={{ scale: 1 }} animate={{ scale: [1, 1, 1.14], opacity: [1, 1, 0] }} transition={{ duration: end, times: [0, 0.84, 1] }}>
      <canvas ref={canvas} className={c.canvas} aria-hidden />
      <motion.span className={c.crown} initial={{ y: -260, rotate: -12 }} animate={{ y: 0, rotate: [-12, 6, -3, 0] }} transition={{ type: 'spring', stiffness: 70, damping: 11, delay: 0.3 }}>
        <Crown size={88} stroke="url(#sb-gold)" strokeWidth={1.25} aria-hidden />
      </motion.span>
      <motion.p className={c.ribbon} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.0, duration: 0.6, ease: [0.2, 0.9, 0.2, 1] }}>
        <Sparkles size={14} aria-hidden /> {banner} <Sparkles size={14} aria-hidden />
      </motion.p>
      <motion.p className={c.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>{sub}</motion.p>
    </motion.div>
  );
}
