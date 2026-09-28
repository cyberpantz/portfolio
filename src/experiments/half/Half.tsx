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
  WealthPack, Paired, Payout, Horizon, Mechanisms, Scores, Coverage,
  PEOPLE, SUMMARY, CONTEXT, money, shareOf, pctLbl, scoreGap, scoreRows,
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
/* Counts on this page never exceed the list, so words through twenty-five. */
const spell = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five'][n] ?? String(n);
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
/* The empty stretch in the score chart, found in the data rather than asserted. */
const gap = scoreGap();
/* The headline's two groups, counted — the thresholds are Forbes' own band edges. */
const scoredRows = scoreRows();
const topGivers = scoredRows.filter((r) => !r.bound && r.share >= 0.2).length;
const cap = (w: string) => w.replace(/^\w/, (c) => c.toUpperCase());
const now = Number(data.built.slice(0, 4));
const muskHalf = now + (musk.derived.yearsToHalf ?? 0);

const CHAPTERS = [
  {
    id: 'pile',
    kicker: 'The twenty-five',
    title: `Between them, ${words(SUMMARY.totalWealth)}.`,
    body: <>The twenty-five richest people alive, as Forbes counted them on {longDate(SUMMARY.listDate)}<Cite id="forbes-list" />.</>,
    figure: <WealthPack />,
  },
  {
    id: 'paired',
    kicker: 'The public record',
    title: 'What they have given, against what they have.',
    body: <>The upper bar is the fortune; the lower is lifetime giving as Forbes counts it — money out the door, not into a foundation<Cite id="forbes-top-givers" />. Forbes’ list stops at {words(SUMMARY.giversFloor)}. The {spell(SUMMARY.lifetimeBounded)} Americans absent from it, {musk.name} and {page.name} among them, fall inside the open bar; the {spell(foreign)} non-Americans are not counted. Share given follows the Institute for Policy Studies’ method<Cite id="ips-15" />. Family scale applies it to a typical family’s {money(SUMMARY.household)}<Cite id="fed-scf-2022" />.</>,
    interactive: true,
    figure: <Paired />,
  },
  {
    id: 'payout',
    kicker: 'The foundations',
    title: 'What their foundations distributed last year.',
    body: <>A private foundation must pay out about five percent of its assets a year, with some carry-over between years<Cite id="irs-990pf" />. Last year the {huang.name} foundation paid {pct(huang.foundation!.payoutRate!)} of its {words(huang.foundation!.assets)}; {page.name}’s, {pct(page.foundation!.payoutRate!)}; {dell.name}’s, {pct(dell.foundation!.payoutRate!)}; the Musk Foundation, {pct(musk.foundation!.payoutRate!)}. Four — {shortfall} — carried {words(SUMMARY.carriedForward)} of undistributed income into the next year. The median among the country’s 144 billion-dollar foundations was {MEDIAN_PAYOUT} percent<Cite id="ips-2026" />.</>,
    figure: <Payout />,
  },
  {
    id: 'mechanisms',
    kicker: 'What “given” can mean',
    title: 'Three structures that change control, timing and disclosure.',
    body: <>A gift to a donor-advised fund counts as a foundation payout, yet the fund has no payout rule and need not name its recipients; the {huang.name} foundation gives mostly to one<Cite id="bloomberg-huang" />. An LLC, like the Chan Zuckerberg Initiative, files no Form 990 at all<Cite id="forbes-czi" />. And a foundation can fund its founder’s own institutions: about half the Musk Foundation’s 2021–22 grants benefited his businesses, associates or family<Cite id="nyt-musk-foundation" />; in 2010 the Walton Family Foundation gave {words(WALTON_CB)} to Crystal Bridges, the family’s museum, and {words(WALTON_OTHER)} to the rest of its home region<Cite id="wff-crystal-bridges" />. The four largest fund sponsors hold ${DAF_HELD} for every dollar they grant<Cite id="ips-2026" />.</>,
    figure: <Mechanisms />,
  },
  {
    id: 'horizon',
    kicker: 'A static projection',
    title: 'At last year’s rate, how long would half take?',
    body: <>Hold each fortune still, subtract what has been given, and repeat last year’s foundation payout every year. {gates.name} is nearly at half. {bloomberg.name} arrives in {now + (bloomberg.derived.yearsToHalf ?? 0)}; {musk.name}, in {muskHalf}. An illustration, not a forecast: it ignores investment returns. The axis is logarithmic because the dates are centuries apart.</>,
    figure: <Horizon />,
  },
  {
    id: 'scores',
    kicker: 'Forbes’ philanthropy score',
    title: `${cap(spell(topGivers))} have given away a fifth or more. ${cap(spell(scoredRows.length - topGivers))} have given less than a twentieth.`,
    body: <>Forbes grades giving from one, under 1 percent of a fortune given away, to five, 20 percent or more<Cite id="forbes-profiles" />. It scored the {spell(scored)} Americans; the {spell(unscored)} others have no score. Measured as share given, they split cleanly. {gap.above.p.name} and the two above him made giving a habit that kept pace with their fortunes; Buffett has given Berkshire shares every year since 2006<Cite id="berkshire-2024" />. Below {gap.below.p.name}, fortunes have outgrown giving: {musk.name}’s is up about {times(musk.derived.growthSincePledge!)} times since he signed the Pledge. The middle bands are empty because reaching them means giving faster than the fortune grows.</>,
    figure: <Scores />,
  },
  {
    id: 'coverage',
    kicker: 'The limits of disclosure',
    title: `${spell(nonFilers).replace(/^\w/, (c) => c.toUpperCase())} of the twenty-five have no comparable public filing.`,
    body: <>The foundation chart exists because American foundations must publish their accounts<Cite id="irs-990pf" />. The {spell(foreign)} non-Americans file no comparable return, and Steve Ballmer gives through a company that need not. Of these {spell(nonFilers)}, {spell(publishOwn)} publish figures of their own; for {spell(withNothing)}, this review found none. Missing from a chart is not the same as not giving. It is what the record cannot show.</>,
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
        {/* Hidden from assistive tech — its figures are repeated beside each
            paragraph — except where the figure has controls, which must be
            reachable where they are seen. */}
        <div className={s.stage} aria-hidden={active === 0 || 'interactive' in CHAPTERS[active] ? undefined : true}>
          <div className={s.stageInner}>{CHAPTERS[active].figure}</div>
        </div>
        <div className={s.steps}>
          {CHAPTERS.map((c, i) => (
            <section key={c.id} id={c.id} ref={(el) => { steps.current[i] = el; }}
                     className={i === active ? s.stepOn : s.step}>
              <p className={s.kicker}>{c.kicker}</p>
              <h2>{c.title}</h2>
              <p>{c.body}</p>
              {!('interactive' in c) && (
                <div className={s.srFigure} aria-hidden={i === 0 ? true : undefined}>{c.figure}</div>
              )}
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
        their wealth. Sixteen years later, {spell(SUMMARY.pledgers)} of the twenty-five richest people have
        signed. Together they are worth {words(SUMMARY.totalWealth)}. Public filings show what some of their
        foundations pay out — and how little the record shows about the rest.
      </p>
      <dl className={s.numbers}>
        <Figure n={String(SUMMARY.pledgers)} label={`of the ${SUMMARY.count} have signed the Pledge`} more={<PledgeNote />}>
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
function Figure({ n, label, children, more }: { n: string; label: string; children: ReactNode; more?: ReactNode }) {
  return (
    <div>
      <svg className={s.glyph} viewBox="0 0 120 20" aria-hidden="true">{children}</svg>
      <dt>{n}</dt>
      <dd>{label}{more}</dd>
    </div>
  );
}

/**
 * Who among the twenty-five signed, and how far each has got. "Given" is
 * the same share the wealth-against-giving chart uses — giving over
 * everything had — so one half here means the promise is kept.
 */
function SignerTable() {
  const rows = PEOPLE.filter((p) => p.pledge.signed === true).map((p) => {
    const bound = !p.coverage.lifetime;
    const given = p.coverage.lifetime ? p.lifetime!.amount : p.lifetimeUnder?.amount ?? null;
    return { p, bound, share: given != null ? shareOf(given, p.wealth!) : null };
  });
  return (
    <table className={s.signers}>
      <caption>The {spell(rows.length)} signers among the twenty-five</caption>
      <thead>
        <tr><th scope="col">Signer</th><th scope="col">Signed</th><th scope="col">Worth now</th><th scope="col">Given so far</th></tr>
      </thead>
      <tbody>
        {rows.map(({ p, bound, share }) => (
          <tr key={p.slug}>
            <th scope="row">{p.name}</th>
            <td>{p.pledge.year ?? '—'}</td>
            <td>{money(p.wealth)}</td>
            <td>
              {share == null ? '—' : (
                <span className={s.given}>
                  <span className={s.givenBar} aria-hidden="true">
                    <span className={bound ? s.givenFillBound : s.givenFill} style={{ width: `${Math.max(2, share * 200)}%` }} />
                    <span className={s.givenHalf} />
                  </span>
                  {bound ? `under ${pctLbl(share)}` : pctLbl(share)}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The Pledge, told once and on request. It is the occasion for the piece,
 * not its subject, so it lives behind the figure it explains. A native
 * popover: no script to open or close it, Escape and light-dismiss for free.
 */
function PledgeNote() {
  return (
    <>
      <button type="button" className={s.more} popoverTarget="pledge-note">About the Pledge</button>
      <div id="pledge-note" popover="auto" className={s.pop} role="dialog" aria-labelledby="pledge-note-h">
        <p className={s.kicker}>The Giving Pledge</p>
        <h2 id="pledge-note-h">A promise of half, sixteen years on.</h2>
        <p>
          Started in 2010 by Bill Gates and Warren Buffett, the Pledge asks the very rich to give away at least
          half their wealth, in life or at death<Cite id="giving-pledge" />. About {SIGNED_PCT} percent of
          American billionaires have signed<Cite id="chronicle-pledge" />. The original American signers who
          remain billionaires are {f15.net_worth_growth_since_2010_pct} percent richer than when they signed;
          one living original signer has given half<Cite id="ips-15" />.
        </p>
        <SignerTable />
        <p>
          {musk.name} signed in {musk.pledge.year} worth {words(musk.pledge.wealthAtSigning)}, and is now worth
          about {times(musk.derived.growthSincePledge!)} times that. Peter Thiel says he told him “it would be
          much worse to give it to Bill Gates”<Cite id="fortune-thiel" />.
        </p>
        <p>
          Its founders have since changed course. In 2024 Buffett said his gifts to the Gates Foundation would
          end at his death<Cite id="berkshire-2024" />; in 2025 he wrote that his “grand philanthropic plans …
          did not prove feasible”<Cite id="berkshire-2025" />; in July 2026 his annual gift left Gates out for
          the first time in twenty years<Cite id="berkshire-2026" />, closing {words(48e9)} of
          contributions<Cite id="fortune-buffett-gates" />. Gates will close his foundation in
          2045<Cite id="npr-gates-2045" />. Asked “Have they given enough?”, Melinda French Gates said:
          “No.”<Cite id="fortune-french-gates" />
        </p>
        <button type="button" className={s.popClose} popoverTarget="pledge-note" popoverTargetAction="hide">Close</button>
      </div>
    </>
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
      <h2>What the record shows, and what it does not.</h2>

      <h3>Giving is not absent</h3>
      <p>
        {buffett.name} has given away {words(buffett.lifetime!.amount)}<Cite id="forbes-top-givers" />,
        {' '}{gates.name} {words(gates.lifetime!.amount)}, {bloomberg.name} {words(bloomberg.lifetime!.amount)}.
        {' '}{brin.name}’s foundation paid out {pct(brin.foundation!.payoutRate!)} last
        year<Cite id="irs-990pf" />, more than three times the requirement. The Pledge’s founders account for most
        of the documented giving here.
      </p>

      <h3>The five-percent rule</h3>
      <p>
        Paying less than five percent in a year is legal if the balance follows the next
        year<Cite id="irs-990pf" />. Donor-advised funds and LLCs are legal. The only court ruling on
        foundation self-dealing cited here concerns someone outside the twenty-five<Cite id="nyag-trump" />.
        The filings show what the rules allow, not misconduct.
      </p>

      <h3>Attributing Bezos giving</h3>
      <p>
        The only Bezos foundation that files is his parents’; its figures are not counted as his. His own
        vehicle reported no grants and {words(13.9e6)} of expenses in its latest
        return<Cite id="propublica-bezos-earth" />. His one lifetime figure, {words(bezos.lifetime?.amount)} against
        {' '}{words(bezos.wealth)}<Cite id="forbes-top-givers" />, appears only in the giving chart.
      </p>

      <h3>The public subsidy</h3>
      <p>
        A gift of appreciated stock can avoid capital-gains tax and earn an income-tax
        deduction<Cite id="tpc-subsidy" />. The Institute for Policy Studies puts the public’s share at up
        to {SUBSIDY} on the dollar for the richest donors<Cite id="ips-15" />. Part of every gift here is
        paid for in taxes not collected.
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
export const FIGURES = { WealthPack, Paired, Payout, Horizon, Mechanisms, Scores, Coverage };
export { fmt };
