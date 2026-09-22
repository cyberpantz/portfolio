import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Pause, Play } from 'lucide-react';
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
  const cellW = Math.max(26, Math.round(baseW * scale));

  const cellH         = Math.round(cellW * (CELL_H_MAX / CELL_W_MAX));
  const separatorSize = Math.round(cellW * (76 / CELL_W_MAX));
  const outerGap      = Math.max(2, Math.round(cellW * (6 / CELL_W_MAX)));
  const innerGap      = Math.max(1, Math.round(cellW * (3 / CELL_W_MAX)));

  const str = earnings.toFixed(2);
  const [rawInt, frac] = str.split('.');
  const intDigits = rawInt.padStart(3, '0').split('');
  const fracDigits = frac.split('');

  return (
    /* Left-aligned: it sits in a ladder now, and a centred counter among
       left-aligned rows reads as a different component that wandered in. */
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
 * ELON_RATE — Bloomberg Billionaires Index, 31 August 2026: $888B, a
 * year-to-date gain of $269B (+43.4%). Over the 243 days elapsed that is
 * $269e9 / 243 / 24 = $46,124,829 per hour. The previous figure was
 * $7,191,780/hr from 2024 — the rate is now 6.4x what this piece shipped
 * with.
 *
 * 2026 is also the year the framing broke in an instructive way. SpaceX
 * listed on 12 June and he became the first trillionaire; his fortune
 * peaked at $1.32T on 16 June, then fell roughly $594B from that peak as
 * SpaceX slid post-IPO and Tesla softened over the summer. Trackers still
 * disagree by hundreds of billions — Forbes had $726B on 4 August while
 * Bloomberg had $888B on the 31st. A number that can move half a trillion
 * dollars in ten weeks, and that two reputable sources cannot agree on to
 * within 20%, is not a wage. That is the point the piece should now make,
 * and the copy below makes it.
 */
const MEDIAN_WAGE = 31.28; // BLS Q2 2026: $1,251/wk ÷ 40

const ELON_RATE    = 46_124_829; // $269B YTD ÷ 243 days ÷ 24h, Bloomberg 31 Aug 2026
const MIN_WAGE     = 7.25;       // US federal minimum, unchanged since 2009
const MEDIAN_LABEL = 'US Median Worker';

export type LadderRow = { id: 'elon' | 'you' | 'median' | 'min'; label: string; rate: number };

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
export function ladderRows(wage: number): LadderRow[] {
  return [
    { id: 'elon',   label: 'Elon Musk',          rate: ELON_RATE },
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
export function rankScale(rate: number): number {
  const lo = Math.log10(MIN_WAGE);
  const hi = Math.log10(ELON_RATE);
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
  return             { text: `${(days / 365.25).toFixed(1)} yr`,                              cls: 'text-fg'         };
}

const AFFORD_ITEMS = [
  { label: 'cup of coffee',     price: 6        },
  { label: 'week of groceries', price: 200      },
  { label: "month's rent",      price: 1_750    },
  { label: 'emergency room',    price: 3_000    },
  { label: 'used car',          price: 15_000   },
  { label: 'new car',           price: 40_000   },
  { label: 'college (4 yr)',    price: 220_000  },
  { label: 'median home',       price: 420_000  },
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

function EarningsChart({ elapsed, wage }: { elapsed: number; wage: number }) {
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
    { key: 'elon',    name: 'Elon Musk',        stroke: '#EF4444',                width: 2,               ink: '#FF6B6B' },
    { key: 'you',     name: 'You',              stroke: '#FFFFFF',                width: 2,               ink: '#FFFFFF' },
    { key: 'median',  name: 'US Median Worker', stroke: 'rgba(255,255,255,0.45)', width: 1.5, dash: '6 4', ink: 'rgba(255,255,255,0.78)' },
    { key: 'minwage', name: 'Federal Min. Wage',stroke: 'rgba(255,255,255,0.26)', width: 1.5, dash: '3 5', ink: 'rgba(255,255,255,0.62)' },
  ];

  const stats = [
    { label: 'Elon Musk',         earned: (ELON_RATE   / 3600) * elapsed, ink: '#FF6B6B' },
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
        elon:    (ELON_RATE   / 3600) * t,
        you:     (wage        / 3600) * t,
        median:  (MEDIAN_WAGE / 3600) * t,
        minwage: (MIN_WAGE    / 3600) * t,
      };
    });
  }, [elapsed, wage]);

  const yTicks = useMemo(() => {
    const maxY = (ELON_RATE / 3600) * Math.max(elapsed, 30);
    const ticks: number[] = [];
    for (let p = -3; p <= Math.ceil(Math.log10(maxY)); p++) ticks.push(10 ** p);
    return ticks;
  }, [elapsed]);

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
            Elon is{' '}
            <span style={{ color: '#FF6B6B', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(ELON_RATE / wage).toLocaleString()}&times;
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
            domain={[0.001, (ELON_RATE / 3600) * maxTime * 1.5]}
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

function AffordTable({ wage }: { wage: number }) {
  const columns = [
    { name: 'You',      rate: wage,        highlight: true  },
    { name: 'Median',   rate: MEDIAN_WAGE, highlight: false },
    { name: 'Min Wage', rate: MIN_WAGE,    highlight: false },
    { name: 'Elon',     rate: ELON_RATE,   highlight: false },
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
  const [showElonInfo, setShowElonInfo] = useState(false);

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

  const rows     = ladderRows(wage);
  const slot     = rows.findIndex(r => r.id === 'you');
  // Counter size follows the same log rank as every other amount, floored
  // by EarningsDisplay so the digits stay readable at the bottom.
  const youScale = 0.42 + rankScale(wage) * 0.55;

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
          ONE tab row, centred on small screens and right-aligned from sm up.
          There were two — a desktop copy and a `sm:hidden` mobile copy — with
          the same list rendered twice and the same handlers duplicated. That
          is what put a stray, barely-visible tab label in the top left.
          A single row cannot disagree with itself.

          role=tablist so the group is announced as a set rather than as
          three unrelated buttons, and aria-selected carries the state that
          was previously conveyed by brightness alone.
        */}
        <div
          className="flex items-center justify-center gap-6 px-6 py-3.5 sm:justify-end sm:gap-5 sm:py-4"
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
                {row.id === 'elon' && (
                  <>
            {/* Elon */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-exp-label uppercase tracking-wider text-exp-base">
                  Elon Musk
                </span>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-exp-bright tabular-nums" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)' }}>
                  {fmtMoney((ELON_RATE / 3600) * elapsed)}
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
              <span className="font-mono text-exp-note text-exp-muted">
                earns {Math.round(ELON_RATE / wage).toLocaleString()} times your hourly rate
                {' · '}
                <button
                  onClick={e => { e.stopPropagation(); setShowElonInfo(v => !v); }}
                  aria-expanded={showElonInfo}
                  aria-controls="elon-method"
                  className="font-mono text-exp-note text-exp-base hover:text-exp-bright
                             underline decoration-dotted underline-offset-4 decoration-white/30
                             hover:decoration-white/70 transition-colors cursor-pointer
                             inline-flex items-center gap-1"
                >
                  {showElonInfo ? 'Hide' : 'Learn more'}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 text-[0.85em]"
                    style={{ transform: showElonInfo ? 'rotate(180deg)' : 'none' }}
                  >
                    ▾
                  </span>
                </button>
              </span>
              <AnimatePresence>
                {showElonInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    id="elon-method"
                    className="border border-white/10 rounded-xs p-4 mt-1"
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

                    {/* ---- as originally published ---- */}
                    <p className="font-mono uppercase tracking-widest mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.44)', fontSize: 11 }}>
                      As published · 2024
                    </p>
                    <p className="font-mono text-exp-muted leading-relaxed mb-1"
                      style={{ fontSize: 13 }}>
                      Net worth increase of ~$63 billion, Bloomberg Billionaires Index.
                    </p>
                    <p className="font-mono tabular-nums mb-5"
                      style={{ color: 'rgba(255,255,255,0.62)', fontSize: 15 }}>
                      $63,000,000,000 ÷ 365 ÷ 24 = $7,191,780 / hr
                    </p>

                    {/* ---- the update ---- */}
                    <div className="border-t border-white/12 pt-4">
                      <p className="font-mono uppercase tracking-widest mb-2 flex items-center gap-2"
                        style={{ color: '#FF6B6B', fontSize: 11 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block', width: 5, height: 5,
                            borderRadius: '50%', background: '#FF6B6B',
                          }}
                        />
                        Update · September 2026
                      </p>

                      <p className="font-mono text-exp-base leading-relaxed mb-2.5"
                        style={{ fontSize: 13 }}>
                        First trillionaire on 12 June 2026, when SpaceX listed. Bloomberg, 31 Aug:
                        $888B — a year-to-date gain of $269 billion across 243 days.
                      </p>

                      {/* The answer. Given room to be the largest thing here. */}
                      <p className="font-mono tabular-nums mb-1"
                        style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                        $269,000,000,000 ÷ 243 ÷ 24 =
                      </p>
                      <p className="font-mono tabular-nums text-exp-bright leading-none mb-2.5"
                        style={{ fontSize: 22, letterSpacing: '-0.015em' }}>
                        $46,124,829 <span style={{ fontSize: 15, letterSpacing: 0 }}>/ hr</span>
                      </p>

                      <p className="font-mono mb-3.5" style={{ color: '#FF6B6B', fontSize: 13.5 }}>
                        6.4&times; the rate this piece launched with, in two years.
                      </p>

                      <p className="font-mono text-exp-muted leading-relaxed"
                        style={{ fontSize: 13 }}>
                        Still unrealized gains, not a paycheck — and 2026 made that plainer than
                        ever. The figure peaked at $1.32T on 16 June, then fell about $594B from
                        that peak as SpaceX slid post-IPO. Forbes said $726B on 4 August; Bloomberg
                        said $888B on the 31st. A number that moves half a trillion dollars in ten
                        weeks, and that two reputable trackers cannot agree on to within 20%, is not
                        a wage. Which is rather the point.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

                  </>
                )}

                {row.id === 'you' && (
                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-2.5">
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

                    <div className="flex items-center gap-4">
                      <span className="font-mono text-exp-note text-exp-dim tabular-nums">
                        elapsed {fmtElapsed(elapsed)}
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); togglePause(); }}
                        className="flex items-center gap-1.5 text-exp-muted hover:text-exp-bright transition-colors cursor-pointer"
                      >
                        {paused ? <Play size={11} strokeWidth={1.5} /> : <Pause size={11} strokeWidth={1.5} />}
                        <span className="font-mono text-exp-note">{paused ? 'resume' : 'pause'}</span>
                      </button>
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
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-exp-label uppercase tracking-wider text-exp-muted">
                    {MEDIAN_LABEL}
                  </span>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-exp-base tabular-nums" style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2.6rem)' }}>
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
                <div className="flex flex-col gap-2">
                  <span className="font-mono text-exp-label uppercase tracking-wider text-exp-dim">
                    Federal Min. Wage
                  </span>
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-exp-muted tabular-nums" style={{ fontSize: 'clamp(1.1rem, 2.2vw, 2rem)' }}>
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
            <p className="mt-10 font-mono text-exp-note text-exp-muted leading-relaxed max-w-xl">
              While you work, so does everyone else — from the minimum wage worker to the world's
              wealthiest person. The federal minimum wage hasn't changed since 2009. Billionaire
              wealth has grown by trillions. This is not an accident.
            </p>

            {/* Sources */}
            <div className="flex items-center gap-3 mt-2 text-exp-micro">
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
          <EarningsChart elapsed={elapsed} wage={wage} />
        </div>
      ) : (
        <AffordTable wage={wage} />
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
