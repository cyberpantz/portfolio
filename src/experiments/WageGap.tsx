import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

function FlipDigit({ value, cellW }: { value: string; cellW: number }) {
  const cellH    = Math.round(cellW * (CELL_H_MAX / CELL_W_MAX));
  const fontSize = Math.round(cellW * (72 / CELL_W_MAX));

  const num = parseInt(value, 10);
  const prevNum = useRef(num);
  const [pos, setPos] = useState(num);
  const instant = useRef(false);
  const strip = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], []);

  useEffect(() => {
    const wrapping = prevNum.current === 9 && num === 0;
    if (wrapping) {
      instant.current = false;
      setPos(10);
      setTimeout(() => {
        instant.current = true;
        setPos(0);
        prevNum.current = num;
        setTimeout(() => { instant.current = false; }, 50);
      }, 380);
    } else {
      instant.current = false;
      setPos(num);
      prevNum.current = num;
    }
  }, [num]);

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-white/10"
      style={{ width: cellW, height: cellH, background: 'rgba(255,255,255,0.04)' }}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/30 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 top-1/2 h-px bg-white/8 pointer-events-none z-10" />
      <motion.div
        className="absolute inset-x-0 top-0"
        animate={{ y: -pos * cellH }}
        transition={
          instant.current
            ? { duration: 0 }
            : { type: 'spring', stiffness: 220, damping: 32, mass: 0.8 }
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

function EarningsDisplay({ earnings }: { earnings: number }) {
  const [cellW, setCellW] = useState(() =>
    typeof window !== 'undefined' ? computeCellW(window.innerWidth - 48) : CELL_W_MAX
  );

  useEffect(() => {
    const update = () => setCellW(computeCellW(window.innerWidth - 48));
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const cellH         = Math.round(cellW * (CELL_H_MAX / CELL_W_MAX));
  const separatorSize = Math.round(cellW * (76 / CELL_W_MAX));
  const outerGap      = Math.max(2, Math.round(cellW * (6 / CELL_W_MAX)));
  const innerGap      = Math.max(1, Math.round(cellW * (3 / CELL_W_MAX)));

  const str = earnings.toFixed(2);
  const [rawInt, frac] = str.split('.');
  const intDigits = rawInt.padStart(3, '0').split('');
  const fracDigits = frac.split('');

  return (
    <div className="flex justify-center">
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

const MEDIAN_WAGE = 29.13; // BLS Q3 2024 median hourly earnings

const ELON_RATE    = 7_191_780; // ~$63B / yr, Bloomberg 2024
const MIN_WAGE     = 7.25;       // US federal minimum wage
const MEDIAN_LABEL = 'US Median Worker';

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

interface LineSpec { key: string; name: string; stroke: string; width: number; dash?: string; }

function EarningsChart({ elapsed, wage }: { elapsed: number; wage: number }) {
  const maxTime = Math.max(elapsed, 30);

  const lineSpecs: LineSpec[] = [
    { key: 'elon',    name: 'Elon Musk',        stroke: '#EF4444',                 width: 2 },
    { key: 'you',     name: 'You',               stroke: '#FFFFFF',                 width: 2 },
    { key: 'median',  name: 'US Median Worker',  stroke: 'rgba(255,255,255,0.45)', width: 1.5, dash: '6 4' },
    { key: 'minwage', name: 'Federal Min. Wage', stroke: 'rgba(255,255,255,0.22)', width: 1.5, dash: '3 5' },
  ];

  const stats = [
    { label: 'Elon Musk',        earned: (ELON_RATE   / 3600) * elapsed, color: '#EF4444' },
    { label: 'You',               earned: (wage        / 3600) * elapsed, color: '#FFFFFF' },
    { label: 'US Median Worker',  earned: (MEDIAN_WAGE / 3600) * elapsed, color: 'rgba(255,255,255,0.45)' },
    { label: 'Federal Min. Wage', earned: (MIN_WAGE    / 3600) * elapsed, color: 'rgba(255,255,255,0.22)' },
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
    return (
      <div style={{
        background: 'rgba(0,0,0,0.92)',
        border: '1px solid rgba(255,255,255,0.12)',
        padding: '10px 14px',
        fontFamily: 'monospace',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 8 }}>
          {fmtX(label ?? 0)}
        </p>
        {payload.map(entry => (
          <div key={entry.dataKey} style={{
            display: 'flex', justifyContent: 'space-between', gap: 24,
            fontSize: 13, color: entry.stroke, marginBottom: 3,
          }}>
            <span style={{ opacity: 0.8 }}>{entry.name}</span>
            <span>{fmtMoney(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        {stats.map(s => (
          <div key={s.label}
            className="border p-3 rounded-sm"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
          >
            <p className="font-mono uppercase tracking-widest mb-1"
              style={{ color: s.color, opacity: 0.5, fontSize: 11 }}>
              {s.label}
            </p>
            <p className="font-mono tabular-nums" style={{ color: s.color, fontSize: 18 }}>
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
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={[CHART_EPS, maxTime]}
            tickFormatter={fmtX}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            label={{ value: 'time elapsed', position: 'insideBottom', offset: -16,
              style: { fill: 'rgba(255,255,255,0.18)', fontSize: 12, fontFamily: 'monospace' } }}
          />
          <YAxis
            scale="log"
            domain={[0.001, (ELON_RATE / 3600) * maxTime * 1.5]}
            ticks={yTicks}
            tickFormatter={fmtY}
            tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'monospace' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            allowDataOverflow
            label={{ value: 'earnings (log scale)', angle: -90, position: 'insideLeft', offset: -55,
              style: { fill: 'rgba(255,255,255,0.18)', fontSize: 12, fontFamily: 'monospace' } }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
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
      <div className="flex items-center justify-center gap-8 pb-2 flex-shrink-0">
        {lineSpecs.map(l => (
          <div key={l.key} className="flex items-center gap-2">
            <svg width={24} height={12}>
              <line x1={0} y1={6} x2={24} y2={6}
                stroke={l.stroke} strokeWidth={l.width}
                strokeDasharray={l.dash} strokeLinecap="round" />
            </svg>
            <span className="font-mono text-exp-note tracking-wider" style={{ color: l.stroke }}>
              {l.name}
            </span>
          </div>
        ))}
      </div>

      {/* Log scale explainer */}
      <p className="font-mono text-exp-note text-center text-exp-muted leading-relaxed pb-4 flex-shrink-0 max-w-2xl mx-auto">
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
            {AFFORD_ITEMS.map((item, i) => (
              <tr key={item.label} className={i < AFFORD_ITEMS.length - 1 ? 'border-b border-white/5' : ''}>
                <td className="sticky left-0 bg-black py-3.5 pr-4 sm:pr-8">
                  <div className="font-mono text-exp-label text-exp-base">{item.label}</div>
                  <div className="font-mono text-exp-note text-exp-dim">${item.price.toLocaleString()}</div>
                </td>
                {columns.map(col => {
                  const { text, cls } = fmtWorkTime(item.price, col.rate);
                  return (
                    <td key={col.name} className={`py-3.5 pl-4 sm:pl-8 text-right font-mono tabular-nums text-exp-label ${cls}`}>
                      {text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="font-mono text-exp-micro text-exp-dim mt-8 leading-relaxed">
          prices are US averages · assumes continuous work · wages: BLS 2024, Elon: Bloomberg 2024
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

export default function WageGap() {
  const [wage, setWage] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem('skrillatime-wage') ?? '');
      if (!isNaN(v) && v > 0) return v;
    } catch {}
    return MEDIAN_WAGE;
  });
  const [inputWage, setInputWage] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem('skrillatime-wage') ?? '');
      if (!isNaN(v) && v > 0) return String(v);
    } catch {}
    return String(MEDIAN_WAGE);
  });
  const [editingWage, setEditingWage] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [view, setView] = useState<'counter' | 'chart' | 'afford'>('counter');
  const [paused, setPaused] = useState(false);
  const [showElonInfo, setShowElonInfo] = useState(false);

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
    try { localStorage.setItem('skrillatime-wage', String(rate)); } catch {}
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
      <div className="border-b border-white/10 flex-shrink-0">
        {/* Row 1: back + title */}
        <div className="relative flex items-center px-6 py-3 sm:py-4 sm:justify-between">
          <a
            href="/explorations"
            className="font-mono text-exp-label text-exp-muted tracking-[0.08em] hover:text-exp-bright transition-colors"
            onClick={e => e.stopPropagation()}
          >
            ← back
          </a>
          {/* Mobile: title centered between back and right edge */}
          <span className="sm:hidden flex-1 text-center font-mono text-exp-label text-exp-muted tracking-[0.08em] uppercase">
            Wage Gap
          </span>
          {/* Desktop: title absolutely centered, tabs on right */}
          <span className="hidden sm:block font-mono text-exp-label text-exp-muted tracking-[0.08em] uppercase absolute left-1/2 -translate-x-1/2">
            Wage Gap
          </span>
          <div className="hidden sm:flex items-center gap-5" onClick={e => e.stopPropagation()}>
            {TAB_LABELS.map(({ key, label }) => (
              <button key={key} onClick={() => setView(key)}
                className={`font-mono text-exp-label tracking-[0.08em] uppercase transition-colors cursor-pointer ${
                  view === key ? 'text-exp-bright' : 'text-exp-muted hover:text-exp-base'
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
        {/* Row 2 (mobile only): tabs */}
        <div className="sm:hidden flex items-center justify-center gap-8 pb-3" onClick={e => e.stopPropagation()}>
          {TAB_LABELS.map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)}
              className={`font-mono text-exp-label tracking-[0.08em] uppercase transition-colors cursor-pointer ${
                view === key ? 'text-exp-bright' : 'text-exp-muted hover:text-exp-base'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      {view === 'counter' ? (
        <div className="flex flex-col sm:flex-row flex-1 min-h-0">

          {/* Left: your counter */}
          <div className="sm:w-[44%] flex flex-col items-center justify-center gap-8 p-6 sm:p-12 border-b sm:border-b-0 sm:border-r border-white/10">
            <p className="font-mono text-exp-label uppercase tracking-[0.3em] text-exp-muted">
              you've earned
            </p>

            <div className="relative">
              <EarningsDisplay earnings={earnings} />
              <div className="absolute inset-0" style={{ overflow: 'visible', pointerEvents: 'none' }}>
                {coins.map(coin => <CoinParticle key={coin.id} {...coin} />)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); setInputWage(wage.toFixed(2)); setEditingWage(true); }}
                className="flex items-center gap-1.5 border border-white/15 rounded px-2.5 py-1.5 text-exp-muted hover:text-exp-bright hover:border-white/30 transition-colors cursor-pointer"
              >
                <Pencil size={12} strokeWidth={1.5} />
                <span className="font-mono text-exp-label tracking-[0.06em]">${wage.toFixed(2)}/hr</span>
              </button>
              <button
                onClick={e => { e.stopPropagation(); togglePause(); }}
                className="flex items-center gap-1.5 border border-white/15 rounded px-2.5 py-1.5 text-exp-muted hover:text-exp-bright hover:border-white/30 transition-colors cursor-pointer"
                title={paused ? 'Resume' : 'Pause'}
              >
                {paused ? <Play size={12} strokeWidth={1.5} /> : <Pause size={12} strokeWidth={1.5} />}
                <span className="font-mono text-exp-label tracking-[0.06em]">{paused ? 'resume' : 'pause'}</span>
              </button>
            </div>

            <p className="font-mono text-exp-label text-exp-muted tabular-nums flex items-center gap-2">
              <span className="uppercase tracking-[0.15em] text-exp-muted">elapsed</span>
              {fmtElapsed(elapsed)}
            </p>
          </div>

          {/* Right: comparisons */}
          <div className="flex-1 flex flex-col justify-center px-6 py-6 sm:px-12 sm:py-10 gap-8 overflow-y-auto">

            {/* Context blurb */}
            <p className="font-mono text-exp-body text-exp-muted leading-relaxed max-w-sm">
              While you work, so does everyone else — from the minimum wage worker to the world's wealthiest person. These counters are synchronized and expose the wealth gap in a dramatic way.
              The federal minimum wage hasn't changed since 2009. Billionaire wealth has grown by trillions. This is not an accident.
            </p>

            <div className="border-t border-white/10" />

            {/* Elon */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-exp-label uppercase tracking-wider text-exp-base">
                  Elon Musk
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setShowElonInfo(v => !v); }}
                  className="font-mono text-exp-label text-exp-muted hover:text-exp-bright transition-colors cursor-pointer leading-none"
                  title="How was this calculated?"
                >
                  ⓘ
                </button>
              </div>
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-exp-bright tabular-nums" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)' }}>
                  {fmtMoney((ELON_RATE / 3600) * elapsed)}
                </span>
              </div>
              <span className="font-mono text-exp-note text-exp-muted">
                earns {Math.round(ELON_RATE / wage).toLocaleString()} times your hourly rate
              </span>
              <AnimatePresence>
                {showElonInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="border border-white/10 rounded-sm p-4 mt-1"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="font-mono text-exp-note text-exp-bright font-bold uppercase tracking-widest mb-3">
                      How was this calculated?
                    </p>
                    <p className="font-mono text-exp-base leading-relaxed mb-2">
                      Based on Elon Musk's 2024 net worth increase of ~$63 billion (Bloomberg Billionaires Index):
                    </p>
                    <p className="font-mono text-exp-base mb-2">
                      $63,000,000,000 ÷ 365 ÷ 24 = <span className="text-exp-bright">$7,191,780 / hr</span>
                    </p>
                    <p className="font-mono text-exp-muted leading-relaxed">
                      Unrealized stock gains, not a paycheck — his net worth fell ~$200B in 2022.
                      The year varies. The scale does not.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/10" />

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

            {/* Sources */}
            <div className="flex items-center gap-3 mt-2 text-exp-micro">
              <span className="font-mono text-exp-dim">est. 2024 ·</span>
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
            className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setEditingWage(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center gap-10"
              onClick={e => e.stopPropagation()}
            >
              <p className="font-mono uppercase tracking-[0.3em] text-exp-base text-sm">
                your hourly rate
              </p>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-exp-bright" style={{ fontSize: 'clamp(2rem, 5vw, 4rem)' }}>$</span>
                <input
                  type="number"
                  value={inputWage}
                  onChange={e => setInputWage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyWage()}
                  autoFocus
                  className="font-mono text-exp-bright bg-transparent border-b border-white/30 focus:outline-none focus:border-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', width: '5ch' }}
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
                default: ${MEDIAN_WAGE} / hr · US median (BLS 2024)
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
