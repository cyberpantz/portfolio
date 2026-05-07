import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChooser } from './chooser/useChooser';
import { ASSESSMENTS } from './chooser/assessments';

interface ChooserPair {
  id: string;
  left:  { image: string; label: string; audio: string };
  right: { image: string; label: string; audio: string };
}

const PAIRS: ChooserPair[] = [
  {
    id: 'dance-vs-meditate',
    left:  { image: '/chooser/images/noun-dancer-12712.svg',    label: 'party',     audio: '/chooser/tracks/house.mp3'       },
    right: { image: '/chooser/images/noun-zen-8072896.svg',     label: 'meditate',  audio: '/chooser/tracks/meditation.mp3'  },
  },
  {
    id: 'camping-vs-treadmill',
    left:  { image: '/chooser/images/noun-camping-8379687.svg',  label: 'camping',   audio: '/chooser/tracks/734403__alexdarek__birds-singing-in-the-forest.wav' },
    right: { image: '/chooser/images/noun-treadmill-177889.svg', label: 'treadmill', audio: '/chooser/tracks/house.mp3'       },
  },
  {
    id: 'drugs-vs-beer',
    left:  { image: '/chooser/images/noun-drugs-8348685.svg', label: 'drugs', audio: '/chooser/tracks/house.mp3'                  },
    right: { image: '/chooser/images/noun-beer-23573.svg',    label: 'beer',  audio: '/chooser/tracks/boys-are-back-in-town.mp3'  },
  },
  {
    id: 'disco-vs-joystick',
    left:  { image: '/chooser/images/penis.svg', label: 'PARTY', audio: '/chooser/tracks/house.mp3'             },
    right: { image: '/chooser/images/joystick.svg',                label: 'PLAY', audio: '/chooser/tracks/01. Ground Theme.mp3'  },
  },
  {
    id: 'flipflops-vs-suits',
    left:  { image: '/chooser/images/noun-flip-flops-8316450.svg', label: 'flipflops', audio: '/chooser/tracks/407446__sassaby__band-in-brazilian-restaurant-in-vinales.wav'                  },
    right: { image: '/chooser/images/noun-tie-8161615.svg',    label: 'suits',   audio: '/chooser/tracks/house.mp3'  },
  }
  // add more pairs here
];

const SLIDE = { duration: 0.45, ease: [0.32, 0, 0.67, 0] as const };

// ---------- Stage ----------

interface ChosenItem { image: string; label: string; side: 'L' | 'R'; }

interface StageProps {
  pair: ChooserPair;
  direction: number;
  onAudioStarted: () => void;
  onChosen: (item: ChosenItem) => void;
  autoStart?: boolean;
}

function Stage({ pair, direction, onAudioStarted, onChosen, autoStart }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const choosingRef = useRef(false);

  const { startAudio } = useChooser(
    leftRef  as unknown as React.RefObject<HTMLElement>,
    rightRef as unknown as React.RefObject<HTMLElement>,
    {
      leftAudioUrl:  pair.left.audio,
      rightAudioUrl: pair.right.audio,
      stageRef: stageRef as unknown as React.RefObject<HTMLElement>,
      radius:   340,
      minScale: 0.72,
      midScale: 1.1,
      maxScale: 1.9,
      curve:    'ease',
    }
  );

  useEffect(() => {
    if (!autoStart) return;
    setStarted(true);
    void startAudio().then(onAudioStarted);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStageClick = useCallback(async () => {
    if (started) return;
    setStarted(true);
    await startAudio();
    onAudioStarted();
  }, [started, startAudio, onAudioStarted]);

  const handleChoose = useCallback(async (item: ChosenItem) => {
    if (choosingRef.current) return;
    choosingRef.current = true;

    if (!started) {
      setStarted(true);
      await startAudio();
      onAudioStarted();
    }

    onChosen(item);
  }, [started, startAudio, onAudioStarted, onChosen]);

  return (
    <motion.div
      key={pair.id}
      ref={stageRef}
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ x: direction * 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: direction * -80, opacity: 0 }}
      transition={SLIDE}
      onClick={handleStageClick}
    >
      <div className="flex items-center justify-center gap-16 sm:gap-40">
        {/* Left */}
        <div
          className="flex flex-col items-center gap-5 cursor-pointer"
          onClick={e => { e.stopPropagation(); handleChoose({ ...pair.left, side: 'L' }); }}
        >
          <div
            ref={leftRef}
            className="w-36 h-36 sm:w-52 sm:h-52 rounded-full overflow-hidden"
            style={{ transformOrigin: 'center center', willChange: 'transform' }}
          >
            <img
              src={pair.left.image}
              alt={pair.left.label}
              className="w-full h-full object-contain p-4 pointer-events-none"
              draggable={false}
            />
          </div>
          <span className="font-mono text-[10px] text-fg-muted tracking-[0.2em] uppercase">
            {pair.left.label}
          </span>
        </div>

        {/* Right */}
        <div
          className="flex flex-col items-center gap-5 cursor-pointer"
          onClick={e => { e.stopPropagation(); handleChoose({ ...pair.right, side: 'R' }); }}
        >
          <div
            ref={rightRef}
            className="w-36 h-36 sm:w-52 sm:h-52 rounded-full overflow-hidden"
            style={{ transformOrigin: 'center center', willChange: 'transform' }}
          >
            <img
              src={pair.right.image}
              alt={pair.right.label}
              className="w-full h-full object-contain p-4 pointer-events-none"
              draggable={false}
            />
          </div>
          <span className="font-mono text-[10px] text-fg-muted tracking-[0.2em] uppercase">
            {pair.right.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Chooser ----------

export default function Chooser() {
  const [pairIndex, setPairIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [audioStarted, setAudioStarted] = useState(false);
  const [hasEverStarted, setHasEverStarted] = useState(false);
  const [badge, setBadge] = useState<ChosenItem | null>(null);
  const [choices, setChoices] = useState<ChosenItem[]>([]);
  const [done, setDone] = useState(false);
  const choicesCountRef = useRef(0);

  const pair = PAIRS[pairIndex];
  const assessmentKey = choices.map(c => c.side).join('');
  const assessment = ASSESSMENTS[assessmentKey] ?? null;

  const go = useCallback((dir: 1 | -1) => {
    setDirection(dir);
    setPairIndex((i) => (i + dir + PAIRS.length) % PAIRS.length);
    setAudioStarted(false);
  }, []);

  const handleChosen = useCallback((item: ChosenItem) => {
    choicesCountRef.current += 1;
    const isLast = choicesCountRef.current === PAIRS.length;
    setChoices(prev => [...prev, item]);
    setBadge(item);
    setTimeout(() => {
      setBadge(null);
      if (isLast) setDone(true);
      else go(1);
    }, 700);
  }, [go]);

  return (
    <div className="min-h-screen bg-ink flex flex-col select-none cursor-crosshair">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-rule flex-shrink-0">
        <a
          href="/explorations"
          className="font-mono text-[11px] text-fg-muted tracking-[0.08em] hover:text-fg transition-colors"
        >
          ← back
        </a>
        <span className="font-mono text-[11px] text-fg-muted tracking-[0.08em] uppercase">
          The Chooser
        </span>
      </div>

      {/* Stage */}
      <div className="flex-1 relative overflow-hidden">
        {!done && (
          <AnimatePresence mode="wait" initial={false}>
            <Stage
              key={pair.id}
              pair={pair}
              direction={direction}
              autoStart={hasEverStarted}
              onAudioStarted={() => { setAudioStarted(true); setHasEverStarted(true); }}
              onChosen={handleChosen}
            />
          </AnimatePresence>
        )}

        {/* Choice badge — rendered above Stage so it animates independently */}
        <AnimatePresence>
          {badge && (
            <motion.div
              key="badge"
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none z-10"
              style={{ paddingBottom: '20%' }}
              initial={{ opacity: 0, scale: 0.35, y: 24 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{    opacity: 0, scale: 1.25,  y: -20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              <div className="w-36 h-36 rounded-full overflow-hidden border border-fg-muted/20 bg-white/5">
                <img
                  src={badge.image}
                  alt={badge.label}
                  className="w-full h-full object-contain p-4"
                  draggable={false}
                />
              </div>
              {badge.label && (
                <span className="font-mono text-[10px] text-fg-muted tracking-[0.2em] uppercase">
                  {badge.label}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt — centered just above the chooser items */}
        {/* Persistent title */}
        {!badge && !done && (
          <div
            className="absolute left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
            style={{ top: '22%' }}
          >
            <span className="font-mono text-2xl text-fg tracking-[0.15em] uppercase">
              who are you today?
            </span>
            <AnimatePresence>
              {!hasEverStarted && (
                <motion.span
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[11px] text-fg-muted/50 tracking-[0.12em]"
                >
                  click anywhere to hear the audio · then choose
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Choices tracker — hidden once done (layoutId takes over) */}
        <AnimatePresence>
          {choices.length > 0 && !done && (
            <motion.div
              key="choices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-8 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
            >
              <div className="flex items-center gap-1.5">
                {choices.map((c, i) => (
                  <motion.div
                    key={i}
                    layoutId={`choice-${i}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                    className="w-8 h-8 rounded-full overflow-hidden border border-fg-muted/20 bg-white/5 flex-shrink-0"
                  >
                    <img src={c.image} alt={c.label} className="w-full h-full object-contain p-1" draggable={false} />
                  </motion.div>
                ))}
              </div>
              <span className="font-mono text-[9px] text-fg-muted/40 tracking-[0.22em] uppercase">
                your choices
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results screen */}
        <AnimatePresence>
          {done && (
            <motion.div
              key="results"
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex items-end gap-6">
                {choices.map((c, i) => (
                  <motion.div
                    key={i}
                    layoutId={`choice-${i}`}
                    className="rounded-full overflow-hidden border border-fg-muted/25 bg-white/5 flex-shrink-0"
                    style={{ width: 96, height: 96 }}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{
                      layout: { type: 'spring', stiffness: 180, damping: 24 },
                      scale:  { repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 1 + i * 0.2 },
                    }}
                  >
                    <img src={c.image} alt={c.label} className="w-full h-full object-contain p-4" draggable={false} />
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="flex gap-6">
                  {choices.map((c, i) => (
                    <span
                      key={i}
                      className="font-mono text-[10px] text-fg-muted tracking-[0.2em] uppercase text-center"
                      style={{ width: 96 }}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
                <span className="font-mono font-bold text-fg tracking-[0.3em] uppercase mt-2" style={{ fontSize: '0.85rem' }}>
                  this is you
                </span>
              </motion.div>
              {assessment && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 }}
                  className="font-mono text-[12px] text-fg-muted/70 tracking-[0.06em] text-center max-w-xs leading-relaxed"
                >
                  {assessment}
                </motion.p>
              )}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                onClick={() => {
                  setDone(false);
                  setChoices([]);
                  choicesCountRef.current = 0;
                  setPairIndex(0);
                  setDirection(1);
                  setAudioStarted(false);
                  setHasEverStarted(false);
                }}
                className="font-mono text-[11px] text-fg-muted/40 tracking-[0.12em] hover:text-fg-muted transition-colors cursor-pointer mt-4"
              >
                start over
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prev / Next — hidden when done */}
        {PAIRS.length > 1 && !done && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={() => go(-1)}
              className="font-mono text-[11px] text-fg-sub tracking-[0.08em] hover:text-fg transition-colors cursor-pointer"
            >
              ← prev
            </button>
            <span className="font-mono text-[10px] text-fg-sub">
              {pairIndex + 1} / {PAIRS.length}
            </span>
            <button
              onClick={() => go(1)}
              className="font-mono text-[11px] text-fg-sub tracking-[0.08em] hover:text-fg transition-colors cursor-pointer"
            >
              next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
