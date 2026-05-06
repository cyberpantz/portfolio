import { RotateCcw, Frown, PartyPopper, Sparkles, Crown } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { playNote, MUSICAL_NOTES } from '@/lib/audio/toneGenerator';
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

const WILDCARD_NOTES: (keyof typeof MUSICAL_NOTES)[] = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4'];
const WILDCARD_COLORS: Record<string, string> = {
  purple: '#a855f7',
  blue: '#3b82f6',
  pink: '#ec4899',
  emerald: '#10b981',
  orange: '#f97316',
  rose: '#f43f5e',
};

// Card colors for visual variety
const CARD_COLORS = ['purple', 'blue', 'pink', 'emerald', 'orange', 'rose'];

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
    setTimeout(() => setHighlightedCardIndex(null), 200);

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
        colors: ['#a855f7', '#ec4899', '#f97316', '#10b981', '#3b82f6'],
      });

      // Side cannons
      const sideConfetti = () => {
        fireConfetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors: ['#a855f7', '#ec4899'],
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
          colors: ['#f97316', '#ec4899', '#a855f7'],
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
        <motion.div
          className="flex justify-center mb-4"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-5xl">🎮</span>
        </motion.div>

        <h3
          className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 mb-3"
          style={{
            textShadow: '0 0 20px rgba(168,85,247,0.5), 0 0 40px rgba(168,85,247,0.3)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          PATTERN MATCH
        </h3>

        <p className="text-white/50 text-sm tracking-widest font-mono uppercase mb-10">
          Remember the sequence
        </p>

        {/* Difficulty buttons */}
        <motion.div
          className="mb-10 w-full max-w-xl"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-5 text-center font-mono">
            Select Difficulty
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: 'easy' as const,       emoji: '🧠', label: 'Easy',   sub: '4-card sequence', glow: 'rgba(34,197,94,0.5)',  border: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
              { id: 'hard' as const,       emoji: '🔥', label: 'Hard',   sub: '6-card sequence', glow: 'rgba(234,179,8,0.5)', border: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
              { id: 'super-hard' as const, emoji: '💀', label: 'Insane', sub: '9-card sequence', glow: 'rgba(239,68,68,0.5)', border: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
            ]).map(({ id, emoji, label, sub, glow, border, bg }) => (
              <motion.button
                key={id}
                onClick={() => startGame(id)}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="relative flex flex-col items-center gap-1.5 px-4 py-5 rounded-lg border-2 font-mono uppercase tracking-widest cursor-pointer"
                style={{
                  borderColor: border,
                  background: bg,
                  boxShadow: `0 0 20px ${glow}`,
                  color: border,
                }}
              >
                <motion.span
                  className="text-4xl"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {emoji}
                </motion.span>
                <span className="text-sm font-black">{label}</span>
                <span className="text-[10px] opacity-70 normal-case tracking-normal">{sub}</span>
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
            className="px-6 py-2 text-sm text-gray-400 hover:text-red-400 font-mono uppercase tracking-wider transition-colors"
          >
            [ ESC - CANCEL ]
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
            <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 dark:from-purple-400 dark:via-pink-400 dark:to-orange-400 mb-2 uppercase tracking-wider">
              Epic Victory!
            </h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg font-bold text-gray-700 dark:text-neutral-300"
            >
              {difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Insane'} Mode Conquered!
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
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 border-2 border-white/20 text-white/70 font-mono text-sm uppercase tracking-wider rounded-lg hover:border-white/40 hover:text-white transition-colors"
              >
                Change Difficulty
              </motion.button>
              <motion.button
                onClick={() => difficulty && startGame(difficulty)}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-3 bg-gradient-to-b from-purple-500 to-pink-600 text-white font-black text-sm uppercase tracking-wider rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.7)] transition-shadow"
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
            <Frown className="w-16 h-16 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
              Game Over
            </h3>
            <p className="text-gray-700 dark:text-neutral-300">
              You reached Round {round} of {difficulty && getMaxRounds(difficulty)}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setGameState('difficulty-select')}
              className="w-full px-6 py-3 rounded-xl border-2 border-purple-300 dark:border-purple-500/50 bg-purple-50 dark:bg-purple-500/10 hover:border-purple-500 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 hover:border-gray-400 dark:hover:border-zinc-600 transition-all text-gray-700 dark:text-neutral-300 font-semibold"
              >
                Close
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Round {round} of {difficulty && getMaxRounds(difficulty)}
            </h3>
            <p className="text-xs text-gray-600 dark:text-neutral-400">
              {gamePhase === 'simon-turn' && 'Watch the pattern...'}
              {gamePhase === 'player-turn' && 'Your turn! Repeat the pattern'}
              {gamePhase === 'between-rounds' && 'Get ready...'}
            </p>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-neutral-500">Sequence</div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {simonSequence.length} cards
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${(round / (difficulty ? getMaxRounds(difficulty) : 1)) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
            className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full"
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
        {CARD_COLORS.map((color, index) => {
          const isHighlighted = highlightedCardIndex === index;
          const highlightColor = WILDCARD_COLORS[color] || WILDCARD_COLORS.purple;
          const isDisabled = gamePhase !== 'player-turn' || isPlayingSequence;

          return (
            <motion.button
              key={index}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.08,
                type: 'spring',
                stiffness: 200,
                damping: 15
              }}
              onClick={() => handleCardClick(index)}
              disabled={isDisabled}
              style={
                isHighlighted
                  ? {
                      borderColor: highlightColor,
                      backgroundColor: `${highlightColor}20`,
                      boxShadow: `0 10px 25px -5px ${highlightColor}50, 0 8px 10px -6px ${highlightColor}50`,
                    }
                  : {
                      borderColor: `${highlightColor}50`,
                      backgroundColor: `${highlightColor}0d`,
                    }
              }
              className={`group flex flex-col items-center justify-center p-3 rounded-xl border-2 min-h-[100px] transition-all ${
                isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="relative w-9 h-9">
                {/* Concentric pulse rings when highlighted */}
                {isHighlighted && (
                  <>
                    {[0, 1, 2].map((ring) => (
                      <motion.div
                        key={ring}
                        className="absolute inset-0 rounded-full"
                        style={{
                          borderWidth: '3px',
                          borderStyle: 'solid',
                          borderColor: highlightColor,
                        }}
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{
                          scale: [1, 1.8, 2.2],
                          opacity: [0.8, 0.3, 0],
                        }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: ring * 0.3,
                          ease: 'easeOut',
                        }}
                      />
                    ))}
                  </>
                )}
                {/* Main circle */}
                <div
                  className="relative w-9 h-9 rounded-full transition-all"
                  style={
                    isHighlighted
                      ? {
                          borderWidth: '3px',
                          borderStyle: 'solid',
                          borderColor: highlightColor,
                          backgroundColor: `${highlightColor}40`,
                        }
                      : {
                          borderWidth: '3px',
                          borderStyle: 'solid',
                          borderColor: `${highlightColor}70`,
                          backgroundColor: `${highlightColor}20`,
                        }
                  }
                />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Cancel game button */}
      <div className="text-center mt-3">
        <button
          onClick={onCancel || (() => setGameState('difficulty-select'))}
          className="text-xs text-gray-500 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors underline"
        >
          Cancel Game
        </button>
      </div>
    </motion.div>
  );
}
