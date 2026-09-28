/**
 * Half — the world's twenty-five richest people, and what they give back.
 *
 * Named for the promise: the Giving Pledge asks for at least half. Tilt's
 * engine — a sticky figure, prose steps, an IntersectionObserver, no
 * interference with the scroll — and Tilt's rules: every figure from the
 * data file, every claim pointing at a source, and no verdict written
 * anywhere. The filings say it.
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import data from '../../data/half.json';
import { SOURCES, byId } from '../../data/half-sources';
import {
  WealthPack, Paired, Pledge, Payout, Horizon, Mechanisms, Founders, Scores, Coverage,
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
const scored = Object.values(SUMMARY.scores).reduce((sum, n) => sum + n, 0);
const unscored = SUMMARY.count - scored;
const now = Number(data.built.slice(0, 4));
const muskHalf = now + (musk.derived.yearsToHalf ?? 0);

const CHAPTERS = [
  {
    id: 'pile',
    kicker: 'The twenty-five',
    title: `Between them, ${words(SUMMARY.totalWealth)}.`,
    body: <>These are the twenty-five richest people alive, as Forbes counted them on {longDate(SUMMARY.listDate)}<Cite id="forbes-list" />. Each circle’s area represents a fortune. The teal circle is {musk.name}: at {words(musk.wealth)}<Cite id="forbes-profiles" />, he is worth more than the next three people combined. On a conventional bar chart, nearly everyone else would be reduced to a mark along his scale.</>,
    figure: <WealthPack />,
  },
  {
    id: 'pledge',
    kicker: 'The promise',
    title: `${spell(SUMMARY.pledgers).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five have promised half.`,
    body: <>The Pledge asks for at least half<Cite id="giving-pledge" />. About {SIGNED_PCT} percent of American billionaires have signed<Cite id="chronicle-pledge" />. The original American signers who are still billionaires are, together, {f15.net_worth_growth_since_2010_pct} percent richer than when they signed; one living member of that cohort has given half<Cite id="ips-15" />. {musk.name} signed in {musk.pledge.year}, worth {words(musk.pledge.wealthAtSigning)}; he is now worth roughly {times(musk.derived.growthSincePledge!)} times that. Peter Thiel says he advised him against it: “it would be much worse to give it to Bill Gates”<Cite id="fortune-thiel" />.</>,
    figure: <Pledge />,
  },
  {
    id: 'paired',
    kicker: 'The public record',
    title: 'Known lifetime giving, measured against current wealth.',
    body: <>The upper bar is the fortune; the lower is lifetime giving as Forbes counts it — money that has left the donor’s hands, not money parked in a foundation<Cite id="forbes-top-givers" />. {buffett.name} has given an estimated {words(buffett.lifetime!.amount)}; {gates.name}, {words(gates.lifetime!.amount)}. Forbes’ list of top American givers ends at {words(SUMMARY.giversFloor)}. {spell(SUMMARY.lifetimeBounded).replace(/^\w/, (c) => c.toUpperCase())} Americans here, {musk.name} and {page.name} among them, are not on it: their giving sits somewhere inside the open bar. The {spell(foreign)} who are not American are not counted at all.</>,
    figure: <Paired />,
  },
  {
    id: 'payout',
    kicker: 'The foundations',
    title: 'What their foundations distributed last year.',
    body: <>American private foundations file annual public returns with the IRS. In general, they must make qualifying distributions equal to roughly five percent of their assets, although prior excess distributions and subsequent-year payments can alter what is due in any one year<Cite id="irs-990pf" />. The latest return for the {huang.name} foundation reports distributions equal to {pct(huang.foundation!.payoutRate!)} of its {words(huang.foundation!.assets)} in assets. {page.name}’s reported {pct(page.foundation!.payoutRate!)}; {dell.name}’s {pct(dell.foundation!.payoutRate!)}; the Musk Foundation {pct(musk.foundation!.payoutRate!)}. Four — {shortfall} — reported undistributed income carried into the following year, totaling {words(SUMMARY.carriedForward)}. Among the country’s 144 billion-dollar foundations, the median payout in 2024 was {MEDIAN_PAYOUT} percent<Cite id="ips-2026" />.</>,
    figure: <Payout />,
  },
  {
    id: 'mechanisms',
    kicker: 'What “given” can mean',
    title: 'Three structures that change control, timing and disclosure.',
    body: <>A contribution to a donor-advised fund is irrevocable: the sponsor owns the money, while the donor retains advisory privileges. The contribution counts as a foundation distribution, but the individual account has no annual payout requirement and need not disclose its eventual recipients; the {huang.name} foundation has directed most of its giving to one such fund<Cite id="bloomberg-huang" />. A limited-liability company, such as the Chan Zuckerberg Initiative, can make grants, investments and political contributions without filing a Form 990<Cite id="forbes-czi" />. A foundation can also support institutions closely associated with its founders: reporting found that about half of the Musk Foundation’s 2021 and 2022 grants benefited Musk’s businesses, associates or family<Cite id="nyt-musk-foundation" />; in 2010 the Walton Family Foundation granted {words(WALTON_CB)} to the family-founded Crystal Bridges museum and {words(WALTON_OTHER)} to its other home-region programs<Cite id="wff-crystal-bridges" />. These arrangements are not equivalent, but each complicates the distance between a charitable transfer and money reaching an independent recipient. The four largest donor-advised-fund sponsors held ${DAF_HELD} in assets for every dollar they granted in 2025<Cite id="ips-2026" />.</>,
    figure: <Mechanisms />,
  },
  {
    id: 'horizon',
    kicker: 'A static projection',
    title: 'At last year’s rate, how long would half take?',
    body: <>Freeze each fortune at its current estimate, subtract known lifetime giving, and repeat the latest foundation payout every year: this is when the total reaches half. It is an illustration, not a forecast; it assumes neither investment returns nor future changes in wealth or giving. {gates.name} is nearly there already. At the modeled rate, {bloomberg.name} reaches half in {now + (bloomberg.derived.yearsToHalf ?? 0)}. {musk.name} reaches it in {muskHalf}. The logarithmic axis is necessary to show dates separated by centuries on one scale.</>,
    figure: <Horizon />,
  },
  {
    id: 'founders',
    kicker: 'The founders change course',
    title: 'Sixteen years later, their philanthropic plans have changed.',
    body: <>Warren Buffett and Bill Gates launched the Pledge in 2010. In 2024 Buffett said his commitments to the Gates Foundation would end with his death<Cite id="berkshire-2024" />. The next year he wrote that his “grand philanthropic plans … did not prove feasible” and accelerated gifts to foundations run by his children<Cite id="berkshire-2025" />. In July 2026, for the first time in twenty years, his annual Berkshire gift included nothing for Gates<Cite id="berkshire-2026" /> — ending a relationship through which he had contributed {words(48e9)}<Cite id="fortune-buffett-gates" />. Gates, meanwhile, plans to spend down and close his foundation in 2045<Cite id="npr-gates-2045" />. These are not retreats from philanthropy; they are departures from the institutional arrangement that accompanied the Pledge’s creation. Asked, “Have they given enough?” Melinda French Gates answered: “No.”<Cite id="fortune-french-gates" /></>,
    figure: <Founders />,
  },
  {
    id: 'scores',
    kicker: 'Forbes’ philanthropy score',
    title: `Among the ${spell(scored)} people Forbes scored, nobody received a three or four.`,
    body: <>Forbes assigns a philanthropy score from one to five according to the share of a fortune given away<Cite id="forbes-profiles" />. It scored {spell(scored)} of the twenty-five people in this analysis; {spell(unscored)} had no score. Of those rated, {spell(SUMMARY.scores['1'])} received a one, {spell(SUMMARY.scores['2'])} a two, and {spell(SUMMARY.scores['5'])} a five. The empty middle is striking, but it also reflects the limits of the measure: the scores compress different forms, timing and evidence of giving into a single grade.</>,
    figure: <Scores />,
  },
  {
    id: 'coverage',
    kicker: 'The limits of disclosure',
    title: `For ${spell(nonFilers)} of the twenty-five, no comparable public filing is available.`,
    body: <>The foundation chart is possible because American private foundations disclose their finances each year<Cite id="irs-990pf" />. For the non-American fortunes in this group, this review found no comparable standardized public return. {spell(foreign).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five are not American; another, Steve Ballmer, gives through a company that is not required to file a foundation return. Of the {spell(nonFilers)} without comparable filings, {spell(publishOwn)} disclose some giving figures on their own terms, while this review found no usable distribution figure for {spell(withNothing)}. Absence from the chart is therefore not evidence of an absence of giving. It is evidence of what the public record cannot establish.</>,
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
        <div className={s.stage} aria-hidden={active === 0 ? undefined : true}>
          <div className={s.stageInner}>{CHAPTERS[active].figure}</div>
        </div>
        <div className={s.steps}>
          {CHAPTERS.map((c, i) => (
            <section key={c.id} id={c.id} ref={(el) => { steps.current[i] = el; }}
                     className={i === active ? s.stepOn : s.step}>
              <p className={s.kicker}>{c.kicker}</p>
              <h2>{c.title}</h2>
              <p>{c.body}</p>
              <div className={s.srFigure} aria-hidden={i === 0 ? true : undefined}>{c.figure}</div>
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
        In 2010, Bill Gates and Warren Buffett asked the world’s billionaires to give away at least half
        their wealth, during their lives or in their wills. Sixteen years later, {spell(SUMMARY.pledgers)}
        of the twenty-five richest people have signed. Together, the twenty-five are worth about
        {' '}{words(SUMMARY.totalWealth)}. Public filings reveal what some of their foundations distributed,
        how much remains inside them and, in many cases, how little the public record can tell us.
      </p>
      <dl className={s.numbers}>
        <Figure n={String(SUMMARY.pledgers)} label={`of the ${SUMMARY.count} have signed the Pledge`}>
          {/* twenty-five dots, the signers filled */}
          {PEOPLE.map((p, i) => (
            <circle key={p.slug} className={p.pledge.signed ? s.gOn : s.gOff} cx={6 + (i % 13) * 9} cy={i < 13 ? 5 : 15} r={3} />
          ))}
        </Figure>
        <Figure n={money(SUMMARY.foundationPaidOut)} label={`paid out of ${money(SUMMARY.foundationAssets)} held in their foundations, latest filed year`}>
          <rect className={s.gTrack} x={0} y={6} width={120} height={8} rx={1} />
          <rect className={s.gFill} x={0} y={6} width={(120 * SUMMARY.foundationPaidOut) / SUMMARY.foundationAssets} height={8} rx={1} />
        </Figure>
        <Figure n={money(SUMMARY.carriedForward)} label="reported as undistributed income carried into the next year">
          <rect className={s.gTrack} x={0} y={6} width={120} height={8} rx={1} />
          <rect className={s.gWarn} x={0} y={6} width={(120 * SUMMARY.carriedForward) / SUMMARY.foundationPaidOut} height={8} rx={1} />
        </Figure>
        <Figure n={String(SUMMARY.scores['1'])} label="scored one out of five by Forbes; nobody scored three or four">
          {/* the score distribution, one to five */}
          {(['1', '2', '3', '4', '5'] as const).map((k, i) => {
            const n = SUMMARY.scores[k];
            const h = n ? 4 + (14 * n) / Math.max(...Object.values(SUMMARY.scores)) : 1.5;
            return <rect key={k} className={k === '1' ? s.gFill : n ? s.gOff : s.gTrack} x={i * 24} y={20 - h} width={16} height={h} rx={1} />;
          })}
        </Figure>
      </dl>
      <p className={s.credit}>
        Wealth as of {longDate(SUMMARY.listDate)}. Foundation figures come from IRS Form 990-PF and use
        fair-market asset values. The methodology and source record appear at the end.
      </p>
    </header>
  );
}

/** A headline figure with a small glyph showing the proportion behind it. */
function Figure({ n, label, children }: { n: string; label: string; children: ReactNode }) {
  return (
    <div>
      <svg className={s.glyph} viewBox="0 0 120 20" aria-hidden="true">{children}</svg>
      <dt>{n}</dt>
      <dd>{label}</dd>
    </div>
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
      <p className={s.kicker}>How to read the record</p>
      <h2>What the evidence shows—and what it does not.</h2>

      <h3>Giving is not absent</h3>
      <p>
        {buffett.name} has given away {words(buffett.lifetime!.amount)}<Cite id="forbes-top-givers" />,
        {' '}{gates.name} {words(gates.lifetime!.amount)}, {bloomberg.name} {words(bloomberg.lifetime!.amount)}.
        {' '}{brin.name}’s foundation paid out {pct(brin.foundation!.payoutRate!)} of its assets last
        year<Cite id="irs-990pf" />, more than three times the general distribution requirement. The people
        who founded the Pledge account for nearly all of the clearly documented large-scale giving in this group.
      </p>

      <h3>The five-percent rule</h3>
      <p>
        Paying out less than five percent in a year is legal; the balance is owed by the end of the
        next<Cite id="irs-990pf" />. A donor-advised fund is legal. An LLC is legal. The one case of
        foundation self-dealing on this page that a court has ruled on comes from outside the
        twenty-five, and is labelled so<Cite id="nyag-trump" />. The filings do not, by themselves,
        establish misconduct. They show how much the rules require, how distributions are counted and
        how much discretion the structures preserve.
      </p>

      <h3>Attributing Bezos giving</h3>
      <p>
        The only Bezos foundation that files a public return is run by his parents; he is an unpaid
        director, and its figures are not shown as his giving. His own vehicle reported no grants at all
        and {words(13.9e6)} of expenses in its last return<Cite id="propublica-bezos-earth" />. The one
        lifetime figure that exists for {bezos.name.split(' ')[1]} — {words(bezos.lifetime?.amount)} through
        2025<Cite id="forbes-top-givers" />, against a fortune of {words(bezos.wealth)} — is drawn in the
        second chart and nowhere else.
      </p>

      <h3>The public subsidy</h3>
      <p>
        A charitable contribution of appreciated stock can avoid capital-gains tax while also producing
        an income-tax deduction<Cite id="tpc-subsidy" />. Using assumptions for an ultra-wealthy donor,
        the Institute for Policy Studies estimates a combined public subsidy of up to {SUBSIDY} on the
        dollar<Cite id="ips-15" />. The precise subsidy varies with the asset, the donor and the deduction;
        the larger point is that private charitable choices are partly financed through foregone public revenue.
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
export const FIGURES = { WealthPack, Paired, Pledge, Payout, Horizon, Mechanisms, Founders, Scores, Coverage };
export { fmt };
