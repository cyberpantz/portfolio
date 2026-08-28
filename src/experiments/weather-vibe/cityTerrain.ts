import { Color } from 'three';
import { isNightPalette, type Palette } from './conditions';

/**
 * One tone for all city land, at a given distance.
 *
 * Ground and hills used to derive their colour independently — pavement at
 * 0.62 of the sky, the nearest ridge at 0.40. Two consequences, both visible
 * in Jakarta: a flat city (relief near zero) got hills that were the same
 * shape as the ground but much darker, so instead of vanishing they became
 * dark rectangles lying on it; and under a bright sky, 0.62 of #87CEEB is
 * nearly white, so the pavement read as a void rather than a street.
 *
 * Both go away if land is one material sampled at different depths. A flat
 * hill now matches the ground it sits on and is simply invisible, which is
 * what flat means.
 *
 * Lightness is targeted rather than scaled. Multiplying the sky tone makes
 * ground brightness a hostage to the weather — white under clear day, black
 * under storm. Fixing the target and borrowing only the sky's HUE keeps
 * asphalt looking like asphalt in all eleven palettes.
 */
export function cityLandColor(palette: Palette, depth: number): Color {
  const bg = new Color(palette.background);
  const gray = (bg.r + bg.g + bg.b) / 3;

  const sat = 0.14;
  const c = new Color(
    gray * (1 - sat) + bg.r * sat,
    gray * (1 - sat) + bg.g * sat,
    gray * (1 - sat) + bg.b * sat,
  );

  const mean = Math.max((c.r + c.g + c.b) / 3, 1e-4);
  // LINEAR, not sRGB. three.js Color stores linear internally, and the first
  // pass at this set 0.26 while thinking in display terms — which shows up as
  // sRGB 0.55, a pale plain rather than a street. These are the linear values
  // for roughly sRGB 0.34 by day and 0.14 at night.
  const target = isNightPalette(palette) ? 0.017 : 0.094;
  c.multiplyScalar(target / mean);

  // Aerial perspective: distance washes land toward the sky.
  return depth > 0 ? c.lerp(bg, Math.min(1, depth) * 0.7) : c;
}

/**
 * City relief — the hills a skyline stands on.
 *
 * A flat row of boxes reads as Dallas no matter what you put behind it. What
 * makes San Francisco, Seattle or Lisbon recognisable in silhouette is that
 * the buildings STEP, because the ground under them does.
 *
 * The whole feature rests on one rule: the visible hills and the building
 * placement must derive from the same function. Draw the hills one way and
 * position the buildings another and they disagree by a few units, which
 * shows up as towers hovering over a slope or sunk into it. So
 * `cityHillHeight` is the single source of truth — the ridge silhouettes
 * sample it to build their profile, and each building samples it to find its
 * own base. They cannot drift apart.
 */

/**
 * Tallest a hill gets, in world units. Buildings are 16–48 tall for scale.
 *
 * Set by working backwards from the effect. At 13 the spread between the
 * highest and lowest building base came out around 7 units against towers up
 * to 48 tall — measurably a slope, but not enough to read as one. 22 puts a
 * strongly hilly city around 11–12 units of step, which is a quarter of a tall
 * building and reads clearly in silhouette without turning downtown into a
 * mountain range.
 */
export const MAX_HILL = 22;

/**
 * Ground height at (x, z) for a city with the given relief.
 *
 * Three sine terms at different frequencies: one broad landform, one that
 * breaks it into distinct hills, one that keeps crests from looking machined.
 * Deterministic and stateless, so it is safe to call per-frame or per-vertex
 * and always agrees with itself.
 *
 * The result is squared before scaling. A raw sine sum spends most of its
 * time near the middle, which produces gentle swells everywhere and reads as
 * a lumpy plain. Squaring pushes the low end down into genuine flats and
 * keeps the peaks, which is what a hilly city actually looks like — valleys
 * you could put a downtown in, with ridges between them.
 */
export function cityHillHeight(x: number, z: number, relief: number): number {
  if (relief <= 0) return 0;

  const broad = Math.sin(x * 0.0130 + 0.9) * Math.cos(z * 0.0170 - 0.5);
  const mid = Math.sin(x * 0.0270 - 1.7) * 0.55;
  const fine = Math.cos(x * 0.0480 + 2.3) * 0.28;

  // Sum spans roughly ±1.83 → normalise to 0..1 before shaping.
  const n = ((broad + mid + fine) / 1.83) * 0.5 + 0.5;
  const shaped = n * n;

  return shaped * relief * MAX_HILL;
}

/**
 * Terrain ruggedness from a grid of elevation samples, as 0..1.
 *
 * Standard deviation rather than range, because a single outlier sample
 * (one bridge tower, one quarry) should not make a city hilly. And ruggedness
 * rather than absolute elevation, which is the intuitive-but-wrong metric:
 * Denver sits at 1600m and is nearly flat downtown, while San Francisco
 * averages under 60m and is famously not.
 *
 * Deliberately CONTINUOUS rather than a hilly/flat boolean. The thresholds
 * below are reasoned, not measured — so if they are somewhat off, the failure
 * mode is a city with slightly too much or too little relief, rather than a
 * flat city getting mountains. The dead zone at the bottom guarantees that
 * genuinely flat places come out exactly flat.
 */
export function reliefFromElevations(samples: number[]): number {
  const usable = samples.filter((n) => Number.isFinite(n));
  if (usable.length < 4) return 0;

  const mean = usable.reduce((a, b) => a + b, 0) / usable.length;
  const variance = usable.reduce((a, b) => a + (b - mean) ** 2, 0) / usable.length;
  const sd = Math.sqrt(variance);

  /** Below this, a city is flat. Miami and Chicago sit around 1–3m. */
  const FLAT_SD = 8;
  /** At or above this, full relief. San Francisco and Seattle are ~40–55m. */
  const STEEP_SD = 60;

  const t = (sd - FLAT_SD) / (STEEP_SD - FLAT_SD);
  return Math.max(0, Math.min(1, t));
}

/**
 * A square grid of lat/lon offsets around a city centre, for the elevation
 * lookup. 5×5 over roughly ±5km — wide enough to catch the hills a city is
 * built across, tight enough that it does not sample the next mountain range
 * over and call the place rugged.
 */
export function elevationGrid(lat: number, lon: number): { lats: number[]; lons: number[] } {
  const STEPS = 5;
  const SPAN = 0.045; // ~5 km in latitude

  const lats: number[] = [];
  const lons: number[] = [];

  // Longitude degrees shrink with latitude; without this the sampled box
  // would be a thin sliver near the poles and a wide rectangle at the equator.
  const lonScale = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));

  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const dy = (i / (STEPS - 1) - 0.5) * 2 * SPAN;
      const dx = (j / (STEPS - 1) - 0.5) * 2 * SPAN * lonScale;
      lats.push(+(lat + dy).toFixed(4));
      lons.push(+(lon + dx).toFixed(4));
    }
  }

  return { lats, lons };
}
