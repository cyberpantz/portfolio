import { useState } from 'react';
import { motion } from 'framer-motion';
import KitchenDodgeball from '../../experiments/KitchenDodgeball';

type Screen = 'playing' | 'win' | 'lose';

/**
 * End screens for Fowl Play.
 *
 * Two things were wrong. The screen sat at the top of the stage because the
 * flex parent used `items-start`, which shrinks the child to its content
 * height — so the inner `h-full` resolved against a box only as tall as the
 * text, and `justify-center` centred it inside itself. Letting the child
 * stretch is what makes the centring real.
 *
 * The second was tone. A serif headline with an emoji stapled to it belongs to
 * neither system: the game's own overlays are deliberately loud arcade
 * (gradients, glow, black italics), while the surrounding site is editorial.
 * This is the seam between them, so it commits to the editorial side — the
 * same eyebrow / serif / rule / bordered-button structure the Quizzolator
 * result card uses, and no emoji, for the reason Pattern Match lost its own.
 */
function EndScreen({
  eyebrow,
  title,
  line,
  primary,
  onPrimary,
}: {
  eyebrow: string;
  title: string;
  line: string;
  primary: string;
  onPrimary: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
      className="flex min-h-full flex-col items-center justify-center gap-6 px-5 text-center"
    >
      <p className="text-exp-micro font-medium tracking-[0.2em] uppercase text-fg-muted">
        {eyebrow}
      </p>

      <h2 className="max-w-[16ch] font-serif text-[clamp(38px,6.5vw,84px)] leading-[0.95] tracking-[-0.03em] text-fg">
        {title}
      </h2>

      <p className="max-w-[46ch] text-[clamp(16px,1.5vw,20px)] leading-[1.5] text-exp-bright [text-wrap:pretty]">
        {line}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-rule pt-7">
        <button
          type="button"
          onClick={onPrimary}
          className="inline-flex min-h-11 cursor-pointer items-center gap-3 border border-accent px-7
                     text-exp-micro font-medium tracking-[0.16em] uppercase text-accent
                     transition-colors duration-300 hover:bg-accent hover:text-ink"
        >
          {primary}
          <span aria-hidden="true">→</span>
        </button>

        <a
          href="/explorations"
          className="inline-flex min-h-11 items-center border border-rule-strong px-7 text-exp-micro
                     font-medium tracking-[0.16em] uppercase text-fg-muted transition-colors
                     duration-300 hover:border-fg-muted hover:text-fg"
        >
          All explorations
        </a>
      </div>
    </motion.div>
  );
}

export default function KitchenDodgeballGame() {
  const [screen, setScreen] = useState<Screen>('playing');

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      {/* Header removed — the page's ExpChrome bar already carries the
          back link and the title. */}
      {/* No items-start: the child must stretch, or h-full below has nothing
          to resolve against and the end screens ride at the top. */}
      <div className="flex flex-1 justify-center px-4 pt-6 pb-0">
        <div className="h-full w-full" style={{ minWidth: 800 }}>
          {screen === 'playing' && (
            <KitchenDodgeball
              onWin={() => setScreen('win')}
              onLose={() => setScreen('lose')}
              onCancel={() => {
                window.location.href = '/explorations';
              }}
            />
          )}

          {screen === 'win' && (
            <EndScreen
              eyebrow="Fowl Play"
              title="You survived."
              line="Thirty seconds under a sky of poultry and produce, and the kitchen still stands."
              primary="Play again"
              onPrimary={() => setScreen('playing')}
            />
          )}

          {screen === 'lose' && (
            <EndScreen
              eyebrow="Fowl Play"
              title="The birds win."
              line="Three hits and the shift is over. They were always going to be faster than you."
              primary="Try again"
              onPrimary={() => setScreen('playing')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
