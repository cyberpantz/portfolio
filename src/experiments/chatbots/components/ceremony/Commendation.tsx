import { motion } from 'framer-motion';
import { Award } from 'lucide-react';
import c from './ceremony.module.css';

function Odometer({ figure }: { figure: string }) {
  return (
    <span className={c.odo} aria-label={figure}>
      {[...figure].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={c.odoCol} aria-hidden>
            <motion.span
              className={c.odoReel}
              initial={{ y: '0em' }}
              animate={{ y: `-${(Number(ch) + 20) * 1.1}em` }}
              transition={{ delay: 1.5 + i * 0.12, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {Array.from({ length: 30 }, (_, n) => <span key={n}>{n % 10}</span>)}
            </motion.span>
          </span>
        ) : (
          <span key={i} aria-hidden>{ch}</span>
        )
      )}
    </span>
  );
}

export function Commendation({ lines }: { lines: string[]; ms: number }) {
  const [title, to, figure, label] = lines;
  return (
    <motion.div className={c.stage} animate={{ x: [0, -6, 5, -3, 0] }} transition={{ delay: 1.1, duration: 0.35 }}>
      <motion.div
        className={c.cert}
        initial={{ scaleY: 0.04, rotateX: 70, opacity: 0 }}
        animate={{ scaleY: 1, rotateX: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 14 }}
      >
        <p className={c.eyebrow}>{to}</p>
        <p className={c.gilt}>{title}</p>
        <p className={c.figure}><Odometer figure={figure} /></p>
        <p className={c.sub}>{label}</p>
        <motion.span className={c.seal} initial={{ scale: 3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -8 }} transition={{ delay: 0.95, duration: 0.18, ease: 'easeIn' }}>
          <Award size={34} stroke="url(#sb-gold)" strokeWidth={1.5} aria-hidden />
        </motion.span>
        <span className={c.sheen} aria-hidden />
      </motion.div>
    </motion.div>
  );
}
