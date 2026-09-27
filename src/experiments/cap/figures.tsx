/**
 * The Cap — figures.
 *
 * One drawing, used seven ways. A row is an income. A cell is a payday.
 * A cell is inked while Social Security tax is coming out of it and hollow
 * once it is not. Read down a ladder of incomes and the inked region falls
 * away from the right into a cliff — which is the cap, as a shape, and the
 * reason the piece needs no legend.
 *
 * SVG throughout: crisp at any size, renderable on the server, and so
 * testable without a browser. Nothing here needs a canvas.
 */
import { useState } from 'react';
import data from '../../data/cap.json';
import s from './cap.module.css';

const LAW = data.law;
const N = LAW.payPeriods;

export type Row = {
  id: string;
  label: string;
  income: number;
  /** Payday on which the tax stops — null is never. */
  stopPayday: number | null;
  /** Read-out at the right edge. */
  stop: string;
  /** No cells at all: the income is not wages. */
  noWages?: boolean;
  you?: boolean;
  /** Something to say under the label. */
  sub?: string;
};

export const money = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M`
  : `$${Math.round(n).toLocaleString('en-US')}`;

/** The pure maths, exported so the tests can hold it to the data file. */
export function stopPayday(income: number): number | null {
  return income <= LAW.wageBase ? null : Math.ceil((LAW.wageBase / income) * N);
}
export function stopDay(income: number): number | null {
  return income <= LAW.wageBase ? null : Math.ceil((LAW.wageBase / income) * 365);
}
export function stopDate(income: number): string | null {
  const d = stopDay(income);
  if (d === null) return null;
  return new Date(Date.UTC(LAW.year, 0, d))
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
export function socialSecurity(income: number): number {
  return Math.min(income, LAW.wageBase) * LAW.socialSecurityRate;
}

/** Share of income Social Security actually takes — 6.2% until the base,
    falling from there. The second thing the cap does. */
export function shareOfIncome(income: number): string {
  const r = income > 0 ? (socialSecurity(income) / income) * 100 : 0;
  return `${r >= 1 ? r.toFixed(r % 1 ? 1 : 0) : r.toFixed(2)}% of income`;
}

export function rowFor(income: number, label: string, extra: Partial<Row> = {}): Row {
  const p = stopPayday(income);
  return {
    id: extra.id ?? label,
    label,
    income,
    stopPayday: p,
    stop: p === null ? 'never' : stopDate(income)!,
    sub: shareOfIncome(income),
    ...extra,
  };
}

/* The named ladder, from the data file — the figures the prose quotes. */
const NAMED: Record<string, string> = {
  minimum: 'Minimum wage', average: 'Average wage', base: 'The base', twice: 'Twice the base',
};
export const LADDER: Row[] = data.ladder.map((r) =>
  rowFor(r.income, NAMED[r.id] ? `${NAMED[r.id]} · ${money(r.income)}` : money(r.income), { id: r.id }));

/* ------------------------------------------------------------ the strip */

const CELL = 22, GAP = 4, ROW = 44, LEFT = 214, RIGHT = 100;
const W = LEFT + N * (CELL + GAP) - GAP + RIGHT;
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Rows of paydays.
 *
 * `wall` draws a vertical rule at the base — the payday a given income
 * crosses it — so the wall can be introduced once and then stay while the
 * ladder grows around it.
 */
export function Strip({ rows, wall, title }: { rows: Row[]; wall?: number | null; title: string }) {
  const H = 22 + rows.length * ROW + 4;
  return (
    <svg className={s.strip} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      {/* Month ticks along the top — twelve labels over twenty-six cells,
          placed at each month's share of the year rather than at cells. */}
      {MONTHS.map((m, i) => (
        <text key={i} className={s.month}
              x={LEFT + ((i + 0.5) / 12) * (N * (CELL + GAP) - GAP)} y={12}>{m}</text>
      ))}
      {rows.map((r, ri) => {
        const y = 22 + ri * ROW;
        return (
          <g key={r.id} transform={`translate(0 ${y})`}>
            <text className={r.you ? s.youText : s.label} x={0} y={16}>
              {r.you ? `${r.label} · ${money(r.income)}` : r.label}
            </text>
            <text className={s.amount} x={0} y={31}>{r.sub}</text>
            {Array.from({ length: N }, (_, i) => {
              const x = LEFT + i * (CELL + GAP);
              if (r.noWages) {
                return <rect key={i} className={s.cellNone} x={x + 0.5} y={4.5} width={CELL - 1} height={CELL - 1} rx={3} />;
              }
              const on = r.stopPayday === null || i < r.stopPayday;
              const cls = !on ? s.cellOff : r.you ? s.cellYou : s.cellOn;
              return (
                <rect key={i} className={cls} x={x} y={4} width={CELL} height={CELL} rx={3}
                      style={on ? { animationDelay: `${i * 28}ms` } : undefined} />
              );
            })}
            <text className={r.stop === 'never' ? s.stopNever : s.stop}
                  x={W - 4} y={20}>{r.noWages ? '—' : r.stop}</text>
          </g>
        );
      })}
      {wall != null && (
        <line className={s.wall}
              x1={LEFT + wall * (CELL + GAP) - GAP / 2} x2={LEFT + wall * (CELL + GAP) - GAP / 2}
              y1={20} y2={H - 2} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------ chapters */

const avg = LADDER.find((r) => r.id === 'average')!;
const base = LADDER.find((r) => r.id === 'base')!;
const twice = LADDER.find((r) => r.id === 'twice')!;

/** One income, every payday taxed. */
export function ChapterEvery() {
  return <Strip rows={[avg]} title="The average wage: Social Security tax on every payday of the year" />;
}

/** The base, and twice the base. The wall appears. */
export function ChapterWall() {
  return (
    <Strip rows={[avg, base, twice]} wall={twice.stopPayday}
           title="At twice the base, Social Security tax stops in July" />
  );
}

/** The full ladder: the cliff. */
export function ChapterCliff({ you }: { you?: Row }) {
  const rows = you ? insert(LADDER, you) : LADDER;
  return <Strip rows={rows} title="Social Security tax by income: the higher the income, the earlier it stops" />;
}

/** Musk: no wages, then the one year there were. */
export function ChapterNoWages() {
  const m = data.musk;
  const rows: Row[] = [
    LADDER.find((r) => r.id === 'ten-million')!,
    {
      id: 'musk-salary', label: 'Musk, salary', income: m.salary, stopPayday: null, stop: '—',
      noWages: true, sub: `$0 since ${m.salarySince}`,
    },
    {
      id: 'musk-2021', label: `Musk, ${m.in2021.year}`, income: m.exercise.taxPaid, stopPayday: m.in2021.stopPayday,
      stop: 'first payday', sub: `options exercised`,
    },
  ];
  return <Strip rows={rows} title="Musk takes no salary, so there is nothing for the tax to stop on. The one year there was, it stopped on the first payday." />;
}

/** Ten years: 260 paydays against 12 tranches. */
export function ChapterClocks() {
  const p = data.musk.package;
  const paydays = p.workerPaydays;
  const cols = 52, cell = 10, gap = 3;
  const w = cols * (cell + gap);
  const rows = Math.ceil(paydays / cols);
  const h = rows * (cell + gap);
  return (
    <div className={s.clocks}>
      <div className={s.clock}>
        <div className={s.clockHead}><span>Minimum wage, {p.years} years</span><b>{paydays} paydays</b></div>
        <svg className={s.strip} viewBox={`0 0 ${w} ${h}`} role="img"
             aria-label={`${paydays} paydays over ${p.years} years, each with tax taken`}>
          {Array.from({ length: paydays }, (_, i) => (
            <rect key={i} className={s.cellOn} x={(i % cols) * (cell + gap)} y={Math.floor(i / cols) * (cell + gap)}
                  width={cell} height={cell} rx={2} style={{ animationDelay: `${i * 4}ms` }} />
          ))}
        </svg>
      </div>
      <div className={s.clock}>
        <div className={s.clockHead}><span>The 2025 package, {p.years} years</span><b>{p.tranches} vests</b></div>
        <svg className={s.strip} viewBox={`0 0 ${w} ${cell + gap}`} role="img"
             aria-label={`${p.tranches} vesting tranches over ${p.years} years`}>
          {Array.from({ length: p.tranches }, (_, i) => (
            <rect key={i} className={s.cellOn} x={(i / p.tranches) * w} y={0} width={cell} height={cell} rx={2}
                  style={{ animationDelay: `${600 + i * 60}ms` }} />
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Three published rates, and the denominator that made each. */
export function ChapterRates({ you }: { you?: { rate: number } }) {
  const [pick, setPick] = useState(data.rates[0].id);
  const r = data.rates.find((x) => x.id === pick)!;
  const max = 35;
  const bar = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className={s.rates}>
      <div className={s.ratesHead}>
        <label htmlFor="cap-denominator">Rate as a share of</label>
        <select id="cap-denominator" value={pick} onChange={(e) => setPick(e.target.value)}>
          {data.rates.map((x) => <option key={x.id} value={x.id}>{x.denominator} · {x.period}</option>)}
        </select>
      </div>
      <div className={s.rateRow}>
        <span>{r.label}</span>
        <div className={s.rateBar}><i style={{ width: bar(r.rate) }} /></div>
        <b>{r.rate}%</b>
      </div>
      {'middle' in r && r.middle && (
        <div className={s.rateRow}>
          <span>{r.middle.label}</span>
          <div className={s.rateBar}><i style={{ width: bar(r.middle.rate) }} /></div>
          <b>{r.middle.rate}%</b>
        </div>
      )}
      {you && (
        <div className={`${s.rateRow} ${s.you}`}>
          <span>You, payroll only</span>
          <div className={s.rateBar}><i style={{ width: bar(you.rate) }} /></div>
          <b>{you.rate}%</b>
        </div>
      )}
      {'lowest' in r && r.lowest && (
        <div className={s.rateRow}>
          <span>{r.lowest.label}</span>
          <div className={s.rateBar}><i style={{ width: bar(r.lowest.rate) }} /></div>
          <b>{r.lowest.rate}%</b>
        </div>
      )}
      {'note' in r && r.note && <p className={s.rateNote}>{r.note}</p>}
    </div>
  );
}

/** Slot the reader's row into the ladder by income. */
function insert(ladder: Row[], you: Row): Row[] {
  const out = [...ladder];
  let i = out.findIndex((r) => r.income > you.income);
  if (i < 0) i = out.length;
  out.splice(i, 0, you);
  return out;
}
