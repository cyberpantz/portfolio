/**
 * Half — figures.
 *
 * Nine chapters, nine forms. Tilt's rule: if two chapters would look the
 * same, one of them is not a chapter. Each drawing here is the one that
 * answers its question and no other — proportional area for size, a shared
 * scale for wealth against giving, a threshold for the payout rule, a
 * timeline for a promise, a grid for what is missing.
 *
 * All SVG, all server-renderable, so the suite can hold every drawing to
 * the data file. No number here is typed: it is read from half.json.
 */
import data from '../../data/half.json';
import s from './half.module.css';

type Person = (typeof data.people)[number];
export const PEOPLE: Person[] = data.people;
export const SUMMARY = data.summary;
export const CONTEXT = data.context;

const B = 1e9;
export const money = (n: number | null | undefined) =>
  n == null ? '—'
  : n >= 1e12 ? `$${(n / 1e12).toFixed(2)}T`
  : n >= 1e9 ? `$${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}B`
  : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M`
  : `$${Math.round(n).toLocaleString('en-US')}`;
const short = (name: string) => name.replace(' Helu', '').replace(' (CZ)', '').replace('Françoise ', '').replace(' Meyers', '');
/**
 * Surname only — for a square or a cell too small for the whole name.
 * Three Waltons and a Chinese name order need saying by hand.
 */
const TIGHT: Record<string, string> = {
  'rob-walton': 'R. Walton', 'jim-walton': 'J. Walton', 'alice-walton': 'A. Walton', 'zhang-yiming': 'Zhang',
};
const surname = (p: { slug: string; name: string }) => {
  if (TIGHT[p.slug]) return TIGHT[p.slug];
  const parts = short(p.name).split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

/* ------------------------------------------------------- 1. the squares */

/**
 * Twenty-five squares, area proportional to wealth, packed in rank order.
 * Area rather than height because a number this size only reads as area —
 * a bar for Musk would leave the other twenty-four as a ruler's ticks.
 */
export function Squares() {
  const W = 720, GAP = 6;
  const max = Math.max(...PEOPLE.map((p) => p.wealth ?? 0));
  const big = 300; // side of the largest square
  const side = (w: number) => big * Math.sqrt((w || 0) / max);
  /* Row-pack greedily; the first square takes its own row. */
  const rows: { p: Person; sd: number }[][] = [];
  let row: { p: Person; sd: number }[] = [], x = 0;
  for (const p of PEOPLE) {
    const sd = side(p.wealth ?? 0);
    if (x + sd > W && row.length) { rows.push(row); row = []; x = 0; }
    row.push({ p, sd }); x += sd + GAP;
  }
  if (row.length) rows.push(row);
  let y = 0;
  const placed: { p: Person; sd: number; x: number; y: number }[] = [];
  for (const r of rows) {
    const h = Math.max(...r.map((c) => c.sd));
    let cx = 0;
    for (const c of r) { placed.push({ ...c, x: cx, y: y + (h - c.sd) }); cx += c.sd + GAP; }
    y += h + GAP;
  }
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${y}`} role="img"
         aria-label={`The wealth of the twenty-five as proportional squares. ${PEOPLE[0].name} alone is ${money(PEOPLE[0].wealth)}.`}>
      {placed.map(({ p, sd, x, y }) => (
        <g key={p.slug} transform={`translate(${x} ${y})`}>
          <rect className={p.rank === 1 ? s.sqTop : s.sq} width={sd} height={sd} rx={sd > 40 ? 4 : 2} />
          {sd > 118 && <text className={p.rank === 1 ? s.sqNameTop : s.sqName} x={8} y={18}>{short(p.name)}</text>}
          {sd <= 118 && sd > 54 && <text className={s.sqName} x={8} y={18}>{surname(p)}</text>}
          {sd > 54 && <text className={p.rank === 1 ? s.sqAmtTop : s.sqAmt} x={8} y={34}>{money(p.wealth)}</text>}
          {sd <= 54 && sd > 28 && <text className={s.sqTiny} x={sd / 2} y={sd / 2 + 4}>{p.rank}</text>}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------ 2. wealth against giving */

/** Paired bars on ONE scale. The giving bar is the point: it is a hairline. */
export function Paired() {
  const rows = PEOPLE.filter((p) => p.coverage.lifetime).sort((a, b) => (b.wealth ?? 0) - (a.wealth ?? 0));
  const W = 720, L = 150, R = 80, H = 30;
  const max = Math.max(...rows.map((p) => p.wealth ?? 0));
  const w = (v: number) => ((W - L - R) * v) / max;
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${rows.length * H + 20}`} role="img"
         aria-label="Wealth and lifetime giving, drawn to the same scale">
      {rows.map((p, i) => {
        const y = 10 + i * H;
        const give = p.lifetime!.amount;
        return (
          <g key={p.slug} transform={`translate(0 ${y})`}>
            <text className={s.lbl} x={0} y={14}>{short(p.name)}</text>
            <rect className={s.barWealth} x={L} y={2} width={w(p.wealth!)} height={8} rx={1} />
            <rect className={s.barGive} x={L} y={12} width={Math.max(1.5, w(give))} height={8} rx={1} />
            <text className={s.val} x={L + w(p.wealth!) + 6} y={10}>{money(p.wealth)}</text>
            <text className={s.valGive} x={L + Math.max(1.5, w(give)) + 6} y={20}>{money(give)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------------- 3. the pledge */

/** Twenty-five marks. Signed is filled, with the year. */
export function Pledge() {
  const COLS = 4, CELL = 180, ROW = 56, W = COLS * CELL;
  const ROWS = Math.ceil(PEOPLE.length / COLS);
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${ROWS * ROW}`} role="img"
         aria-label={`${SUMMARY.pledgers} of the twenty-five have signed the Giving Pledge`}>
      {PEOPLE.map((p, i) => {
        const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * ROW;
        const on = p.pledge.signed === true;
        return (
          <g key={p.slug} transform={`translate(${x} ${y})`}>
            <circle className={on ? s.dotOn : s.dotOff} cx={14} cy={20} r={9} />
            <text className={s.lbl} x={32} y={17}>{short(p.name)}</text>
            <text className={on ? s.sub : s.subOff} x={32} y={33}>
              {on ? `signed ${p.pledge.year ?? ''}` : p.filesUS ? 'not signed' : 'not signed'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ 4. the 5% */

/** Every verified foundation's payout rate on one axis, with the rule drawn. */
export function Payout() {
  const rows = PEOPLE
    .filter((p) => p.foundation?.status === 'primary' && !p.foundation.notHis && !p.foundation.operating && p.foundation.payoutRate != null)
    .sort((a, b) => a.foundation!.payoutRate! - b.foundation!.payoutRate!);
  const W = 720, L = 150, R = 30, H = 26, TOP = 30;
  const max = 20; // per cent; Brin at 16.8 is the largest
  const x = (v: number) => L + ((W - L - R) * Math.min(v, max)) / max;
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${TOP + rows.length * H + 10}`} role="img"
         aria-label="Foundation payout as a share of assets, against the five per cent minimum">
      <line className={s.rule} x1={x(5)} x2={x(5)} y1={12} y2={TOP + rows.length * H} />
      <text className={s.ruleLbl} x={x(5) + 5} y={10}>5% — the legal minimum</text>
      {[0, 5, 10, 15, 20].map((t) => <text key={t} className={s.tick} x={x(t)} y={TOP + rows.length * H + 8}>{t}%</text>)}
      {rows.map((p, i) => {
        const y = TOP + i * H + 13, v = p.foundation!.payoutRate!, over = v > max;
        return (
          <g key={p.slug}>
            <text className={s.lbl} x={0} y={y + 4}>{short(p.name)}</text>
            <line className={s.stem} x1={L} x2={x(v)} y1={y} y2={y} />
            <circle className={v < 5 ? s.dotUnder : s.dotOver} cx={x(v)} cy={y} r={5} />
            {/* Past the axis: the label goes inside, with an arrow, rather
                than off the drawing. Buffett's foundation is a pass-through
                and pays out most of what it holds. */}
            {over
              ? <text className={s.valEnd} x={x(v) - 10} y={y + 4}>{v.toFixed(1)}% ▸</text>
              : <text className={s.val} x={x(v) + 10} y={y + 4}>{v.toFixed(1)}%</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------- 5. the year they reach half */

/** At the latest year's rate, the year each would have given away half. */
export function Horizon() {
  const now = Number(data.built.slice(0, 4));
  const rows = PEOPLE
    .filter((p) => p.derived.yearsToHalf != null && p.derived.yearsToHalf > 0)
    .map((p) => ({ p, year: now + p.derived.yearsToHalf! }))
    .sort((a, b) => a.year - b.year);
  const W = 720, L = 150, R = 60, H = 24, TOP = 26;
  const maxYear = Math.max(...rows.map((r) => r.year));
  const x = (yr: number) => L + ((W - L - R) * Math.log10(1 + yr - now)) / Math.log10(1 + maxYear - now);
  const ticks = [1, 10, 100, 1000].filter((t) => t <= maxYear - now);
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${TOP + rows.length * H + 14}`} role="img"
         aria-label="The year each would have given away half, at their latest year's rate">
      <line className={s.axis} x1={L} x2={W - R} y1={TOP - 8} y2={TOP - 8} />
      {ticks.map((t) => (
        <g key={t}>
          <line className={s.tickLine} x1={x(now + t)} x2={x(now + t)} y1={TOP - 12} y2={TOP - 4} />
          <text className={s.tick} x={x(now + t)} y={TOP - 14}>{now + t}</text>
        </g>
      ))}
      {rows.map(({ p, year }, i) => {
        const y = TOP + i * H + 12;
        return (
          <g key={p.slug}>
            <text className={s.lbl} x={0} y={y + 4}>{short(p.name)}</text>
            <line className={s.stem} x1={L} x2={x(year)} y1={y} y2={y} />
            <circle className={year - now > 100 ? s.dotUnder : s.dotOver} cx={x(year)} cy={y} r={4.5} />
            <text className={s.val} x={x(year) + 9} y={y + 4}>{year}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------------------------- 6. how it stays home */

/** Three mechanisms, each a small diagram with its named case. */
export function Mechanisms() {
  const pick = (m: string) => CONTEXT.shelters.find((x) => x.mechanism === m && x.inTop25 && x.status !== 'needs-check');
  const daf = pick('daf'), llc = pick('llc'), rel = pick('related-party');
  const Card = ({ title, children, caption }: { title: string; children: React.ReactNode; caption?: string }) => (
    <figure className={s.card}>
      <svg viewBox="0 0 200 90" className={s.cardSvg} aria-hidden="true">{children}</svg>
      <figcaption><b>{title}</b>{caption && <span>{caption}</span>}</figcaption>
    </figure>
  );
  return (
    <div className={s.cards}>
      <Card title="The donor-advised fund" caption={daf ? `${daf.case.split(' — ')[0]}: ${daf.finding.slice(0, 120)}…` : undefined}>
        {/* money goes in; the box has no outlet */}
        <rect className={s.cBox} x={70} y={20} width={60} height={50} rx={4} />
        <line className={s.cArrow} x1={10} y1={45} x2={64} y2={45} markerEnd="url(#h-arrow)" />
        <text className={s.cLbl} x={100} y={49}>DAF</text>
        <text className={s.cNote} x={140} y={49}>no outlet</text>
      </Card>
      <Card title="The charitable LLC" caption={llc ? `${llc.case.split(' (')[0]}: ${llc.finding.slice(0, 120)}…` : undefined}>
        {/* a box with no window: nothing is disclosed */}
        <rect className={s.cBoxSolid} x={60} y={15} width={80} height={60} rx={4} />
        <text className={s.cLblInv} x={100} y={49}>LLC</text>
        <text className={s.cNote} x={100} y={86}>no filing, no window</text>
      </Card>
      <Card title="The related party" caption={rel ? `${rel.case.split(' (')[0]}: ${rel.finding.slice(0, 120)}…` : undefined}>
        {/* a loop back to where it came from */}
        <circle className={s.cRing} cx={100} cy={45} r={30} />
        <line className={s.cArrow} x1={100} y1={15} x2={100} y2={15} />
        <text className={s.cLbl} x={100} y={49}>back</text>
        <text className={s.cNote} x={100} y={86}>to the donor's own interests</text>
      </Card>
      <svg width="0" height="0" aria-hidden="true">
        <defs><marker id="h-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9d9d95" /></marker></defs>
      </svg>
    </div>
  );
}

/* --------------------------------------------- 7. the men who invented it */

/** Buffett and Gates, 2010 to July 2026, in their own words. */
/** Break a line of text into tspans at roughly `width` characters. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > width && line) { out.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

export function Founders() {
  const items = CONTEXT.backlash
    /* Their own statements only — a write-up of one is cited in the prose
       instead, so the timeline is never quoting a paraphrase as a quote. */
    .filter((b) => /^(Warren Buffett|Bill Gates)$/.test(b.who) && b.status !== 'needs-check')
    .map((b) => ({ ...b, year: Number(b.when.slice(0, 4)), m: Number(b.when.slice(5, 7) || 6) }))
    .sort((a, b) => a.year + a.m / 12 - (b.year + b.m / 12));
  const W = 720, L = 20, R = 20, TOP = 30, ROW = 74;
  const y0 = 2010, y1 = 2027;
  const x = (yr: number, m = 6) => L + ((W - L - R) * (yr + m / 12 - y0)) / (y1 - y0);
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${TOP + items.length * ROW + 30}`} role="img"
         aria-label="Buffett and Gates on the Pledge, from its founding to July 2026">
      <line className={s.axis} x1={L} x2={W - R} y1={TOP - 10} y2={TOP - 10} />
      {[2010, 2015, 2020, 2025].map((yr) => <text key={yr} className={s.tick} x={x(yr, 0)} y={TOP - 16}>{yr}</text>)}
      <g>
        <circle className={s.dotOver} cx={x(2010, 8)} cy={TOP - 10} r={4} />
        <text className={s.sub} x={x(2010, 8) + 8} y={TOP - 4}>The Pledge founded</text>
      </g>
      {items.map((b, i) => {
        const yy = TOP + 16 + i * ROW;
        /* The quoted span if the record carries one, else the statement's
           opening — either way cut to two lines so it stays inside. */
        /* Double quotes delimit; a curly apostrophe inside is part of it. */
        const q = b.what.match(/[“"]([^”"]{20,220})[”"]/)?.[1] ?? b.what.match(/'([^']{20,220})'/)?.[1];
        const lines = wrap(q ? `“${q}”` : b.what, 96).slice(0, 2);
        return (
          <g key={i}>
            <line className={s.tickLine} x1={x(b.year, b.m)} x2={x(b.year, b.m)} y1={TOP - 10} y2={yy} />
            <circle className={/Buffett/.test(b.who) ? s.dotUnder : s.dotOver} cx={x(b.year, b.m)} cy={yy} r={4.5} />
            <text className={s.lbl} x={L} y={yy + 20}>{b.who} · {b.when}</text>
            <text className={s.quote} x={L} y={yy + 36}>
              {lines.map((ln, k) => <tspan key={k} x={L} dy={k ? 15 : 0}>{ln}{k === 1 && lines.length === 2 && !ln.endsWith('”') ? '…' : ''}</tspan>)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ 8. the score */

/** Forbes' 1–5 philanthropy score across the twenty-five. */
export function Scores() {
  const counts = [1, 2, 3, 4, 5].map((k) => ({ k, n: (SUMMARY.scores as Record<string, number>)[k] ?? 0 }));
  const W = 720, H = 200, L = 40, BW = 100, GAP = 30;
  const max = Math.max(...counts.map((c) => c.n), 1);
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${H + 40}`} role="img"
         aria-label={`Forbes philanthropy scores: ${counts.map((c) => `${c.n} scored ${c.k}`).join(', ')}`}>
      {counts.map((c, i) => {
        const x = L + i * (BW + GAP), h = (H * c.n) / max;
        return (
          <g key={c.k}>
            <rect className={c.n ? s.col : s.colEmpty} x={x} y={H - h} width={BW} height={Math.max(h, 2)} rx={3} />
            <text className={s.colVal} x={x + BW / 2} y={H - h - 8}>{c.n}</text>
            <text className={s.colLbl} x={x + BW / 2} y={H + 20}>score {c.k}</text>
            <text className={s.colSub} x={x + BW / 2} y={H + 34}>
              {['under 1% given', '1–4.99%', '5–9.99%', '10–19.99%', '20% or more'][i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------------------------------------------- 9. what cannot be seen */

/** Person by field: what is on the record and what is not. */
export function Coverage() {
  const cols: [keyof Person['coverage'], string][] = [
    ['wealth', 'wealth'], ['pledge', 'pledge'], ['lifetime', 'lifetime giving'], ['filing', 'a filing read'], ['political', 'political giving'],
  ];
  const W = 720, L = 190, CW = (W - L) / cols.length, RH = 22, TOP = 26;
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${TOP + PEOPLE.length * RH}`} role="img"
         aria-label="For each person, which figures are on the record">
      {cols.map(([, label], j) => <text key={label} className={s.colHead} x={L + j * CW + CW / 2} y={12}>{label}</text>)}
      {PEOPLE.map((p, i) => {
        const y = TOP + i * RH;
        return (
          <g key={p.slug}>
            <text className={p.filesUS ? s.lbl : s.lblMute} x={0} y={y + 14}>{short(p.name)}</text>
            {cols.map(([k], j) => (
              <rect key={k} className={p.coverage[k] ? s.cellOn : s.cellOff}
                    x={L + j * CW + 4} y={y + 3} width={CW - 8} height={RH - 6} rx={2} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
