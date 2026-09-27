/**
 * Half — the world's twenty-five richest people, and what they give back.
 *
 * Named for the promise: the Giving Pledge asks for at least half. Tilt's
 * engine — a sticky figure, prose steps, an IntersectionObserver, no
 * interference with the scroll — and Tilt's rules: every figure from the
 * data file, every claim pointing at a source, and no verdict written
 * anywhere. The filings say it.
 */
import { useEffect, useRef, useState } from 'react';
import data from '../../data/half.json';
import { SOURCES, byId } from '../../data/half-sources';
import {
  Squares, Paired, Pledge, Payout, Horizon, Mechanisms, Founders, Scores, Coverage,
  PEOPLE, SUMMARY, CONTEXT, money,
} from './figures';
import s from './half.module.css';

const pct = (n: number) => `${n}%`;
const fmt = (n: number) => n.toLocaleString('en-US');
const by = (slug: string) => {
  const p = PEOPLE.find((x) => x.slug === slug);
  if (!p) throw new Error(`Half: no person "${slug}"`);
  return p;
};

const musk = by('elon-musk'), huang = by('jensen-huang'), page = by('larry-page'), dell = by('michael-dell');
const brin = by('sergey-brin'), gates = by('bill-gates'), buffett = by('warren-buffett'), bloomberg = by('michael-bloomberg');
const ips15 = CONTEXT.assessments.find((a) => /at 15/.test(a.source))!;
const chronicle = CONTEXT.assessments.find((a) => /Chronicle/.test(a.source))!;
const f15 = ips15.figures as Record<string, string | number>;
const fig = (m: string, key: string) => {
  const hit = CONTEXT.shelters.find((x) => x.mechanism === m && x.figures && key in (x.figures as object));
  if (!hit) throw new Error(`Half: no shelter figure "${key}" under ${m}`);
  return (hit.figures as Record<string, string | number>)[key];
};
const DAF_HELD = fig('daf', 'assets_per_dollar_granted_big4_2025');
const MEDIAN_PAYOUT = fig('payout-shortfall', 'median_payout_billion_dollar_foundations_2024_pct');
const SUBSIDY = String(f15.public_subsidy_per_dollar ?? '').replace(/^up to /, '');
const SIGNED_PCT = (chronicle.figures as Record<string, number>).us_billionaires_signed_pct;
const dollars = (v: string | number) => Number(String(v).replace(/[^\d.]/g, ''));
const WALTON_CB = dollars(fig('related-party', 'crystal_bridges_grants_2010_usd'));
const WALTON_OTHER = dollars(fig('related-party', 'other_home_region_2010_usd'));
const shortfall = SUMMARY.shortfallThisYear.map((slug) => by(slug).name.split(' ').pop()).join(', ');
const nonFilers = PEOPLE.filter((p) => !p.filesUS).length;
const withNothing = PEOPLE.filter((p) => !p.filesUS && !p.foundation?.paidOut).length;
const now = Number(data.built.slice(0, 4));
const muskHalf = now + (musk.derived.yearsToHalf ?? 0);

const CHAPTERS = [
  {
    id: 'pile',
    kicker: 'The twenty-five',
    title: `${money(SUMMARY.totalWealth)}, between them.`,
    body: <>Forbes’ real-time list, {SUMMARY.listDate}<Cite id="forbes-list" />. Drawn to area. {musk.name.split(' ')[1]} alone is {money(musk.wealth)}<Cite id="forbes-profiles" /> — more than the next three together.</>,
    figure: <Squares />,
  },
  {
    id: 'paired',
    kicker: 'Wealth against giving',
    title: 'To the same scale.',
    body: <>Lifetime giving, where it is known, drawn beside the fortune it came from<Cite id="forbes-top-givers" />. {buffett.name.split(' ')[1]} has given {money(buffett.lifetime!.amount)}; {gates.name.split(' ')[1]} {money(gates.lifetime!.amount)}. For the rest of the list the lower bar is a hairline, or absent because no figure exists.</>,
    figure: <Paired />,
  },
  {
    id: 'pledge',
    kicker: 'The promise',
    title: `${SUMMARY.pledgers} of ${SUMMARY.count} have signed.`,
    body: <>The Giving Pledge asks for at least half, in life or at death<Cite id="giving-pledge" />. Across all American billionaires, about {SIGNED_PCT}% have signed<Cite id="chronicle-pledge" />. Signatories’ wealth has grown {f15.net_worth_growth_since_2010_pct}% since they signed; one living pledger has met it<Cite id="ips-15" />. {musk.name.split(' ')[1]} signed at {money(musk.pledge.wealthAtSigning)} and is now {musk.derived.growthSincePledge}× that. Peter Thiel says he told Musk “it would be much worse to give it to Bill Gates”<Cite id="fortune-thiel" />.</>,
    figure: <Pledge />,
  },
  {
    id: 'payout',
    kicker: 'The foundations',
    title: 'The law asks for five per cent a year.',
    body: <>Read from each foundation’s own IRS filing<Cite id="irs-990pf" />. {huang.name.split(' ')[1]}’s paid out {pct(huang.foundation!.payoutRate!)} of {money(huang.foundation!.assets)}. {page.name.split(' ')[1]}’s {pct(page.foundation!.payoutRate!)}, {dell.name.split(' ')[1]}’s {pct(dell.foundation!.payoutRate!)}, {musk.name.split(' ')[1]}’s {pct(musk.foundation!.payoutRate!)}. {shortfall} paid less than the year required; {money(SUMMARY.carriedForward)} is owed into next year. Across the 144 largest foundations the median is {MEDIAN_PAYOUT}% — the minimum, met and not exceeded<Cite id="ips-2026" />.</>,
    figure: <Payout />,
  },
  {
    id: 'horizon',
    kicker: 'At that rate',
    title: 'The year they would reach half.',
    body: <>Take the latest year’s payout and hold it steady. {musk.name.split(' ')[1]} would have given away half his fortune in the year {muskHalf}. {brin.name.split(' ')[1]}, whose foundation paid out {pct(brin.foundation!.payoutRate!)}, is the exception on this list. The axis is logarithmic, because it has to be.</>,
    figure: <Horizon />,
  },
  {
    id: 'mechanisms',
    kicker: 'How it stays home',
    title: 'Given, and not gone.',
    body: <>A grant to a donor-advised fund counts as paid out and is never disclosed onward; the {huang.name.split(' ')[1]} foundation has mostly given stock to one<Cite id="bloomberg-huang" />. An LLC files nothing<Cite id="forbes-czi" />. About half the Musk Foundation’s grants in 2021–22 went to interests tied to Musk<Cite id="nyt-musk-foundation" />. In 2010 the Walton Family Foundation gave {money(WALTON_CB)} to Crystal Bridges, the Walton museum in the Walton home town, and {money(WALTON_OTHER)} to everything else there<Cite id="wff-crystal-bridges" />. The four largest DAF sponsors hold ${DAF_HELD} for every dollar they grant<Cite id="ips-2026" />.</>,
    figure: <Mechanisms />,
  },
  {
    id: 'founders',
    kicker: 'The men who invented it',
    title: 'Sixteen years on.',
    body: <>Buffett and Gates launched the Pledge in 2010. In 2024 Buffett said his commitments to the Gates Foundation would expire at his death<Cite id="berkshire-2024" />; in 2025 that “grand philanthropic plans … did not prove feasible”<Cite id="berkshire-2025" />; in July 2026 he gave his remaining shares to his children’s foundations and the Gates Foundation nothing, for the first time since 2006<Cite id="berkshire-2026" /> — after {money(48e9)}<Cite id="fortune-buffett-gates" />. Gates will close his foundation in 2045<Cite id="npr-gates-2045" />. Melinda French Gates, on the Pledge: “Have they given enough? No.”<Cite id="fortune-french-gates" /></>,
    figure: <Founders />,
  },
  {
    id: 'scores',
    kicker: 'Forbes’ own grade',
    title: 'No one scored a three or a four.',
    body: <>Forbes rates every billionaire’s giving from one to five, as a share of wealth given away<Cite id="forbes-profiles" />. Of the twenty-five: {SUMMARY.scores['1']} scored one, {SUMMARY.scores['2']} scored two, {SUMMARY.scores['5']} scored five. The middle is empty.</>,
    figure: <Scores />,
  },
  {
    id: 'coverage',
    kicker: 'What cannot be seen',
    title: `${nonFilers} of the ${SUMMARY.count} file nothing in the United States.`,
    body: <>A private foundation there must file a public return every year<Cite id="irs-990pf" />. Nowhere else on this list is that true. Three of the {nonFilers} publish a figure of their own; {withNothing} publish nothing at all. Their squares in the first chapter are as large as anyone’s.</>,
    figure: <Coverage />,
  },
] as const;

export default function Half() {
  const [active, setActive] = useState(0);
  const [stacked, setStacked] = useState(false);
  const steps = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setStacked(Boolean(reduce) || typeof IntersectionObserver === 'undefined');
  }, []);

  useEffect(() => {
    if (stacked) return;
    const io = new IntersectionObserver(
      (entries) => {
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
        <Notes />
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
              <div className={s.srFigure}>{c.figure}</div>
            </section>
          ))}
        </div>
      </div>
      <Notes />
      <Sources />
    </article>
  );
}

/* ------------------------------------------------------------ sections */

function Intro() {
  return (
    <header className={s.intro}>
      <h1>Half</h1>
      <p className={s.standfirst}>
        The Giving Pledge asks the very rich for at least half. Sixteen years on, the twenty-five
        richest people alive hold {money(SUMMARY.totalWealth)}. This is what their own filings say
        they have given.
      </p>
      <div className={s.numbers}>
        <div><b>{SUMMARY.pledgers}</b><span>of the {SUMMARY.count} have signed</span></div>
        <div><b>{money(SUMMARY.foundationPaidOut)}</b><span>paid out by their foundations in the latest year read</span></div>
        <div><b>{money(SUMMARY.carriedForward)}</b><span>owed into the following year</span></div>
        <div><b>{SUMMARY.scores['1']}</b><span>scored one out of five by Forbes</span></div>
      </div>
      <p className={s.credit}>
        Wealth as of {SUMMARY.listDate}. Foundation figures from IRS Form 990-PF, fair-market value,
        read line by line. Every figure is computed from the sources at the end; none is typed by hand.
      </p>
    </header>
  );
}

function Cite({ id }: { id: string }) {
  const i = SOURCES.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`Half: cited unknown source "${id}"`);
  return (
    <a className={s.cite} href={`#src-${id}`} aria-label={`Source ${i + 1}: ${byId(id).title}`}>
      {i + 1}
    </a>
  );
}

function Notes() {
  const bezos = by('jeff-bezos');
  return (
    <section className={s.essay} id="notes">
      <p className={s.kicker}>What this is not saying</p>
      <h2>Read the filings, not the headlines.</h2>

      <h3>Not that nobody gives</h3>
      <p>
        {buffett.name} has given {money(buffett.lifetime!.amount)}<Cite id="forbes-top-givers" />,
        {' '}{gates.name} {money(gates.lifetime!.amount)}, {bloomberg.name} {money(bloomberg.lifetime!.amount)}.
        {' '}{brin.name}’s foundation paid out {pct(brin.foundation!.payoutRate!)} of its assets last
        year<Cite id="irs-990pf" />. The Pledge’s founders are the reason the top of the chart is not empty.
      </p>

      <h3>Not that a foundation is a fraud</h3>
      <p>
        Paying out less than five per cent in a year is legal; the balance is owed by the end of the
        next<Cite id="irs-990pf" />. A donor-advised fund is legal. An LLC is legal. The one
        court-adjudicated case of foundation self-dealing cited here is from outside the twenty-five,
        and is labelled so<Cite id="nyag-trump" />. What the filings show is not crime. It is what the
        rules permit, and how fully it is used.
      </p>

      <h3>Not that the Bezos foundation is his</h3>
      <p>
        The only Bezos foundation that files a public return is run by his parents; he is an unpaid
        director, and its figures are not shown as his giving. His own vehicle filed
        {' '}{money(0)} of grants against {money(13.9e6)} of expenses in its last return<Cite id="propublica-bezos-earth" />.
        No lifetime figure for {bezos.name.split(' ')[1]} is drawn: the one that exists is {money(bezos.lifetime?.amount)}
        {' '}through 2025<Cite id="forbes-top-givers" />, against {money(bezos.wealth)}.
      </p>

      <h3>What it costs the rest of us</h3>
      <p>
        A gift of appreciated stock avoids the capital-gains tax and takes the income-tax deduction
        both<Cite id="tpc-subsidy" />. The Institute for Policy Studies puts the public share of a
        top-bracket gift at up to {SUBSIDY} on the dollar<Cite id="ips-15" />.
        Every dollar in these foundations was, in part, redirected tax.
      </p>

      <dl className={s.method}>
        <div><dt>The list</dt><dd>Forbes real-time, {SUMMARY.listDate}. Ranks move daily; the date is the fact.</dd></div>
        <div><dt>Payout rate</dt><dd>Qualifying distributions divided by fair-market value of assets, both from the same year’s Form 990-PF. Book values were rejected — they understate assets several-fold, and made one foundation appear to pay out more than it held.</dd></div>
        <div><dt>Years to half</dt><dd>(half of wealth, less lifetime giving) ÷ the latest year’s payout. A projection of a rate, not a forecast.</dd></div>
        <div><dt>Attribution</dt><dd>Two calls are made in the build script, where they can be read: the Bezos Family Foundation is not his giving; the Buffett filing was read from the IRS e-file and is primary.</dd></div>
        <div><dt>Status</dt><dd>Every source is graded. Nothing marked needs-check draws a bar. The full register — {' '}every URL the research touched — is <code>docs/research/half/SOURCES.md</code>.</dd></div>
        <div><dt>Built</dt><dd>{data.built}, by <code>scripts/half-data.mjs</code>.</dd></div>
      </dl>
    </section>
  );
}

function Sources() {
  return (
    <section className={s.sources} id="sources">
      <h2>Sources</h2>
      <p>Numbered in the order they are cited. The kind of document is printed next to each.</p>
      <ul>
        {SOURCES.map((src, i) => (
          <li key={src.id} id={`src-${src.id}`}>
            <span className={s.srcHead}>
              <b>{i + 1}</b> <a href={src.url} rel="noopener">{src.title}</a>
              <span className={s.kind}>{src.kind}</span>
            </span>
            <span className={s.pub}>{src.author ? `${src.author} · ` : ''}{src.publisher}{src.date ? ` · ${src.date}` : ''}</span>
            <span className={s.supports}>{src.supports}</span>
            {src.note && <span className={s.caveat}>{src.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Referenced so the build keeps them and the suite can render them alone. */
export const FIGURES = { Squares, Paired, Pledge, Payout, Horizon, Mechanisms, Founders, Scores, Coverage };
export { fmt };
