import { useState } from 'react';
import KitchenDodgeball from '../../experiments/KitchenDodgeball';

type Screen = 'playing' | 'win' | 'lose';

export default function KitchenDodgeballGame() {
  const [screen, setScreen] = useState<Screen>('playing');

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      {/* Header removed — the page's ExpChrome bar already carries the
          back link and the title. */}
      <div className="flex-1 flex items-start justify-center px-4 pt-6 pb-0">
        <div className="w-full h-full" style={{ minWidth: 800 }}>
          {screen === 'playing' && (
            <KitchenDodgeball
              onWin={() => setScreen('win')}
              onLose={() => setScreen('lose')}
              onCancel={() => { window.location.href = '/explorations'; }}
            />
          )}

          {screen === 'win' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="font-serif text-4xl text-fg mb-4">You survived! 🍳</div>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setScreen('playing')}
                  className="font-mono text-[11px] text-accent border border-accent/30 px-5 py-2.5 rounded-xs hover:bg-accent/10 transition-colors"
                >
                  play again
                </button>
                <a href="/explorations" className="font-mono text-[11px] text-fg-sub border border-rule-strong px-5 py-2.5 rounded-xs hover:text-fg transition-colors">
                  all explorations
                </a>
              </div>
            </div>
          )}

          {screen === 'lose' && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="font-serif text-4xl text-fg mb-4">You got hit! 💥</div>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setScreen('playing')}
                  className="font-mono text-[11px] text-accent border border-accent/30 px-5 py-2.5 rounded-xs hover:bg-accent/10 transition-colors"
                >
                  try again
                </button>
                <a href="/explorations" className="font-mono text-[11px] text-fg-sub border border-rule-strong px-5 py-2.5 rounded-xs hover:text-fg transition-colors">
                  all explorations
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
