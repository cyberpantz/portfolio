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

/* Prose speaks its numbers; the charts abbreviate theirs. */
const pct = (n: number) => `${(Math.round(n * 10) / 10).toString()} percent`;
const fmt = (n: number) => n.toLocaleString('en-US');
const words = (n: number | null | undefined) =>
  n == null ? '—'
  : n >= 1e12 ? `$${(n / 1e12).toFixed(2)} trillion`
  : n >= 1e9 ? `$${(n / 1e9) % 1 ? (n / 1e9).toFixed(1) : (n / 1e9).toFixed(0)} billion`
  : n >= 1e6 ? `$${Math.round(n / 1e6)} million`
  : `$${Math.round(n).toLocaleString('en-US')}`;
const longDate = (iso: string) => new Date(iso + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const times = (x: number) => `${Math.round(x / 10) * 10}`;
const spell = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] ?? String(n);
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
const shortfall = (() => {
  const names = SUMMARY.shortfallThisYear.map((slug) => by(slug).name.split(' ').pop()!);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
})();
const nonFilers = PEOPLE.filter((p) => !p.filesUS).length;
const foreign = PEOPLE.filter((p) => !/^United States/.test(p.citizenship ?? '')).length;
const withNothing = PEOPLE.filter((p) => !p.filesUS && !p.foundation?.paidOut).length;
const publishOwn = nonFilers - withNothing;
const now = Number(data.built.slice(0, 4));
const muskHalf = now + (musk.derived.yearsToHalf ?? 0);

const CHAPTERS = [
  {
    id: 'pile',
    kicker: 'The twenty-five',
    title: `Between them, ${words(SUMMARY.totalWealth)}.`,
    body: <>These are the twenty-five richest people alive, as Forbes counted them on {longDate(SUMMARY.listDate)}<Cite id="forbes-list" />, drawn as squares whose area is their fortune. The teal one is {musk.name}. At {words(musk.wealth)}<Cite id="forbes-profiles" /> he is worth more than the next three together, and the square is the only way to show it: as a bar, everyone else would be a tick on his ruler.</>,
    figure: <Squares />,
  },
  {
    id: 'paired',
    kicker: 'Wealth against giving',
    title: 'What each has given, drawn to the same scale as what each has.',
    body: <>The upper bar is the fortune; the lower is lifetime giving, where a figure exists<Cite id="forbes-top-givers" />. {buffett.name} has given away {words(buffett.lifetime!.amount)}, and {gates.name} {words(gates.lifetime!.amount)}, and you can see it. For most of the list the lower bar is a hairline. Where there is no bar at all, it is because nobody — not Forbes, not the Chronicle of Philanthropy, not the person — has ever put a number on it.</>,
    figure: <Paired />,
  },
  {
    id: 'pledge',
    kicker: 'The promise',
    title: `${spell(SUMMARY.pledgers).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five have promised half.`,
    body: <>The Giving Pledge asks the very rich to give away at least half of what they have, in life or at death<Cite id="giving-pledge" />. About {SIGNED_PCT} percent of American billionaires have signed<Cite id="chronicle-pledge" />. Those who did are, as a group, {f15.net_worth_growth_since_2010_pct} percent richer than the day they signed, and exactly one living signatory has kept the promise<Cite id="ips-15" />. {musk.name} signed in {musk.pledge.year}, when he was worth {words(musk.pledge.wealthAtSigning)}. He is now worth roughly {times(musk.derived.growthSincePledge!)} times that. Peter Thiel says he told him “it would be much worse to give it to Bill Gates”<Cite id="fortune-thiel" />.</>,
    figure: <Pledge />,
  },
  {
    id: 'payout',
    kicker: 'The foundations',
    title: 'The law asks a foundation to give away five percent a year. Here is who does.',
    body: <>Every American private foundation must file a public return with the IRS, and these figures are read from those returns, line by line<Cite id="irs-990pf" />. Last year the {huang.name} foundation paid out {pct(huang.foundation!.payoutRate!)} of the {words(huang.foundation!.assets)} it holds. {page.name}’s paid out {pct(page.foundation!.payoutRate!)}; {dell.name}’s {pct(dell.foundation!.payoutRate!)}; the Musk Foundation {pct(musk.foundation!.payoutRate!)}. Four — {shortfall} — gave less than the year required, and between them the foundations on this chart still owe {words(SUMMARY.carriedForward)}. Across the 144 largest foundations in the country the median is {MEDIAN_PAYOUT} percent: the minimum, met and not exceeded<Cite id="ips-2026" />.</>,
    figure: <Payout />,
  },
  {
    id: 'horizon',
    kicker: 'At that rate',
    title: 'The year each of them would reach half.',
    body: <>Take what each foundation paid out last year, hold it steady, and count forward to the day the giving reaches half the fortune. {gates.name} gets there almost at once; he is nearly there already. {bloomberg.name} arrives in {now + (bloomberg.derived.yearsToHalf ?? 0)}. {musk.name} arrives in the year {muskHalf}. The axis is logarithmic because it has to be.</>,
    figure: <Horizon />,
  },
  {
    id: 'mechanisms',
    kicker: 'How it stays home',
    title: 'Three ways to give money without letting go of it.',
    body: <>A grant to a donor-advised fund counts, to the IRS, as money paid out — and the fund need never say where it goes next. The {huang.name} foundation has given mostly to one<Cite id="bloomberg-huang" />. A limited-liability company, the structure Mark Zuckerberg chose, files no public return at all<Cite id="forbes-czi" />. And a foundation may give to things its founder already owns: about half of the Musk Foundation’s grants in 2021 and 2022 went to interests tied to Musk<Cite id="nyt-musk-foundation" />, and in 2010 the Walton Family Foundation gave {words(WALTON_CB)} to Crystal Bridges, the Walton art museum in the Walton home town, against {words(WALTON_OTHER)} to everything else in the region<Cite id="wff-crystal-bridges" />. The four largest donor-advised-fund sponsors now hold ${DAF_HELD} for every dollar they grant<Cite id="ips-2026" />.</>,
    figure: <Mechanisms />,
  },
  {
    id: 'founders',
    kicker: 'The men who invented it',
    title: 'Sixteen years on, its founders are walking away from it.',
    body: <>Warren Buffett and Bill Gates launched the Pledge in 2010. In 2024 Buffett announced that his commitments to the Gates Foundation would end with his death<Cite id="berkshire-2024" />. In 2025 he wrote that his “grand philanthropic plans … did not prove feasible”<Cite id="berkshire-2025" />. In July 2026 he gave his remaining Berkshire shares to his children’s foundations and, for the first time in twenty years, nothing to Gates<Cite id="berkshire-2026" /> — the end of a {words(48e9)} relationship<Cite id="fortune-buffett-gates" />. Gates, for his part, will close his foundation in 2045<Cite id="npr-gates-2045" />. Asked whether the billionaires had given enough, Melinda French Gates answered in one word: “No.”<Cite id="fortune-french-gates" /></>,
    figure: <Founders />,
  },
  {
    id: 'scores',
    kicker: 'Forbes’ own grade',
    title: 'Nobody scored a three. Nobody scored a four.',
    body: <>Forbes grades every billionaire’s giving from one to five, by the share of their wealth they have given away<Cite id="forbes-profiles" />. Of these twenty-five, {spell(SUMMARY.scores['1'])} scored one, {spell(SUMMARY.scores['2'])} scored two, and {spell(SUMMARY.scores['5'])} scored five. There is nobody in the middle. On this list you are either Buffett, Gates and Bloomberg, or you are not.</>,
    figure: <Scores />,
  },
  {
    id: 'coverage',
    kicker: 'What cannot be seen',
    title: `${spell(nonFilers).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five file nothing at all.`,
    body: <>The chart above exists because American law makes a private foundation open its books every year<Cite id="irs-990pf" />. No other country on this list asks the same. {spell(foreign).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five are not American, and one who is, Steve Ballmer, gives through a company that need not file. Of the {spell(nonFilers)}, {spell(publishOwn)} publish a figure of their own choosing; {spell(withNothing)} publish nothing. Their squares in the first chart are as large as anyone’s. That is all this piece can say about them, and it is the point.</>,
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
        In 2010 the richest people in the world were asked to promise away half of what they had.
        Sixteen years on, the twenty-five richest people alive hold {words(SUMMARY.totalWealth)} between
        them. This is what their own filings say they have given.
      </p>
      <div className={s.numbers}>
        <div><b>{SUMMARY.pledgers}</b><span>of the {SUMMARY.count} have signed</span></div>
        <div><b>{money(SUMMARY.foundationPaidOut)}</b><span>paid out by their foundations in their latest filed year</span></div>
        <div><b>{money(SUMMARY.carriedForward)}</b><span>owed into the following year</span></div>
        <div><b>{SUMMARY.scores['1']}</b><span>scored one out of five by Forbes</span></div>
      </div>
      <p className={s.credit}>
        Wealth as of {longDate(SUMMARY.listDate)}. Foundation figures are read from IRS Form 990-PF at
        fair-market value. Every number on this page is computed from the sources listed at the end;
        none is typed by hand.
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

      <h3>That nobody gives</h3>
      <p>
        {buffett.name} has given away {words(buffett.lifetime!.amount)}<Cite id="forbes-top-givers" />,
        {' '}{gates.name} {words(gates.lifetime!.amount)}, {bloomberg.name} {words(bloomberg.lifetime!.amount)}.
        {' '}{brin.name}’s foundation paid out {pct(brin.foundation!.payoutRate!)} of its assets last
        year<Cite id="irs-990pf" />, more than three times what the law requires. The people who founded the
        Pledge are the reason the top of every chart here is not empty.
      </p>

      <h3>That a foundation is a fraud</h3>
      <p>
        Paying out less than five percent in a year is legal; the balance is owed by the end of the
        next<Cite id="irs-990pf" />. A donor-advised fund is legal. An LLC is legal. The one case of
        foundation self-dealing on this page that a court has ruled on comes from outside the
        twenty-five, and is labelled so<Cite id="nyag-trump" />. What the filings show is not a crime.
        It is what the rules permit, and how fully the rules are used.
      </p>

      <h3>That the Bezos foundation is his</h3>
      <p>
        The only Bezos foundation that files a public return is run by his parents; he is an unpaid
        director, and its figures are not shown as his giving. His own vehicle reported no grants at all
        and {words(13.9e6)} of expenses in its last return<Cite id="propublica-bezos-earth" />. The one
        lifetime figure that exists for {bezos.name.split(' ')[1]} — {words(bezos.lifetime?.amount)} through
        2025<Cite id="forbes-top-givers" />, against a fortune of {words(bezos.wealth)} — is drawn in the
        second chart and nowhere else.
      </p>

      <h3>What it costs the rest of us</h3>
      <p>
        A gift of appreciated stock escapes the capital-gains tax and earns the income-tax deduction
        both<Cite id="tpc-subsidy" />. The Institute for Policy Studies puts the public’s share of a
        top-bracket gift at up to {SUBSIDY} on the dollar<Cite id="ips-15" />. Every dollar in these
        foundations was, in part, tax that was never paid.
      </p>

      <dl className={s.method}>
        <div><dt>The list</dt><dd>Forbes’ real-time ranking on {longDate(SUMMARY.listDate)}. Ranks move daily; the date is the fact.</dd></div>
        <div><dt>Payout rate</dt><dd>Qualifying distributions divided by the fair-market value of assets, both from the same year’s Form 990-PF. Book values were rejected: they understate assets several-fold, and made one foundation appear to pay out more than it held.</dd></div>
        <div><dt>Years to half</dt><dd>Half the fortune, less lifetime giving, divided by the latest year’s payout. A rate carried forward, not a forecast.</dd></div>
        <div><dt>Attribution</dt><dd>Two judgements are made in the build script, where they can be read: the Bezos Family Foundation is not his giving, and the Buffett filing was read from the IRS e-file and counts as primary.</dd></div>
        <div><dt>Status</dt><dd>Every source is graded. Nothing seen only in a search summary draws a bar. The full register — every URL the research touched — is <code>docs/research/half/SOURCES.md</code>.</dd></div>
        <div><dt>Built</dt><dd>{longDate(data.built)}, by <code>scripts/half-data.mjs</code>.</dd></div>
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
