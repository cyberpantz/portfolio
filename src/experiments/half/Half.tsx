/**
 * Half — the world's twenty-five richest people, and what they give back.
 *
 * Named for the promise: the Giving Pledge asks for at least half. Tilt's
 * engine — a sticky figure, prose steps, an IntersectionObserver, no
 * interference with the scroll — and Tilt's rules: every figure from the
 * data file, every claim pointing at a source, and no verdict written
 * anywhere. The filings say it.
 *
 * This file is layout. The words are in article.md; the numbers they
 * quote are in values.ts.
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { SOURCES, byId } from '../../data/half-sources';
import {
  WealthPack, Paired, Payout, Horizon, Mechanisms, Scores,
  PEOPLE, SUMMARY, money, shareOf, pctLbl,
} from './figures';
import { VALUES } from './values';
import { parseArticle, inline, paragraphs, one, need, type Custom } from './article';
import raw from './article.md?raw';
import s from './half.module.css';

const fmt = (n: number) => n.toLocaleString('en-US');

/* ------------------------------------------------------------- content */

const BLOCKS = parseArticle(raw);
/* Cites and the signers table are the article's own tags. */
const CUSTOM: Custom = { cite: (src, key) => <Cite key={key} id={src} /> };
const PLEDGE: Custom = { ...CUSTOM, signers: (key) => <SignerTable key={key} /> };
const text = (t: string, c: Custom = CUSTOM) => inline(t, VALUES, c);
const paras = (t: string, c: Custom = CUSTOM) => paragraphs(t, VALUES, c);

/** The charts a chapter can name in its "figure:" field. */
const FIGURES: Record<string, (arg?: string) => ReactNode> = {
  WealthPack: (arg) => <WealthPack mode={arg === 'disclosure' ? 'disclosure' : 'wealth'} />,
  Paired: () => <Paired />,
  Payout: () => <Payout />,
  Horizon: () => <Horizon />,
  Mechanisms: () => <Mechanisms />,
  Scores: () => <Scores />,
};

const CHAPTERS = BLOCKS.filter((b) => b.kind === 'chapter').map((b) => {
  if (!b.id) throw new Error('article.md: every "=== chapter" needs an id, e.g. "=== chapter payout"');
  const [name, arg] = need(b, 'figure').split(/\s+/);
  const draw = FIGURES[name];
  if (!draw) throw new Error(`article.md: chapter ${b.id} names an unknown figure "${name}"`);
  return {
    id: b.id,
    kicker: text(need(b, 'kicker')),
    title: text(need(b, 'title')),
    body: paras(need(b, 'body')),
    figure: draw(arg),
    interactive: /^(yes|true)$/i.test(b.fields.interactive ?? ''),
  };
});

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
            {c.body}
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
        <div className={s.stage} aria-hidden={active === 0 || CHAPTERS[active].interactive ? undefined : true}>
          <div className={s.stageInner}>{CHAPTERS[active].figure}</div>
        </div>
        <div className={s.steps}>
          {CHAPTERS.map((c, i) => (
            <section key={c.id} id={c.id} ref={(el) => { steps.current[i] = el; }}
                     className={i === active ? s.stepOn : s.step}>
              <p className={s.kicker}>{c.kicker}</p>
              <h2>{c.title}</h2>
              {c.body}
              {!c.interactive && (
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
  const b = one(BLOCKS, 'intro');
  return (
    <header className={s.intro}>
      <h1>Half</h1>
      <p className={s.standfirst}>{text(need(b, 'standfirst'))}</p>
      <dl className={s.numbers}>
        <Figure n={String(SUMMARY.pledgers)} label={text(need(b, 'pledgers'))} more={<PledgeNote />}>
          {/* twenty-five dots, the signers filled */}
          {PEOPLE.map((p, i) => (
            <circle key={p.slug} className={p.pledge.signed ? s.gOn : s.gOff} cx={6 + (i % 13) * 9} cy={i < 13 ? 5 : 15} r={3} />
          ))}
        </Figure>
        <Figure n={money(SUMMARY.foundationPaidOut)} label={text(need(b, 'paidOut'))}>
          <rect className={s.gTrack} x={0} y={6} width={120} height={8} rx={1} />
          <rect className={s.gFill} x={0} y={6} width={(120 * SUMMARY.foundationPaidOut) / SUMMARY.foundationAssets} height={8} rx={1} />
        </Figure>
        <Figure n={money(SUMMARY.carriedForward)} label={text(need(b, 'carried'))}>
          <rect className={s.gTrack} x={0} y={6} width={120} height={8} rx={1} />
          <rect className={s.gWarn} x={0} y={6} width={(120 * SUMMARY.carriedForward) / SUMMARY.foundationPaidOut} height={8} rx={1} />
        </Figure>
        <Figure n={String(SUMMARY.scores['1'])} label={text(need(b, 'scoredOne'))}>
          {/* the score distribution, one to five */}
          {(['1', '2', '3', '4', '5'] as const).map((k, i) => {
            const n = SUMMARY.scores[k];
            const h = n ? 4 + (14 * n) / Math.max(...Object.values(SUMMARY.scores)) : 1.5;
            return <rect key={k} className={k === '1' ? s.gFill : n ? s.gOff : s.gTrack} x={i * 24} y={20 - h} width={16} height={h} rx={1} />;
          })}
        </Figure>
      </dl>
      <p className={s.credit}>{text(need(b, 'credit'))}</p>
    </header>
  );
}

/** A headline figure with a small glyph showing the proportion behind it. */
function Figure({ n, label, children, more }: { n: string; label: ReactNode; children: ReactNode; more?: ReactNode }) {
  return (
    <div>
      <svg className={s.glyph} viewBox="0 0 120 20" aria-hidden="true">{children}</svg>
      <dt>{n}</dt>
      <dd>{label}{more}</dd>
    </div>
  );
}

/**
 * The Pledge, told once and on request. It is the occasion for the piece,
 * not its subject, so it lives behind the figure it explains. A native
 * popover: no script to open or close it, Escape and light-dismiss for free.
 */
function PledgeNote() {
  const b = one(BLOCKS, 'pledge-note');
  return (
    <>
      <button type="button" className={s.more} popoverTarget="pledge-note">{text(need(b, 'trigger'))}</button>
      <div id="pledge-note" popover="auto" className={s.pop} role="dialog" aria-labelledby="pledge-note-h">
        <p className={s.kicker}>{text(need(b, 'kicker'))}</p>
        <h2 id="pledge-note-h">{text(need(b, 'title'))}</h2>
        {paras(need(b, 'body'), PLEDGE)}
        <button type="button" className={s.popClose} popoverTarget="pledge-note" popoverTargetAction="hide">Close</button>
      </div>
    </>
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
      <caption>{text(need(one(BLOCKS, 'pledge-note'), 'caption'))}</caption>
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
  const head = one(BLOCKS, 'notes');
  return (
    <section className={s.essay} id="notes">
      <p className={s.kicker}>{text(need(head, 'kicker'))}</p>
      <h2>{text(need(head, 'title'))}</h2>
      {BLOCKS.filter((b) => b.kind === 'note').map((b, i) => (
        <div key={i}>
          <h3>{text(need(b, 'heading'))}</h3>
          {paras(need(b, 'body'))}
        </div>
      ))}
      <dl className={s.method}>
        {BLOCKS.filter((b) => b.kind === 'method').map((b, i) => (
          <div key={i}><dt>{text(need(b, 'term'))}</dt><dd>{text(need(b, 'body'))}</dd></div>
        ))}
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
export { FIGURES, BLOCKS, fmt };
