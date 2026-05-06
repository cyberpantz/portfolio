import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playMelody, playNote, type MelodyNote } from '@/lib/audio/toneGenerator';
import { playGameSound as playFoodSound } from '@/lib/audio/playSound';

interface KitchenDodgeballProps {
  /** Called when the player wins (survives the duration) */
  onWin: () => void;
  /** Called when the player loses (gets hit) */
  onLose?: () => void;
  /** Called when the player cancels the game */
  onCancel?: () => void;
  /** Game duration in seconds (default: 30) */
  duration?: number;
  /** Difficulty level affects spawn rate (default: 'medium') */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Player emoji avatar (default: 👨‍🍳) */
  playerEmoji?: string;
}

interface FallingItem {
  id: string;
  emoji: string;
  x: number; // 0-100 (percentage)
  speed: number; // pixels per frame
  isBoss?: boolean; // Boss items are bigger and scarier
  floatsUp?: boolean; // Some bosses float up from bottom instead of falling
}

const FOOD_EMOJIS = ['🍅', '🥚', '🥔', '🧅', '🌽', '🥕', '🍋', '🥒', '🍆', '🥑', '🍑'];
const BOSS_EMOJIS = ['🐓', '🐓', '🐓', '🦆', '🐓',];
const GROWTH_EMOJIS = ['🍆', '🍑']; // Special items that make player grow

// Sound effects
const playStartSound = () => {
  const melody: MelodyNote[] = [
    { note: 'C4', duration: 0.15 },
    { note: 'E4', duration: 0.15 },
    { note: 'G4', duration: 0.2 },
  ];
  playMelody(melody, 0.15);
};

const playHitSound = () => {
  playNote('G4', 0.1, 0.2);
  setTimeout(() => playNote('D4', 0.1, 0.2), 100);
  setTimeout(() => playNote('A3', 0.2, 0.2), 200);
};

const playWinSound = () => {
  const melody: MelodyNote[] = [
    { note: 'C4', duration: 0.15 },
    { note: 'E4', duration: 0.15 },
    { note: 'G4', duration: 0.15 },
    { note: 'C5', duration: 0.3, drum: 'crash' },
  ];
  playMelody(melody, 0.2);
};

const playLoseSound = () => {
  const melody: MelodyNote[] = [
    { note: 'G4', duration: 0.2 },
    { note: 'F4', duration: 0.2 },
    { note: 'Eb4', duration: 0.2 },
    { note: 'C4', duration: 0.4 },
  ];
  playMelody(melody, 0.15);
};

const playBossPulse = () => {
  // Low, ominous pulse - deeper note with higher volume
  playNote('C2', 0.5, 0.25); // Deep bass note
  setTimeout(() => playNote('C2', 0.3, 0.15), 200); // Echo effect
};

export default function KitchenDodgeball({
  onWin,
  onLose,
  onCancel,
  duration = 30,
  difficulty = 'medium',
  playerEmoji = '👨‍🍳',
}: KitchenDodgeballProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready');
  const [playerX, setPlayerX] = useState(50); // 0-100 percentage
  const [playerY, setPlayerY] = useState(0); // Player Y offset (0 = ground, negative = in air)
  const [fallingItems, setFallingItems] = useState<FallingItem[]>([]);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [gameProgress, setGameProgress] = useState(0); // 0 to 1
  const [lives, setLives] = useState(3);
  const [invulnerable, setInvulnerable] = useState(false); // Brief invulnerability after hit
  const [isGrown, setIsGrown] = useState(false); // Player growth from eggplant/peach
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>(difficulty);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const invulnerabilityRef = useRef(false); // Track invulnerability immediately without waiting for state update
  const lastBossPulseRef = useRef<number>(0); // Track last time boss sound played
  const gameTimeRef = useRef<number>(0); // Track game time for boss floating animation
  const jumpVelocityRef = useRef<number>(0); // Jump velocity
  const playerXRef = useRef<number>(50); // Track current player X position for spawn calculations

  // Difficulty settings (slightly more forgiving)
  const difficultySettings = {
    easy: { spawnInterval: 1100, baseSpeed: 1.1, speedVariance: 0.4 },
    medium: { spawnInterval: 850, baseSpeed: 1.5, speedVariance: 0.5 },
    hard: { spawnInterval: 600, baseSpeed: 2.0, speedVariance: 0.7 },
  };

  const settings = difficultySettings[selectedDifficulty];

  // Progressive speed multiplier: starts at 0.6x, ends at 1.8x (slightly less aggressive)
  const speedMultiplier = 0.6 + (gameProgress * 1.2);

  // Start game
  const startGame = () => {
    setGameState('playing');
    setTimeLeft(duration);
    setGameProgress(0);
    setLives(3);
    setInvulnerable(false);
    invulnerabilityRef.current = false; // Reset ref
    lastBossPulseRef.current = 0; // Reset boss pulse timer
    gameTimeRef.current = 0; // Reset game time for animations
    setFallingItems([]);
    setPlayerX(50);
    playStartSound();
  };

  // Handle keyboard controls
  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setPlayerX(prev => {
          const newX = Math.max(5, prev - 5);
          playerXRef.current = newX; // Update ref immediately
          return newX;
        });
      } else if (e.key === 'ArrowRight') {
        setPlayerX(prev => {
          const newX = Math.min(95, prev + 5);
          playerXRef.current = newX; // Update ref immediately
          return newX;
        });
      } else if (e.key === ' ' || e.key === 'ArrowUp') {
        // Jump: only if on ground
        if (playerY === 0) {
          jumpVelocityRef.current = -4; // Initial upward velocity
          e.preventDefault(); // Prevent spacebar from scrolling page
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, playerY]);

  // Handle touch controls for mobile
  useEffect(() => {
    if (gameState !== 'playing' || !gameAreaRef.current) return;

    const gameArea = gameAreaRef.current;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      touchStartY = touch.clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scrolling while playing
      if (e.touches.length === 0 || !gameArea) return;

      const touch = e.touches[0];
      const rect = gameArea.getBoundingClientRect();

      // Calculate touch position relative to game area (0-100%)
      const touchX = ((touch.clientX - rect.left) / rect.width) * 100;

      // Clamp to valid range and update player position
      const newX = Math.max(5, Math.min(95, touchX));
      setPlayerX(newX);
      playerXRef.current = newX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Detect tap vs swipe for jump
      // If touch ended quickly and moved very little vertically, treat as tap to jump
      if (e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const touchEndY = touch.clientY;
      const verticalMovement = Math.abs(touchEndY - touchStartY);

      // If minimal vertical movement (< 20px), treat as tap to jump
      if (verticalMovement < 20 && playerY === 0) {
        jumpVelocityRef.current = -4; // Initial upward velocity
      }
    };

    gameArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameArea.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      gameArea.removeEventListener('touchstart', handleTouchStart);
      gameArea.removeEventListener('touchmove', handleTouchMove);
      gameArea.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, playerY]);

  // Generate weighted spawn position based on player location
  const getWeightedSpawnX = (playerPosition: number): number => {
    const rand = Math.random();

    // 40% of time: spawn DIRECTLY on player (must dodge!)
    if (rand < 0.4) {
      // Add small variance so it's not pixel-perfect
      const variance = (Math.random() - 0.5) * 3; // ±1.5% variance
      return Math.max(5, Math.min(95, playerPosition + variance));
    }

    // 40% of time: spawn near player (challenging!)
    if (rand < 0.8) {
      const offset = (Math.random() * 15 + 5) * (Math.random() < 0.5 ? 1 : -1); // 5-20% away
      const spawnX = playerPosition + offset;
      return Math.max(5, Math.min(95, spawnX));
    }

    // 15% of time: spawn far from player (give breathing room)
    if (rand < 0.95) {
      // Try to spawn on opposite side of screen
      if (playerPosition < 50) {
        return 60 + Math.random() * 35; // Spawn on right side
      } else {
        return 5 + Math.random() * 35; // Spawn on left side
      }
    }

    // 5% of time: completely random
    return Math.random() * 90 + 5;
  };

  // Spawn falling items
  useEffect(() => {
    if (gameState !== 'playing') return;

    const spawnInterval = setInterval(() => {
      // 12% chance to spawn a BOSS (scary and intimidating!)
      const isBoss = Math.random() < 0.12;
      // 20% of bosses float up from bottom instead of falling (reduced from 50% so more traverse full screen)
      const floatsUp = isBoss && Math.random() < 0.2;

      const bossEmoji = isBoss
        ? BOSS_EMOJIS[Math.floor(Math.random() * BOSS_EMOJIS.length)]
        : '';

      // Bosses need wider margins due to text-7xl size (vs text-4xl for regular items)
      const spawnX = isBoss
        ? Math.max(12, Math.min(88, getWeightedSpawnX(playerXRef.current))) // Bosses: 12-88% to prevent edge clipping
        : getWeightedSpawnX(playerXRef.current); // Regular items: 5-95% is fine

      const newItem: FallingItem & { y?: number } = {
        id: `${Date.now()}-${Math.random()}`,
        emoji: isBoss
          ? bossEmoji
          : FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)],
        x: spawnX,
        speed: isBoss
          ? (settings.baseSpeed * 0.65) + Math.random() * (settings.speedVariance * 0.5) // Boss moves slower - more menacing
          : settings.baseSpeed + Math.random() * settings.speedVariance,
        isBoss,
        floatsUp,
        y: floatsUp ? 100 : 0, // Floating bosses start at bottom, others at top
      };

      // Play chicken sound when chicken boss spawns
      if (isBoss && bossEmoji === '🐓') {
        playFoodSound('chicken_boss');
      }

      setFallingItems(prev => [...prev, newItem]);
    }, settings.spawnInterval);

    return () => clearInterval(spawnInterval);
  }, [gameState, settings.spawnInterval, settings.baseSpeed, settings.speedVariance]);

  // Game loop - move items and check collisions
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = () => {
      gameTimeRef.current += 0.05; // Increment for animation timing

      // Update jump physics
      if (jumpVelocityRef.current !== 0 || playerY !== 0) {
        jumpVelocityRef.current += 0.3; // Gravity
        let newPlayerY = playerY + jumpVelocityRef.current;

        // Land on ground
        if (newPlayerY >= 0) {
          newPlayerY = 0;
          jumpVelocityRef.current = 0;
        }

        // Cap maximum jump height
        if (newPlayerY < -30) {
          newPlayerY = -30;
          jumpVelocityRef.current = 0;
        }

        setPlayerY(newPlayerY);
      }

      setFallingItems(prev => {
        const updated = prev.map(item => {
          const currentY = (item as FallingItem & { y?: number }).y !== undefined
            ? (item as FallingItem & { y: number }).y
            : 0;

          let newY;
          if (item.isBoss) {
            // Bosses: less affected by speed increase, with floating bob effect
            const bossSpeedMultiplier = 0.7 + (gameProgress * 0.5); // Only 0.7x to 1.2x instead of 0.5x to 2x
            let baseMovement = item.speed * bossSpeedMultiplier;

            // Some bosses float UP from the bottom instead of falling down
            if (item.floatsUp) {
              baseMovement = -baseMovement; // Negative = move upward
            }

            // Add strong floating bob: sin wave for eerie floating effect
            const floatOffset = Math.sin(gameTimeRef.current * 0.8 + item.x * 0.1) * 1.5;
            newY = currentY + baseMovement + floatOffset;
          } else {
            // Regular items: normal speed progression
            newY = currentY + (item.speed * speedMultiplier);
          }

          return {
            ...item,
            y: newY,
          };
        });

        // Remove items that went off screen (top or bottom)
        const filtered = updated.filter(item => {
          const y = (item as FallingItem & { y?: number }).y || 0;
          // Remove if went past bottom (y > 100) OR past top (y < -5)
          return y >= -5 && y <= 100;
        });

        // Check collisions with player using centroid distance
        // Only check one collision per frame to prevent multiple hits
        // Use ref to track invulnerability immediately without waiting for state update
        let hitItemId: string | null = null;
        if (!invulnerabilityRef.current) {
          for (const item of filtered) {
            if (hitItemId) break; // Stop after first hit

            const itemY = (item as FallingItem & { y?: number }).y || 0;
            // Player is at bottom (~90% y position), adjusted for jump
            // playerY is negative when jumping (max -30), so this moves player up on screen
            const playerYPos = 90 + (playerY * 0.67); // Scale jump height: -30 * 0.67 ≈ -20% upward movement

            // Calculate distance between centroids
            const dx = item.x - playerX;
            const dy = itemY - playerYPos; // Use calculated position, not raw playerY
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Collision threshold (boss items have larger radius due to size)
            const collisionRadius = item.isBoss ? 10 : 6; // Boss: 10%, Regular: 6%

            if (distance < collisionRadius) {
              hitItemId = item.id; // Mark this item for removal

              // Check if hit by growth item (eggplant or peach)
              const isGrowthItem = GROWTH_EMOJIS.includes(item.emoji);

              if (isGrowthItem) {
                // GOOD item! Player grows, no life lost!
                invulnerabilityRef.current = true;
                setIsGrown(true);
                playWinSound(); // Happy sound for good item
                setTimeout(() => {
                  setIsGrown(false);
                  invulnerabilityRef.current = false;
                }, 3000);
              } else {
                // BAD item - lose a life
                invulnerabilityRef.current = true;
                setLives(prev => {
                  const newLives = prev - 1;
                  if (newLives <= 0) {
                    setGameState('lost');
                    playLoseSound();
                    onLose?.();
                  } else {
                    // Grant temporary invulnerability with flash
                    playHitSound();
                    setInvulnerable(true);
                    setTimeout(() => {
                      setInvulnerable(false);
                      invulnerabilityRef.current = false;
                    }, 1500);
                  }
                  return newLives;
                });
              }
            }
          }
        }

        // Remove the item that caused the hit
        const finalFiltered = hitItemId
          ? filtered.filter(item => item.id !== hitItemId)
          : filtered;

        // Boss pulse sound - play if any boss is on screen (throttled to ~1 per second)
        const hasBoss = finalFiltered.some(item => item.isBoss);
        const now = Date.now();
        if (hasBoss && now - lastBossPulseRef.current > 1000) {
          playBossPulse();
          lastBossPulseRef.current = now;
        }

        return finalFiltered as FallingItem[];
      });

      // Only schedule next frame if still running
      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
      }
    };

    // Start the game loop
    let isRunning = true;
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      isRunning = false; // Prevent any scheduled frames from continuing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, playerX, playerY, onLose, speedMultiplier, invulnerable, gameProgress]);

  // Timer countdown
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;

        // Update game progress (0 at start, 1 at end)
        setGameProgress((duration - newTime) / duration);

        if (newTime <= 0) {
          setGameState('won');
          playWinSound();
          onWin();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, onWin, duration]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Game Area */}
      <div
        ref={gameAreaRef}
        className="relative w-full aspect-[16/10] min-h-[500px] max-h-[700px] bg-black rounded-xl border border-white/10 overflow-hidden select-none"
        style={{ height: 'calc(100vh - 300px)' }}
      >
        {/* Timer and Lives */}
        {gameState === 'playing' && (
          <>
            {/* Timer - Left Side, Retro Style */}
            <div className="absolute top-4 left-4 z-20">
              <span className="text-3xl font-mono font-bold text-brand drop-shadow-lg" style={{ fontFamily: 'monospace, "Courier New"' }}>
                {timeLeft}s
              </span>
            </div>

            {/* Lives - Right Side, Minimal */}
            <div className="absolute top-4 right-4 z-20">
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="text-2xl drop-shadow-lg"
                    animate={invulnerable && i === lives ? {
                      opacity: [1, 0.3, 1],
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={{
                      duration: 0.3,
                      repeat: invulnerable && i === lives ? Infinity : 0,
                    }}
                  >
                    {i < lives ? '❤️' : '🖤'}
                  </motion.span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Falling Items */}
        <AnimatePresence>
          {fallingItems.map(item => {
            const itemWithY = item as FallingItem & { y?: number };
            // Bosses grow larger as game progresses: 1.0x at start → 1.5x at end
            const bossGrowthScale = item.isBoss ? 1 + (gameProgress * 0.5) : 1;
            return (
              <motion.div
                key={item.id}
                className={`absolute ${item.isBoss ? 'text-7xl' : 'text-4xl'}`}
                style={{
                  left: `${item.x}%`,
                  top: `${itemWithY.y || 0}%`,
                  filter: item.isBoss ? 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.6))' : 'none',
                  transform: item.floatsUp ? 'scaleY(-1)' : 'none', // Flip upward-floating bosses upside down
                }}
                initial={{ opacity: 0, scale: 0.5 * bossGrowthScale }}
                animate={item.isBoss ? {
                  opacity: 1,
                  scale: [1 * bossGrowthScale, 1.1 * bossGrowthScale, 1 * bossGrowthScale],
                  rotate: [-5, 5, -5],
                } : {
                  opacity: 1,
                  scale: 1,
                }}
                transition={item.isBoss ? {
                  scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
                  rotate: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
                } : {}}
                exit={{ opacity: 0, scale: 0.5 * bossGrowthScale }}
              >
                {item.emoji}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Player */}
        {gameState === 'playing' && (
          <motion.div
            className="absolute text-5xl"
            style={{
              left: `${playerX}%`,
              top: `${90 + (playerY * 0.67)}%`, // Jump visual: playerY is negative when jumping
              transform: 'translateX(-50%)',
              transformOrigin: 'bottom center', // Scale upward from feet when hit
            }}
            animate={invulnerable ? {
              y: [0, -5, 0],
              opacity: [1, 0.6, 1],
              scale: [1.3, 1.25, 1.3], // Chef gets bigger when hit!
            } : isGrown ? {
              y: [0, -5, 0],
              scale: 1.8, // GROWN from special items!
            } : {
              y: [0, -5, 0],
              scale: 1,
            }}
            transition={invulnerable ? {
              duration: 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
            } : {
              duration: 0.3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {playerEmoji}
          </motion.div>
        )}

        {/* Start Screen - Retro Arcade Style */}
        {gameState === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-purple-900 via-indigo-900 to-black/95 backdrop-blur-sm px-4 py-6 overflow-y-auto">
            <div className="flex flex-col items-center w-full max-w-2xl">
              {/* Retro Title with Glow */}
              <motion.div
                className="text-center mb-12"
                initial={{ opacity: 0, y: -50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              >
                {/* Animated Food Icons */}
                <motion.div
                  className="flex justify-center gap-4 mb-4"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <span className="text-5xl">🍕</span>
                  <span className="text-5xl">🍔</span>
                  <span className="text-5xl">🌮</span>
                </motion.div>

                {/* Glowing Title */}
                <h3
                  className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 mb-3"
                  style={{
                    textShadow: '0 0 20px rgba(251, 146, 60, 0.8), 0 0 40px rgba(251, 146, 60, 0.4)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    letterSpacing: '0.05em',
                  }}
                >
                  KITCHEN DODGEBALL
                </h3>

                <p className="text-white/50 text-sm tracking-widest font-mono uppercase">
                  Survive {duration} seconds
                </p>
              </motion.div>

              {/* Difficulty Selector */}
              <motion.div
                className="mb-10 w-full max-w-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-5 text-center font-mono">
                  Select Difficulty
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { id: 'easy',   emoji: '🥗', label: 'Easy',   sub: 'Nice & chill',   color: 'green',  glow: 'rgba(34,197,94,0.5)',   border: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
                    { id: 'medium', emoji: '🌶️', label: 'Medium', sub: 'Getting spicy',  color: 'yellow', glow: 'rgba(234,179,8,0.5)',   border: '#eab308', bg: 'rgba(234,179,8,0.12)'  },
                    { id: 'hard',   emoji: '🔥', label: 'Hard',   sub: 'Pure chaos',     color: 'red',    glow: 'rgba(239,68,68,0.5)',   border: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
                  ] as const).map(({ id, emoji, label, sub, glow, border, bg }) => {
                    const active = selectedDifficulty === id;
                    return (
                      <motion.button
                        key={id}
                        onClick={() => setSelectedDifficulty(id)}
                        whileHover={{ scale: 1.04, y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative flex flex-col items-center gap-1.5 px-4 py-5 rounded-lg border-2 font-mono uppercase tracking-widest transition-colors cursor-pointer"
                        style={{
                          borderColor: active ? border : `${border}33`,
                          background: active ? bg : 'rgba(0,0,0,0.35)',
                          boxShadow: active ? `0 0 28px ${glow}, inset 0 0 16px ${glow}` : 'none',
                          color: active ? border : `${border}66`,
                        }}
                      >
                        <motion.span
                          className="text-4xl"
                          animate={active ? { scale: [1, 1.15, 1], rotate: [-3, 3, -3] } : { scale: 1, rotate: 0 }}
                          transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: 'easeInOut' }}
                        >
                          {emoji}
                        </motion.span>
                        <span className="text-sm font-black">{label}</span>
                        <span className="text-[10px] opacity-70 normal-case tracking-normal">{sub}</span>
                        {active && (
                          <motion.div
                            className="absolute inset-0 rounded-lg pointer-events-none"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            style={{ boxShadow: `inset 0 0 20px ${glow}` }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Start Button - Arcade Style */}
              <motion.button
                onClick={startGame}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="relative px-8 sm:px-16 py-5 bg-gradient-to-b from-pink-500 to-purple-600 text-white text-2xl font-black uppercase border-4 border-pink-300 rounded-lg shadow-[0_0_30px_rgba(236,72,153,0.6)] hover:shadow-[0_0_50px_rgba(236,72,153,0.8)]"
                style={{
                  textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                <motion.span
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ▶ START GAME ◀
                </motion.span>
              </motion.button>

              {/* Controls Info */}
              <motion.div
                className="mt-8 px-6 py-4 bg-black/50 border-2 border-gray-600 rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <p className="text-gray-300 text-sm text-center font-mono">
                  ← → Arrow Keys to Move | ↑ / Space to Jump
                </p>
                <p className="text-gray-400 text-xs text-center font-mono mt-1">
                  Mobile: Touch to move | Tap to jump
                </p>
              </motion.div>

              {/* Cancel Button */}
              {onCancel && (
                <motion.button
                  onClick={onCancel}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-4 px-6 py-2 text-sm text-gray-400 hover:text-red-400 font-mono uppercase tracking-wider transition-colors"
                >
                  [ ESC - CANCEL ]
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Win Screen */}
        {gameState === 'won' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              className="text-6xl mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ type: 'spring', duration: 0.6 }}
            >
              🏆
            </motion.div>
            <h3
              className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 mb-2"
              style={{ textShadow: '0 0 30px rgba(251,191,36,0.6)' }}
            >
              CHEF OF THE YEAR
            </h3>
            <p className="text-white/50 text-sm font-mono uppercase tracking-widest mb-8">
              Kitchen survived — nothing hit you!
            </p>
            <div className="flex gap-3">
              <motion.button
                onClick={() => setGameState('ready')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 border-2 border-white/20 text-white/70 font-mono text-sm uppercase tracking-wider rounded-lg hover:border-white/40 hover:text-white transition-colors"
              >
                Change Difficulty
              </motion.button>
              <motion.button
                onClick={startGame}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-3 bg-gradient-to-b from-yellow-400 to-orange-500 text-black font-black text-sm uppercase tracking-wider rounded-lg shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:shadow-[0_0_30px_rgba(251,191,36,0.7)] transition-shadow"
              >
                Play Again
              </motion.button>
            </div>
          </div>
        )}

        {/* Lose Screen */}
        {gameState === 'lost' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
              className="text-6xl mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1], rotate: [-10, 10, 0] }}
              transition={{ type: 'spring', duration: 0.6 }}
            >
              💥
            </motion.div>
            <h3
              className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-pink-500 mb-2"
              style={{ textShadow: '0 0 30px rgba(239,68,68,0.6)' }}
            >
              FOOD FIGHT LOST
            </h3>
            <p className="text-white/50 text-sm font-mono uppercase tracking-widest mb-8">
              The kitchen won this round
            </p>
            <div className="flex gap-3">
              <motion.button
                onClick={() => setGameState('ready')}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-3 border-2 border-white/20 text-white/70 font-mono text-sm uppercase tracking-wider rounded-lg hover:border-white/40 hover:text-white transition-colors"
              >
                Change Difficulty
              </motion.button>
              <motion.button
                onClick={startGame}
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="px-8 py-3 bg-gradient-to-b from-red-500 to-pink-600 text-white font-black text-sm uppercase tracking-wider rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.7)] transition-shadow"
              >
                Try Again
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-sm text-secondary">
        {gameState === 'ready' && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span>💡 Desktop:</span>
              <kbd className="px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs font-mono shadow-sm">
                ←
              </kbd>
              <kbd className="px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs font-mono shadow-sm">
                →
              </kbd>
              <span>to move,</span>
              <kbd className="px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs font-mono shadow-sm">
                ↑
              </kbd>
              <span>or</span>
              <kbd className="px-2 py-1 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded text-xs font-mono shadow-sm">
                Space
              </kbd>
              <span>to jump</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📱 Mobile: Touch screen to move, tap to jump</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
