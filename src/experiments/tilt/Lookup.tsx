/**
 * Chapter seven — find a county.
 *
 * The result draws the county's own eighteen-year line inside the seven size
 * bands from chapter three, so you can see whether it tracked counties of its
 * size or left them.
 *
 * Two constraints to keep:
 *   - The axis is per-county, not fixed. 373 counties exceed 1,000 per
 *     100,000 and one reaches 56,757; a fixed axis clips them silently.
 *   - The index is fetched, not imported. ~240KB gzipped, more than the rest
 *     of the piece together.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import data from '../../data/tilt.json';
import { Frame, makeScales, path, band as areaBand } from './charts';
import s from './tilt.module.css';

const YEARS = data.ch1.years;
const XT = [2002, 2007, 2012, 2019];
const RAMP = ['#e8734a', '#e08a4e', '#c9975c', '#9c9a6e', '#6d9a8c', '#4f8fa8', '#4a7ab8'];
const fmt = (n: number) => n.toLocaleString();
const last = <T,>(a: T[]) => a[a.length - 1];
const bandOf = (c: County) => data.bands.find((b) => b.key === c.band)!;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const shortName = (n: string) => n.replace(/ (County|Parish|Borough|Census Area|City and Borough|Municipality)$/, '');

export type County = {
  fips: string; name: string; state: string; urb: string; band: string;
  pop: number; rate: number[]; pct: number;
  people?: number[]; beds?: number[];
};

/* Module-scoped: a second search, or a second mount, must not refetch. */
let cache: County[] | null = null;
let inflight: Promise<County[]> | null = null;
function load(): Promise<County[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/tilt-counties.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: County[]) => { cache = j; return j; })
      .catch((e) => { inflight = null; throw e; });
  }
  return inflight;
}

export function ChapterLookup() {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<County | null>(null);
  const [list, setList] = useState<County[] | null>(cache);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const started = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  /* useId, not a literal: a hard-coded id collides if this ever renders twice
     on a page, and both labels then point at the same input. */
  const id = useId();

  /* On focus as well as on keystroke, so the fetch has a head start. */
  const begin = () => {
    if (started.current || cache) return;
    started.current = true;
    setStatus('loading');
    load().then((j) => { setList(j); setStatus('idle'); })
          .catch(() => { setStatus('error'); started.current = false; });
  };

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!list || t.length < 2) return [];
    return list.filter((c) => `${c.name} ${c.state}`.toLowerCase().includes(t)).slice(0, 8);
  }, [q, list]);

  return (
    <div className={s.lookup}>
      <label htmlFor={id}>Find a county</label>
      <input id={id} ref={input} type="search" value={q} autoComplete="off"
             placeholder="Grant County, KY"
             onFocus={begin}
             onChange={(e) => { begin(); setQ(e.target.value); setPicked(null); }} />

      <p className={s.none} role="status">
        {status === 'loading' && 'Loading the county index…'}
        {status === 'error' && 'The county index did not load. Nothing above depends on it.'}
        {status === 'idle' && !picked && list && q.trim().length >= 2 && hits.length === 0 &&
          `No match. ${fmt(list.length)} counties are in the panel — the rest did not report in every
           year between 2002 and 2019, and were left out rather than interpolated.`}
        {status === 'idle' && !picked && hits.length === 0 && q.trim().length < 2 &&
          'Type two letters. Every county that reported jail population in all eighteen years is here.'}
      </p>

      {!picked && hits.length > 0 && (
        <>
          {/* Labels the column once instead of repeating a unit per row. */}
          <p className={s.hitsCap} aria-hidden="true">2019 rate per 100k</p>
          <ul className={s.hits}>
            {hits.map((c) => (
              <li key={c.fips}>
                <button type="button" onClick={() => { setPicked(c); setQ(`${c.name}, ${c.state}`); }}>
                  <span>{c.name}, {c.state}</span>
                  {/* The caption is aria-hidden, so each row carries its unit. */}
                  <b>{fmt(last(c.rate))}<span className={s.srOnlyInline}> per 100,000 in 2019</span></b>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {picked && (
        <Modal
          title={`${picked.name}, ${picked.state}`}
          meta={[
            { label: 'Population', value: `${fmt(picked.pop)} aged 15–64` },
            { label: 'Size band', value: `Counties of ${bandOf(picked).label}` },
            { label: 'Vera classification', value: cap(picked.urb) },
          ]}
          onClose={() => { setPicked(null); input.current?.focus(); }}
        >
          <CountyReport c={picked} />
        </Modal>
      )}
    </div>
  );
}

/**
 * The result, as a full-screen modal. Three things are load-bearing:
 *
 *   showModal()  — focus trap, inert background, Escape, top layer
 *   the portal   — the stage is aria-hidden, which covers its whole subtree,
 *                  so a dialog inside it is invisible to a screen reader
 *   scroll lock  — the stage swaps chapter on scroll, which would unmount
 *                  this component and take the dialog with it
 */
function Modal({ title, meta, children, onClose }: {
  title: string;
  meta: { label: string; value: string }[];
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headId = useId();   /* names the dialog by county, not "detail" */

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();

    /* Padding replaces the scrollbar so the page does not jump sideways. */
    const html = document.documentElement;
    const gap = window.innerWidth - html.clientWidth;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    html.style.overflow = 'hidden';
    if (gap > 0) html.style.paddingRight = `${gap}px`;

    return () => {
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
      if (el.open) el.close();
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={ref}
      className={s.modal}
      aria-labelledby={headId}
      /* Escape fires `cancel`; unhandled, the browser closes the element
         without telling React and it never reopens. */
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      /* No click-to-dismiss: full-bleed, so the only clickable emptiness is
         the gutter beside the charts, which does not read as "outside". */
    >
      <div className={s.modalInner}>
        {/* Sticky: the county stays named at the second chart. */}
        <header className={s.modalHead}>
          <div>
            <h3 id={headId}>{title}</h3>
            <dl className={s.modalMeta}>
              {meta.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <button type="button" className={s.close} onClick={onClose} aria-label="Close county detail">
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}

/* Exported for the suite; nothing else renders it without a search. */
export function CountyReport({ c }: { c: County }) {
  const r0 = c.rate[0], r1 = last(c.rate);
  const chg = r0 ? Math.round((r1 / r0 - 1) * 100) : null;
  const bi = data.bands.findIndex((b) => b.key === c.band);
  const bandInfo = data.bands[bi];
  const peers = bandInfo.rate;

  /* The axis has to clear the county, not the other way round. */
  const top = Math.max(1000, Math.ceil((Math.max(...c.rate) * 1.1) / 500) * 500);
  const sc = makeScales(YEARS, 0, top);
  const clipped = top > 1000;

  return (
    <div className={s.report}>
      {/* Each figure names itself above and says what it counts below. */}
      <dl className={s.bigRow}>
        <div>
          <dt>Jail rate, 2019</dt>
          <dd><b>{fmt(r1)}</b><span>people in jail per 100,000 residents aged 15&ndash;64</span></dd>
        </div>
        {chg !== null && (
          <div>
            <dt>Change since 2002</dt>
            <dd><b>{chg > 0 ? '+' : ''}{chg}%</b><span>{chg > 0 ? 'rise' : 'fall'} in that rate over eighteen years</span></dd>
          </div>
        )}
        <div>
          <dt>National rank</dt>
          <dd><b>{c.pct}<i>th</i></b><span>percentile among the {fmt(data.ch1.panel)} counties in the panel</span></dd>
        </div>
      </dl>

      {/* Where the rate sits nationally — what one number cannot say. */}
      <div className={s.pctWrap}>
        <div className={s.pctTrack}><div className={s.pctMark} style={{ left: `${c.pct}%` }} /></div>
        <p>
          <b>{c.pct}%</b> of counties jail at a lower rate; <b>{100 - c.pct}%</b> jail at a higher one.
        </p>
      </div>

      {/* Side by side above 900px, stacked below. */}
      <div className={s.charts}>
      <div>
      {/* Heading states the measure, deck states what the other lines are. */}
      <h4 className={s.chartHead}>Jail rate per 100,000 residents aged 15&ndash;64</h4>
      <p className={s.chartDeck}>
        {shortName(c.name)} in white, against the average for each of the seven county-size
        bands. Its own band &mdash; counties of {bandInfo.label} &mdash; is the brighter line.
      </p>
      <Frame
        title={`Jail rate per 100,000: ${c.name} against the seven county-size bands`}
        desc={`${c.name} ran at ${r0} per 100,000 in 2002 and ${r1} in 2019, against ${Math.round(peers[0])} and ${Math.round(last(peers))} for counties of its size.`}
        yTicks={axis(top)} xTicks={XT} sx={sc.x} sy={sc.y}
        hover={{ xs: YEARS, rows: [
          { label: shortName(c.name), values: c.rate },
          { label: `counties of ${bandInfo.label}`, values: peers.map((v) => Math.round(v)), ink: RAMP[bi] },
        ] }}>
        {data.bands.map((b, i) => (
          <path key={b.key} d={path(YEARS, b.rate, sc.x, sc.y)} fill="none"
                stroke={RAMP[i]} strokeWidth={i === bi ? 2.2 : 1.5}
                opacity={i === bi ? 0.95 : 0.26} />
        ))}
        <path d={path(YEARS, c.rate, sc.x, sc.y)} fill="none" stroke="currentColor"
              strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {/* Key at the line ends, as in chapter three. Spread first: on a flat
            county all eight finish within a few pixels of each other. */}
        {spread([
          ...data.bands.map((b, i) => ({ y: sc.y(last(b.rate)), text: b.label, ink: RAMP[i], own: i === bi })),
          { y: sc.y(r1), text: shortName(c.name), ink: 'currentColor', own: true },
        ], sc.y(top), sc.y(0)).map((e) => (
          <text key={e.text} x={sc.x(last(YEARS)) + 8} y={e.y} dy="0.32em"
                fontSize={e.ink === 'currentColor' ? 12 : 10.5}
                fontWeight={e.own ? 600 : 400}
                fill={e.ink} opacity={e.own ? 1 : 0.7}>{e.text}</text>
        ))}
      </Frame>
      {clipped && (
        <p className={s.aside}>
          The axis runs to {fmt(top)} to fit this county, which presses the seven national bands
          into the foot of the chart. That flattening is the finding, not a drawing problem.
        </p>
      )}
      </div>

      <div>
      <h4 className={s.chartHead}>People held against beds built</h4>
      <p className={s.chartDeck}>
        The number of people in {shortName(c.name)}&rsquo;s jail each year, against the number
        of beds it was rated for. The gap between them is capacity nobody is using.
      </p>
      {c.people && c.beds ? <Beds c={c} /> : (
        <p className={s.aside}>
          {c.name} did not report a rated capacity in every year, so its beds are not drawn. An
          incomplete line beside a complete one reads as capacity disappearing, which would be false.
        </p>
      )}
      </div>
      </div>
    </div>
  );
}

function Beds({ c }: { c: County }) {
  const people = c.people!, beds = c.beds!;
  const top = Math.max(...beds, ...people) * 1.14;
  const sc = makeScales(YEARS, 0, top);
  const spare = last(beds) - last(people);
  return (
    <Frame
      title={`${c.name}: people held against beds built`}
      desc={`Capacity went from ${fmt(beds[0])} to ${fmt(last(beds))} while the population held went from ${fmt(people[0])} to ${fmt(last(people))}.`}
      yTicks={axis(top)} xTicks={XT} sx={sc.x} sy={sc.y}
      hover={{ xs: YEARS, rows: [{ label: 'beds', values: beds }, { label: 'held', values: people }] }}>
      <path d={areaBand(YEARS, beds, people, sc.x, sc.y)} fill="currentColor" opacity={0.1} />
      <path d={path(YEARS, beds, sc.x, sc.y)} fill="none" stroke="currentColor"
            strokeWidth={2} opacity={0.55} strokeDasharray="5 4" />
      <path d={path(YEARS, people, sc.x, sc.y)} fill="none" stroke="currentColor" strokeWidth={2.6} />
      <text x={sc.x(2019) + 8} y={sc.y(last(beds))} dy="0.32em"
            fontSize="12" fill="currentColor" opacity={0.6}>beds</text>
      <text x={sc.x(2019) + 8} y={sc.y(last(people))} dy="0.32em"
            fontSize="12" fill="currentColor">held</text>
      {spare > 0 && (
        <text x={sc.x(2019) + 8} y={sc.y((last(beds) + last(people)) / 2)} dy="0.32em"
              fontSize="11" fill="currentColor" opacity={0.5}>{fmt(spare)} spare</text>
      )}
    </Frame>
  );
}

/**
 * Spread end-of-line labels so none overprints another.
 *
 * Down pass, then an up pass — never a global shift, which would move labels
 * that never collided. On a county like Irwin GA the seven bands crush into
 * the foot of the plot while the county's own label sits alone at the top.
 *
 * Labels move, lines do not.
 */
export function spread<T extends { y: number }>(items: T[], topY: number, bottomY: number): T[] {
  const MIN = 12.5;
  const a = [...items].sort((x, y) => x.y - y.y);

  /* Down: clear the one above. */
  for (let i = 1; i < a.length; i++) a[i].y = Math.max(a[i].y, a[i - 1].y + MIN);

  /* Up: pin the last to the floor, lift only as far as spacing needs. */
  if (a[a.length - 1].y > bottomY) {
    a[a.length - 1].y = bottomY;
    for (let i = a.length - 2; i >= 0; i--) a[i].y = Math.min(a[i].y, a[i + 1].y - MIN);
  }

  /* Still out of frame: too many labels for the plot. Tight beats clipped. */
  if (a[0].y < topY) {
    for (let i = 0; i < a.length; i++) a[i].y = Math.max(a[i].y, topY + i * MIN);
  }
  return a;
}

/** Four or five round ticks that clear the data, whatever its magnitude. */
function axis(max: number): number[] {
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].find((m) => mag * m >= raw)! * mag;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(Math.round(v));
  return out;
}
