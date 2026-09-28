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

  /* The scratch scene plays before any words; the others lead with them. */
  const textStart = data.scene === 'scratch' ? 1700 : 300;
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

/* Toe centres; each claw tip sits on the head of one mark. */
const TOES: [number, number][] = [[94, 8], [133, 26], [173, 26], [211, 8]];

/**
 * One torn mark, from its claw's x down the glass: a slight drift in the
 * direction of the rake, and a small deterministic wobble every few
 * pixels so it reads as torn rather than ruled.
 */
function tear(x0: number, k: number) {
  const pts: string[] = [];
  for (let y = -20, n = 0; y <= 640; y += 16, n++) {
    const wobble = Math.sin(n * 2.3 + k * 1.7) * 2.2 + Math.sin(n * 0.7 + k) * 1.4;
    const drift = (y / 640) * (6 + k * 2);
    pts.push(`${(x0 + wobble + drift).toFixed(1)} ${y}`);
  }
  return `M${pts.join(' L')}`;
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
    /*
     * Four claws raked down the glass. Each mark is a slightly bowed stroke
     * with a ragged edge, drawn on the same clock as the paw that makes it,
     * so the paw appears to be doing the tearing.
     */
    const marks = [94, 133, 173, 211].map(tear);
    return (
      <svg className={sp.scratch} viewBox="0 0 300 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {marks.map((d, i) => (
          <g key={i} style={{ ['--i' as string]: i }}>
            <path className={sp.gouge} pathLength={1} d={d} />
            <path className={sp.gougeLight} pathLength={1} d={d} />
          </g>
        ))}
        {/* Toes below the pad: raking downward, the claws lead. */}
        <g className={sp.paw}>
          <ellipse cx="152" cy="-40" rx="46" ry="38" />
          {TOES.map(([x, y], i) => (
            <g key={i}>
              <path className={sp.claw} d={`M${x - 5} ${y + 16} L${x} ${y + 34} L${x + 5} ${y + 16} Z`} />
              <ellipse cx={x} cy={y} rx={i === 0 || i === 3 ? 16 : 17} ry={i === 0 || i === 3 ? 20 : 22} />
            </g>
          ))}
        </g>
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
