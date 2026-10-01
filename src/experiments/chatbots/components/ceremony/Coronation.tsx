import { motion } from 'framer-motion';
import c from './ceremony.module.css';

const EASE = [0.65, 0, 0.25, 1] as const;
// Lucide's crown, drawn as one hairline rather than placed as an icon.
const CROWN = 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z';
const BASE = 'M5 21h14';

export function Coronation({ lines }: { lines: string[]; ms: number }) {
  const [banner, sub] = lines;
  return (
    <div className={c.throne}>
      <svg viewBox="0 0 24 24" className={c.crownArt} aria-hidden>
        <motion.path d={CROWN} className={c.crownLine} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.3, ease: EASE }} />
        <motion.path d={BASE} className={c.crownLine} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.5, ease: EASE }} />
        {/* The light: a short bright segment travelling once along the drawn line. */}
        <motion.path d={CROWN} className={c.crownGlint} initial={{ pathLength: 0.12, pathOffset: 0, opacity: 0 }} animate={{ pathOffset: 1, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6, delay: 2.0, ease: 'easeInOut' }} />
      </svg>
      <motion.span className={c.hairline} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, delay: 2.1, ease: EASE }} />
      <motion.p className={c.banner} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 2.5, ease: EASE }}>
        {banner}
      </motion.p>
      <motion.p className={c.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 3.0, ease: EASE }}>
        {sub}
      </motion.p>
    </div>
  );
}
