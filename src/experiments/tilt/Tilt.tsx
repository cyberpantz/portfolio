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
import { SOURCES, byId } from '../../data/incarceration-sources';
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
const TRANSFERS = data.ch4.transfers;
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
    body: `In 2002 a county of three thousand people jailed at roughly the same rate as a county of a million — ${RATIO02} times, close enough to call flat. By 2019 it was ${RATIO} times. Ranked by size, each band above 5,000 residents jails at a lower rate than the band below it, and has done in every year of this panel. Counties under 5,000 are the exception, sitting below their neighbours: more than a third share a regional jail instead of running their own, so their rate is measured on a different basis.`,
    figure: <ChapterTilt />,
  },
  {
    id: 'eliminations',
    /*
      Was "Three things it is not" / "The obvious explanations do not
      survive", and it overclaimed twice.
      
      These three hypotheses came from a conversation, not from the
      literature, so "the obvious explanations" promises a sweep that was
      never done. Worse, the transfers test was wrong: it read a flat SHARE
      as an absent cause. Held-for-others held near a third of the rural jail
      population throughout, which means it grew in step with everything else
      and supplied 28% of the increase. Vera names it as one of two drivers,
      and this chapter was denying it.
      
      The conclusion survives — most of the growth is locally driven — but it
      is now stated as an attribution rather than an elimination.
    */
    kicker: 'Testing three explanations',
    title: 'Most of it is local.',
    body: `Rural jail populations rose ${TRANSFERS.growth} percent. People held for other authorities — state prisons, federal agencies, other counties — account for ${TRANSFERS.heldShareOfGrowth} percent of that increase, leaving ${TRANSFERS.localShareOfGrowth} percent held on local authority. Cities shipping people to rural jails is the smallest piece: jail-to-jail transfers doubled, from ${fmt(TRANSFERS.otherJail.from)} to ${fmt(TRANSFERS.otherJail.to)}, but that is ${TRANSFERS.otherJail.shareOfGrowth} percent of the growth. Displacement into rural counties cannot explain it either, since rural America lost population over this period. Changing demographics is the one this data cannot settle: the Latino share of rural residents rose about three points, which is small beside the move in the rate, but a composition shift is not a test.`,
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
        <Conclusion />
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
      <Conclusion />
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
/*
 * A numbered citation that jumps to the source list. The chapters cite their
 * own data file under each chart; this section makes claims the data cannot
 * support on its own, so every one of them has to point somewhere.
 */
function Cite({ id }: { id: string }) {
  const i = SOURCES.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`Tilt: cited unknown source "${id}"`);
  return (
    <a className={s.cite} href={`#src-${id}`} aria-label={`Source ${i + 1}: ${byId(id).title}`}>
      {i + 1}
    </a>
  );
}

function Conclusion() {
  return (
    <section className={s.essay} id="what-follows">
      <p className={s.kicker}>What follows</p>
      <h2>The building is the decision.</h2>

      <p>
        A jail is not a policy that can be revised next year. It is a structure with a
        thirty-year debt attached, and once the beds exist somebody fills them. Since 2002 more
        than 1,200 counties have spent over $42 billion adding jail capacity, through two decades
        in which the national jail population fell<Cite id="vera-scale" />. The advertised price
        is not the price: across thirty years, roughly nine tenths of what a jail costs is running
        it, not building it<Cite id="vera-scale" />.
      </p>

      <h3>Nobody with a statewide mandate decides this</h3>
      <p>
        Jails are county property. The sheriff decides who is booked and who is released, the
        commissioners decide what gets built, and almost no state reviews either
        choice<Cite id="littman-sheriffs" />. Sheriff elections are typically quiet and rarely
        contested<Cite id="farris-holman-badge" />. So the single largest capital commitment a
        rural county makes is set by a handful of local officials, on a question almost nobody
        campaigns on.
      </p>

      <h3>The forecast and the contract are often the same firm</h3>
      <p>
        Counties hire architecture firms to estimate how many beds they will need, and those
        firms frequently go on to design the jail they recommended. In Indiana, three firms
        designed roughly 90 percent of recent projects. The needs assessments extrapolate from
        past population rather than from local policy, and they recommend expansion even where
        crime and residents are both projected to fall<Cite id="intercept-architects" />. Vera
        documents the same conflict independently<Cite id="vera-scale" />.
      </p>

      <h3>And the vote can be routed around</h3>
      <p>
        A general obligation bond is backed by taxes and usually needs public approval. A
        lease-purchase agreement is not and does not — and it is used in counties where voters
        have already rejected a jail bond<Cite id="vera-scale" />. The debt is real either way:
        jail bonds carry the second-highest default rate in the municipal
        market<Cite id="vera-scale" />. Grant County, Kentucky built to rent beds to the state
        and approached insolvency when the state stopped sending
        people<Cite id="vera-build-it" />.
      </p>

      <h3>Is it a party story? Mostly not</h3>
      <p>
        The obvious reading is partisan, and the best available test does not support it. A
        regression discontinuity across more than 3,200 partisan sheriff elections finds
        Democratic and Republican sheriffs comply with federal immigration detainers at close to
        the same rate<Cite id="thompson-sheriffs" />. What predicts behaviour is the individual
        officeholder, and the building. A county that has borrowed against future occupancy has
        an interest in occupancy regardless of who wins.
      </p>

      <h3>What it costs the people inside</h3>
      <p>
        Most people in an American jail have not been convicted of anything. That detention is
        not a neutral wait: using the random assignment of bail judges, being held before trial
        raises the chance of conviction — mostly by producing guilty pleas — and lowers formal
        employment afterwards<Cite id="dobbie-pretrial" />. The smallest jails have the highest
        death rates, in some years more than double the overall rate<Cite id="ppi-jail-mortality" />,
        and there is no reliable national count of those deaths: a bipartisan Senate
        investigation found the Justice Department had missed at least a thousand in a single
        year<Cite id="senate-deaths" />. Boyd County, Kentucky expanded from 93 beds to 202 in
        2006 and held 286 people by 2021<Cite id="quandt-rural-deaths" />.
      </p>

      <h3>The lever exists</h3>
      <p>
        Jail populations are not a readout of crime. They respond to booking, bail and release
        practices, which is why they fell so far so fast in 2020 — and a synthetic-control study
        of all 58 California counties finds no consistent link between that decarceration and
        county crime<Cite id="kubrin-covid" />. One state and one short window, so it shows the
        lever works rather than that pulling it is free.
      </p>

      <p>
        Which leaves the tilt in this piece looking less like a trend and more like an
        accumulation of local decisions that each seemed small. Rural towns pursue these
        facilities for standing and a sense of order as much as for
        jobs<Cite id="eason-bighouse" />, which is why the economics failing has not stopped the
        building. The beds outlast the crime rate that justified them, the sheriff who wanted
        them, and the argument that built them.
      </p>
    </section>
  );
}

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
      <h2>Method</h2>
      <dl className={s.method}>
        <div>
          <dt>Balanced panels</dt>
          <dd>
            Counties enter and leave the jail survey from year to year. A chart drawn on
            whoever reported that year measures the reporting, not the jailing. Every series
            here uses only counties present with the required field in all eighteen years:
            {' '}{fmt(data.ch1.panel)} of roughly 3,100 for jail population, fewer for capacity
            and pretrial. Missing years are dropped, never interpolated.
          </dd>
        </div>
        <div>
          <dt>Rates, not counts</dt>
          <dd>
            Per 100,000 residents aged 15&ndash;64 — Vera&rsquo;s denominator, and roughly the
            population at risk of arrest. Counts alone hide the story, because the largest
            counties hold most of the people and their direction becomes the national
            direction. Chapter two shows the counts so that chapter three&rsquo;s rates mean
            something.
          </dd>
        </div>
        <div>
          <dt>Size bands fixed at 2002</dt>
          <dd>
            Each county is assigned to a band by its 2002 population and stays there. Reassigning
            every year would let counties migrate between bands as they grow or shrink, and the
            chart would then be partly measuring that migration.
          </dd>
        </div>
        <div>
          <dt>Why pretrial is never shown as a share</dt>
          <dd>
            Total jail population is an average across the year; the pretrial figure is a
            single-day count each June. Dividing one by the other looks like a percentage and
            is not one, so pretrial appears here only as its own rate. People held for federal
            authorities, ICE among them, are counted inside the pretrial number — so those two
            series overlap and cannot be added.
          </dd>
        </div>
        <div>
          <dt>Bands are aggregates, not typical counties</dt>
          <dd>
            A band&rsquo;s line is everyone in it — total jail population over total residents —
            so it follows the larger counties within each band. Individual counties scatter
            widely around it, and the spread inside one band is far larger than the gap between
            bands: among counties of 10,000 to 25,000 the middle one jailed at 493 per 100,000
            in 2019, while a tenth were below 190 and a tenth above 1,022. The ladder is a
            statement about bands. It is not a rule that a bigger county jails less, and the
            county search below will show you plenty of exceptions.
          </dd>
        </div>
        <div>
          <dt>Percentiles</dt>
          <dd>
            A county&rsquo;s rank is its position among the {fmt(data.ch1.panel)} panel counties
            by 2019 rate. It describes this panel, not all US counties — the excluded ones skew
            rural and small.
          </dd>
        </div>
      </dl>

      <h2>Sources</h2>
      <ul>
        {SOURCES.map((x, i) => (
          <li key={x.id} id={`src-${x.id}`}>
            <span className={s.srcHead}>
              <b>{i + 1}</b>
              <a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a>
            </span>
            <span className={s.pub}>
              <em className={s.kind}>{x.kind}</em>
              {x.author ? `${x.author} · ` : ''}{x.publisher}{x.date ? `, ${x.date}` : ''}
              {x.openCopy ? ' · free copy of a paywalled work' : ''}
            </span>
            <span className={s.supports}>{x.supports}</span>
            {x.note && <span className={s.srcNote}>{x.note}</span>}
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
