import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Pause, Play, RotateCcw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

// ---------- audio ----------

let _regRawBuf: ArrayBuffer | null = null;
async function fetchRegisterRaw(): Promise<ArrayBuffer> {
  if (!_regRawBuf) {
    const res = await fetch('/sounds/old-register.mp3');
    _regRawBuf = await res.arrayBuffer();
  }
  return _regRawBuf;
}

function playRegister(ctx: AudioContext, buffer: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

// ---------- FlipDigit ----------

const CELL_W_MAX = 80;
const CELL_H_MAX = 116;

// 5 digit cells + $ sep + . sep + gaps, approximated at cellW=1
// cellW * (5 + 0.54 + 0.54) + 24 = available  →  cellW = (available - 24) / 6.08
const DISPLAY_DIVISOR = 6.08;
const DISPLAY_MARGIN  = 24;

function computeCellW(availablePx: number) {
  return Math.max(30, Math.min(CELL_W_MAX, Math.floor((availablePx - DISPLAY_MARGIN) / DISPLAY_DIVISOR)));
}

/*
 * How long the roll-past-zero choreography takes: animate down to the
 * duplicate zero, then rebase. Nothing may interrupt it half-finished.
 */
const WRAP_MS = 380;
const REBASE_MS = 32;

function FlipDigit({ value, cellW }: { value: string; cellW: number }) {
  const cellH    = Math.round(cellW * (CELL_H_MAX / CELL_W_MAX));
  const fontSize = Math.round(cellW * (72 / CELL_W_MAX));

  const num = parseInt(value, 10);
  const prevNum = useRef(num);
  const [pos, setPos] = useState(num);

  /*
   * `animate` is STATE, not a ref.
   *
   * It was a ref, which does not cause a render — so the flag was being
   * written and then read on whatever render happened to come next. It
   * worked by luck. As state it is guaranteed to be correct on the render
   * that applies the matching position.
   */
  const [animate, setAnimate] = useState(true);

  // Index 10 is a SECOND zero, so 9 -> 0 rolls forward instead of spinning
  // backwards through 8,7,6...
  const strip = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], []);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const lastChange = useRef(0);

  useEffect(() => {
    const from = prevNum.current;
    if (from === num) return;

    /*
     * Cancel anything still in flight.
     *
     * This is the bug behind the blinking, and why it showed up at higher
     * wages. The cents digit changes at wage/36 per second — 0.8/s at the
     * median, but 2.6/s by $95/hr and 13.9/s at $500/hr. Past roughly
     * $95/hr the digit changes faster than this 380ms choreography can
     * finish, so the old code left stale timeouts running: each one fired
     * `setPos(0)` later, yanking the reel to zero regardless of which digit
     * should have been showing, and wrote a STALE closure value into
     * prevNum, which then broke rollover detection for every later change.
     * They also stacked — at $500/hr several were in flight at once.
     */
    clearTimers();

    const now = performance.now();
    const sinceLast = now - lastChange.current;
    lastChange.current = now;
    prevNum.current = num;

    // Any decrease is a roll past zero. The old check was `=== 9 && === 0`,
    // which misses skips like 7 -> 2 — real at high rates, and they made the
    // reel spin backwards.
    const rollsOver = num < from;

    /*
     * If this digit is changing faster than the animation can play, do not
     * try to play it. Nobody can read a 380ms flip at 14 changes a second;
     * attempting it is exactly what produced the jerk. Cut straight to the
     * value instead.
     *
     * This degrades per digit for free: the cents reel goes hard-cut while
     * the tens and dollars, which change far more slowly, keep the flip.
     */
    if (sinceLast < WRAP_MS * 1.25) {
      setAnimate(false);
      setPos(num);
      timers.current.push(setTimeout(() => setAnimate(true), REBASE_MS));
      return;
    }

    if (!rollsOver) {
      setAnimate(true);
      setPos(num);
      return;
    }

    // Roll forward onto the duplicate zero, rebase to the real zero with no
    // animation, then continue to the target if it is not zero.
    setAnimate(true);
    setPos(10);
    timers.current.push(setTimeout(() => {
      setAnimate(false);
      setPos(0);
      timers.current.push(setTimeout(() => {
        setAnimate(true);
        if (num !== 0) setPos(num);
      }, REBASE_MS));
    }, WRAP_MS));
  }, [num]);

  // Unmounting mid-roll left timers running against a dead component.
  useEffect(() => clearTimers, []);

  return (
    <div
      className="relative overflow-hidden rounded-xs border border-white/10"
      style={{ width: cellW, height: cellH, background: 'rgba(255,255,255,0.04)' }}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/8 pointer-events-none z-10" />
      <motion.div
        className="absolute inset-x-0 top-0"
        animate={{ y: -pos * cellH }}
        transition={
          animate
            ? { type: 'spring', stiffness: 220, damping: 32, mass: 0.8 }
            : { duration: 0 }
        }
      >
        {strip.map((d, i) => (
          <div key={i} className="flex items-center justify-center" style={{ height: cellH }}>
            <span className="font-mono font-bold text-exp-bright select-none tabular-nums" style={{ fontSize }}>
              {d}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function EarningsDisplay({ earnings, scale = 1 }: { earnings: number; scale?: number }) {
  const [baseW, setBaseW] = useState(() =>
    typeof window !== 'undefined' ? computeCellW(window.innerWidth - 48) : CELL_W_MAX
  );

  useEffect(() => {
    const update = () => setBaseW(computeCellW(window.innerWidth - 48));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /*
   * Scaled by rank, with a floor.
   *
   * The counter sits in a ladder now and takes the size its POSITION
   * implies, so landing near the bottom genuinely looks small — that is
   * the argument the piece is making. Truly proportional would be
   * useless: against Musk's rate a minimum-wage counter works out under
   * a pixel tall, so 26 is the smallest that still reads as digits.
   */
  /*
   * A ceiling as well as a floor, and the ceiling is new.
   *
   * `baseW` is derived from the WINDOW, but the counter lives in a
   * `max-w-3xl` column — a mismatch that did not matter while `scale`
   * topped out below 1, because 80 × 0.97 still fitted comfortably.
   * Enlarging the ladder pushed the top of the range to about 1.41,
   * and 80 × 1.41 = 113 per cell, which is 711px of counter inside
   * 688px of column. A high earner would have found their own number
   * clipped.
   *
   * 104 is the widest cell that fits: five digits plus two separators
   * plus gaps is `cellW × 6.08 + 24`, and 104 lands at 656 inside 688.
   */
  const cellW = Math.min(104, Math.max(26, Math.round(baseW * scale)));

  const cellH         = Math.round(cellW * (CELL_H_MAX / CELL_W_MAX));
  const separatorSize = Math.round(cellW * (76 / CELL_W_MAX));
  const outerGap      = Math.max(2, Math.round(cellW * (6 / CELL_W_MAX)));
  const innerGap      = Math.max(1, Math.round(cellW * (3 / CELL_W_MAX)));

  const str = earnings.toFixed(2);
  const [rawInt, frac] = str.split('.');
  const intDigits = rawInt.padStart(3, '0').split('');
  const fracDigits = frac.split('');

  return (
    /* Shrinks to its digits so the ladder's `items-center` can place it.
       This said "left-aligned" and argued that a centred counter among
       left-aligned rows would look like a component that wandered in —
       true until the rows themselves centred, at which point the same
       sentence pointed the wrong way. The div is unchanged; only the
       reason for it is. */
    <div className="flex">
      <div className="flex items-center" style={{ gap: outerGap }}>
        <span className="font-mono font-bold text-exp-base select-none" style={{ fontSize: separatorSize, lineHeight: `${cellH}px` }}>$</span>
        <div className="flex" style={{ gap: innerGap }}>
          {intDigits.map((d, i) => <FlipDigit key={`i${i}`} value={d} cellW={cellW} />)}
        </div>
        <span className="font-mono font-bold text-exp-base select-none" style={{ fontSize: separatorSize, lineHeight: `${cellH}px` }}>.</span>
        <div className="flex" style={{ gap: innerGap }}>
          {fracDigits.map((d, i) => <FlipDigit key={`f${i}`} value={d} cellW={cellW} />)}
        </div>
      </div>
    </div>
  );
}

// ---------- Coins ----------

interface Coin { id: number; angle: number; distance: number; duration: number; size: number; }
let _coinId = 0;

function CoinParticle({ angle, distance, duration, size }: Omit<Coin, 'id'>) {
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * distance;
  const ty = Math.sin(rad) * distance;
  return (
    <motion.div
      style={{
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #FFE87C, #D4900A)',
        border: '1.5px solid #9A6200',
        boxShadow: 'inset 0 1px 3px rgba(255,240,140,0.6)',
        left: '50%', top: '50%', marginLeft: -size / 2, marginTop: -size / 2,
        pointerEvents: 'none', zIndex: 20,
      }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0.3 }}
      animate={{ x: tx, y: ty, opacity: 0, scale: 0.9 }}
      transition={{ duration, ease: [0.15, 0, 0.6, 1] }}
    />
  );
}

// ---------- Comparison data ----------

/*
 * Figures refreshed September 2026.
 *
 * MEDIAN_WAGE — BLS Q2 2026: median usual weekly earnings for the 120.9M
 * full-time wage and salary workers were $1,251. Divided by a 40-hour week.
 * (Was $29.13, BLS Q3 2024.)
 *
 * MIN_WAGE — still $7.25. Unchanged since 2009, which is now seventeen
 * years. 22 states and 66 cities have raised their own floors above it.
 *
 * The tycoon rates live in TYCOONS below, all on one basis: Bloomberg
 * Billionaires Index year-to-date gain as of 23 September 2026, over the
 * 265 days elapsed. Musk is $307B, which is $48,270,440 per hour — 6.7x
 * the $7,191,780/hr this piece shipped with in 2024.
 *
 * 2026 is also the year the framing broke in an instructive way. SpaceX
 * listed on 12 June and Musk became the first trillionaire; his fortune
 * peaked at $1.32T on 16 June, then fell roughly $594B from that peak as
 * SpaceX slid post-IPO and Tesla softened over the summer. Trackers still
 * disagree by tens of billions on any given day. A number that can move
 * half a trillion dollars in ten weeks is not a wage. That is the point
 * the piece should now make, and the copy below makes it.
 */
const MEDIAN_WAGE = 31.28; // BLS Q2 2026: $1,251/wk ÷ 40

const MIN_WAGE     = 7.25;       // US federal minimum, unchanged since 2009
const MEDIAN_LABEL = 'US Median Worker';

/**
 * The top of the ladder is a seat, not a person.
 *
 * It was Musk, hard-coded, and that quietly made the piece an argument
 * about one man. It is not — he is the most extreme case of something
 * general, and a reader who dislikes him personally can dismiss the
 * whole exhibit on those grounds. Being able to swap him out for four
 * other people and watch the numbers stay preposterous removes that
 * exit.
 *
 * ── One basis, one date ──────────────────────────────────────────────
 *
 * Every figure here is the SAME measurement: Bloomberg Billionaires
 * Index year-to-date gain as of 23 September 2026, divided by the 265
 * days elapsed and again by 24. Mixing bases would be the easiest way
 * to make this dishonest — one person's salary against another's
 * portfolio would produce a comparison that means nothing while looking
 * rigorous — so the rule is that a name cannot join this list without
 * the same number from the same tracker on the same day.
 *
 * That is also why there is no CEO here. Median S&P 500 pay is $17.3M
 * (AFL-CIO Executive Paywatch 2026), which is a wage and would belong
 * on this page — but it is a different measurement, and it would need
 * its own row and its own label rather than a seat in this rotation.
 *
 * ── What the number is not ───────────────────────────────────────────
 *
 * None of these are paycheques. They are unrealized gains on holdings,
 * and 2026 made that unusually plain: Musk's fortune peaked at $1.32T
 * on 16 June after the SpaceX listing, then gave back roughly $594B of
 * it over the summer. The disclosure panel says so for every person,
 * because the caveat belongs to the measurement rather than to any one
 * of them.
 */
export type Tycoon = {
  id: string;
  /** Surname only — it is a tab label, and the full name is the heading. */
  short: string;
  name: string;
  rate: number;
  /** YTD gain in billions, for the method shown in the panel. */
  ytdB: number;
  /** Total net worth in billions at the same reading. */
  worthB: number;
  /**
   * One sentence of context, per person.
   *
   * Added because the panel had a single generic caveat that then
   * illustrated itself with Musk — so picking Bezos got you a fact
   * about Musk. The fix is not a blander paragraph; it is that each
   * seat carries its own, and the shared caveat below says only what
   * is true of all of them.
   */
  context: string;
};

/** Days elapsed in 2026 at the reading, and the hours they contain. */
const YTD_DAYS  = 265;
const YTD_HOURS = YTD_DAYS * 24;
const asOf = (ytdB: number) => Math.round((ytdB * 1e9) / YTD_HOURS);

/*
 * Three, and the list is ordered by RATE OF GAIN — not by wealth.
 *
 * Worth being explicit, because the natural reading of a name beside a
 * dollar figure is a rich list, and this is not one. Bezos is worth
 * more than Zuckerberg and sits below him here, because 2026 has been
 * kinder to Meta than to Amazon. What the seat holds is "how fast did
 * this person's fortune grow while you worked", which is the only
 * quantity a ticker can count.
 *
 * ── Larry Ellison was here and was wrong ─────────────────────────────
 *
 * He was listed at +$67.6B, which had him second. The opposite is true:
 * Oracle is down about 27% year-to-date and 53% over the trailing year,
 * and Ellison shed roughly $200B in twelve months — from second-richest
 * to seventh. His 2026 rate is strongly NEGATIVE.
 *
 * Which is genuinely the most interesting row this piece could have,
 * and it cannot be built as a one-line data change: a negative rate
 * means a counter that runs backwards, a ladder sort that puts him
 * below the minimum wage, and an "earns N times your hourly rate" line
 * that stops being a sentence. Left out rather than faked.
 */
const TYCOONS: Tycoon[] = [
  {
    id: 'musk', short: 'Musk', name: 'Elon Musk',
    ytdB: 307, worthB: 927, rate: asOf(307),
    context:
      'Became the first trillionaire on 12 June when SpaceX listed, peaked at $1.32T on the 16th, then gave back roughly $594B of it over the summer.',
  },
  {
    id: 'zuck', short: 'Zuckerberg', name: 'Mark Zuckerberg',
    ytdB: 21.6, worthB: 229, rate: asOf(21.6),
    context:
      'The 2026 gain tracks investor enthusiasm for Meta’s spending on AI and VR — money going out of the company, counted as wealth coming in.',
  },
  {
    id: 'bezo', short: 'Bezos', name: 'Jeff Bezos',
    ytdB: 16.4, worthB: 255, rate: asOf(16.4),
    context:
      'Still overwhelmingly Amazon stock, more than thirty years after he founded it, and he has not run the company since 2021.',
  },
];

const AS_OF_LABEL = '23 Sep 2026';

export type LadderRow = { id: 'tycoon' | 'you' | 'median' | 'min'; label: string; rate: number };

/**
 * Everyone on screen, richest first, with YOU slotted in by rate.
 *
 * A sort rather than a chain of conditionals, which is what makes all
 * FOUR positions fall out for free: above Musk, between Musk and the
 * median, between the median and the minimum, and below the minimum.
 * The third is the one that matters most — someone on $12 an hour lands
 * under the median and over the minimum, and being placed there is the
 * sharpest thing this piece does.
 */
export function ladderRows(wage: number, tycoon: Tycoon = TYCOONS[0]): LadderRow[] {
  return [
    { id: 'tycoon', label: tycoon.name,          rate: tycoon.rate },
    { id: 'you',    label: 'You',                rate: wage },
    { id: 'median', label: MEDIAN_LABEL,         rate: MEDIAN_WAGE },
    { id: 'min',    label: 'Federal Min. Wage',  rate: MIN_WAGE },
  ].sort((a, b) => b.rate - a.rate) as LadderRow[];
}

/** Where `wage` lands in the ladder, 0 = top. */
export const slotFor = (wage: number) => ladderRows(wage).findIndex(r => r.id === 'you');

/**
 * A rate's position on the ladder, 0 (minimum) to 1 (Musk), logarithmic.
 *
 * Linear is meaningless at this spread: on a straight scale every human
 * wage collapses onto the same point and only Musk has any height. Log
 * is the only mapping where the difference between $7.25 and $31 is
 * still visible on the same axis as $46 million.
 */
/*
 * The ceiling is the richest person in the list, not the SELECTED one.
 *
 * Scaling to whoever is on screen would make the whole ladder resize on
 * every swap — your row would grow when you picked Bezos, which reads
 * as your wage having changed. A fixed ceiling means swapping shrinks
 * the tycoon's own row and leaves everyone else alone, which is both
 * calmer and the more informative behaviour: you can SEE that Bezos
 * gains less than Musk.
 */
const RATE_CEILING = Math.max(...TYCOONS.map(t => t.rate));

export function rankScale(rate: number): number {
  const lo = Math.log10(MIN_WAGE);
  const hi = Math.log10(RATE_CEILING);
  const t = (Math.log10(Math.max(rate, 0.01)) - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}

/** Type size for a ladder row's amount, in rem. */
export const remFor = (rate: number) => 1.15 + rankScale(rate) * 2.45;

// ---------- helpers ----------

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMultiplier(ratio: number) {
  if (ratio >= 10_000) return `${Math.round(ratio / 1000)}k×`;
  if (ratio >= 1_000)  return `${(ratio / 1000).toFixed(1)}k×`;
  return `${ratio.toFixed(1)}×`;
}

function fmtHourly(rate: number): string {
  if (rate >= 1_000_000) return `$${(rate / 1_000_000).toFixed(1)}M/hr`;
  if (rate >= 1_000)     return `$${(rate / 1_000).toFixed(1)}k/hr`;
  return `$${rate.toFixed(2)}/hr`;
}

function fmtWorkTime(price: number, rate: number): { text: string; cls: string } {
  const secs = (price / rate) * 3600;
  if (secs < 60)   return { text: secs < 1 ? `${secs.toFixed(2)}s` : `${Math.round(secs)}s`, cls: 'text-exp-dim'    };
  if (secs < 3600) return { text: `${Math.round(secs / 60)}m`,                               cls: 'text-exp-muted'  };
  const hrs = secs / 3600;
  if (hrs < 24)    return { text: `${hrs.toFixed(1)}h`,                                       cls: 'text-exp-base'   };
  const days = secs / 86400;
  if (days < 30)   return { text: `${Math.round(days)}d`,                                     cls: 'text-exp-bright' };
  const months = days / 30.44;
  if (months < 24) return { text: `${Math.round(months)} mo`,                                 cls: 'text-fg'         };
  /*
   * Years, and above a century the decimal goes.
   *
   * This was always `toFixed(1)`, which was fine while the priciest row
   * was a house — 2.3 yr wants its decimal. Once the table reached a
   * superyacht it started printing "10404.6 yr": false precision, and
   * unreadable, because a five-digit number with no separator is a blur.
   * Past 100 years the tenth of a year is noise, and the comma is the
   * only thing making the magnitude legible at a glance.
   */
  const yrs = days / 365.25;
  return {
    text: yrs < 100
      ? `${yrs.toFixed(1)} yr`
      : `${Math.round(yrs).toLocaleString()} yr`,
    cls: 'text-fg',
  };
}

/*
 * Two ladders in one table, and the join between them is the argument.
 *
 * The first eight are things an ordinary life is measured in — a coffee,
 * the rent, an ER visit, a car, a degree, a house. Read down that half
 * and the numbers do what you expect: seconds become minutes become
 * years, and everyone's column climbs together.
 *
 * The rest are not a continuation of that list. They are what the top of
 * the fourth column buys, and they break the table on purpose. A
 * superyacht is 4.3 hours of Musk and eleven human lifetimes of minimum
 * wage, which is a sentence nobody can hold in their head — but two
 * cells on the same row state it without comment, and that is the whole
 * device.
 *
 * Prices are round on purpose: these are orders of magnitude, not
 * quotes, and a figure like $78,431,200 would imply a precision that
 * the point does not need and the sourcing would not survive.
 */
const AFFORD_ITEMS = [
  { label: 'cup of coffee',      price: 6             },
  { label: 'week of groceries',  price: 200           },
  { label: "month's rent",       price: 1_750         },
  { label: 'emergency room',     price: 3_000         },
  { label: 'used car',           price: 15_000        },
  { label: 'new car',            price: 40_000        },
  { label: 'college (4 yr)',     price: 220_000       },
  { label: 'median home',        price: 420_000       },
  /*
   * ── and then ────────────────────────────────────────────────────
   *
   * Starts at $450,000, immediately above the median home, because the
   * adjacency does the work: a place to live, or a seat on a rocket.
   * A Birkin bag sat here in the first draft at $25,000 and had to go —
   * it broke the ascending order, and worse, $25,000 is not preposterous
   * enough to belong in this half. It is a used car.
   */
  { label: 'seat on a rocket',   price: 450_000       },
  { label: 'Bugatti',            price: 4_000_000     },
  { label: 'private island',     price: 25_000_000    },
  { label: 'private jet',        price: 78_000_000    },
  { label: 'superyacht',         price: 300_000_000   },
  { label: 'an NBA team',        price: 4_000_000_000 },
] as const;

function fmtElapsed(secs: number) {
  return [
    Math.floor(secs / 3600),
    Math.floor((secs % 3600) / 60),
    Math.floor(secs % 60),
  ].map(n => String(n).padStart(2, '0')).join(':');
}

// ---------- EarningsChart ----------

const CHART_N   = 150;
const CHART_EPS = 0.5;

interface LineSpec {
  key: string;
  name: string;
  /** Colour of the plotted line. May be low-alpha — lines are allowed to recede. */
  stroke: string;
  width: number;
  dash?: string;
  /** Colour of this series' TEXT. Must stay legible; never reuse `stroke`. */
  ink: string;
}

function EarningsChart({ elapsed, wage, tycoon }: { elapsed: number; wage: number; tycoon: Tycoon }) {
  const maxTime = Math.max(elapsed, 30);

  /*
   * `stroke` draws the LINE. `ink` sets the TEXT.
   *
   * They were the same value, and that was the bug behind the unreadable
   * labels: a 22%-white stroke is correct for a line that should recede
   * into a chart, and is nowhere near legible as type — the minimum-wage
   * card and its legend entry were effectively invisible, and the card
   * label was then multiplied by a further opacity:0.5 on top.
   *
   * Lines keep their hierarchy through stroke weight, dash and value.
   * Text does not get to be decorative: every ink below clears 4.5:1 on
   * black, so the series can be told apart by anyone.
   */
  const lineSpecs: LineSpec[] = [
    { key: 'elon',    name: tycoon.name,        stroke: '#EF4444',                width: 2,               ink: '#FF6B6B' },
    { key: 'you',     name: 'You',              stroke: '#FFFFFF',                width: 2,               ink: '#FFFFFF' },
    { key: 'median',  name: 'US Median Worker', stroke: 'rgba(255,255,255,0.45)', width: 1.5, dash: '6 4', ink: 'rgba(255,255,255,0.78)' },
    { key: 'minwage', name: 'Federal Min. Wage',stroke: 'rgba(255,255,255,0.26)', width: 1.5, dash: '3 5', ink: 'rgba(255,255,255,0.62)' },
  ];

  const stats = [
    { label: tycoon.name,         earned: (tycoon.rate / 3600) * elapsed, ink: '#FF6B6B' },
    { label: 'You',               earned: (wage        / 3600) * elapsed, ink: '#FFFFFF' },
    { label: 'US Median Worker',  earned: (MEDIAN_WAGE / 3600) * elapsed, ink: 'rgba(255,255,255,0.78)' },
    { label: 'Federal Min. Wage', earned: (MIN_WAGE    / 3600) * elapsed, ink: 'rgba(255,255,255,0.62)' },
  ];

  const data = useMemo(() => {
    const mt = Math.max(elapsed, 30);
    return Array.from({ length: CHART_N + 1 }, (_, i) => {
      const t = CHART_EPS + (i / CHART_N) * (mt - CHART_EPS);
      return {
        t,
        elon:    (tycoon.rate / 3600) * t,
        you:     (wage        / 3600) * t,
        median:  (MEDIAN_WAGE / 3600) * t,
        minwage: (MIN_WAGE    / 3600) * t,
      };
    });
  }, [elapsed, wage, tycoon]);

  const yTicks = useMemo(() => {
    const maxY = (tycoon.rate / 3600) * Math.max(elapsed, 30);
    const ticks: number[] = [];
    for (let p = -3; p <= Math.ceil(Math.log10(maxY)); p++) ticks.push(10 ** p);
    return ticks;
  }, [elapsed, tycoon]);

  function fmtX(s: number) {
    if (s < 60)   return `${Math.round(s)}s`;
    if (s < 3600) return `${Math.round(s / 60)}m`;
    return `${(s / 3600).toFixed(1)}h`;
  }

  function fmtY(v: number) {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`;
    if (v >= 1)         return `$${v.toFixed(0)}`;
    if (v >= 0.1)       return `$0.10`;
    if (v >= 0.01)      return `$0.01`;
    return `$0.001`;
  }

  interface TooltipEntry { name?: string; value?: number; stroke?: string; dataKey?: string; }
  function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: number }) {
    if (!active || !payload?.length) return null;

    // Ordered high to low so the rows read as a ranking rather than as
    // whatever order the series happen to be declared in.
    const rows = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const inkFor = (k?: string) => lineSpecs.find(l => l.key === k)?.ink ?? '#fff';
    const you = payload.find(e => e.dataKey === 'you')?.value ?? 0;

    return (
      <div style={{
        background: 'rgba(8,8,8,0.94)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 3,
        padding: '11px 14px 12px',
        fontFamily: 'monospace',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
        minWidth: 236,
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.62)', fontSize: 11, marginBottom: 9,
          textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          {fmtX(label ?? 0)} elapsed
        </p>

        {rows.map(entry => {
          const spec = lineSpecs.find(l => l.key === entry.dataKey);
          const v = entry.value ?? 0;
          return (
            <div key={entry.dataKey} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              gap: 9,
              fontSize: 13,
              padding: '3px 0',
            }}>
              {/* The swatch carries the series identity, so the label
                  itself can stay at a legible neutral weight. */}
              <svg width={16} height={8} aria-hidden="true">
                <line x1={0} y1={4} x2={16} y2={4}
                  stroke={spec?.stroke} strokeWidth={spec?.width ?? 2}
                  strokeDasharray={spec?.dash} strokeLinecap="round" />
              </svg>
              <span style={{ color: 'rgba(255,255,255,0.72)' }}>{entry.name}</span>
              <span style={{
                color: inkFor(entry.dataKey), fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtMoney(v)}
              </span>
            </div>
          );
        })}

        {/* The multiple is the whole argument of the piece, so the tooltip
            states it outright instead of leaving it to be inferred from
            four numbers on a log axis. */}
        {you > 0 && (
          <p style={{
            marginTop: 9, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.62)', fontSize: 11.5,
          }}>
            {tycoon.short} is{' '}
            <span style={{ color: '#FF6B6B', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(tycoon.rate / wage).toLocaleString()}&times;
            </span>{' '}
            your rate
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        {stats.map(s => (
          <div key={s.label}
            className="border rounded-xs px-3.5 py-3"
            style={{ borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.025)' }}
          >
            {/* The label is a neutral grey at a single, legible value —
                it does not need to restate the series colour, which the
                figure beneath it already carries. */}
            <p className="font-mono uppercase mb-1.5"
              style={{ color: 'rgba(255,255,255,0.62)', fontSize: 11, letterSpacing: '0.14em' }}>
              {s.label}
            </p>
            <p className="font-mono tabular-nums"
              style={{ color: s.ink, fontSize: 19, letterSpacing: '-0.01em' }}>
              {fmtMoney(s.earned)}
            </p>
          </div>
        ))}
      </div>

      {/* Chart — absolute inset so ResponsiveContainer has a concrete pixel height */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 36, left: 70 }}>
          <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.09)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[CHART_EPS, maxTime]}
            tickFormatter={fmtX}
            tick={{ fill: 'rgba(255,255,255,0.52)', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.18)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.18)' }}
            label={{ value: 'time elapsed', position: 'insideBottom', offset: -16,
              style: { fill: 'rgba(255,255,255,0.46)', fontSize: 12, fontFamily: 'monospace' } }}
          />
          <YAxis
            scale="log"
            domain={[0.001, (tycoon.rate / 3600) * maxTime * 1.5]}
            ticks={yTicks}
            tickFormatter={fmtY}
            tick={{ fill: 'rgba(255,255,255,0.52)', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.18)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.18)' }}
            allowDataOverflow
            label={{ value: 'earnings (log scale)', angle: -90, position: 'insideLeft', offset: -55,
              style: { fill: 'rgba(255,255,255,0.46)', fontSize: 12, fontFamily: 'monospace' } }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.34)', strokeWidth: 1, strokeDasharray: '3 3' }}
          />
          {lineSpecs.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.stroke}
              strokeWidth={l.width}
              strokeDasharray={l.dash}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-8 pb-2 shrink-0">
        {lineSpecs.map(l => (
          <div key={l.key} className="flex items-center gap-2">
            <svg width={24} height={12}>
              <line x1={0} y1={6} x2={24} y2={6}
                stroke={l.stroke} strokeWidth={l.width}
                strokeDasharray={l.dash} strokeLinecap="round" />
            </svg>
            <span className="font-mono text-exp-note tracking-wider" style={{ color: l.ink }}>
              {l.name}
            </span>
          </div>
        ))}
      </div>

      {/* Log scale explainer */}
      <p className="font-mono text-exp-note text-center text-exp-muted leading-relaxed pb-4 shrink-0 max-w-2xl mx-auto">
        This chart uses a logarithmic scale — each step up the Y-axis represents a 10× increase, not a fixed dollar amount.
        On a standard linear scale, Elon's line would shoot off the top of the screen within seconds,
        compressing every other worker into an invisible flat line at the bottom.
        The fact that we needed a log scale to make this readable is itself the point.
      </p>
    </div>
  );
}

// ---------- AffordTable ----------

function AffordTable({ wage, tycoon }: { wage: number; tycoon: Tycoon }) {
  const columns = [
    { name: 'You',      rate: wage,        highlight: true  },
    { name: 'Median',   rate: MEDIAN_WAGE, highlight: false },
    { name: 'Min Wage', rate: MIN_WAGE,    highlight: false },
    { name: tycoon.short, rate: tycoon.rate, highlight: false },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-12">
      <div className="max-w-3xl mx-auto overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="sticky left-0 bg-black text-left pb-4 pr-4 sm:pr-8 font-mono text-exp-note text-exp-dim uppercase tracking-wider">
                item
              </th>
              {columns.map(col => (
                <th key={col.name} className="text-right pb-4 pl-4 sm:pl-8 min-w-[4rem]">
                  <div className={`font-mono text-exp-label uppercase tracking-wider ${col.highlight ? 'text-exp-bright' : 'text-exp-base'}`}>
                    {col.name}
                  </div>
                  <div className="font-mono text-exp-note text-exp-dim">{fmtHourly(col.rate)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/*
              Row highlight on hover. A wide table of numbers is read across,
              and there is nothing here to hold the eye on one line — the
              rules are at 5% white, deliberately faint. The tint is the
              cheapest fix that does not add ink to the design.

              group/row + the `You` column responding too, so hovering a row
              also picks out the reader's own number in it. Keyboard and
              touch reach it through focus-within.
            */}
            {AFFORD_ITEMS.map((item, i) => (
              <tr
                key={item.label}
                tabIndex={0}
                className={`group/row outline-none transition-colors duration-150
                  hover:bg-white/[0.055] focus-within:bg-white/[0.055]
                  ${i < AFFORD_ITEMS.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                {/* The sticky cell needs its own tint: it sits on bg-black to
                    cover the scrolling columns, so the row's background is
                    painted behind it and never shows through. */}
                <td className="sticky left-0 bg-black py-3.5 pr-4 sm:pr-8 transition-colors duration-150
                               group-hover/row:bg-[#0d0d0d] group-focus-within/row:bg-[#0d0d0d]">
                  <div className="font-mono text-exp-label text-exp-base transition-colors duration-150
                                  group-hover/row:text-exp-bright group-focus-within/row:text-exp-bright">
                    {item.label}
                  </div>
                  <div className="font-mono text-exp-note text-exp-dim">
                    ${item.price.toLocaleString()}
                  </div>
                </td>
                {columns.map(col => {
                  const { text, cls } = fmtWorkTime(item.price, col.rate);
                  return (
                    <td key={col.name}
                      className={`py-3.5 pl-4 sm:pl-8 text-right font-mono tabular-nums text-exp-label
                        transition-colors duration-150 ${cls}
                        ${col.highlight ? 'group-hover/row:text-exp-bright group-focus-within/row:text-exp-bright' : ''}`}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="font-mono text-exp-micro text-exp-dim mt-8 leading-relaxed">
          prices are US averages · assumes continuous work · wages: BLS Q2 2026, Elon: Bloomberg Aug 2026
        </p>
      </div>
    </div>
  );
}

// ---------- WageGap ----------

const TAB_LABELS = [
  { key: 'counter' as const, label: 'Ticker' },
  { key: 'chart'   as const, label: 'Graph'  },
  { key: 'afford'  as const, label: 'Table'  },
];

const WAGE_KEY = 'wage-gap-rate';
/** Older builds of this experiment stored the rate under the name it
 *  had before it was Wage Gap. Read it once so an existing visitor
 *  does not silently lose their saved figure. */
const LEGACY_WAGE_KEY = 'skrillatime-wage';

function savedWage(): number | null {
  try {
    for (const key of [WAGE_KEY, LEGACY_WAGE_KEY]) {
      const v = parseFloat(localStorage.getItem(key) ?? '');
      if (!isNaN(v) && v > 0) return v;
    }
  } catch {}
  return null;
}

export default function WageGap() {
  const [wage, setWage] = useState(() => savedWage() ?? MEDIAN_WAGE);
  const [inputWage, setInputWage] = useState(() => String(savedWage() ?? MEDIAN_WAGE));
  const [editingWage, setEditingWage] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [view, setView] = useState<'counter' | 'chart' | 'afford'>('counter');
  const [paused, setPaused] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  /*
   * Who occupies the top of the ladder. Not persisted, unlike the wage:
   * your own rate is a fact about you worth remembering between visits,
   * and which billionaire you last looked at is not.
   */
  const [tycoonId, setTycoonId] = useState(TYCOONS[0].id);
  const tycoon = TYCOONS.find(t => t.id === tycoonId) ?? TYCOONS[0];

  /*
   * Has a wage been committed yet?
   *
   * Seeded from localStorage, so a returning visitor is not asked again —
   * they land straight in the ladder with their rate already in place.
   */
  const [placed, setPlaced] = useState(() => savedWage() !== null);

  const youRowRef   = useRef<HTMLDivElement>(null);
  const inputBoxRef = useRef<HTMLDivElement>(null);
  /** Where the counter animates FROM: the input's rect at the moment of commit. */
  const flipFrom    = useRef<DOMRect | null>(null);
  const prevSlot    = useRef<number | null>(null);

  const startRef    = useRef<number>(Date.now());
  const lastTenRef  = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null); // elapsed ms when paused
  const ctxRef      = useRef<AudioContext | null>(null);
  const regBufRef   = useRef<AudioBuffer | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const wageRef     = useRef(MEDIAN_WAGE);

  const spawnCoins = useCallback(() => {
    const batch: Coin[] = Array.from({ length: 16 }, () => ({
      id: _coinId++,
      angle: Math.random() * 360,
      distance: 70 + Math.random() * 110,
      duration: 0.5 + Math.random() * 0.45,
      size: 10 + Math.round(Math.random() * 7),
    }));
    setCoins(prev => [...prev, ...batch]);
    const ids = new Set(batch.map(c => c.id));
    setTimeout(() => setCoins(prev => prev.filter(c => !ids.has(c.id))), 1400);
  }, []);

  const spawnCoinsRef = useRef(spawnCoins);
  spawnCoinsRef.current = spawnCoins;

  const startTimer = useCallback((rate: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    wageRef.current     = rate;
    startRef.current    = Date.now();
    lastTenRef.current  = 0;
    pausedAtRef.current = null;
    setEarnings(0);
    setElapsed(0);
    setCoins([]);
    setPaused(false);

    timerRef.current = setInterval(() => {
      const secs = (Date.now() - startRef.current) / 1000;
      const earned = (wageRef.current / 3600) * secs;
      setEarnings(earned);
      setElapsed(secs);
      const tens = Math.floor(earned / 10);
      if (tens > lastTenRef.current && ctxRef.current && regBufRef.current) {
        lastTenRef.current = tens;
        playRegister(ctxRef.current, regBufRef.current);
        spawnCoinsRef.current();
      }
    }, 100);
  }, []);

  /*
   * Clear means gone: no stored rate, no running clock, back to the
   * empty state.
   *
   * It cannot reuse `startTimer`, which is the opposite operation —
   * that one starts a new run at a given rate, and every reset it does
   * is in service of starting. This one has to STOP, and then forget.
   *
   * Both keys are removed, not just the current one. `savedWage()`
   * falls back to `skrillatime-wage` from an older build of this
   * experiment, so clearing only `wage-gap-rate` would look like it
   * worked and then hand a returning visitor their old figure back on
   * the next page load — the most annoying class of clear bug, because
   * it appears to succeed.
   *
   * `prevSlot` and `flipFrom` are refs the FLIP animation uses to know
   * where your counter travelled from. Left set, the next commit would
   * animate from a rectangle that no longer exists.
   */
  const clearAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      localStorage.removeItem(WAGE_KEY);
      localStorage.removeItem(LEGACY_WAGE_KEY);
    } catch {}
    pausedAtRef.current = null;
    lastTenRef.current  = 0;
    prevSlot.current    = null;
    flipFrom.current    = null;
    wageRef.current     = MEDIAN_WAGE;
    setEarnings(0);
    setElapsed(0);
    setCoins([]);
    setPaused(false);
    setWage(MEDIAN_WAGE);
    setInputWage(String(MEDIAN_WAGE));
    setPlaced(false);
  }, []);

  const rows     = ladderRows(wage, tycoon);
  const slot     = rows.findIndex(r => r.id === 'you');
  // Counter size follows the same log rank as every other amount, floored
  // by EarningsDisplay so the digits stay readable at the bottom.
  const youScale = 0.61 + rankScale(wage) * 0.80;

  const commitWage = useCallback(() => {
    const v = parseFloat(inputWage);
    if (isNaN(v) || v <= 0) return;
    // Measure BEFORE the layout changes — this rect is the animation's start.
    flipFrom.current = inputBoxRef.current?.getBoundingClientRect() ?? null;
    try { localStorage.setItem(WAGE_KEY, String(v)); } catch {}
    setWage(v);
    setPlaced(true);
    startTimer(v);
  }, [inputWage, startTimer]);

  /*
   * FLIP: play the counter into its slot.
   *
   * Runs on placement and again whenever the wage crosses a boundary and
   * moves you in the ladder, so editing your rate down past the median
   * visibly drops you a rung — the edit path reuses the entrance instead
   * of needing an idea of its own.
   *
   * useLayoutEffect, not useEffect: the end rect has to be read after the
   * DOM updates but before the browser paints, or the counter is visible
   * in its final position for a frame before the animation starts.
   */
  useLayoutEffect(() => {
    if (!placed) return;
    const el = youRowRef.current;
    if (!el) return;

    const was = prevSlot.current;
    prevSlot.current = slot;
    const from  = flipFrom.current;
    const moved = was !== null && was !== slot;
    if (!from && !moved) return;
    flipFrom.current = null;

    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'linear' });
      return;
    }

    const to = el.getBoundingClientRect();
    let dx = 0, dy = 0, sc = 1;
    if (from) {
      dx = from.left + from.width / 2 - (to.left + to.width / 2);
      dy = from.top + from.height / 2 - (to.top + to.height / 2);
      sc = Math.max(0.5, Math.min(2.2, from.width / Math.max(to.width, 1)));
    } else {
      // No start rect: this is a re-rank, so come from the side you left.
      dy = (was as number) < slot ? -64 : 64;
    }

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0.2 },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ],
      { duration: from ? 760 : 520, easing: 'cubic-bezier(0.22, 0.8, 0.22, 1)' }
    );
  }, [placed, slot]);

  const initialWage = useRef(wage);
  useEffect(() => {
    startTimer(initialWage.current);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      ctxRef.current?.close();
    };
  }, [startTimer]);

  // Audio initialises on first interaction (browser policy)
  const initAudio = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      await ctx.resume();
      ctxRef.current = ctx;
      const raw = await fetchRegisterRaw();
      regBufRef.current = await ctx.decodeAudioData(raw.slice(0));
    } catch {}
  }, []);

  const applyWage = useCallback(() => {
    const rate = parseFloat(inputWage);
    if (isNaN(rate) || rate <= 0) return;
    try { localStorage.setItem(WAGE_KEY, String(rate)); } catch {}
    setWage(rate);
    setEditingWage(false);
    startTimer(rate);
  }, [inputWage, startTimer]);

  const togglePause = useCallback(() => {
    setPaused(prev => {
      if (!prev) {
        // pausing: record how far we've elapsed and clear interval
        pausedAtRef.current = Date.now() - startRef.current;
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        // resuming: shift startRef forward so elapsed stays continuous
        startRef.current = Date.now() - (pausedAtRef.current ?? 0);
        pausedAtRef.current = null;
        timerRef.current = setInterval(() => {
          const secs = (Date.now() - startRef.current) / 1000;
          const earned = (wageRef.current / 3600) * secs;
          setEarnings(earned);
          setElapsed(secs);
          const tens = Math.floor(earned / 10);
          if (tens > lastTenRef.current && ctxRef.current && regBufRef.current) {
            lastTenRef.current = tens;
            playRegister(ctxRef.current, regBufRef.current);
            spawnCoinsRef.current();
          }
        }, 100);
      }
      return !prev;
    });
  }, []);

  return (
    <div
      className="min-h-screen bg-black text-exp-base flex flex-col overflow-hidden"
      onClick={initAudio}
    >
      {/* ── Header ── */}
      <div className="border-b border-white/10 shrink-0">
        {/* Row 1: view tabs.
            The back link and title that used to sit here are gone —
            the page's ExpChrome bar already carries both. */}
        {/*
          ONE tab row, centred at every width.

          It used to break right from `sm` up, which was fine while the
          ladder's contents were flush-left — two left-ish things and one
          right-ish thing is a layout. Once the ticker centred, the tabs
          were the only element on the page aligned to anything else, and
          on a wide screen they sat a long way from the column they
          govern, looking adrift rather than placed.
          There were two — a desktop copy and a `sm:hidden` mobile copy — with
          the same list rendered twice and the same handlers duplicated. That
          is what put a stray, barely-visible tab label in the top left.
          A single row cannot disagree with itself.

          role=tablist so the group is announced as a set rather than as
          three unrelated buttons, and aria-selected carries the state that
          was previously conveyed by brightness alone.
        */}
        <div
          className="flex items-center justify-center gap-6 px-6 py-3.5 sm:gap-5 sm:py-4"
          role="tablist"
          aria-label="View"
          onClick={e => e.stopPropagation()}
        >
          {TAB_LABELS.map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)}
              role="tab"
              aria-selected={view === key}
              className={`font-mono text-exp-label tracking-[0.08em] uppercase transition-colors cursor-pointer
                border-b pb-1 -mb-px ${
                view === key
                  ? 'text-exp-bright border-white/70'
                  : 'text-exp-muted border-transparent hover:text-exp-base hover:border-white/25'
              }`}
            >{label}</button>
          ))}
        </div>

        {/*
          The transport, moved up out of your row.

          `elapsed` drives every amount on the page — Musk's, yours, the
          median and the minimum are all the same number multiplied by
          four different rates. Parking the clock and its controls inside
          the YOU block said they belonged to you, which is both wrong
          and why pause went missing: it was filed under a person rather
          than under the thing it actually governs.

          Up here it reads as what it is — the state of the whole
          exhibit — and it stays put while the ladder scrolls.

          Counter view only. The chart and the table are not running,
          so a pause button on them would be a control with nothing to
          act on.

          And only once a wage is placed, for the same reason: before
          that the clock has not started, so pause would pause nothing
          and clear would clear what is already clear. Offering them
          there would also put two controls directly above an input
          asking for the one thing that has to happen first.
        */}
        {view === 'counter' && placed && (
          <div className="flex items-center justify-center gap-3 px-6 pb-3.5 sm:pb-4">
            <span className="font-mono text-exp-note text-exp-dim tabular-nums mr-1">
              {fmtElapsed(elapsed)}
            </span>
            {/*
              Bordered, not bare text. These were two words in the
              middle of a paragraph of small grey type, which is where
              the pause control went to hide — a button has to look
              like one before you point at it, not after.

              Deliberately NOT stopping propagation, unlike most
              controls in here: the root's click handler is what
              initialises audio under the browser's autoplay policy,
              and swallowing the first click on the most likely first
              control is how the register sound never plays.
            */}
            <button
              onClick={togglePause}
              aria-pressed={paused}
              className="flex items-center gap-1.5 font-mono text-exp-note text-exp-muted
                         border border-white/15 rounded-xs px-3 py-1.5 cursor-pointer
                         hover:text-exp-bright hover:border-white/40 transition-colors"
            >
              {paused ? <Play size={11} strokeWidth={1.5} /> : <Pause size={11} strokeWidth={1.5} />}
              {paused ? 'resume' : 'pause'}
            </button>
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 font-mono text-exp-note text-exp-muted
                         border border-white/15 rounded-xs px-3 py-1.5 cursor-pointer
                         hover:text-exp-bright hover:border-white/40 transition-colors"
            >
              <RotateCcw size={11} strokeWidth={1.5} />
              clear
            </button>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {view === 'counter' ? (
        /*
         * A LADDER, not two columns.
         *
         * The old layout put your counter on the left and everyone else
         * on the right, which gave the page two competing focal points —
         * and Musk's number, being larger, won. Worse, the three amounts
         * were set at roughly the same size, so a layout about disparity
         * rendered a 5,800,000:1 gap as about 1.3:1.
         *
         * Now everyone sits in one column ordered by rate, each amount
         * sized by where it falls on a log scale, and you are placed
         * among them. The hierarchy IS the argument.
         */
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10 sm:py-14">

            {rows.map((row, i) => (
              <div
                key={row.id}
                ref={row.id === 'you' ? youRowRef : undefined}
                className={`py-7 ${i ? 'border-t border-white/10' : ''} ${
                  placed ? '' : row.id === 'you' ? 'invisible' : 'opacity-30'
                }`}
              >
                {row.id === 'tycoon' && (
                  <>
            {/* The seat at the top */}
            <div className="flex flex-col items-center text-center gap-1.5">
              {/*
                The name IS the control.

                A separate "compare with…" dropdown above a heading would
                say the same word twice and add a row of chrome to the
                one part of the page that should be nothing but a number.
                These five surnames ARE the label — the selected one is
                the heading, and the rest are visibly available.

                role=tablist for the same reason the view switcher uses
                it: they are one set of alternatives, not five unrelated
                buttons, and aria-selected carries a state that is
                otherwise conveyed by brightness alone.
              */}
              <div
                className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1"
                role="tablist"
                aria-label="Compare against"
                onClick={e => e.stopPropagation()}
              >
                {TYCOONS.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={t.id === tycoon.id}
                    onClick={() => setTycoonId(t.id)}
                    className={`font-mono text-exp-label uppercase tracking-wider transition-colors cursor-pointer ${
                      t.id === tycoon.id
                        ? 'text-exp-bright'
                        : 'text-exp-dim hover:text-exp-base'
                    }`}
                  >
                    {t.short}
                  </button>
                ))}
              </div>
              <div className="flex items-baseline justify-center gap-4">
                <span className="font-mono text-exp-bright tabular-nums" style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)' }}>
                  {fmtMoney((tycoon.rate / 3600) * elapsed)}
                </span>
              </div>
              {/*
                The ⓘ that used to sit beside the name is gone. It was a
                lone glyph with no label, parked next to a heading rather
                than next to the claim it explains — and the thing a reader
                doubts is the multiple, not the name. The control now sits
                directly after that sentence and says what it does.

                aria-expanded/aria-controls so the state is announced, not
                just drawn; the caret rotates so it reads as a disclosure.
              */}
              {/*
                The subline carries the person, not just the multiple.

                It read "earns N times your hourly rate" for everyone,
                which is the one sentence that is identical whoever is
                selected — so switching name changed a 48-million-dollar
                number above it and nothing else, and the swap looked
                like a rounding change rather than a different human
                being. The net worth is the cheapest piece of context
                that distinguishes them at a glance.
              */}
              <span className="font-mono text-exp-note text-exp-muted">
                worth ~${tycoon.worthB}B · earns{' '}
                {Math.round(tycoon.rate / wage).toLocaleString()} times your hourly rate
                {' · '}
                <button
                  onClick={e => { e.stopPropagation(); setShowMethod(v => !v); }}
                  aria-expanded={showMethod}
                  aria-controls="tycoon-method"
                  className="font-mono text-exp-note text-exp-base hover:text-exp-bright
                             underline decoration-dotted underline-offset-4 decoration-white/30
                             hover:decoration-white/70 transition-colors cursor-pointer
                             inline-flex items-center gap-1"
                >
                  {showMethod ? 'Hide' : 'Learn more'}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 text-[0.85em]"
                    style={{ transform: showMethod ? 'rotate(180deg)' : 'none' }}
                  >
                    ▾
                  </span>
                </button>
              </span>
              <AnimatePresence>
                {showMethod && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    id="tycoon-method"
                    /*
                     * The ladder centres; this panel does not.
                     *
                     * Everything else in the ticker is a number and a
                     * label, which centre happily — they are a
                     * scoreboard, and a scoreboard has one axis.
                     *
                     * This is neither. It is three paragraphs and two
                     * long division sums, and centred prose forces the
                     * eye to hunt for the start of every line. The
                     * arithmetic is worse: "$63,000,000,000 ÷ 365 ÷ 24"
                     * sitting centred above a differently-sized second
                     * sum makes two figures that should be compared
                     * impossible to compare, because neither their
                     * first nor their last digits line up.
                     *
                     * `self-stretch` keeps it full width rather than
                     * shrinking to its content inside a centred column,
                     * and `text-left` opts its contents back out.
                     */
                    className="self-stretch text-left border border-white/10 rounded-xs p-4 mt-1"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/*
                      Shown as a revision, not a restatement.

                      Quietly swapping the number would have thrown away the
                      most interesting thing the piece now has: a two-year
                      before-and-after on the same measurement, taken the same
                      way. The original stays on the page, dimmed and dated;
                      the update sits under a rule. That the figure moved 6.4x
                      in two years is the finding — it is only legible if the
                      earlier number is still there to be compared against.
                    */}
                    {/*
                      Four sizes, and they rank by importance rather than by
                      reading order:
                        11px  section labels — wayfinding, the quietest thing
                        13px  supporting prose
                        15px  the 2024 result — subordinate, it is history
                        22px  the 2026 result — the payload of the whole panel

                      The panel title used to be bold, bright and larger than
                      the figure it introduces, which inverted the hierarchy:
                      a heading that says "How was this calculated?" is a
                      label, and the answer is the content.
                    */}
                    <p className="font-mono uppercase tracking-widest mb-3.5"
                      style={{ color: 'rgba(255,255,255,0.52)', fontSize: 11 }}>
                      How was this calculated?
                    </p>

                    {/*
                      One method, five people.
                      
                      This block used to be Musk-specific: a 2024 figure,
                      a 2026 figure, and a paragraph about how much the
                      rate had moved between them. Once the top of the
                      ladder became a seat, that shape stopped working —
                      four of the five people have no 2024 figure in this
                      piece to be compared against.
                      
                      What generalises is the SUM. Every person here is
                      the same arithmetic on the same tracker on the same
                      day, and showing it worked through is the only
                      thing that entitles the number above to be believed.
                    */}
                    <p className="font-mono text-exp-base leading-relaxed mb-2.5"
                      style={{ fontSize: 13 }}>
                      {tycoon.name} · Bloomberg Billionaires Index, {AS_OF_LABEL} — worth about
                      ${tycoon.worthB} billion, a year-to-date gain of ${tycoon.ytdB} billion
                      across {YTD_DAYS} days.
                    </p>

                    <p className="font-mono tabular-nums mb-1"
                      style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                      ${(tycoon.ytdB * 1e9).toLocaleString()} &divide; {YTD_DAYS} &divide; 24 =
                    </p>
                    <p className="font-mono tabular-nums text-exp-bright leading-none mb-3.5"
                      style={{ fontSize: 22, letterSpacing: '-0.015em' }}>
                      ${tycoon.rate.toLocaleString()} <span style={{ fontSize: 15, letterSpacing: 0 }}>/ hr</span>
                    </p>

                    {/*
                      Musk keeps the extra paragraph, because he is the
                      only one this piece has a two-year baseline for —
                      it shipped with his 2024 rate, so the movement is a
                      finding rather than a decoration.
                    */}
                    {/*
                      Everything below the sum is either true of ALL
                      three or fenced behind a name.

                      The caveat paragraph used to be generic in its
                      first clause and then illustrated itself with
                      Musk's peak and giveback — so picking Bezos got
                      you a figure about Musk. Same failure as a shared
                      node quoting one of its inbound answers: the copy
                      was written while looking at one route and never
                      re-read from the others.

                      The rule now is simple. If a sentence names a
                      person, it lives inside a check on that person.
                    */}
                    {/*
                      Musk keeps this one line because he is the only
                      person this piece has a two-year baseline for — it
                      shipped with his 2024 rate, so the movement is a
                      finding rather than a decoration.
                    */}
                    {tycoon.id === 'musk' && (
                      <p className="font-mono mb-3.5" style={{ color: '#FF6B6B', fontSize: 13.5 }}>
                        6.7&times; the $7,191,780 / hr this piece launched with in 2024.
                      </p>
                    )}

                    {/* Whose fortune this is, and what happened to it. */}
                    <p className="font-mono text-exp-muted leading-relaxed mb-3.5"
                      style={{ fontSize: 13 }}>
                      {tycoon.context}
                    </p>

                    {/*
                      True of every name in the list, and it stays true
                      of the next one added — which is the test a line in
                      this block has to pass.
                    */}
                    <p className="font-mono text-exp-muted leading-relaxed"
                      style={{ fontSize: 13 }}>
                      Unrealized gains on holdings, not a paycheck. Each of these fortunes is
                      mostly stock in a single company, so the number moves with a share price
                      rather than with anybody working, and it can fall as easily as it rises.
                      Reputable trackers disagree with each other by billions on any given day.
                      A figure that behaves like that is not a wage. Which is rather the point.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

                  </>
                )}

                {row.id === 'you' && (
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex items-center justify-center gap-2.5">
                      <span className="font-mono text-exp-label uppercase tracking-wider text-exp-bright">
                        You
                      </span>
                      {/* The pencil belongs to your row, not to a floating
                          toolbar — it is your rate, so it lives with your name. */}
                      <button
                        onClick={e => { e.stopPropagation(); setInputWage(wage.toFixed(2)); setEditingWage(true); }}
                        aria-label="Change your hourly rate"
                        className="text-exp-muted hover:text-exp-bright transition-colors cursor-pointer"
                      >
                        <Pencil size={12} strokeWidth={1.5} />
                      </button>
                      <span className="font-mono text-exp-note text-exp-dim tabular-nums">
                        ${wage.toFixed(2)}/hr
                      </span>
                    </div>

                    <div className="relative">
                      <EarningsDisplay earnings={earnings} scale={youScale} />
                      <div className="absolute inset-0" style={{ overflow: 'visible', pointerEvents: 'none' }}>
                        {coins.map(coin => <CoinParticle key={coin.id} {...coin} />)}
                      </div>
                    </div>

                  </div>
                )}

                {row.id === 'median' && (
                  <>
            {/* Median worker */}
            {(() => {
              const medianEarned = (MEDIAN_WAGE / 3600) * elapsed;
              const ratio = wage >= MEDIAN_WAGE ? wage / MEDIAN_WAGE : MEDIAN_WAGE / wage;
              const youEarnMore = wage >= MEDIAN_WAGE;
              return (
                <div className="flex flex-col items-center text-center gap-1.5">
                  <span className="font-mono text-exp-label uppercase tracking-wider text-exp-muted">
                    {MEDIAN_LABEL}
                  </span>
                  <div className="flex items-baseline justify-center gap-4">
                    <span className="font-mono text-exp-base tabular-nums" style={{ fontSize: 'clamp(2rem, 4vw, 3.7rem)' }}>
                      {fmtMoney(medianEarned)}
                    </span>
                  </div>
                  <span className="font-mono text-exp-note text-exp-dim">
                    {youEarnMore
                      ? `you earn ${fmtMultiplier(ratio)} the median wage`
                      : `earns ${fmtMultiplier(ratio)} your hourly rate`}
                  </span>
                </div>
              );
            })()}

                  </>
                )}

                {row.id === 'min' && (
                  <>
            {/* Min wage */}
            {(() => {
              const minEarned = (MIN_WAGE / 3600) * elapsed;
              const ratio = wage >= MIN_WAGE ? wage / MIN_WAGE : MIN_WAGE / wage;
              const youEarnMore = wage >= MIN_WAGE;
              return (
                <div className="flex flex-col items-center text-center gap-1.5">
                  <span className="font-mono text-exp-label uppercase tracking-wider text-exp-dim">
                    Federal Min. Wage
                  </span>
                  <div className="flex items-baseline justify-center gap-4">
                    <span className="font-mono text-exp-muted tabular-nums" style={{ fontSize: 'clamp(1.6rem, 3.1vw, 2.9rem)' }}>
                      {fmtMoney(minEarned)}
                    </span>
                  </div>
                  <span className="font-mono text-exp-note text-exp-dim">
                    {youEarnMore
                      ? `you earn ${fmtMultiplier(ratio)} federal minimum wage`
                      : `earns ${fmtMultiplier(ratio)} your hourly rate`}
                  </span>
                </div>
              );
            })()}

                  </>
                )}
              </div>
            ))}

            {/* The explanation sits BELOW the evidence now. Four lines of
                prose above the numbers meant the argument arrived before
                anything had happened. */}
            <p className="mt-10 font-mono text-exp-note text-exp-muted leading-relaxed max-w-xl mx-auto text-center">
              While you work, so does everyone else — from the minimum wage worker to the world's
              wealthiest person. The federal minimum wage hasn't changed since 2009. Billionaire
              wealth has grown by trillions. This is not an accident.
            </p>

            {/* Sources */}
            <div className="flex items-center justify-center gap-3 mt-2 text-exp-micro">
              <span className="font-mono text-exp-dim">est. Aug 2026 ·</span>
              <a href="https://www.bloomberg.com/billionaires/" target="_blank" rel="noopener noreferrer"
                className="font-mono text-exp-muted hover:text-exp-base transition-colors" onClick={e => e.stopPropagation()}>
                bloomberg billionaires
              </a>
              <span className="font-mono text-exp-dim">·</span>
              <a href="https://www.bls.gov" target="_blank" rel="noopener noreferrer"
                className="font-mono text-exp-muted hover:text-exp-base transition-colors" onClick={e => e.stopPropagation()}>
                bls.gov
              </a>
              <span className="font-mono text-exp-dim">·</span>
              <a href="https://www.dol.gov/agencies/whd/minimum-wage" target="_blank" rel="noopener noreferrer"
                className="font-mono text-exp-muted hover:text-exp-base transition-colors" onClick={e => e.stopPropagation()}>
                dol.gov
              </a>
            </div>
          </div>

          {/* ── Empty state: the ladder is visible behind this, faint, so
                you can see the hierarchy before you join it. ── */}
          {!placed && (
            /* A scrim, not a curtain. The ladder has to stay legible
               behind this — seeing the hierarchy before you join it is the
               whole point of the empty state — but without something to
               separate them the input's digits collide with the row
               underneath and both become hard to read. */
            <div className="absolute inset-0 grid place-items-center px-6 bg-black/60 backdrop-blur-[1.5px]">
              <div ref={inputBoxRef} className="flex flex-col items-center gap-7">
                <p className="font-mono uppercase tracking-[0.3em] text-exp-base text-sm">
                  enter your hourly wage
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-exp-bright" style={{ fontSize: 'clamp(2rem, 5vw, 3.6rem)' }}>$</span>
                  <input
                    type="number"
                    value={inputWage}
                    onChange={e => setInputWage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && commitWage()}
                    autoFocus
                    aria-label="Your hourly wage in dollars"
                    className="font-mono text-exp-bright bg-transparent border-b border-white/30 focus:outline-hidden focus:border-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ fontSize: 'clamp(2rem, 5vw, 3.6rem)', width: '5ch' }}
                  />
                  <span className="font-mono text-exp-base" style={{ fontSize: 'clamp(1rem, 2vw, 1.4rem)' }}>/ hr</span>
                </div>
                <button
                  onClick={commitWage}
                  className="font-mono text-sm tracking-[0.2em] uppercase border border-white/30 px-8 py-3 text-exp-base hover:text-exp-bright hover:border-white/60 transition-colors cursor-pointer"
                >
                  begin
                </button>
              </div>
            </div>
          )}
        </div>
      ) : view === 'chart' ? (
        <div className="flex-1 flex flex-col min-h-0 px-8 py-6">
          <EarningsChart elapsed={elapsed} wage={wage} tycoon={tycoon} />
        </div>
      ) : (
        <AffordTable wage={wage} tycoon={tycoon} />
      )}

      {/* ── Wage overlay ── */}
      <AnimatePresence>
        {editingWage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            /* Dimmed, not blacked out. This is a small correction to one
               number, and the ladder behind it is the context for that
               number — a full takeover hid the thing being changed. */
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-50"
            onClick={() => setEditingWage(false)}
          >
            <motion.div
              initial={{ y: 10, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 0.8, 0.22, 1] }}
              className="flex flex-col items-center gap-7 rounded-sm border border-white/12 bg-black/80 px-10 py-9 shadow-2xl"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Change your hourly rate"
            >
              <p className="font-mono uppercase tracking-[0.3em] text-exp-base text-sm">
                your hourly rate
              </p>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-exp-bright" style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.6rem)' }}>$</span>
                <input
                  type="number"
                  value={inputWage}
                  onChange={e => setInputWage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyWage()}
                  autoFocus
                  className="font-mono text-exp-bright bg-transparent border-b border-white/30 focus:outline-hidden focus:border-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontSize: 'clamp(1.6rem, 3.4vw, 2.6rem)', width: '5ch' }}
                />
                <span className="font-mono text-exp-base" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>/ hr</span>
              </div>
              <button
                onClick={applyWage}
                className="font-mono text-sm tracking-[0.2em] uppercase border border-white/30 px-8 py-3 text-exp-base hover:text-exp-bright hover:border-white/60 transition-colors cursor-pointer"
              >
                set wage
              </button>
              <p className="font-mono text-exp-muted text-xs tracking-wider">
                default: ${MEDIAN_WAGE} / hr · US median (BLS Q2 2026)
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
