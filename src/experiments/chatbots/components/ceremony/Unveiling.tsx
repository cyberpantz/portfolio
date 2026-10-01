import { motion } from 'framer-motion';
import c from './ceremony.module.css';

const EASE = [0.7, 0, 0.2, 1] as const;

export function Unveiling({ lines }: { lines: string[]; ms: number }) {
  const [eyebrow, headline, sub] = lines;
  return (
    <>
      <motion.div className={c.spot} initial={{ x: '-60%', opacity: 0 }} animate={{ x: ['-60%', '30%', '0%'], opacity: [0, 1, 0.85] }} transition={{ duration: 1.6, delay: 0.6, ease: EASE }} />
      <div className={c.titles}>
        <motion.p className={c.eyebrow} initial={{ opacity: 0, letterSpacing: '0.6em' }} animate={{ opacity: 1, letterSpacing: '0.32em' }} transition={{ delay: 1.0, duration: 0.8 }}>{eyebrow}</motion.p>
        <motion.p className={c.gilt} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2, duration: 0.7, ease: EASE }}>{headline}</motion.p>
        <motion.p className={c.sub} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>{sub}</motion.p>
      </div>
      <motion.div className={`${c.curtain} ${c.left}`} initial={{ x: 0 }} animate={{ x: '-102%' }} transition={{ delay: 0.5, duration: 1.3, ease: EASE }} />
      <motion.div className={`${c.curtain} ${c.right}`} initial={{ x: 0 }} animate={{ x: '102%' }} transition={{ delay: 0.5, duration: 1.3, ease: EASE }} />
      <div className={c.valance} />
    </>
  );
}
