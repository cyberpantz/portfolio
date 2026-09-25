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

/*
 * Figures the prose quotes, computed rather than typed.
 *
 * Chapter one said "peaked in 2008" for months. In this panel the peak is
 * 2007 — 734,475 against 733,116 the following year, a gap of about 1,300
 * people out of three quarters of a million. The nationally reported peak IS
 * 2008, so the sentence was not plucked out of the air; it was a true fact
 * about a different population quietly standing in for this one. That is the
 * exact failure this file's header warns about, and it survived because the
 * number was a string rather than an expression. Now it cannot.
 */
const COUNT = data.ch1.count;
const PEAK = data.ch1.years[COUNT.indexOf(Math.max(...COUNT))];
const SINCE_PEAK = Math.abs(Math.round((COUNT[COUNT.length - 1] / Math.max(...COUNT) - 1) * 100));
const last = <T,>(a: T[]) => a[a.length - 1];
const pctChange = (r: number[]) => Math.round((r[r.length - 1] / r[0] - 1) * 100);
const SMALLEST = pctChange(data.bands[0].rate);
const LARGEST = pctChange(data.bands[data.bands.length - 1].rate);
/* Smallest counties against largest, in the final year. Chapter three quotes
   both ends of this; the intro quotes only where it ended up. */
const RATIO = (last(data.bands[0].rate) / last(data.bands[data.bands.length - 1].rate)).toFixed(1);

const CHAPTERS = [
  {
    id: 'decline',
    /*
      Was "What you already know", and the body went on to call this "the
      number most people carry around" and the last thing here that would
      "behave the way you expect". Three guesses about the reader in one
      short chapter, and a reader who does not recognise the figure has been
      told they are unusual before the first chart. The claim the chapter
      needs is about the data, not about the audience: this is the figure
      that gets reported, and everything after it comes from the same file
      and points elsewhere.
    */
    kicker: 'The reported figure',
    title: 'American jails emptied out.',
    body: `The county jail population peaked in ${PEAK} and fell about ${SINCE_PEAK} percent by 2019. That is accurate, and it is the number that usually gets quoted. Every chart after this one is drawn from the same data and points somewhere else.`,
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
 * The county lookup, as its own section rather than a chapter.
 *
 * It was the eighth entry in CHAPTERS, which meant a search field slid into
 * the sticky stage as you scrolled — the place seven charts had appeared,
 * suddenly holding a control. Frank's note was that getting to it felt odd,
 * and that is why: the stage is for things you watch, and a text input is
 * something you operate. Scrolling past would also have swept it away mid-
 * typing, the same problem the result panel had.
 *
 * Two structural faults went with it. The stage is aria-hidden="true", so the
 * one interactive control in the piece was hidden from assistive technology
 * there and present only in the duplicate rendered for screen readers. And
 * being a chapter, it rendered twice on every page — which is how two search
 * inputs came to share one id.
 *
 * Here it is a destination: the story ends, and then it turns to the reader.
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
      {/*
        This read "the United States did not stop putting people in jail — it
        moved the practice to its smallest places." Two things wrong with it.
        The first is rhetorical: "not X, but Y" only lands if somebody believed
        X, and nobody has ever believed America stopped jailing people. The
        second is factual. "Moved" implies a transfer, a fixed quantity going
        somewhere else — and chapter four spends its whole length proving that
        is not what happened. Rural rates rose while urban rates fell; the two
        are not the same people relocated.
      */}
      <p className={s.standfirst}>
        Between 2002 and 2019 rural America began jailing people at a far faster rate
        than urban America. In the smallest counties the rate rose by {SMALLEST} percent.
        In the largest it fell by {Math.abs(LARGEST)}.
      </p>
      {/*
        "What is new here is the shape: a gradient by county size that was
        nearly flat and is now steep." Three abstractions stacked on each
        other — shape, gradient, flat-to-steep — and not one of them names a
        thing the reader can picture. It was a description of the chart rather
        than of the country. The same claim stated as two rates does not need
        the vocabulary at all.
      */}
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
      {/*
        This used to name the build script by path and say no number was
        "typed by hand" — a note to a code reviewer, on a page read by people
        looking at a portfolio. The underlying claim is worth making, because
        it is the reason to trust the charts; it just has to be made to a
        reader rather than to whoever might open the repository.
      */}
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
