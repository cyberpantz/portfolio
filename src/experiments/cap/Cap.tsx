/**
 * The Cap — the day your Social Security tax stops.
 *
 * Tilt's engine, unchanged: a sticky figure, prose steps, an
 * IntersectionObserver that swaps the figure, and no interference with the
 * reader's scroll. Reduced motion gets a stacked article with every figure
 * inline.
 *
 * What is different is how little it says. Every sentence carries a number
 * from cap.json or points at a source, and the figure does the rest.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import data from '../../data/cap.json';
import { SOURCES, byId } from '../../data/cap-sources';
import {
  ChapterEvery, ChapterWall, ChapterCliff, ChapterNoWages, ChapterClocks, ChapterRates,
  Strip, rowFor, socialSecurity, stopDate, money, LADDER,
} from './figures';
import s from './cap.module.css';

const LAW = data.law;
const pct = (n: number) => `${(n * 100).toFixed(n * 100 % 1 ? 2 : 0)}%`;
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;

const twice = LADDER.find((r) => r.id === 'twice')!;
const million = LADDER.find((r) => r.id === 'million')!;
const fourM = LADDER.find((r) => r.id === 'four-million')!;
const tenM = LADDER.find((r) => r.id === 'ten-million')!;
const M = data.musk;

/** The reader's own row, from whatever they typed. */
function useYou() {
  const [income, setIncome] = useState<number>(Math.round(LAW.averageWage));
  const you = useMemo(() => rowFor(income, 'You', { id: 'you', you: true }), [income]);
  const rate = useMemo(() => {
    const ss = socialSecurity(income);
    const med = income * LAW.medicareRate
      + Math.max(0, income - LAW.additionalMedicareFrom) * LAW.additionalMedicareRate;
    return Math.round(((ss + med) / Math.max(1, income)) * 1000) / 10;
  }, [income]);
  return { income, setIncome, you, rate };
}

export default function Cap() {
  const [active, setActive] = useState(0);
  const [stacked, setStacked] = useState(false);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const { income, setIncome, you, rate } = useYou();

  const CHAPTERS = [
    {
      id: 'every',
      kicker: 'How it is collected',
      title: 'Every payday, from the first dollar.',
      body: <>Social Security tax is {pct(LAW.socialSecurityRate)} of wages, taken from each paycheck<Cite id="usc-3101" />. On the average wage — {usd(Math.round(LAW.averageWage))} in {LAW.averageWageYear}<Cite id="ssa-2026" /> — it comes out {LAW.payPeriods} times a year and never stops.</>,
      figure: <ChapterEvery />,
    },
    {
      id: 'wall',
      kicker: 'Where it stops',
      title: `It is only collected on the first ${usd(LAW.wageBase)}.`,
      body: <>That is the {LAW.year} wage base<Cite id="ssa-2026" />. Earn twice it and the tax stops on {twice.stop}. The rest of the year, that line on the paycheck reads zero.</>,
      figure: <ChapterWall />,
    },
    {
      id: 'cliff',
      kicker: 'The day it stops',
      title: 'The higher the income, the earlier in the year.',
      body: <>At {money(million.income)} it stops on {million.stop}. At {money(fourM.income)}, {fourM.stop}. At {money(tenM.income)}, {tenM.stop}. Your row is in the accent colour — change the income at the top to move it.</>,
      figure: <ChapterCliff you={you} />,
    },
    {
      id: 'nowages',
      kicker: 'And when there are no wages',
      title: 'For Musk the question does not arise.',
      body: <>He has never accepted a salary; since {M.salarySince} Tesla accrues none<Cite id="tesla-ars-2024" />. Wages: $0. The one year his income was wages — {M.in2021.year}, when he exercised options<Cite id="musk-2021" /> — the base was {usd(M.in2021.wageBase)}<Cite id="ssa-cbb" />, so Social Security tax reached its maximum of {usd(M.in2021.socialSecurityMax)} on the first payday.</>,
      figure: <ChapterNoWages />,
    },
    {
      id: 'clocks',
      kicker: 'When, not how much',
      title: 'Same rate. Different clock.',
      body: <>A minimum-wage worker pays payroll tax {M.package.workerPaydays} times over ten years. The {M.package.approved.slice(0, 4)} package — {M.package.shares.toLocaleString('en-US')} restricted shares in {M.package.tranches} tranches<Cite id="tesla-package" /> — is taxed at ordinary rates too, but only as each tranche vests, after the shares have compounded untaxed.</>,
      figure: <ChapterClocks />,
    },
    {
      id: 'rates',
      kicker: 'Three published answers',
      title: 'What the rich pay depends on what you divide by.',
      body: <>Income as taxed: the top one percent pay {data.rates[0].rate}%<Cite id="cbo-2022" />. Income including unrealised gains: the wealthiest 400 pay {data.rates[1].rate}%<Cite id="cea-2021" />. Growth in wealth: the wealthiest 25 pay {data.rates[2].rate}%<Cite id="propublica-2021" />. None is wrong. They measure different things<Cite id="taxfoundation-cea" />.</>,
      figure: <ChapterRates you={{ rate }} />,
    },
  ] as const;

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

  const intro = <Intro income={income} setIncome={setIncome} />;
  const tail = <><Finder you={you} income={income} setIncome={setIncome} /><Conclusion /><Sources /></>;

  if (stacked) {
    return (
      <article className={s.stacked}>
        {intro}
        {CHAPTERS.map((c) => (
          <section key={c.id} id={c.id}>
            <p className={s.kicker}>{c.kicker}</p>
            <h2>{c.title}</h2>
            <p>{c.body}</p>
            <figure className={s.fig}>{c.figure}</figure>
          </section>
        ))}
        {tail}
      </article>
    );
  }

  return (
    <article className={s.scrolly}>
      {intro}
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
      {tail}
    </article>
  );
}

/* ------------------------------------------------------------ sections */

function IncomeField({ income, setIncome, id }: { income: number; setIncome: (n: number) => void; id: string }) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>Your yearly wages, before tax</label>
      <input id={id} type="text" inputMode="numeric" autoComplete="off"
             value={income.toLocaleString('en-US')}
             onChange={(e) => {
               const n = Number(e.target.value.replace(/[^\d]/g, ''));
               if (Number.isFinite(n) && n <= 1e9) setIncome(n);
             }} />
    </div>
  );
}

function Intro({ income, setIncome }: { income: number; setIncome: (n: number) => void }) {
  return (
    <header className={s.intro}>
      <h1>The Cap</h1>
      <p className={s.standfirst}>
        Social Security tax stops on the day your wages reach {usd(LAW.wageBase)}. For most
        people that day never comes. For some it is in January.
      </p>
      <IncomeField income={income} setIncome={setIncome} id="cap-income" />
      <p className={s.credit}>
        {LAW.year} federal law, single filer, wages only. Every figure is computed from the
        sources at the end; none is typed by hand.
      </p>
    </header>
  );
}

function Finder({ you, income, setIncome }: { you: ReturnType<typeof rowFor>; income: number; setIncome: (n: number) => void }) {
  const date = stopDate(income);
  const ss = socialSecurity(income);
  return (
    <section className={s.finder} id="you">
      <p className={s.kicker}>Your year</p>
      <h2>The day yours stops.</h2>
      <IncomeField income={income} setIncome={setIncome} id="cap-income-2" />
      <p className={s.answer}>
        {date
          ? <>On {usd(income)}, your Social Security tax stops on <b>{date}</b>. You pay {usd(Math.round(ss))} — {pct(ss / income)} of your income.</>
          : <>On {usd(income)}, your Social Security tax <b>never stops</b>. You pay {pct(LAW.socialSecurityRate)} on every dollar: {usd(Math.round(ss))}.</>}
      </p>
      <figure className={s.fig}>
        <Strip rows={[you]} title={`Your year at ${usd(income)}`} />
      </figure>
      <p className={s.answerNote}>
        Employee share only. Your employer pays the same again<Cite id="usc-3101" />; most
        economists treat that as yours too, which would double these figures. Medicare has no cap.
      </p>
    </section>
  );
}

function Cite({ id }: { id: string }) {
  const i = SOURCES.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`The Cap: cited unknown source "${id}"`);
  return (
    <a className={s.cite} href={`#src-${id}`} aria-label={`Source ${i + 1}: ${byId(id).title}`}>
      {i + 1}
    </a>
  );
}

function Conclusion() {
  const min = data.minimum;
  const t = data.tesla;
  return (
    <section className={s.essay} id="notes">
      <p className={s.kicker}>Three things this is not saying</p>
      <h2>Read the denominators.</h2>

      <h3>Not that the rich pay nothing</h3>
      <p>
        Musk paid about ${(M.exercise.taxPaid / 1e9).toFixed(0)} billion for {M.exercise.year}, among the largest
        individual payments on record<Cite id="musk-2021" />. Federal taxes as a whole are
        progressive: {data.rates[0].lowest!.rate}% for the lowest fifth,
        {' '}{data.rates[0].rate}% for the top one percent<Cite id="cbo-2022" />.
      </p>

      <h3>Not that the minimum wage is untaxed</h3>
      <p>
        Full time at {usd(min.hourly)} an hour<Cite id="usc-206" /> is {usd(min.income)}, below the
        {' '}{usd(LAW.standardDeductionSingle)} standard deduction<Cite id="irs-2026" />, so federal
        income tax is {usd(min.federalIncomeTax ?? 0)}. Payroll tax is {usd(min.total)} —
        {' '}{usd(min.perPayday)} a payday, {LAW.payPeriods} times.
      </p>

      <h3>Not that Tesla and Musk are the same taxpayer</h3>
      <p>
        Tesla reported ${(t.usIncome / 1e9).toFixed(1)} billion of US income in {t.year} and
        {' '}{usd(t.currentFederalTax)} of current federal income tax<Cite id="itep-tesla-2025" />.
        That is corporate tax. It is shown here because it is public and because it is not
        the same thing.
      </p>

      <p>
        What the piece does say is smaller and harder to argue with: the tax is collected on a
        share of wages that falls as wages rise, and on the largest incomes it is not collected
        at all, because they are not wages.
      </p>

      <dl className={s.method}>
        <div><dt>Stop date</dt><dd>The day of the year on which cumulative wages reach the base: ceil(base ÷ income × 365). It does not depend on how often you are paid.</dd></div>
        <div><dt>Paydays</dt><dd>Fortnightly, {LAW.payPeriods} a year, for the drawings. The date above is independent of this.</dd></div>
        <div><dt>Wages</dt><dd>Everything here is wage income. Investment income is not subject to Social Security tax at all.</dd></div>
        <div><dt>Built</dt><dd>{data.built}, from the constants in <code>scripts/cap-data.mjs</code>.</dd></div>
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
