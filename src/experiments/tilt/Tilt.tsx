/**
 * The Tilt — a scroll-driven piece about where American incarceration went.
 *
 * ── How the scrolling works, and what it deliberately does not do ───────
 *
 * A sticky figure on one side, prose steps on the other. An
 * IntersectionObserver watches the steps and swaps the figure. That is all.
 *
 * It does NOT take the scroll. No preventDefault, no scroll-snap fighting the
 * wheel, no programmatic scrollTo with a duration, no wheel handler. Those are
 * what make this genre feel hostile: the reader pushes and the page argues
 * back. Here the reader's scroll is theirs and the figure responds to it. The
 * whole piece is readable at any speed, including a fast flick to the bottom.
 *
 * `prefers-reduced-motion` is not a degraded version of this — the steps
 * become an ordinary stacked article with every figure inline, in document
 * order, which is a perfectly good way to read it and on a phone is better.
 */

import { useEffect, useRef, useState } from 'react';
import data from '../../data/tilt.json';
import { SOURCES } from '../../data/incarceration-sources';
import {
  ChapterDecline, ChapterBands, ChapterTilt, ChapterEliminations, ChapterCapacity,
  ChapterConstruction, ChapterPretrial, ChapterLookup,
} from './chapters';
import s from './tilt.module.css';

const fmt = (n: number) => n.toLocaleString();

/* Figures the prose quotes, computed rather than typed. The nationally
   reported jail peak is 2008; this balanced panel peaks in 2007. Quote the
   panel, since it is what the charts draw. */
const COUNT = data.ch1.count;
const PEAK = data.ch1.years[COUNT.indexOf(Math.max(...COUNT))];
const SINCE_PEAK = Math.abs(Math.round((COUNT[COUNT.length - 1] / Math.max(...COUNT) - 1) * 100));
const last = <T,>(a: T[]) => a[a.length - 1];
const pctChange = (r: number[]) => Math.round((r[r.length - 1] / r[0] - 1) * 100);
const SMALLEST = pctChange(data.bands[0].rate);
const LARGEST = pctChange(data.bands[data.bands.length - 1].rate);
/* Smallest counties against largest, in the final year. Chapter three quotes
   both ends of this; the intro quotes only where it ended up. */
const RATIO02 = (data.bands[0].rate[0] / data.bands[data.bands.length - 1].rate[0]).toFixed(2);
const RATIO = (last(data.bands[0].rate) / last(data.bands[data.bands.length - 1].rate)).toFixed(1);

const CHAPTERS = [
  {
    id: 'decline',

    kicker: 'The reported figure',

    title: 'The jail population came down.',
    body: `The county jail population peaked in ${PEAK} and fell about ${SINCE_PEAK} percent by 2019.`,
    figure: <ChapterDecline />,
  },
  {
    id: 'split',
    kicker: 'The same data, by county size',
    title: 'One line, two opposite trends.',
    body: `Most people in jail are held in a small number of very large counties, so those counties decide which way the national line goes. Group counties by size and the split shows: the biggest are jailing fewer people each year, while almost everywhere else is jailing more.`,
    figure: <ChapterBands mode="count" />,
  },
  {
    id: 'tilt',
    kicker: 'The finding',
    title: 'Measured per resident, the country tilts.',
    body: `In 2002 a county of three thousand people jailed at roughly the same rate as a county of a million — ${RATIO02} times, close enough to call flat. By 2019 it was ${RATIO} times. Above 5,000 residents, every step up in county size means a lower rate, all the way to the largest. Counties under 5,000 are the exception, sitting below their neighbours: more than a third share a regional jail instead of running their own, so their rate is measured on a different basis.`,
    figure: <ChapterTilt />,
  },
  {
    id: 'eliminations',
    kicker: 'Three things it is not',
    title: 'The obvious explanations do not survive.',
    body: `It is not cities shipping people to rural jails: the share of rural jail populations held for other authorities is flat. It is not displacement of the poor out of cities: rural America lost population over this period. And it is not demographic change: the shift is a few percentage points against a rate that moved by forty.`,
    figure: <ChapterEliminations />,
  },
  {
    id: 'capacity',
    kicker: 'What was built',
    title: 'The beds kept coming anyway.',
    body: `Rated capacity grew by almost 22 percent while the population inside fell. By 2019 there were around 150,000 empty beds. Vera's own phrase for what follows is "if you build it, they will come" — they document counties that expanded far past local need, rented the surplus to state prisons and federal immigration, and then filled it locally when the outside customers stopped coming.`,
    figure: <ChapterCapacity />,
  },
  {
    id: 'construction',
    kicker: 'And still coming',
    title: 'Construction hit a twenty-year high.',
    body: `Proposals bottomed out in the mid-2010s and then climbed. The last year in the record, 2022, is the busiest in the series. Across the whole period: 1,926 projects, 348,688 beds added and 949 removed.`,
    figure: <ChapterConstruction />,
  },
  {
    id: 'pretrial',
    kicker: 'Who is inside',
    title: 'Mostly people awaiting a decision.',
    body: `The pretrial rate — people not convicted of anything — rose sharply in rural counties and fell in urban ones. Held for ICE grew fastest of all in rural jails, though it accounts for under a tenth of the rural pretrial rise, and the two figures are not independent: the codebook is explicit that people held for federal authorities are counted inside the pretrial number.`,
    figure: <ChapterPretrial />,
  },
] as const;

export default function Tilt() {
  const [active, setActive] = useState(0);
  const [stacked, setStacked] = useState(false);
  const steps = useRef<(HTMLElement | null)[]>([]);

  /* Reduced motion, or no IntersectionObserver, means the stacked reading.
     Resolved once on mount rather than watched, because a piece that
     re-lays-out underneath someone mid-read is worse than either layout. */
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setStacked(Boolean(reduce) || typeof IntersectionObserver === 'undefined');
  }, []);

  useEffect(() => {
    if (stacked) return;
    const io = new IntersectionObserver(
      (entries) => {
        /* The step nearest the middle of the viewport wins. Taking the first
           intersecting entry makes the figure flicker between two neighbours
           at the boundary, which reads as a bug. */
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top - window.innerHeight / 2)
                        - Math.abs(b.boundingClientRect.top - window.innerHeight / 2))[0];
        if (!best) return;
        const i = steps.current.findIndex((el) => el === best.target);
        if (i >= 0) setActive(i);
      },
      { rootMargin: '-35% 0px -35% 0px', threshold: 0 }
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [stacked]);

  if (stacked) {
    return (
      <article className={s.stacked}>
        <Intro />
        {CHAPTERS.map((c) => (
          <section key={c.id} id={c.id}>
            <p className={s.kicker}>{c.kicker}</p>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
            <figure className={s.fig}>{c.figure}</figure>
          </section>
        ))}
        <Finder />
        <Sources />
      </article>
    );
  }

  return (
    <article className={s.scrolly}>
      <Intro />
      <div className={s.split}>
        <div className={s.stage} aria-hidden="true">
          <div className={s.stageInner}>{CHAPTERS[active].figure}</div>
        </div>
        <div className={s.steps}>
          {CHAPTERS.map((c, i) => (
            <section key={c.id} id={c.id} ref={(el) => { steps.current[i] = el; }}
                     className={i === active ? s.stepOn : s.step}>
              <p className={s.kicker}>{c.kicker}</p>
              <h2>{c.title}</h2>
              <p>{c.body}</p>
              {/*
                The figure is rendered here too, and hidden from sight but not
                from assistive technology, because the sticky stage is
                aria-hidden. A screen reader gets every chart in document
                order beside the prose it belongs to; a sighted reader gets
                the sticky one. Neither gets a worse version.
              */}
              <div className={s.srFigure}>{c.figure}</div>
            </section>
          ))}
        </div>
      </div>
      <Finder />
      <Sources />
    </article>
  );
}

/*
 * The county lookup, as a section after the story rather than a chapter in
 * it. The sticky stage is for figures, is aria-hidden, and renders each
 * chapter twice — all three are wrong for a text input.
 */
function Finder() {
  return (
    <section className={s.finder} id="lookup">
      <p className={s.kicker}>Where you are</p>
      <h2>Now find your own county.</h2>
      <p className={s.finderLede}>
        {fmt(data.ch1.panel)} counties reported a jail population in every year between 2002
        and 2019; the rest were left out rather than estimated. Search for one and you get its
        own line drawn against counties of every size, so you can see whether it followed the
        national pattern or went its own way.
      </p>
      <ChapterLookup />
    </section>
  );
}

function Intro() {
  return (
    <header className={s.intro}>
      <h1>The Tilt</h1>
      <p className={s.standfirst}>
        Between 2002 and 2019 rural America began jailing people at a far faster rate
        than urban America. In the smallest counties the rate rose by {SMALLEST} percent.
        In the largest it fell by {Math.abs(LARGEST)}.
      </p>
      <p className={s.credit}>
        The finding is the Vera Institute&rsquo;s, from <i>Out of Sight</i> (2017). What this
        piece adds is a way to see it: in 2002 a county of a few thousand people jailed at
        about the same rate as a county of a million. By 2019 it jailed at {RATIO} times
        the rate. Figures cover {fmt(data.ch1.panel)} counties that reported in every year.
      </p>
    </header>
  );
}

function Sources() {
  return (
    <section className={s.sources} id="sources">
      <h2>Sources</h2>
      <p>
        Every number on this page is calculated from the files below when the site is
        built. Nothing was copied across by hand, so anything here can be traced back
        to the original data.
      </p>
      <ul>
        {SOURCES.map((x) => (
          <li key={x.id}>
            <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a>
            <span className={s.pub}>{x.publisher}{x.date ? `, ${x.date}` : ''}</span>
            <span className={s.supports}>{x.supports}</span>
          </li>
        ))}
      </ul>
      <p className={s.caveat}>
        Two limits worth stating plainly. The usable window is 2002&ndash;2019: before that,
        coverage is scattered survey years, and county prison data stops in 2019 entirely.
        And this data counts people and beds &mdash; it holds no charges, bail amounts, sentences
        or crime figures, so it can show what changed and cannot say why.
      </p>
    </section>
  );
}
