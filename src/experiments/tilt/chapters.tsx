/**
 * The seven chapters. One visual per chapter; if two would look the same,
 * one of them is not a chapter.
 *
 * Every figure here reads from tilt.json. There are no numbers typed into
 * this file — the Wage Gap lesson, where a hand-copied hourly rate drifted
 * from the data that produced it and nothing noticed for two years.
 */

import { useMemo, useState } from 'react';
import data from '../../data/tilt.json';
import counties from '../../data/tilt-counties.json';
import { Frame, EndLabel, makeScales, path, band, W, H } from './charts';
import s from './tilt.module.css';

const YEARS = data.ch1.years;
const XT = [2002, 2007, 2012, 2019];
const fmt = (n: number) => n.toLocaleString();
const k = (n: number) => `${Math.round(n / 1000)}k`;

/* Palette by band. One ramp, small to large, so size reads as colour
   without a legend. Every stop clears 4.5:1 on the page ground. */
const RAMP = ['#e8734a', '#e08a4e', '#c9975c', '#9c9a6e', '#6d9a8c', '#4f8fa8', '#4a7ab8'];

/* ── 1 ─────────────────────────────────────────────────────────────────── */
export function ChapterDecline() {
  const v = data.ch1.count;
  const sc = makeScales(YEARS, 560_000, 760_000);
  const peak = v.indexOf(Math.max(...v));
  return (
    <Frame title="US county jail population, 2002 to 2019"
           desc={`Rises from ${fmt(v[0])} in 2002 to a peak of ${fmt(v[peak])} in ${YEARS[peak]}, then falls to ${fmt(v.at(-1)!)} by 2019.`}
           yTicks={[560_000, 640_000, 720_000]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={k}>
      <path d={path(YEARS, v, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <circle cx={sc.x(YEARS[peak])} cy={sc.y(v[peak])} r={4} fill="currentColor" />
      <text x={sc.x(YEARS[peak])} y={sc.y(v[peak]) - 14} textAnchor="middle" fontSize="12" fill="currentColor">
        peak {YEARS[peak]}
      </text>
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(v.at(-1)!)}>−7%</EndLabel>
    </Frame>
  );
}

/* ── 2 and 3 ───────────────────────────────────────────────────────────
 * The same seven series, twice. Chapter two shows counts, where the big
 * counties dominate and the story is hidden. Chapter three shows rates,
 * where it is not. Putting them in one component keeps the geometry
 * registered between the two, so the transition is the argument.
 */
export function ChapterBands({ mode }: { mode: 'count' | 'rate' }) {
  const bands = data.bands;
  const series = bands.map((b) => (mode === 'count' ? b.count : b.rate));
  const all = series.flat();
  const sc = makeScales(YEARS, mode === 'count' ? 0 : 200, Math.max(...all) * 1.08);
  const yTicks = mode === 'count' ? [0, 100_000, 200_000] : [200, 400, 600, 800];
  return (
    <Frame
      title={mode === 'count' ? 'Jail population by county size' : 'Jail rate by county size, per 100,000 residents aged 15–64'}
      desc={mode === 'count'
        ? 'Seven size bands. The largest counties hold most people, which conceals the divergence in the rates.'
        : `In 2002 the smallest counties jailed at ${bands[0].rate[0]} per 100,000 against ${bands.at(-1)!.rate[0]} in the largest. By 2019 it is ${bands[0].rate.at(-1)} against ${bands.at(-1)!.rate.at(-1)}.`}
      yTicks={yTicks} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={mode === 'count' ? k : fmt}>
      {bands.map((b, i) => (
        <path key={b.key} d={path(YEARS, series[i], sc.x, sc.y)} fill="none"
              stroke={RAMP[i]} strokeWidth={2} opacity={0.92} />
      ))}
      {bands.map((b, i) => (
        <text key={b.key} x={sc.x(YEARS.at(-1)!) + 8} y={sc.y(series[i].at(-1)!)} dy="0.32em"
              fontSize="11" fill={RAMP[i]}>{b.label}</text>
      ))}
    </Frame>
  );
}

/* ── 4 ─────────────────────────────────────────────────────────────────
 * Three eliminations, drawn deliberately plainly and on a shared axis that
 * makes flatness visible. Their going nowhere IS the content, so any styling
 * that made them interesting would be working against the point.
 */
export function ChapterEliminations() {
  const panels = [
    { k: 'held for other authorities', v: data.ch4.transfers.share, unit: '%', n: data.ch4.transfers.panel },
    { k: 'rural population', v: data.ch4.population.index, unit: ' (2002 = 100)', n: data.ch4.population.panel },
    { k: 'rural Latino share', v: data.ch4.demography.latinxShare, unit: '%', n: data.ch4.demography.panel },
  ];
  return (
    <div className={s.smallMultiples}>
      {panels.map((p) => {
        const lo = Math.min(...p.v), hi = Math.max(...p.v);
        const pad = Math.max((hi - lo) * 2, 4);
        const sc = makeScales(YEARS, lo - pad, hi + pad);
        return (
          <figure key={p.k} className={s.mini}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={p.k}
                 style={{ width: '100%', height: 'auto', display: 'block' }}>
              <title>{p.k}</title>
              <desc>{`${p.v[0]}${p.unit} in 2002, ${p.v.at(-1)}${p.unit} in 2019.`}</desc>
              <line x1={56} x2={W - 96} y1={sc.y(p.v[0])} y2={sc.y(p.v[0])}
                    stroke="currentColor" opacity={0.18} strokeDasharray="4 4" />
              <path d={path(YEARS, p.v, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={3} />
            </svg>
            <figcaption>
              <b>{p.k}</b>
              <span>{p.v[0]}{p.unit} → {p.v.at(-1)}{p.unit}</span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/* ── 5 ─────────────────────────────────────────────────────────────────── */
export function ChapterCapacity() {
  const { people, beds, spare } = data.ch5;
  const sc = makeScales(YEARS, 560_000, 880_000);
  return (
    <Frame title="People in jail against rated capacity"
           desc={`Capacity rises from ${fmt(beds[0])} to ${fmt(beds.at(-1)!)} while population falls from its peak to ${fmt(people.at(-1)!)}. Spare beds grow from ${fmt(spare[0])} to ${fmt(spare.at(-1)!)}.`}
           yTicks={[600_000, 700_000, 800_000]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={k}>
      <path d={band(YEARS, beds, people, sc.x, sc.y)} fill="currentColor" opacity={0.12} />
      <path d={path(YEARS, beds, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} opacity={0.75} />
      <path d={path(YEARS, people, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.5} />
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(beds.at(-1)!)} dim>beds</EndLabel>
      <EndLabel x={sc.x(YEARS.at(-1)!)} y={sc.y(people.at(-1)!)}>people</EndLabel>
      <text x={(sc.x(2002) + sc.x(2019)) / 2} y={sc.y((beds[8] + people[8]) / 2)} textAnchor="middle"
            fontSize="12" fill="currentColor" opacity={0.8}>{fmt(spare.at(-1)!)} empty beds</text>
    </Frame>
  );
}

export function ChapterConstruction() {
  const c = data.ch5.construction;
  const max = Math.max(...c.count);
  const bw = (W - 152) / c.years.length;
  return (
    <Frame title="Jail construction projects per year, 2002 to 2022"
           desc={`Falls to ${Math.min(...c.count)} in ${c.years[c.count.indexOf(Math.min(...c.count))]} then rises to ${max} in ${c.years[c.count.indexOf(max)]}. ${c.total.toLocaleString()} projects in total.`}
           yTicks={[0, 100, 200]} xTicks={[2002, 2012, 2022]}
           sx={makeScales(c.years, 0, max).x} sy={makeScales(c.years, 0, max * 1.1).y}>
      {c.count.map((v, i) => {
        const sc = makeScales(c.years, 0, max * 1.1);
        return <rect key={c.years[i]} x={sc.x(c.years[i]) - bw * 0.35} width={bw * 0.7}
                     y={sc.y(v)} height={Math.max(sc.y(0) - sc.y(v), 0)}
                     fill="currentColor" opacity={i === c.count.length - 1 ? 0.95 : 0.4} />;
      })}
    </Frame>
  );
}

/* ── 6 ─────────────────────────────────────────────────────────────────
 * Pretrial as a RATE only. The codebook says a single-day June count and an
 * average daily population are not directly comparable, so this does not
 * divide one by the other — it compares pretrial against itself over time.
 */
export function ChapterPretrial() {
  const u = data.ch6.byUrbanicity as Record<string, { pretrialRate: number[]; iceCount: number[]; n: number; iceShareOfPretrialChange: number }>;
  const keys = ['rural', 'small/mid', 'suburban', 'urban'];
  const all = keys.flatMap((x) => u[x].pretrialRate);
  const sc = makeScales(YEARS, Math.min(...all) * 0.9, Math.max(...all) * 1.08);
  const ink = ['#e8734a', '#c9975c', '#6d9a8c', '#4a7ab8'];
  return (
    <Frame title="Pretrial jail rate per 100,000 residents, by county type"
           desc={`Rural rises from ${u.rural.pretrialRate[0]} to ${u.rural.pretrialRate.at(-1)}. Urban falls from ${u.urban.pretrialRate[0]} to ${u.urban.pretrialRate.at(-1)}.`}
           yTicks={[150, 200, 250, 300, 350]} xTicks={XT} sx={sc.x} sy={sc.y} fmtY={fmt}>
      {keys.map((key, i) => (
        <path key={key} d={path(YEARS, u[key].pretrialRate, sc.x, sc.y)} fill="none"
              stroke={ink[i]} strokeWidth={2.2} />
      ))}
      {keys.map((key, i) => (
        <text key={key} x={sc.x(YEARS.at(-1)!) + 8} y={sc.y(u[key].pretrialRate.at(-1)!)} dy="0.32em"
              fontSize="11" fill={ink[i]}>{key}</text>
      ))}
    </Frame>
  );
}

/* ── 7 ─────────────────────────────────────────────────────────────────── */
type County = { fips: string; name: string; state: string; urb: string; band: string; pop: number; r0: number; r1: number };

export function ChapterLookup() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<County | null>(null);
  const list = counties as County[];
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return list.filter((c) => `${c.name} ${c.state}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, list]);
  const nat = data.bands;
  return (
    <div className={s.lookup}>
      <label htmlFor="tilt-county">Find a county</label>
      <input id="tilt-county" type="search" value={q} autoComplete="off"
             placeholder="Grant County, KY" onChange={(e) => { setQ(e.target.value); setPicked(null); }} />
      {!picked && hits.length > 0 && (
        <ul className={s.hits}>
          {hits.map((c) => (
            <li key={c.fips}>
              <button type="button" onClick={() => { setPicked(c); setQ(`${c.name}, ${c.state}`); }}>
                {c.name}, {c.state}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <dl className={s.readout}>
          <div><dt>Residents 15–64</dt><dd>{fmt(picked.pop)}</dd></div>
          <div><dt>Jail rate, 2002</dt><dd>{picked.r0}</dd></div>
          <div><dt>Jail rate, 2019</dt><dd>{picked.r1}</dd></div>
          <div><dt>Change</dt><dd>{picked.r0 ? `${picked.r1 > picked.r0 ? '+' : ''}${Math.round((picked.r1 / picked.r0 - 1) * 100)}%` : '—'}</dd></div>
          <div><dt>Size band</dt><dd>{nat.find((b) => b.key === picked.band)?.label}</dd></div>
          <div><dt>Vera classes it</dt><dd>{picked.urb}</dd></div>
        </dl>
      )}
      {q.trim().length >= 2 && hits.length === 0 && !picked && (
        <p className={s.none}>
          No match. {list.length.toLocaleString()} counties are in the panel — the rest did not report
          in every year between 2002 and 2019 and were left out rather than interpolated.
        </p>
      )}
    </div>
  );
}
