import { RotateCcw, Frown, PartyPopper, Sparkles, Crown, LogOut } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playNote, MUSICAL_NOTES, resumeAudioContext } from '@/lib/audio/toneGenerator';
import { getVolumeEnabled } from '@/lib/audio/volumeControl';

interface SimonSaysProps {
  /** Called when the player wins */
  onWin: (difficulty: 'easy' | 'hard' | 'super-hard') => void;
  /** Called when the player loses */
  onLose?: () => void;
  /** Called when the player cancels the game */
  onCancel?: () => void;
  /** Initial difficulty (optional) */
  defaultDifficulty?: 'easy' | 'hard' | 'super-hard';
  /** Hide the Play Again button in victory screen (for custom post-victory flows) */
  hideVictoryButton?: boolean;
}

type GameState = 'difficulty-select' | 'playing' | 'victory' | 'game-over';
type Difficulty = 'easy' | 'hard' | 'super-hard';
type GamePhase = 'simon-turn' | 'player-turn' | 'between-rounds';

import { PadGlyph, DifficultyBars, GlyphRow, PAD_SHAPES, PAD_COLORS, PAD_NAMES } from './simon/glyphs';

const WILDCARD_NOTES: (keyof typeof MUSICAL_NOTES)[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
// Pads are identified by SHAPE first and colour second, so the game
// is playable without colour vision. PAD_COLORS is the muted palette
// from ./simon/glyphs — every hue clears AAA on this ground.
const CARD_COLORS = PAD_SHAPES;

/**
 * Simon Says Memory Game
 * Players must repeat increasingly complex sequences to win
 */
export default function SimonSays({
  onWin,
  onLose,
  onCancel,
  defaultDifficulty,
  hideVictoryButton = false,
}: SimonSaysProps) {
  // Game state
  // framer-motion animates in JS, so the stylesheet's blanket
  // reduced-motion rule cannot stop an infinite pulse. Gate it here.
  const reduceMotion = useReducedMotion();

  const [gameState, setGameState] = useState<GameState>('difficulty-select');
  const [difficulty, setDifficulty] = useState<Difficulty | null>(defaultDifficulty || null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('simon-turn');
  const [round, setRound] = useState(1);
  const [simonSequence, setSimonSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [highlightedCardIndex, setHighlightedCardIndex] = useState<number | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  // Get max rounds based on difficulty
  const getMaxRounds = useCallback((diff: Difficulty) => {
    if (diff === 'easy') return 3; // 4 cards total (starts at 2, ends at 4)
    if (diff === 'hard') return 5; // 6 cards total (starts at 2, ends at 6)
    return 8; // super-hard: 9 cards total (starts at 2, ends at 9)
  }, []);

  // Calculate speed based on round and difficulty
  const getSequenceSpeed = useCallback((roundNum: number, diff: Difficulty) => {
    let baseSpeed = 700;
    let speedDecrease = 100;

    if (diff === 'hard') {
      baseSpeed = 600;
      speedDecrease = 80;
    } else if (diff === 'super-hard') {
      baseSpeed = 500;
      speedDecrease = 60;
    }

    return Math.max(250, baseSpeed - (roundNum - 1) * speedDecrease);
  }, []);

  // Generate new sequence for the round
  const generateSequence = useCallback((roundNum: number) => {
    const length = roundNum + 1; // Round 1 = 2 cards, Round 2 = 3 cards, etc.
    return Array.from({ length }, () => Math.floor(Math.random() * 6));
  }, []);

  // Play Simon's sequence with visual and audio feedback
  const playSimonSequence = useCallback((sequence: number[], speed: number) => {
    if (!getVolumeEnabled()) return;

    setIsPlayingSequence(true);
    const BLINK_DELAY = Math.min(100, speed * 0.15); // Scale blink with speed

    sequence.forEach((cardIndex, step) => {
      setTimeout(() => {
        // Turn OFF highlight (for blink effect on repeated cards)
        setHighlightedCardIndex(null);

        // Wait for blink, then turn ON
        setTimeout(() => {
          setHighlightedCardIndex(cardIndex);
          playNote(WILDCARD_NOTES[cardIndex], 0.4);
        }, BLINK_DELAY);
      }, step * speed);
    });

    // Clear highlight and enable player turn after sequence completes
    setTimeout(() => {
      setHighlightedCardIndex(null);
      setIsPlayingSequence(false);
      setGamePhase('player-turn');
    }, sequence.length * speed + 500);
  }, []);

  // Start game with selected difficulty
  const startGame = useCallback((selectedDifficulty: Difficulty) => {
    resumeAudioContext(); // unlock Web Audio on iOS — must be inside a user gesture
    setDifficulty(selectedDifficulty);
    setGameState('playing');
    setRound(1);
    setPlayerSequence([]);

    // Generate and play first sequence
    const firstSequence = generateSequence(1);
    setSimonSequence(firstSequence);
    setGamePhase('simon-turn');

    // Play sequence after brief delay (longer initial delay for better UX)
    setTimeout(() => {
      playSimonSequence(firstSequence, getSequenceSpeed(1, selectedDifficulty));
    }, 1400);
  }, [generateSequence, playSimonSequence, getSequenceSpeed]);

  // Handle player card click
  const handleCardClick = useCallback((cardIndex: number) => {
    if (gamePhase !== 'player-turn' || isPlayingSequence) return;

    // Add to player sequence
    const newPlayerSequence = [...playerSequence, cardIndex];
    setPlayerSequence(newPlayerSequence);

    // Play sound
    playNote(WILDCARD_NOTES[cardIndex], 0.3);

    // Highlight card briefly
    setHighlightedCardIndex(cardIndex);
    // 280ms rather than 200 — long enough for the glow and the
    // first pulse ring to actually read as a response.
    setTimeout(() => setHighlightedCardIndex(null), 280);

    // Check if player is correct so far
    const isCorrect = simonSequence[newPlayerSequence.length - 1] === cardIndex;

    if (!isCorrect) {
      // WRONG! Game over
      setTimeout(() => {
        // Play sad descending tune
        if (getVolumeEnabled()) {
          playNote('E4', 0.3);
          setTimeout(() => playNote('D4', 0.3), 200);
          setTimeout(() => playNote('C4', 0.5), 400);
        }
        setGameState('game-over');
        onLose?.();
      }, 300);
      return;
    }

    // Check if player completed the sequence
    if (newPlayerSequence.length === simonSequence.length) {
      // Correct sequence completed!
      if (difficulty && round >= getMaxRounds(difficulty)) {
        // VICTORY! Player beat the game
        setTimeout(() => {
          // Play victory sound
          if (getVolumeEnabled()) {
            playNote('C5', 0.3);
            setTimeout(() => playNote('E4', 0.3), 150);
            setTimeout(() => playNote('A4', 0.5), 300);
          }

          setGameState('victory');
          onWin(difficulty);
        }, 500);
      } else {
        // Move to next round
        setTimeout(() => {
          const nextRound = round + 1;
          setRound(nextRound);
          setPlayerSequence([]);
          setGamePhase('between-rounds');

          // Generate and play next sequence
          setTimeout(() => {
            const nextSequence = generateSequence(nextRound);
            setSimonSequence(nextSequence);
            setGamePhase('simon-turn');

            setTimeout(() => {
              if (difficulty) {
                playSimonSequence(nextSequence, getSequenceSpeed(nextRound, difficulty));
              }
            }, 600);
          }, 1000);
        }, 500);
      }
    }
  }, [
    gamePhase,
    isPlayingSequence,
    playerSequence,
    simonSequence,
    round,
    difficulty,
    getMaxRounds,
    generateSequence,
    playSimonSequence,
    getSequenceSpeed,
    onWin,
    onLose,
  ]);

  // Fire confetti on victory
  useEffect(() => {
    if (gameState === 'victory') {
      const timeouts: ReturnType<typeof setTimeout>[] = [];

      // Create or get confetti canvas with pointer-events: none to avoid blocking clicks
      let canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1000';
        document.body.appendChild(canvas);
      } else {
        // Ensure pointer-events is always none even if canvas exists
        canvas.style.pointerEvents = 'none';
      }

      const myConfetti = confetti.create(canvas, { resize: true });

      // Create confetti instance that won't block clicks
      const fireConfetti = (options: confetti.Options) => {
        myConfetti({
          ...options,
          disableForReducedMotion: true,
        });
      };

      // Initial burst
      fireConfetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#6fd0c2', '#d9a441', '#e0857f', '#a99ae0', '#7fb4de'],
      });

      // Side cannons
      const sideConfetti = () => {
        fireConfetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#6fd0c2', '#a99ae0'],
        });
        fireConfetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors: ['#3b82f6', '#10b981'],
        });
      };

      // Delayed bursts
      timeouts.push(setTimeout(sideConfetti, 250));
      timeouts.push(setTimeout(sideConfetti, 500));
      timeouts.push(setTimeout(() => {
        fireConfetti({
          particleCount: 100,
          spread: 120,
          origin: { y: 0.6 },
          colors: ['#d9a441', '#e0857f', '#6fd0c2'],
        });
      }, 750));

      // Cleanup function
      return () => {
        timeouts.forEach(clearTimeout);
        // Clean up confetti and remove canvas
        const canvas = document.getElementById('confetti-canvas');
        if (canvas) {
          myConfetti.reset();
          canvas.remove();
        }
      };
    }
  }, [gameState]);

  // Auto-start if default difficulty provided (only once)
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (defaultDifficulty && gameState === 'difficulty-select' && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      // Trigger game start only if we're still in difficulty select
      startGame(defaultDifficulty);
    }
  }, [defaultDifficulty, gameState, startGame]);

  // DIFFICULTY SELECTION SCREEN
  if (gameState === 'difficulty-select') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center"
      >
        {/* Bouncing controller */}
        {/* The six pads, shown up front so the shapes are familiar
            before the sequence starts. Replaces a bouncing emoji. */}
        <motion.div
          className="flex justify-center mb-7"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <GlyphRow size={26} />
        </motion.div>

        <h3 className="font-serif text-[clamp(38px,6vw,64px)] leading-[0.95] tracking-[-0.03em] text-fg mb-3">
          Pattern Match
        </h3>

        <p className="text-exp-micro tracking-[0.2em] uppercase text-fg-muted mb-10">
          Remember the sequence
        </p>

        {/* Difficulty buttons */}
        <motion.div
          className="mb-10 w-full max-w-xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="text-xs uppercase tracking-[0.2em] text-exp-base mb-5 text-center font-mono">
            Select Difficulty
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { id: 'easy' as const,       level: 1 as const, label: 'Easy',   sub: '4-card sequence' },
              { id: 'hard' as const,       level: 2 as const, label: 'Hard',   sub: '6-card sequence' },
              { id: 'super-hard' as const, level: 3 as const, label: 'Insane', sub: '9-card sequence' },
            ]).map(({ id, level, label, sub }) => (
              <motion.button
                key={id}
                onClick={() => startGame(id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group/diff flex cursor-pointer flex-col items-center gap-2.5 border
                           border-rule-strong px-4 py-5 text-fg-muted transition-colors
                           duration-300 hover:border-accent hover:text-accent"
              >
                {/* Ascending bars rather than brain / flame / skull.
                    Says "more" without the platform roulette. */}
                <DifficultyBars level={level} size={26} />
                <span className="text-exp-label font-medium tracking-[0.14em] uppercase">
                  {label}
                </span>
                <span className="text-exp-micro tracking-[0.06em] text-exp-dim">{sub}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {onCancel && (
          <motion.button
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-1.5 border border-white/15 rounded px-2.5 py-1.5 text-white/40 hover:text-white/80 hover:border-white/30 transition-colors font-mono text-[11px] tracking-[0.06em] cursor-pointer"
          >
            <LogOut size={12} strokeWidth={1.5} />
            quit
          </motion.button>
        )}
      </motion.div>
    );
  }

  // VICTORY SCREEN
  if (gameState === 'victory') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
      >
        <div className="text-center space-y-6">
          {/* Animated Trophy and Party Icons */}
          <div className="relative flex justify-center items-center h-24">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, duration: 0.6, type: 'spring', bounce: 0.6 }}
              className="absolute"
            >
              <Crown className="w-20 h-20 text-yellow-500 dark:text-yellow-400" />
            </motion.div>
            <motion.div
              initial={{ scale: 0, x: -50 }}
              animate={{ scale: 1, x: -40 }}
              transition={{ delay: 0.4, duration: 0.5, type: 'spring', bounce: 0.5 }}
              className="absolute"
            >
              <Sparkles className="w-10 h-10 text-purple-500 dark:text-purple-400" />
            </motion.div>
            <motion.div
              initial={{ scale: 0, x: 50 }}
              animate={{ scale: 1, x: 40 }}
              transition={{ delay: 0.5, duration: 0.5, type: 'spring', bounce: 0.5 }}
              className="absolute"
            >
              <PartyPopper className="w-10 h-10 text-pink-500 dark:text-pink-400" />
            </motion.div>
          </div>

          {/* Victory Message */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h3 className="mb-2 font-serif text-[clamp(32px,5vw,52px)] leading-[1] tracking-[-0.03em] text-accent">
              Sequence complete
            </h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-exp-body text-exp-bright"
            >
              {difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Insane'} cleared.
            </motion.p>
          </motion.div>

          {/* Play Again Button (hidden if hideVictoryButton is true) */}
          {!hideVictoryButton && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex gap-3"
            >
              <motion.button
                onClick={() => setGameState('difficulty-select')}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="min-h-11 border border-rule-strong px-6 text-exp-micro font-medium
                           tracking-[0.16em] uppercase text-fg-muted transition-colors
                           duration-300 hover:border-fg-muted hover:text-fg"
              >
                Change Difficulty
              </motion.button>
              <motion.button
                onClick={() => difficulty && startGame(difficulty)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="min-h-11 border border-accent px-8 text-exp-micro font-medium
                           tracking-[0.16em] uppercase text-accent transition-colors
                           duration-300 hover:bg-accent hover:text-ink"
              >
                Play Again
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    );
  }

  // GAME OVER SCREEN
  if (gameState === 'game-over') {
    return (
      <div className="pt-6">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Frown className="w-16 h-16 text-red-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-red-400 mb-2">
              Game Over
            </h3>
            <p className="font-mono text-sm text-white/60 tracking-wider">
              You reached Round {round} of {difficulty && getMaxRounds(difficulty)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setGameState('difficulty-select')}
              className="flex items-center gap-2 px-8 py-3 rounded-lg border-2 border-purple-500/50 bg-purple-500/10 hover:border-purple-400 hover:bg-purple-500/20 transition-all text-purple-300 font-mono text-sm uppercase tracking-wider"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 border border-white/15 rounded px-2.5 py-1.5 text-white/40 hover:text-white/80 hover:border-white/30 transition-colors font-mono text-[11px] tracking-[0.06em] cursor-pointer"
              >
                <LogOut size={12} strokeWidth={1.5} />
                quit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // PLAYING GAME SCREEN
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="pt-6"
    >
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-sm font-bold text-white tracking-widest uppercase">
            Round {round} of {difficulty && getMaxRounds(difficulty)}
          </h3>
          <p className="font-mono text-xs tracking-widest uppercase"
            style={{ color: gamePhase === 'player-turn' ? 'var(--color-accent)' : 'var(--color-fg-muted)' }}>
            {gamePhase === 'simon-turn' && 'watch...'}
            {gamePhase === 'player-turn' && 'your turn'}
            {gamePhase === 'between-rounds' && 'get ready...'}
          </p>
        </div>

        {/* Pip dots — one per round */}
        {(() => {
          const maxRounds = difficulty ? getMaxRounds(difficulty) : 1;
          return (
            <div className="flex items-center gap-2">
              {Array.from({ length: maxRounds }, (_, i) => {
                const done    = i < round - 1;
                const current = i === round - 1;
                return (
                  <motion.div
                    key={i}
                    className="flex-1"
                    style={{ height: 6 }}
                    animate={{
                      backgroundColor: done || current
                        ? 'var(--color-accent)'
                        : 'var(--color-rule-strong)',
                      opacity: done ? 0.55 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  />
                );
              })}
            </div>
          );
        })()}
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
        {CARD_COLORS.map((shape, index) => {
          const isHighlighted = highlightedCardIndex === index;
          const hue = PAD_COLORS[shape];
          const isDisabled = gamePhase !== 'player-turn' || isPlayingSequence;

          return (
            <motion.button
              key={index}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
                type: 'spring',
                stiffness: 260,
                damping: 22,
              }}
              onClick={() => handleCardClick(index)}
              disabled={isDisabled}
              aria-label={PAD_NAMES[shape]}
              style={{
                borderColor: isHighlighted ? hue : 'var(--color-rule-strong)',
                backgroundColor: isHighlighted ? `${hue}1f` : 'transparent',
                // The glow, back but on-system: the pad's own hue
                // instead of neon purple, a crisp inner edge plus a
                // soft bloom. Appears instantly, which is what makes
                // a 280ms click feel like a response.
                boxShadow: isHighlighted
                  ? `inset 0 0 20px -9px ${hue}, 0 0 18px -10px ${hue}`
                  : 'none',
                transition: 'box-shadow 140ms ease-out',
              }}
              className={`group relative flex min-h-[100px] flex-col items-center justify-center
                          border p-3 transition-colors duration-200 ${
                            isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          }`}
            >
              {/* Concentric pulses, restored. Three of them, staggered,
                  in the pad's hue and a hairline thick rather than 3px
                  of purple. The first starts with no delay so a quick
                  click still gets one. */}
              {isHighlighted && !reduceMotion && (
                <>
                  {[0, 1, 2].map((ring) => (
                    <motion.span
                      key={ring}
                      className="pointer-events-none absolute inset-0"
                      style={{ border: `1px solid ${hue}` }}
                      initial={{ opacity: 0.5, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.09 }}
                      transition={{
                        duration: 0.55,
                        repeat: Infinity,
                        delay: ring * 0.13,
                        ease: 'easeOut',
                      }}
                    />
                  ))}
                </>
              )}

              {/* A soft bloom behind the glyph itself */}
              {isHighlighted && (
                <motion.span
                  className="pointer-events-none absolute"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${hue}2b 0%, transparent 70%)`,
                  }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                />
              )}

              <motion.span
                className="relative"
                animate={{ scale: isHighlighted ? 1.07 : 1 }}
                transition={{ type: 'spring', stiffness: 460, damping: 20 }}
              >
                <PadGlyph shape={shape} size={40} active={isHighlighted} />
              </motion.span>
            </motion.button>
          );
        })}
      </div>

      {/* Cancel game button */}
      <div className="flex justify-center mt-3">
        <button
          onClick={onCancel || (() => setGameState('difficulty-select'))}
          className="flex items-center gap-1.5 border border-white/15 rounded px-2.5 py-1.5 text-white/40 hover:text-white/80 hover:border-white/30 transition-colors font-mono text-[11px] tracking-[0.06em] cursor-pointer"
        >
          <LogOut size={12} strokeWidth={1.5} />
          quit
        </button>
      </div>
    </motion.div>
  );
}
