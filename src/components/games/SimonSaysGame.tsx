import { useState } from 'react';
import SimonSays from '../../experiments/SimonSays';

type Screen = 'playing' | 'win' | 'lose';
type Difficulty = 'easy' | 'hard' | 'super-hard';

const DIFFICULTY_META: Record<Difficulty, { name: string; detail: string }> = {
  'easy':       { name: 'Easy',   detail: '4-round sequence' },
  'hard':       { name: 'Hard',   detail: '6-round sequence' },
  'super-hard': { name: 'Insane', detail: '9-round sequence' },
};

export default function SimonSaysGame() {
  const [screen, setScreen] = useState<Screen>('playing');
  const [wonDifficulty, setWonDifficulty] = useState<Difficulty | null>(null);

  return (
    <div className="min-h-screen bg-ink flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-rule flex-shrink-0">
        <a href="/explorations" className="font-mono text-[11px] text-fg-muted tracking-[0.08em] hover:text-fg transition-colors">
          ← back
        </a>
        <span className="font-mono text-[11px] text-fg-muted tracking-[0.08em] uppercase">Pattern Match</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full" style={{ maxWidth: 1200 }}>
          {screen === 'playing' && (
            <SimonSays
              onWin={(difficulty) => { setWonDifficulty(difficulty); setScreen('win'); }}
              onLose={() => setScreen('lose')}
              onCancel={() => { window.location.href = '/explorations'; }}
            />
          )}

          {screen === 'win' && (
            <div className="text-center">
              <div className="font-mono text-[10px] tracking-[0.3em] text-fg-muted uppercase mb-10">
                Pattern Match — Complete
              </div>
              <div className="font-serif text-5xl text-fg mb-3">
                Sequence cleared.
              </div>
              {wonDifficulty && (
                <div className="font-mono text-[11px] tracking-[0.15em] text-fg-muted mb-10">
                  {DIFFICULTY_META[wonDifficulty].name} &middot; {DIFFICULTY_META[wonDifficulty].detail}
                </div>
              )}
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setScreen('playing')}
                  className="font-mono text-[11px] text-accent border border-accent/30 px-5 py-2.5 rounded-sm hover:bg-accent/10 transition-colors"
                >
                  play again
                </button>
                <a href="/explorations" className="font-mono text-[11px] text-fg-sub border border-rule-strong px-5 py-2.5 rounded-sm hover:text-fg transition-colors">
                  all explorations
                </a>
              </div>
            </div>
          )}

          {screen === 'lose' && (
            <div className="text-center">
              <div className="font-serif text-4xl text-fg mb-4">Better luck next time.</div>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => setScreen('playing')}
                  className="font-mono text-[11px] text-accent border border-accent/30 px-5 py-2.5 rounded-sm hover:bg-accent/10 transition-colors"
                >
                  try again
                </button>
                <a href="/explorations" className="font-mono text-[11px] text-fg-sub border border-rule-strong px-5 py-2.5 rounded-sm hover:text-fg transition-colors">
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
