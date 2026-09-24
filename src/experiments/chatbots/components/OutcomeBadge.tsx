import type { Scenario } from '../scripts/types';
import type { StripState } from '../director/useDirector';
import s from './product.module.css';

/**
 * The outcome, once there is one. Nothing before that.
 *
 * This replaces a persistent narrowing strip that was drawn three times
 * and read as furniture every time — first as bordered icon cards
 * (buttons), then as a horizontal row with an accent rule (tabs), then as
 * a list with a counter (still chrome). Three redraws is the signal that
 * the element was wrong rather than its styling.
 *
 * The narrowing was never information the screen had to carry: the
 * conversation says which options are out, in sentences, at the moment it
 * rules them out. A permanent scoreboard restated that in a weaker form
 * and spent the top of the device doing it.
 *
 * So: empty for the whole conversation, then one badge when the answer
 * exists. An arrival rather than a readout — and the only moment worth
 * marking is the one where the question is settled.
 */
export function OutcomeBadge({
  scenario,
  strip,
}: {
  scenario: Scenario;
  strip: StripState;
}) {
  // Tempo-1 safety withdraws everything. Not dimmed — gone.
  if (strip.withdrawn || !strip.win) return null;

  const won = scenario.options.find((o) => o.id === strip.win);
  if (!won) return null;

  return (
    <div
      className={s.badgeBar}
      role="status"
      aria-label={`${scenario.stripLabel}: ${won.label}.`}
    >
      <span className={s.badge} aria-hidden="true">
        {won.label}
      </span>
    </div>
  );
}
