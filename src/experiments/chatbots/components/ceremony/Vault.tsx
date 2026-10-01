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
          <circle key={i} className={c.ring} data-dir={g.dir < 0 ? 'rev' : undefined} style={{ ['--dur' as string]: `${g.dur}s` }}
            cx="100" cy="100" r={g.r} fill="none" stroke="url(#sb-gold)" strokeWidth="2" strokeDasharray={g.dash} />
        ))}
        {[1.6, 2.2, 2.8].map((at, i) => (
          <rect key={i} className={c.bolt} style={{ ['--from' as string]: `${i * 120}deg`, ['--at' as string]: `${at}s` }}
            x="96" y="40" width="8" height="22" rx="2" fill="url(#sb-gold)" />
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
