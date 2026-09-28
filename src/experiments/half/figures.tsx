/**
 * Half — figures.
 *
 * One form per chapter. Tilt's rule: if two chapters would look the
 * same, one of them is not a chapter. Each drawing here is the one that
 * answers its question and no other — packed area for size, a shared
 * scale for wealth against giving, a threshold for the payout rule, a
 * timeline for a promise, a grid for what is missing.
 *
 * All SVG, all server-renderable, so the suite can hold every drawing to
 * the data file. No number here is typed: it is read from half.json.
 */
import data from '../../data/half.json';
import { hierarchy, pack } from 'd3';
import { useState } from 'react';
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
 * Surname only — for a circle or a cell too small for the whole name.
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

/* ------------------------------------------------ 1. the wealth circle pack */

/**
 * Twenty-five circles, area proportional to wealth, packed by D3. React still
 * owns the SVG so the figure remains server-renderable and accessible.
 */
export function WealthPack() {
  const W = 720, H = 620, FOOT = 28;
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  type PackDatum = Person | { children: Person[] };
  const root = hierarchy<PackDatum>(
    { children: PEOPLE },
    (d) => 'children' in d ? d.children : undefined,
  )
    .sum((d) => 'wealth' in d ? d.wealth ?? 0 : 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const leaves = pack<PackDatum>().size([W, H]).padding(5)(root).leaves();
  const selected = pinned ?? hovered;
  const selectedLeaf = leaves.find(({ data: datum }) => (datum as Person).slug === selected);

  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${H + FOOT}`} role="img"
         aria-label={`The wealth of the twenty-five as proportional circles. Circle area represents fortune. ${PEOPLE[0].name} alone is ${money(PEOPLE[0].wealth)}.`}>
      {leaves.map(({ data: datum, r, x, y }) => {
        const p = datum as Person;
        const isSelected = selected === p.slug;
        return (
        <g key={p.slug}
           className={`${s.bubbleGroup} ${selected && !isSelected ? s.bubbleMuted : ''}`}
           transform={`translate(${x} ${y})`}
           role="button" tabIndex={0} aria-pressed={pinned === p.slug}
           aria-label={`${p.name}, rank ${p.rank}, ${money(p.wealth)}, ${((p.wealth! / SUMMARY.totalWealth) * 100).toFixed(1)} per cent of this group's wealth${p.pledge.signed ? ', Giving Pledge signatory' : ''}`}
           onPointerEnter={() => setHovered(p.slug)}
           onPointerLeave={() => setHovered(null)}
           onFocus={() => setHovered(p.slug)}
           onBlur={() => setHovered(null)}
           onPointerDown={() => setPinned((current) => current === p.slug ? null : p.slug)}
           onKeyDown={(event) => {
             if (event.key === 'Enter' || event.key === ' ') {
               event.preventDefault();
               setPinned((current) => current === p.slug ? null : p.slug);
             }
           }}>
          <circle className={p.rank === 1 ? s.bubbleTop : s.bubble} r={r} />
          <text className={p.rank === 1 ? s.bubbleNameTop : s.bubbleName} y={-4}>
            {r > 68 ? short(p.name) : surname(p)}
          </text>
          <text className={p.rank === 1 ? s.bubbleAmtTop : s.bubbleAmt} y={14}>{money(p.wealth)}</text>
        </g>
        );
      })}
      {selectedLeaf && (() => {
        const p = selectedLeaf.data as Person;
        const width = 224, height = 62;
        const x = Math.max(8, Math.min(W - width - 8, selectedLeaf.x < W / 2
          ? selectedLeaf.x + selectedLeaf.r * 0.62
          : selectedLeaf.x - selectedLeaf.r * 0.62 - width));
        const y = Math.max(8, Math.min(H - height - 8, selectedLeaf.y - height / 2));
        return (
          <g className={s.bubbleDetail} transform={`translate(${x} ${y})`} aria-hidden="true">
            <rect width={width} height={height} rx={4} />
            <text className={s.bubbleDetailName} x={13} y={20}>#{p.rank} · {p.name}</text>
            <text className={s.bubbleDetailStat} x={13} y={41}>
              {money(p.wealth)} · {((p.wealth! / SUMMARY.totalWealth) * 100).toFixed(1)}% of the twenty-five
            </text>
            <text className={s.bubbleDetailPledge} x={13} y={55}>
              {p.pledge.signed ? `Giving Pledge signatory${p.pledge.year ? ` since ${p.pledge.year}` : ''}` : 'Has not signed the Giving Pledge'}
            </text>
          </g>
        );
      })()}
      <text className={s.bubbleHint} x={W / 2} y={H + 21}>Hover, focus or tap to inspect · tap again to release</text>
    </svg>
  );
}

/* ------------------------------------------------ 2. wealth against giving */

/** Paired bars on ONE scale. The giving bar is the point: it is a hairline. */
type View = 'dollars' | 'share' | 'family';
type Order = 'wealth' | 'given' | 'share';
const VIEWS: [View, string][] = [['dollars', 'Dollars'], ['share', 'Share given'], ['family', 'Family scale']];
const ORDERS: [Order, string][] = [['wealth', 'Fortune'], ['given', 'Given'], ['share', 'Share']];

/**
 * Share given, as the Institute for Policy Studies measures the Pledge:
 * giving over everything the person has had — what they kept plus what
 * they gave. Crossing one half means half has actually gone.
 */
export const shareOf = (given: number, wealth: number) => given / (given + wealth);
/** Percent to a sensible precision: one decimal under ten, whole above. */
export const pctLbl = (f: number) => { const v = f * 100; return `${v < 10 ? v.toFixed(v < 1 ? 2 : 1) : Math.round(v)}%`; };
/** Family-scale dollars, rounded so the translation does not overclaim. */
const famLbl = (n: number) => money(n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100);

/**
 * Wealth against giving, with three readings of the same rows. Bars change
 * width and rows change place by CSS transition, so a switch reads as the
 * same people moving rather than a new chart.
 */
export function Paired() {
  const [view, setView] = useState<View>('dollars');
  const [order, setOrder] = useState<Order>('wealth');

  const rows = PEOPLE.filter((p) => p.coverage.lifetime || p.coverage.lifetimeBound).map((p) => {
    const bound = !p.coverage.lifetime;
    const given = bound ? p.lifetimeUnder!.amount : p.lifetime!.amount;
    return { p, bound, given, wealth: p.wealth!, share: shareOf(given, p.wealth!) };
  });
  /* Bounds are ceilings, not measurements, so they sort after every
     measured row whatever the key — never above a figure they might trail. */
  const key = (r: (typeof rows)[number]) => order === 'wealth' ? r.wealth : order === 'given' ? r.given : r.share;
  const sorted = [...rows].sort((a, b) =>
    order === 'wealth' ? b.wealth - a.wealth
    : a.bound !== b.bound ? (a.bound ? 1 : -1)
    : key(b) - key(a));
  const place = new Map(sorted.map((r, i) => [r.p.slug, i]));

  const W = 720, L = 150, R = 96, H = 30, TOP = 34;
  const FULL = W - L - R;
  const max = Math.max(...rows.map((r) => r.wealth));
  const dollars = view === 'dollars';
  const topW = (r: (typeof rows)[number]) => dollars ? (FULL * r.wealth) / max : FULL;
  const giveW = (r: (typeof rows)[number]) => Math.max(1.5, dollars ? (FULL * r.given) / max : FULL * r.share);
  const giveLbl = (r: (typeof rows)[number]) => {
    const v = dollars ? money(r.given) : view === 'share' ? pctLbl(r.share) : famLbl(SUMMARY.household * r.share);
    return r.bound ? `under ${v}` : v;
  };
  const header = dollars
    ? 'Fortune, and lifetime giving as Forbes counts it'
    : view === 'share'
      ? 'Share of everything they have had, given away'
      : `Each fortune shrunk to a typical family’s ${money(SUMMARY.household)}: given away`;
  const H_ALL = TOP + rows.length * H + 8;
  const described = sorted.map((r) => `${r.p.name} ${giveLbl(r)}`).join('; ');

  return (
    <div className={s.interactive}>
      <div className={s.controls}>
        <div role="group" aria-label="Measure" className={s.seg}>
          <span className={s.segLbl} aria-hidden="true">Show</span>
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} className={view === v ? s.segOn : s.segBtn}
                    onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
        <div role="group" aria-label="Sort by" className={s.seg}>
          <span className={s.segLbl} aria-hidden="true">Sort</span>
          {ORDERS.map(([o, label]) => (
            <button key={o} type="button" aria-pressed={order === o} className={order === o ? s.segOn : s.segBtn}
                    onClick={() => setOrder(o)}>{label}</button>
          ))}
        </div>
      </div>
      <svg className={s.fig} viewBox={`0 0 ${W} ${H_ALL}`} role="img" aria-live="polite"
           aria-label={`${header}. ${described}.`}>
        <text className={s.sub} x={L} y={12}>{header}</text>
        {/* The Pledge, as a line: only meaningful once bars are shares. */}
        <g className={s.fade} style={{ opacity: dollars ? 0 : 1 }}>
          <line className={s.rule} x1={L + FULL / 2} x2={L + FULL / 2} y1={TOP - 12} y2={H_ALL - 4} />
          <text className={s.ruleLbl} x={L + FULL / 2 + 6} y={TOP - 4}>half — the Pledge</text>
        </g>
        {rows.map((r) => (
          <g key={r.p.slug} className={s.row} style={{ transform: `translateY(${TOP + place.get(r.p.slug)! * H}px)` }}>
            <text className={s.lbl} x={0} y={14}>{short(r.p.name)}</text>
            <rect className={dollars ? s.barWealth : s.barTrack} x={L} y={2} height={7} rx={1} style={{ width: topW(r) }} />
            <rect className={r.bound ? s.barGiveBound : s.barGive} x={L} y={15} height={7} rx={1} style={{ width: giveW(r) }} />
            <text className={s.val} x={L + 6} y={9} style={{ transform: `translateX(${topW(r)}px)`, opacity: dollars ? 1 : 0 }}>
              {money(r.wealth)}
            </text>
            <text className={r.bound ? s.valGiveBound : s.valGive} x={L + 6} y={22.5}
                  style={{ transform: `translateX(${giveW(r)}px)` }}>{giveLbl(r)}</text>
          </g>
        ))}
      </svg>
    </div>
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
  // Stabilize SSR hydration: JS engines can disagree in the final decimal
  // place for logarithmic coordinates, even though the rendered pixel is
  // identical.
  const x = (yr: number) => Number((L + ((W - L - R) * Math.log10(1 + yr - now)) / Math.log10(1 + maxYear - now)).toFixed(6));
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
  /* Definitions only; the chapter text carries the cases. */
  const Card = ({ title, children, caption }: { title: string; children: React.ReactNode; caption: React.ReactNode }) => (
    <figure className={s.card}>
      <svg viewBox="0 0 200 90" className={s.cardSvg} aria-hidden="true">{children}</svg>
      <figcaption><b>{title}</b><span>{caption}</span></figcaption>
    </figure>
  );
  return (
    <div className={s.cards}>
      <Card title="The donor-advised fund"
            caption={<>An account at a sponsoring charity. The donor takes the deduction when money goes in and advises on grants later. There is no payout rule, and recipients need not be disclosed.</>}>
        <rect className={s.cBox} x={70} y={20} width={60} height={50} rx={4} />
        <line className={s.cArrow} x1={10} y1={45} x2={64} y2={45} markerEnd="url(#h-arrow)" />
        <text className={s.cLbl} x={100} y={49}>DAF</text>
        <text className={s.cNote} x={100} y={86}>no payout rule</text>
      </Card>
      <Card title="The charitable LLC"
            caption={<>A company rather than a charity. It can make grants, investments and political contributions, and files no public charitable return.</>}>
        <rect className={s.cBoxSolid} x={60} y={15} width={80} height={60} rx={4} />
        <text className={s.cLblInv} x={100} y={49}>LLC</text>
        <text className={s.cNote} x={100} y={86}>no filing, no window</text>
      </Card>
      <Card title="The related party"
            caption={<>A grant that benefits the donor’s own family, businesses or associates. Direct self-dealing is prohibited; benefit at one remove often is not.</>}>
        <circle className={s.cRing} cx={100} cy={45} r={30} />
        <text className={s.cLbl} x={100} y={49}>back</text>
        <text className={s.cNote} x={100} y={86}>to the donor’s own interests</text>
      </Card>
      <svg width="0" height="0" aria-hidden="true">
        <defs><marker id="h-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9d9d95" /></marker></defs>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------ 8. the score */

/** Forbes' 1–5 philanthropy score across the twenty-five. */
/** Forbes' score bands, as shares given: 1 is under 1%, 5 is 20% or more. */
const BANDS = [
  { k: 1, lo: 0, hi: 0.01 }, { k: 2, lo: 0.01, hi: 0.05 }, { k: 3, lo: 0.05, hi: 0.10 },
  { k: 4, lo: 0.10, hi: 0.20 }, { k: 5, lo: 0.20, hi: 1 },
];

/** The scored, each at their share given, with the gap either side named. */
export function scoreRows() {
  return PEOPLE.filter((p) => p.score != null && (p.coverage.lifetime || p.coverage.lifetimeBound)).map((p) => {
    const bound = !p.coverage.lifetime;
    const given = bound ? p.lifetimeUnder!.amount : p.lifetime!.amount;
    return { p, bound, share: shareOf(given, p.wealth!), score: p.score as number };
  }).sort((a, b) => b.share - a.share);
}
/** The widest empty stretch between neighbours: the highest share below it, the lowest above. */
export function scoreGap() {
  const r = scoreRows().filter((x) => !x.bound);
  let best = { below: r[r.length - 1], above: r[0], ratio: 1 };
  for (let i = 0; i < r.length - 1; i++) {
    const ratio = r[i].share / r[i + 1].share;
    if (ratio > best.ratio) best = { above: r[i], below: r[i + 1], ratio };
  }
  return best;
}

/**
 * One row per scored person, on a log scale of share given, over Forbes'
 * five bands. A histogram of scores counts people; this shows them, and
 * shows that the empty bands are a gap in the people, not in the grading.
 */
export function Scores() {
  const rows = scoreRows();
  const W = 720, L = 150, R = 40, H = 22, TOP = 40;
  const MIN = 0.001, MAX = 0.6;
  const x = (f: number) => L + ((W - L - R) * Math.log10(Math.max(f, MIN) / MIN)) / Math.log10(MAX / MIN);
  const BOTTOM = TOP + rows.length * H;
  const empty = (k: number) => !rows.some((r) => r.score === k);
  return (
    <svg className={s.fig} viewBox={`0 0 ${W} ${BOTTOM + 30}`} role="img"
         aria-label={`Share of wealth given, by person, against Forbes' score bands: ${rows.map((r) => `${r.p.name} ${r.bound ? 'under ' : ''}${pctLbl(r.share)}, score ${r.score}`).join('; ')}`}>
      {BANDS.map((b) => {
        const x0 = x(Math.max(b.lo, MIN)), x1 = x(Math.min(b.hi, MAX));
        return (
          <g key={b.k}>
            <rect className={empty(b.k) ? s.bandEmpty : b.k % 2 ? s.bandA : s.bandB} x={x0} y={TOP - 6} width={x1 - x0} height={BOTTOM - TOP + 6} />
            <text className={empty(b.k) ? s.bandLblEmpty : s.bandLbl} x={(x0 + x1) / 2} y={TOP - 14}>{b.k}</text>
            {empty(b.k) && <text className={s.bandNobody} x={(x0 + x1) / 2} y={(TOP + BOTTOM) / 2}>nobody</text>}
          </g>
        );
      })}
      <text className={s.sub} x={L} y={12}>Forbes score, over the share of each fortune given away</text>
      {[0.001, 0.01, 0.05, 0.1, 0.2, 0.5].map((t) => (
        <text key={t} className={s.tick} x={x(t)} y={BOTTOM + 16}>{`${+(t * 100).toPrecision(2)}%`}</text>
      ))}
      {rows.map((r, i) => {
        const y = TOP + i * H + H / 2;
        const cx = x(r.share);
        return (
          <g key={r.p.slug}>
            <text className={s.lbl} x={0} y={y + 4}>{short(r.p.name)}</text>
            {/* A ceiling, not a point: the true share is somewhere left of the ring. */}
            {r.bound && <line className={s.boundTail} x1={x(MIN)} x2={cx - 5} y1={y} y2={y} />}
            <circle className={r.bound ? s.dotBound : s.dotGiven} cx={cx} cy={y} r={4.5} />
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
