import { weatherAudio } from './audio';

/**
 * Audio-reactive plumbing for the scene.
 *
 * The soundtrack is a real Web Audio graph — synthesized weather layers plus
 * the location recordings — so the visuals can be driven by what is actually
 * playing rather than by a timer pretending to be music.
 *
 * Three decisions worth keeping:
 *
 * 1. BANDS, NOT VOLUME. Driving everything from one amplitude number is what
 *    makes reactive visuals look like a 2003 media player. Low/mid/high get
 *    mapped to different properties, so a passing siren and a low city hum
 *    move different parts of the frame.
 *
 * 2. ASYMMETRIC SMOOTHING. Fast attack, slow release — the same envelope a
 *    compressor uses. Transients register, but nothing flickers, because the
 *    decay is four times slower than the rise.
 *
 * 3. ONE SAMPLE PER FRAME, SHARED. Every consumer calls readAudioLevels()
 *    from its own useFrame, but the FFT is only read once per frame and the
 *    same object is handed back. No render-order coupling and no duplicated
 *    work, which a hook-per-component version would have had.
 */

export interface AudioLevels {
  /** 20–250 Hz — city hum, traffic rumble, thunder. */
  bass: number;
  /** 250–2000 Hz — voices, engines, most of the street. */
  mid: number;
  /** 2–8 kHz — rain, wind hiss, brakes, birds. */
  high: number;
  /** Broadband average. Use when you want "is anything happening". */
  level: number;
}

const levels: AudioLevels = { bass: 0, mid: 0, high: 0, level: 0 };

// Explicitly ArrayBuffer-backed: getByteFrequencyData refuses a view that
// might sit on a SharedArrayBuffer, and the bare Uint8Array alias is wider.
let bins: Uint8Array<ArrayBuffer> | null = null;
let lastAt = 0;

/** ~60fps ceiling. Guards against 120Hz displays doing the work twice. */
const MIN_INTERVAL_MS = 15;

const ATTACK = 0.34;
const RELEASE = 0.085;

/** Averages the bins covering a frequency range, normalised to 0..1. */
function bandAverage(data: Uint8Array<ArrayBuffer>, sampleRate: number, fftSize: number, loHz: number, hiHz: number): number {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(0, Math.floor(loHz / binHz));
  const hi = Math.min(data.length - 1, Math.ceil(hiHz / binHz));
  if (hi <= lo) return 0;

  let sum = 0;
  for (let i = lo; i <= hi; i++) sum += data[i];
  return sum / (hi - lo + 1) / 255;
}

/**
 * Per-band running peak, for auto-gain.
 *
 * The first version of this file mapped raw band energy straight to visual
 * range, which quietly did nothing. Ambient loops occupy a narrow, low slice
 * of the analyser's dB window, so a band that in principle spans 0..1 actually
 * lives around 0.15..0.3 — and multiplying a 0.2 signal by a 0.14 range gives
 * a 3% change nobody can see.
 *
 * Tracking each band's own recent peak and normalising against it means the
 * visuals use their full range no matter how loud the source is, and no
 * constant in this file has to encode an assumption about mastering levels.
 * That is the difference between a reaction and a rounding error.
 */
const peaks = { bass: 0, mid: 0, high: 0 };

/** Peak bleeds off slowly so a single loud moment does not deaden the next minute. */
const PEAK_DECAY = 0.9985;

/**
 * Below this, treat the band as silent rather than normalising it. Without a
 * floor, auto-gain amplifies the noise in a quiet passage up to full range and
 * the city strobes at nothing.
 */
const NOISE_FLOOR = 0.035;

function normalise(raw: number, band: keyof typeof peaks): number {
  peaks[band] = Math.max(raw, peaks[band] * PEAK_DECAY);
  if (peaks[band] < NOISE_FLOOR) return 0;
  return Math.min(1, raw / peaks[band]);
}

/** Fast up, slow down. */
function envelope(current: number, target: number): number {
  const k = target > current ? ATTACK : RELEASE;
  return current + (target - current) * k;
}

/**
 * Current smoothed levels. Safe to call before any audio exists — the context
 * is only created on the first user gesture, so until then this decays to
 * silence rather than throwing or snapping to zero.
 */
export function readAudioLevels(): Readonly<AudioLevels> {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastAt < MIN_INTERVAL_MS) return levels;
  lastAt = now;

  const analyser = weatherAudio.getAnalyser();

  if (!analyser) {
    // Decay toward silence instead of hard-zeroing, so muting mid-scene
    // settles the visuals rather than stopping them dead.
    levels.bass = envelope(levels.bass, 0);
    levels.mid = envelope(levels.mid, 0);
    levels.high = envelope(levels.high, 0);
    levels.level = envelope(levels.level, 0);
    return levels;
  }

  if (!bins || bins.length !== analyser.frequencyBinCount) {
    bins = new Uint8Array(analyser.frequencyBinCount);
  }
  analyser.getByteFrequencyData(bins);

  const { sampleRate } = analyser.context;
  const { fftSize } = analyser;

  levels.bass = envelope(levels.bass, normalise(bandAverage(bins, sampleRate, fftSize, 20, 250), 'bass'));
  levels.mid = envelope(levels.mid, normalise(bandAverage(bins, sampleRate, fftSize, 250, 2000), 'mid'));
  levels.high = envelope(levels.high, normalise(bandAverage(bins, sampleRate, fftSize, 2000, 8000), 'high'));
  levels.level = envelope(levels.level, (levels.bass + levels.mid + levels.high) / 3);

  debugTick();
  return levels;
}

/**
 * Set `window.__weatherVibeAudio = true` in the console to print live band
 * values once a second.
 *
 * This exists because the whole feature is unverifiable from the outside: if
 * the visuals look static, there is no way to tell whether the analyser is
 * reading silence, the bands are being computed wrong, or the numbers are fine
 * and the visual range is simply too small. These three lines answer that in
 * one glance instead of by guesswork.
 */
let lastDebug = 0;
function debugTick(): void {
  if (typeof window === 'undefined') return;
  if (!(window as unknown as Record<string, unknown>).__weatherVibeAudio) return;

  const now = performance.now();
  if (now - lastDebug < 1000) return;
  lastDebug = now;

  console.info(
    `[weather-vibe] bass ${levels.bass.toFixed(2)}  mid ${levels.mid.toFixed(2)}  ` +
      `high ${levels.high.toFixed(2)}   (peaks ${peaks.bass.toFixed(3)} / ` +
      `${peaks.mid.toFixed(3)} / ${peaks.high.toFixed(3)})`,
  );
}
