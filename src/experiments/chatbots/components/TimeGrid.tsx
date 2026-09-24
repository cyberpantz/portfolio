import type { GridTime } from '../scripts/types';
import s from './product.module.css';

/**
 * Days across, times down.
 *
 * The chip scheduler answers "when is the next one?" — two options, read
 * in a second, decided in two. This answers a different question: "what
 * does the week look like?" And a shape is the one thing a row of chips
 * cannot show. Which day is busy, where the gaps fall, that tomorrow
 * morning is gone entirely — all of that is structure, and structure
 * needs a table.
 *
 * Taken slots are drawn rather than omitted. An empty column and a full
 * one are different facts, and a grid that silently drops what is gone
 * makes a booked-out day look like a day with nothing scheduled.
 *
 * ACCESSIBILITY. It is a real table: the day is a column header, so a
 * screen reader announcing a cell says which day it belongs to without
 * the visitor having to track it. Unavailable times are `disabled`
 * buttons rather than plain text, so they stay out of the tab order but
 * keep their accessible name — "7:20pm, unavailable" is information, and
 * a bare struck-through string is not.
 */
export function TimeGrid({
  title,
  days,
  onPick,
  chosen,
}: {
  title: string;
  days: { label: string; note?: string; times: GridTime[] }[];
  onPick: (t: GridTime, day: string) => void;
  chosen?: string;
}) {
  const settled = chosen != null;
  // Columns are ragged in the data; the table must not be.
  const rows = Math.max(...days.map((d) => d.times.length));

  return (
    <div className={`${s.card} ${s.gridCard}`} data-card>
      <p className={s.cardTitle}>{title}</p>
      <table className={s.grid}>
        <thead>
          <tr>
            {days.map((d) => (
              <th key={d.label} scope="col">
                <span className={s.gridDay}>{d.label}</span>
                {d.note && <span className={s.gridNote}>{d.note}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {days.map((d) => {
                const t = d.times[r];
                if (!t) return <td key={d.label} />;
                const taken = settled && t.label === chosen;
                return (
                  <td key={d.label}>
                    <button
                      type="button"
                      className={s.gridTime}
                      disabled={t.gone || settled}
                      data-gone={t.gone ? '1' : undefined}
                      data-state={settled ? (taken ? 'taken' : 'passed') : undefined}
                      /* The label alone reads as a time floating free of
                         its column once focus lands on it. */
                      aria-label={`${t.label}, ${d.label}${t.gone ? ', unavailable' : ''}`}
                      onClick={() => onPick(t, d.label)}
                    >
                      {t.label}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
