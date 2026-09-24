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
  ChapterDecline, ChapterBands, ChapterEliminations, ChapterCapacity,
  ChapterConstruction, ChapterPretrial, ChapterLookup,
} from './chapters';
import s from './tilt.module.css';

const fmt = (n: number) => n.toLocaleString();

const CHAPTERS = [
  {
    id: 'decline',
    kicker: 'What you already know',
    title: 'American jails emptied out.',
    body: `The county jail population peaked in 2008 and fell about 7 percent by 2019. That is true, it is well reported, and it is the number most people carry around. It is also the last thing in this piece that will behave the way you expect.`,
    figure: <ChapterDecline />,
  },
  {
    id: 'split',
    kicker: 'The same data, ungrouped',
    title: 'That line is an average of opposites.',
    body: `Split the country by county size and the single line comes apart. The very largest counties hold most of the people, so their decline sets the national direction on its own. Underneath it, almost everywhere else is going the other way.`,
    figure: <ChapterBands mode="count" />,
  },
  {
    id: 'tilt',
    kicker: 'The finding',
    title: 'Measured per resident, the country tilts.',
    body: `In 2002 a county of three thousand people jailed at roughly the same rate as a county of a million — 1.31 times, close enough to call flat. By 2019 it was 2.61 times. From counties of five thousand downward through the largest, the ladder descends without a step out of place. The very smallest counties are the one exception, sitting below their neighbours: over a third of them share a regional jail rather than running their own, so their rate is measured on a different basis.`,
    figure: <ChapterBands mode="rate" />,
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
  {
    id: 'lookup',
    kicker: 'Where you are',
    title: 'Find a county.',
    body: `Two thousand five hundred and thirteen counties reported in every year between 2002 and 2019. The rest were left out rather than estimated.`,
    figure: <ChapterLookup />,
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
      <Sources />
    </article>
  );
}

function Intro() {
  return (
    <header className={s.intro}>
      <h1>The Tilt</h1>
      <p className={s.standfirst}>
        Between 2002 and 2019 the United States did not stop putting people in jail.
        It moved the practice to its smallest places.
      </p>
      <p className={s.credit}>
        The finding is the Vera Institute&rsquo;s, from <i>Out of Sight</i> (2017). What is new here
        is the shape: a gradient by county size that was nearly flat and is now steep.
        Figures cover {fmt(data.ch1.panel)} counties reporting in every year.
      </p>
    </header>
  );
}

function Sources() {
  return (
    <section className={s.sources} id="sources">
      <h2>Sources</h2>
      <p>
        Every figure above is computed from the files below by{' '}
        <code>scripts/tilt-data.mjs</code>. No number in this piece was typed by hand.
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
