import { useEffect, useRef, useState } from 'react';
import type { Splash as SplashData } from '../scripts/types';
import sp from './splash.module.css';

/**
 * The brand's intro, the first time a visitor opens a scenario.
 *
 * Timing and drawing only. Every word comes from the script (lint rule 3),
 * because the splash is the product talking about itself and the product's
 * voice lives there. Skip is always available — first-visit-only is a
 * courtesy, not a licence to trap anyone — and Escape does the same.
 *
 * The scenes are CSS animations; reduced motion stops them and shows the
 * finished frame, while the words still advance on the clock.
 */
export function Splash({ data, onDone }: { data: SplashData; onDone: () => void }) {
  const [t, setT] = useState(0);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const e = Date.now() - start;
      setT(e);
      if (e >= data.ms) {
        window.clearInterval(id);
        finish();
      }
    }, 100);
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(); };
    window.addEventListener('keydown', key);
    return () => { window.clearInterval(id); window.removeEventListener('keydown', key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const textStart = 300;
  const span = Math.max(1, data.ms * 0.88 - textStart);
  const line = t < textStart ? -1 : Math.min(data.lines.length - 1, Math.floor(((t - textStart) / span) * data.lines.length));
  const status = Math.min(data.status.length - 1, Math.floor((t / data.ms) * data.status.length));

  return (
    <section
      className={sp.splash}
      data-scene={data.scene}
      aria-label={data.wordmark}
      style={{ ['--sp-ms' as string]: `${data.ms}ms`, ['--sp-text' as string]: `${textStart}ms` }}
    >
      <Scene scene={data.scene} />

      <div className={sp.copy}>
        <p className={sp.wordmark}>{data.wordmark}</p>
        <p className={sp.line} aria-live="polite">
          {line >= 0 && <span key={line} className={sp.lineIn}>{data.lines[line]}</span>}
        </p>
      </div>

      <div className={sp.foot}>
        <div className={sp.bar} aria-hidden="true">
          <span className={data.stallAt != null ? sp.fillStall : sp.fill} />
        </div>
        <p className={sp.status}>{data.status[status]}</p>
        <p className={sp.fine}>{data.fine}</p>
      </div>

      <button type="button" className={sp.skip} onClick={finish}>{data.skip}</button>
    </section>
  );
}

/*
 * Claw marks: four slashes, top-right to bottom-left, staggered like a
 * real swipe. Each is [x0, y0, x1, y1, width] in a 200-unit box.
 */
const MARKS: [number, number, number, number, number][] = [
  [100, 16, 24, 112, 10],
  [128, 12, 36, 152, 14],
  [158, 30, 60, 178, 14],
  [180, 80, 104, 180, 11],
];

/* A repeatable pseudo-random number in [0, 1): the same tear every render. */
const rnd = (i: number, k: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233 + salt * 37.719) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * One slash as a filled shape: pointed at both ends, widest in the middle,
 * and torn along both edges. Most of the edge wanders irregularly; now and
 * then a notch is bitten out or a spike tears outward, which is what makes
 * it read as a gouge rather than a drawn line.
 */
function slash([x0, y0, x1, y1, W]: (typeof MARKS)[number], k: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;
  const N = 46, left: [number, number][] = [], right: [number, number][] = [];
  const edge = (i: number, side: number) => {
    const r = rnd(i, k, side);
    if (r > 0.86) return 1.75; // a torn spike
    if (r < 0.1) return 0.3; // a notch bitten out
    return 0.7 + rnd(i, k, side + 5) * 0.6;
  };
  for (let i = 0; i <= N; i++) {
    const t = Math.min(1, Math.max(0, (i + (rnd(i, k, 9) - 0.5) * 0.6) / N));
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * t), 0.7);
    const cx = x0 + dx * t, cy = y0 + dy * t;
    const a = w * edge(i, 1), b = w * edge(i, 2);
    left.push([cx + nx * a, cy + ny * a]);
    right.push([cx - nx * b, cy - ny * b]);
  }
  return `M${[...left, ...right.reverse()].map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
}

function Scene({ scene }: { scene: SplashData['scene'] }) {
  if (scene === 'pulse') {
    return (
      <svg className={sp.pulse} viewBox="0 0 300 80" aria-hidden="true">
        <path pathLength={1} d="M0 44 H96 L110 44 L120 22 L132 64 L144 10 L158 58 L168 44 H300" />
      </svg>
    );
  }
  if (scene === 'scratch') {
    /* Still, on purpose: the damage is already done when you arrive. */
    return (
      <svg className={sp.scratch} viewBox="0 0 200 200" aria-hidden="true">
        {MARKS.map((m, i) => <path key={i} d={slash(m, i)} />)}
      </svg>
    );
  }
  /* The party. Confetti falls on someone who came here to leave. */
  const bits = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div className={sp.party} aria-hidden="true">
      {bits.map((i) => (
        <span
          key={i}
          className={sp.bit}
          style={{
            ['--x' as string]: `${(i * 37) % 100}%`,
            ['--d' as string]: `${(i * 173) % 1400}ms`,
            ['--r' as string]: `${(i * 47) % 360}deg`,
            ['--h' as string]: `${[262, 330, 45, 190, 140][i % 5]}`,
          }}
        />
      ))}
      <span className={sp.popper}>🎉</span>
    </div>
  );
}
