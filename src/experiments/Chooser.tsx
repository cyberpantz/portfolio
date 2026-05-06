import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChooser } from './chooser/useChooser';

interface ChooserPair {
  id: string;
  left:  { image: string; label: string; audio: string };
  right: { image: string; label: string; audio: string };
}

const PAIRS: ChooserPair[] = [
  {
    id: 'disco-vs-crystal',
    left:  { image: '/chooser/disco-ball.svg', label: 'party', audio: '/chooser/house.mp3'      },
    right: { image: '/chooser/crystal.svg',    label: 'meditate',  audio: '/chooser/meditation.mp3' },
  },
    {
    id: 'dick-vs-joystick',
    left:  { image: '/chooser/penis.svg', label: '', audio: '/chooser/house.mp3'      },
    right: { image: '/chooser/joystick.svg',    label: '',  audio: '/chooser/01. Ground Theme.mp3' },
  },
  // add more pairs here
];

const SLIDE = { duration: 0.45, ease: [0.32, 0, 0.67, 0] as const };

// ---------- Stage ----------

interface StageProps {
  pair: ChooserPair;
  direction: number;
  onAudioStarted: () => void;
  autoStart?: boolean;
}

function Stage({ pair, direction, onAudioStarted, autoStart }: StageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

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

  // Auto-start when navigating after the first click (page gesture already unlocked)
  useEffect(() => {
    if (!autoStart) return;
    setStarted(true);
    void startAudio().then(onAudioStarted);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(async () => {
    if (started) return;
    setStarted(true);
    await startAudio();
    onAudioStarted();
  }, [started, startAudio, onAudioStarted]);

  return (
    <motion.div
      key={pair.id}
      ref={stageRef}
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ x: direction * 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: direction * -80, opacity: 0 }}
      transition={SLIDE}
      onClick={handleClick}
    >
      <div className="flex items-center justify-center gap-40">
        {/* Left */}
        <div className="flex flex-col items-center gap-5">
          <div
            ref={leftRef}
            className="w-52 h-52 rounded-full overflow-hidden"
            style={{ transformOrigin: 'center center', willChange: 'transform' }}
          >
            <img
              src={pair.left.image}
              alt={pair.left.label}
              className="w-full h-full object-cover pointer-events-none"
              draggable={false}
            />
          </div>
          <span className="font-mono text-[10px] text-fg-muted tracking-[0.2em] uppercase">
            {pair.left.label}
          </span>
        </div>

        {/* Right */}
        <div className="flex flex-col items-center gap-5">
          <div
            ref={rightRef}
            className="w-52 h-52 rounded-full overflow-hidden"
            style={{ transformOrigin: 'center center', willChange: 'transform' }}
          >
            <img
              src={pair.right.image}
              alt={pair.right.label}
              className="w-full h-full object-cover pointer-events-none"
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

  const pair = PAIRS[pairIndex];

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setPairIndex((i) => (i + dir + PAIRS.length) % PAIRS.length);
    setAudioStarted(false);
  };

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
        <AnimatePresence mode="wait" initial={false}>
          <Stage
            key={pair.id}
            pair={pair}
            direction={direction}
            autoStart={hasEverStarted}
            onAudioStarted={() => { setAudioStarted(true); setHasEverStarted(true); }}
          />
        </AnimatePresence>

        {/* Start prompt */}
        <AnimatePresence>
          {!audioStarted && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <span className="font-mono text-[11px] text-fg-muted tracking-[0.15em] uppercase animate-pulse">
                click anywhere to begin
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prev / Next */}
        {PAIRS.length > 1 && (
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
