/** The Archon: a machine-god sigil that swells, spins faster and cracks as size grows. */
import c from './boss.module.css';

export function Xal({ size, level }: { size: number; level: number }) {
  const halos = level ? 3 : 2;
  const scale = 0.55 + level * 0.12 + size * 0.75;
  const spin = Math.max(1.2, 12 - size * 10);
  return (
    <svg viewBox="0 0 200 200" className={c.xal} style={{ transform: `scale(${scale})`, ['--spin' as string]: `${spin}s` }} aria-hidden>
      <defs>
        <radialGradient id="xal-iris" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.25" stopColor="#ff5a4a" />
          <stop offset="0.7" stopColor="#8a0d12" />
          <stop offset="1" stopColor="#1a0204" />
        </radialGradient>
        <filter id="xal-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2 + size * 6} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#xal-glow)">
        {Array.from({ length: halos }, (_, i) => (
          <circle key={i} className={c.halo} data-dir={i % 2 ? 'rev' : 'fwd'}
            cx="100" cy="100" r={92 - i * 14} fill="none" stroke="#ff6a5a" strokeOpacity={0.55 + size * 0.4}
            strokeWidth={i === 0 ? 3 : 2} strokeDasharray={i === 0 ? '30 10 4 10' : i === 1 ? '6 6' : '50 14'} />
        ))}
        <path d="M100 38 L152 100 L100 162 L48 100 Z" fill="#14090a" stroke="#ff6a5a" strokeWidth="2" />
        <circle cx="100" cy="100" r={18 + size * 6} fill="url(#xal-iris)" className={c.iris} />
        <g stroke="#ffd2a0" strokeWidth="1.4" opacity={Math.max(0, size * 1.4 - 0.3)}>
          <path d="M100 82 L92 64 L97 50" /><path d="M116 104 L136 112 L146 126" />
          <path d="M88 112 L70 126 L62 144" /><path d="M110 88 L128 70" />
        </g>
      </g>
    </svg>
  );
}
