/**
 * How a city arranges itself in front of the camera.
 *
 * The original layout scatters towers on an arc AROUND the viewer, which
 * produces a serviceable generic skyline and cannot express a street. Looking
 * down Market Street from the Ferry Building is the opposite arrangement: two
 * walls of buildings flanking a corridor that recedes to a vanishing point,
 * with high ground closing the far end.
 *
 * Both are emitted as the same building record, so everything downstream —
 * hill sampling, the below-ground skirt, per-building tint, the shared
 * material — is unchanged. Only the positions differ.
 *
 * Deliberately NOT a model of San Francisco. A hand-placed Ferry Building
 * would serve exactly one of the millions of locations this thing can render.
 * `boulevard` is a shape that many cities have; San Francisco simply opts into
 * it, the same way it opts into sea lions through the signature audio
 * registry. Chicago, Barcelona and Buenos Aires can join with one line each.
 */

export type CityLayout = 'arc' | 'boulevard';

export interface Building {
  x: number;
  z: number;
  h: number;
  w: number;
  d: number;
  /** Rotation about Y. The arc layout leaves these axis-aligned. */
  rot: number;
}

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** The original: 32 towers on a wide arc, framing the viewer. */
function arcLayout(): Building[] {
  const rng = makeRng(42);
  return Array.from({ length: 32 }, (_, i) => {
    const t = i / 31;
    const angle = (t - 0.5) * 2.4; // ±69°
    const radius = 65 + rng() * 60;
    return {
      x: radius * Math.sin(angle) + (rng() - 0.5) * 18,
      z: -radius * Math.cos(angle),
      h: 16 + rng() * 32,
      w: 5 + rng() * 9,
      d: 3 + rng() * 4,
      rot: 0,
    };
  });
}

/** Half the street's width. The camera looks straight down the middle. */
const STREET_HALF_WIDTH = 15;

/**
 * A corridor receding from the viewer.
 *
 * Three things make this read as a street rather than two lines of boxes:
 *
 * 1. DEPTH RANGE. Buildings run from z -18 (close enough to be cut by the
 *    frame edge, which is what gives the corridor its enclosure) out to -300,
 *    far enough that the last ones sit near the fog line and supply the
 *    vanishing point.
 *
 * 2. HEIGHT FALLING WITH DISTANCE. Downtown is tallest at the near end. This
 *    is also perspective insurance: without it, distant towers subtend so
 *    little angle that the corridor stops reading as one.
 *
 * 3. A SLIGHT YAW. Market cuts diagonally across the grid, so its buildings
 *    meet the street at an angle rather than presenting flat faces. A few
 *    degrees is enough to break the two-parallel-walls look and is the single
 *    cheapest cue that this is a real street.
 *
 * Buildings are also allowed to step back from the kerb by varying amounts,
 * because a perfectly straight building line reads as a corridor in a game
 * rather than a city.
 */
function boulevardLayout(): Building[] {
  const rng = makeRng(4242);
  const out: Building[] = [];

  const ROWS = 17; // per side
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < ROWS; i++) {
      const t = i / (ROWS - 1); // 0 near → 1 far

      // Near buildings are close together, far ones spread out — perspective
      // already compresses the far end, so even spacing looks bunched.
      const z = -(18 + t * t * 282);

      const setback = rng() * 9;
      const w = 6 + rng() * 11;
      const d = 8 + rng() * 14;

      // Tallest downtown, tapering out toward the hills.
      const falloff = 1 - t * 0.55;
      const h = (20 + rng() * 34) * falloff;

      out.push({
        x: side * (STREET_HALF_WIDTH + setback + w / 2),
        z,
        h,
        w,
        d,
        // Angled toward the street's axis, sign flipped per side so both
        // walls lean the same way relative to the avenue.
        rot: side * (0.16 + rng() * 0.12),
      });
    }
  }

  // A few blocks closing the far end of the avenue, so the corridor terminates
  // in a city rather than in empty fog.
  for (let i = 0; i < 5; i++) {
    out.push({
      x: (rng() - 0.5) * 60,
      z: -(310 + rng() * 50),
      h: 14 + rng() * 18,
      w: 10 + rng() * 16,
      d: 8 + rng() * 10,
      rot: (rng() - 0.5) * 0.3,
    });
  }

  return out;
}

export function buildingsFor(layout: CityLayout): Building[] {
  return layout === 'boulevard' ? boulevardLayout() : arcLayout();
}

/**
 * Cities that opt out of the default arc.
 *
 * Matched the same way location audio is — case-insensitively, tolerating the
 * ", Region, Country" suffixes the reverse geocoder appends.
 */
const CITY_LAYOUTS: { city: string; layout: CityLayout }[] = [
  { city: 'San Francisco', layout: 'boulevard' },
];

export interface Landmark {
  kind: 'transamerica';
  x: number;
  z: number;
  rot?: number;
  height?: number;
}

/**
 * Per-city landmarks, same registry idea as the signature audio tracks: a
 * handful of places get something specific, everyone else gets an empty array
 * and the generic skyline.
 *
 * Placement is from the viewer's standpoint, not a map. Looking southwest down
 * Market from the Ferry Building, the Financial District is on the right, so
 * the Pyramid sits at +x, set back behind the near wall of the boulevard and
 * tall enough to clear it comfortably.
 */
const CITY_LANDMARKS: { city: string; landmarks: Landmark[] }[] = [
  {
    city: 'San Francisco',
    // Pushed back from z -78, where the tip cleared the top of the frame: at
    // that range the apex sat at 41.5 degrees elevation against a 37.5 degree
    // half-FOV, so the wings and most of the taper were cropped and only a
    // spike survived. From the Ferry Building the real thing is the better part
    // of a mile off — distance is what lets you see the whole shape, and the
    // wider x moves it clear of the boulevard's right-hand wall rather than
    // peering over it.
    /*
      Moved onto the avenue's axis, and this is the third position because the
      first two were solved for the wrong constraint.

      At x48 z-150 the APEX had a clear line of sight — but only 12% of the
      tower's silhouette did. The boulevard layout put a continuous wall of
      buildings along that diagonal, so everything below the tip was buried.
      Sighting on the apex alone is what hid that; sampling the whole height
      is what found it.

      The street gap (x -18..+18) is the one corridor with no wall in it. Sat
      near that axis and pushed deep, the Pyramid terminates the vista instead
      of peering over rooftops — which is also the more truthful image, since
      from Market it reads as the thing the street runs toward.
    */
    landmarks: [{ kind: 'transamerica', x: 14, z: -180, rot: 0.5, height: 98 }],
  },
];

export function landmarksFor(city?: string): Landmark[] {
  if (!city) return [];
  const norm = city.trim().toLowerCase();
  const hit = CITY_LANDMARKS.find((e) => {
    const entry = e.city.toLowerCase();
    return norm === entry || norm.startsWith(entry + ',');
  });
  return hit?.landmarks ?? [];
}

export function layoutFor(city?: string): CityLayout {
  if (!city) return 'arc';
  const norm = city.trim().toLowerCase();
  const hit = CITY_LAYOUTS.find((e) => {
    const entry = e.city.toLowerCase();
    return norm === entry || norm.startsWith(entry + ',');
  });
  return hit?.layout ?? 'arc';
}
