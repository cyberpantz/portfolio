import { useRef } from 'react';
import type { ScenarioId } from '../scripts/types';
import a from './apparatus.module.css';

/**
 * Two scenarios, side by side, both visible at rest.
 *
 * The menu that preceded this is still in ScenarioMenu.tsx and still
 * works; it was replaced rather than out-argued. The honest difference
 * is disclosure. A menu shows one option and hides the other behind a
 * click, which is right when a list is long or the alternatives are
 * uninteresting. With exactly two, and where the SECOND one is the whole
 * argument — that this is an engine and not a stylesheet — hiding it
 * behind a chevron buries the point. Tabs put the claim on screen
 * before anyone interacts.
 *
 * They double as the heading. A tab bar plus a separate title would say
 * the same words twice, which is the problem the menu already had.
 *
 * MANUAL ACTIVATION, deliberately. The ARIA pattern allows arrow keys to
 * select as they move, and that is right when switching is free. Here it
 * throws away the conversation you are in the middle of — so arrows move
 * focus and Enter or Space commits, which is the pattern's own advice
 * for panels that are expensive to swap.
 */
export function ScenarioTabs({
  value,
  options,
  onChange,
  panelId,
}: {
  value: ScenarioId;
  options: { id: ScenarioId; label: string }[];
  onChange: (id: ScenarioId) => void;
  /** The region these tabs govern, for `aria-controls`. */
  panelId: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  /* One scenario is not a choice — the same rule the menu followed. */
  if (options.length < 2) {
    return <b className={a.wallTitle}>{options[0]?.label}</b>;
  }

  const move = (from: number, delta: number) => {
    const to = (from + delta + options.length) % options.length;
    refs.current[to]?.focus();
  };

  return (
    <div className={a.scenarioTabs} role="tablist" aria-label="Scenario">
      {options.map((o, i) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`sb-tab-${o.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            /*
             * Roving tabindex: one stop for the whole set, so Tab moves
             * past the bar rather than through it. Without this a
             * keyboard user pays a tab stop per scenario forever.
             */
            tabIndex={selected ? 0 : -1}
            className={a.scenarioTab}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                refs.current[0]?.focus();
              } else if (e.key === 'End') {
                e.preventDefault();
                refs.current[options.length - 1]?.focus();
              }
              // Enter and Space need no handler: a <button> already
              // fires click on both, which is the commit.
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
