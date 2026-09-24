/**
 * Chapter seven — find a county.
 *
 * ── Why this is not six numbers in boxes ────────────────────────────────
 *
 * It was, and that is a thin reward for going to the trouble of searching.
 * A stat card tells you a value; it does not tell you whether the value is
 * normal, and "normal" is the entire subject of this piece.
 *
 * So the payoff draws the county's own eighteen-year line INSIDE the field of
 * seven size bands from chapter three — the same lines, the same colours, by
 * now several minutes familiar. You see at once whether your county tracks
 * counties of its size or leaves them, and the national gradient stops being
 * an abstraction the moment your own line is sitting in it.
 *
 * Underneath, where the county reported it, its people against its beds: the
 * "if you build it" question from chapter five at the scale of one place.
 *
 * ── Three things that had to be got right ───────────────────────────────
 *
 * 1. THE SCALE IS NOT FIXED. 373 counties in the panel exceed 1,000 per
 *    100,000 and one reaches 56,757 — a few hundred people sharing a county
 *    with a regional jail that holds a whole district. On a fixed 0–1,000
 *    axis those counties would silently clip off the top, which is the
 *    failure mode where a chart looks fine and is lying. The axis grows, and
 *    when it does the national bands flatten to a crease at the bottom. That
 *    reads correctly: it is what an outlier actually is.
 *
 * 2. THE BANDS ARE THE FIELD, NOT THE SUBJECT. Drawn at 0.28 opacity, the
 *    county at full white. Without them the line is a squiggle with nothing
 *    to be high or low against; at equal weight you would not know which one
 *    you searched for.
 *
 * 3. THE INDEX IS FETCHED, NOT BUNDLED. ~240KB gzipped, more than the rest of
 *    the piece together, loaded the first time somebody touches the search so
 *    that six chapters of line charts do not wait on it.
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

export type County = {
  fips: string; name: string; state: string; urb: string; band: string;
  pop: number; rate: number[]; pct: number;
  people?: number[]; beds?: number[];
};

/* Module-scoped, so a reader who searches twice does not fetch twice — and
   so that a second mount (the chapter re-enters the sticky stage on scroll)
   is instant rather than a spinner. */
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

  /*
   * The scrollytelling layout renders every chapter TWICE: once in the sticky
   * stage for sighted readers, once inside .srFigure beside the prose for
   * assistive technology, because the stage is aria-hidden. Harmless for a
   * chart. Not harmless for a form — two inputs were sharing id="tilt-county",
   * so both labels pointed at whichever one the parser saw first and one of
   * the two search fields had no label at all.
   */
  const id = useId();

  /* Fires on focus as well as on the first keystroke: by the time anyone has
     typed two characters the fetch has had a head start. */
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
          {/* Labels the right-hand column once, rather than repeating a unit
              on every row or leaving the number to be guessed at. */}
          <p className={s.hitsCap} aria-hidden="true">2019 rate per 100k</p>
          <ul className={s.hits}>
            {hits.map((c) => (
              <li key={c.fips}>
                <button type="button" onClick={() => { setPicked(c); setQ(`${c.name}, ${c.state}`); }}>
                  <span>{c.name}, {c.state}</span>
                  {/* The caption is decorative to a screen reader, which reads
                      rows out of the column's context — so the unit rides with
                      the number here instead. */}
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
          sub={`${fmt(picked.pop)} residents aged 15–64 · ${bandOf(picked).label} · Vera classes it ${picked.urb}`}
          onClose={() => { setPicked(null); input.current?.focus(); }}
        >
          <CountyReport c={picked} />
        </Modal>
      )}
    </div>
  );
}

/**
 * The result, as a modal over the whole page.
 *
 * ── Why a modal, which is normally the wrong answer ─────────────────────
 *
 * The lookup lives in the sticky stage, and the stage swaps its contents as
 * you scroll. So the old inline result was destroyed by the next flick of the
 * wheel — you did the work of searching and the answer evaporated on a
 * gesture you did not mean as "close this". Any inline panel here has that
 * problem; the chapter does not own the scroll position.
 *
 * A modal owns it. It locks the page, so the stage cannot swap underneath,
 * and it leaves by a deliberate act: the X, Escape, or a click on the
 * backdrop. It also buys the report the full width it wants for two charts,
 * which a 26rem stage column never had.
 *
 * ── Three things a hand-rolled modal usually gets wrong ─────────────────
 *
 * 1. Native <dialog>.showModal() rather than a div with a high z-index. It
 *    gives the focus trap, the inert background, Escape, and the top layer —
 *    all of which are fiddly and easy to half-implement.
 *
 * 2. Portalled to <body>. The stage is aria-hidden="true", and aria-hidden
 *    applies to the whole subtree: a dialog rendered inside it would be
 *    invisible to a screen reader however correctly it was marked up. The
 *    stage is also a sticky, overflow-constrained box, which is exactly the
 *    kind of container that clips a fixed child.
 *
 * 3. The scroll lock is not cosmetic. If the page scrolled while this were
 *    open, the stage would swap chapters, unmount the lookup, and take the
 *    portal — and the dialog — with it. The lock is what makes the modal
 *    survive at all.
 */
function Modal({ title, sub, children, onClose }: {
  title: string; sub: string; children: React.ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  /* The dialog is named by the county heading rather than a generic label, so
     a screen reader announces WHICH county on open — the same question the
     sighted reader has. */
  const headId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();

    /* Lock the page behind the dialog. Padding replaces the scrollbar's width
       so the layout underneath does not jump sideways as it disappears. */
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
      /* Escape fires `cancel`, not `close`, and the browser would otherwise
         close the element without telling React — leaving `picked` set and
         the dialog unopenable the second time. */
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      /*
        No click-to-dismiss. On a small centred dialog the surrounding
        backdrop is obviously "outside" and clicking it to leave is a
        convenience. This one fills the viewport, so the only clickable
        emptiness is the gutter beside the charts — which reads as part of
        the panel, not as a way out of it. Dismissing on a click there would
        throw away a reader's search on a stray click. The X and Escape are
        the exits, and both are announced.
      */
    >
      <div className={s.modalInner}>
        {/*
          Sticky, so the county you chose is still named when you have scrolled
          down to the second chart. The charts themselves carry no visible
          title in the scrolly layout — the prose beside them is the title —
          and in here there is no prose, so this header is the only thing
          answering "which county am I looking at".
        */}
        <header className={s.modalHead}>
          <div>
            <h3 id={headId}>{title}</h3>
            <p>{sub}</p>
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

/* Exported for the render suite. The report only appears after a search, so
   nothing else would ever render it under test — and the dynamic axis below
   is the one piece of arithmetic in this file that can produce a NaN. */
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
      <div className={s.bigRow}>
        <div><b>{fmt(r1)}</b><span>per 100,000 in 2019</span></div>
        {chg !== null && (
          <div><b>{chg > 0 ? '+' : ''}{chg}%</b><span>since 2002</span></div>
        )}
        <div><b>{c.pct}<i>th</i></b><span>percentile nationally</span></div>
      </div>

      {/*
        The percentile strip. A rate of 400 means nothing until you know where
        400 sits, and this is the one thing no single number can carry.
      */}
      <div className={s.pctWrap}>
        <div className={s.pctTrack}><div className={s.pctMark} style={{ left: `${c.pct}%` }} /></div>
        <p>Higher than <b>{c.pct}%</b> of the {fmt(data.ch1.panel)} counties in the panel.</p>
      </div>

      {/* Side by side in the modal once there is room, stacked on a phone.
          The two charts answer different questions and neither is a caption
          for the other, so reading order does not matter between them. */}
      <div className={s.charts}>
      <div>
      {/* A visible heading per chart. Frame's `title` becomes the aria-label
          and nothing else, which is right in the scrolly — the paragraph next
          to the chart is its heading. Here there is no paragraph. */}
      <h4 className={s.chartHead}>
        {c.name.replace(/ County$/, '')} against counties of every size
      </h4>
      <Frame
        title={`${c.name} against counties of every size`}
        desc={`${c.name} ran at ${r0} per 100,000 in 2002 and ${r1} in 2019, against ${Math.round(peers[0])} and ${Math.round(last(peers))} for counties of its size.`}
        yTicks={axis(top)} xTicks={XT} sx={sc.x} sy={sc.y}
        hover={{ xs: YEARS, rows: [
          { label: c.name.replace(/ County$/, ''), values: c.rate },
          { label: bandInfo.label, values: peers.map((v) => Math.round(v)), ink: RAMP[bi] },
        ] }}>
        {data.bands.map((b, i) => (
          <path key={b.key} d={path(YEARS, b.rate, sc.x, sc.y)} fill="none"
                stroke={RAMP[i]} strokeWidth={1.5} opacity={0.28} />
        ))}
        <path d={path(YEARS, c.rate, sc.x, sc.y)} fill="none" stroke="currentColor"
              strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        <text x={sc.x(last(YEARS)) + 8} y={sc.y(r1)} dy="0.32em"
              fontSize="12" fontWeight={600} fill="currentColor">
          {c.name.replace(/ County$/, '')}
        </text>
      </Frame>
      {clipped && (
        <p className={s.aside}>
          The axis runs to {fmt(top)} to fit this county, which presses the seven national bands
          into the foot of the chart. That flattening is the finding, not a drawing problem.
        </p>
      )}
      </div>

      <div>
      <h4 className={s.chartHead}>
        {c.name.replace(/ County$/, '')}: people held against beds built
      </h4>
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

/** Four or five round ticks that clear the data, whatever its magnitude. */
function axis(max: number): number[] {
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].find((m) => mag * m >= raw)! * mag;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(Math.round(v));
  return out;
}
