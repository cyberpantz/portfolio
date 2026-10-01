import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import c from './ceremony.module.css';

const RINGS = [
  { r: 92, dash: '2 6', dur: 9, dir: 1 },
  { r: 74, dash: '18 8', dur: 6, dir: -1 },
  { r: 56, dash: '4 3', dur: 4, dir: 1 },
];

export function Vault({ lines }: { lines: string[]; ms: number }) {
  const [status, badge] = lines;
  return (
    <div className={c.vault}>
      <div className={c.laser} aria-hidden />
      <svg viewBox="0 0 200 200" className={c.rings} aria-hidden>
        {RINGS.map((g, i) => (
          <motion.circle key={i} cx="100" cy="100" r={g.r} fill="none" stroke="url(#sb-gold)" strokeWidth="2" strokeDasharray={g.dash}
            style={{ originX: '100px', originY: '100px' }}
            animate={{ rotate: 360 * g.dir }} transition={{ repeat: Infinity, duration: g.dur, ease: 'linear' }} />
        ))}
        {[1.6, 2.2, 2.8].map((at, i) => (
          <motion.rect key={i} x="96" y="40" width="8" height="22" rx="2" fill="url(#sb-gold)"
            style={{ originX: '100px', originY: '100px', rotate: i * 120 }}
            animate={{ rotate: i * 120 + 90 }} transition={{ delay: at, duration: 0.25, ease: [0.6, 0, 0.3, 1.4] }} />
        ))}
      </svg>
      <motion.span className={c.shield} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 3.0, type: 'spring', stiffness: 260, damping: 12 }}>
        <ShieldCheck size={40} stroke="url(#sb-gold)" strokeWidth={1.5} aria-hidden />
      </motion.span>
      <p className={c.status}>{status}</p>
      <motion.p className={c.gilt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.1 }}>{badge}</motion.p>
    </div>
  );
}
