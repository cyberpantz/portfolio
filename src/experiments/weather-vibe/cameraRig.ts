import type { WeatherData, WeatherState } from './conditions';

/**
 * Camera framing and forward drift.
 *
 * The drift is the point. A static camera turns this scene into a diagram —
 * the slow wander is what makes it feel observed rather than rendered. So
 * nothing here stops the camera; it only stops it from leaving.
 *
 * What was wrong: three environments moved forward with `camera.position.z =
 * -t * 0.45`, which is linear and unbounded. Lovely for thirty seconds, and
 * after ten minutes the viewer is 270 units downrange, inside the buildings.
 * Two SF screenshots taken 26 minutes apart framed completely differently for
 * exactly this reason.
 *
 * What is right, and was already in the codebase: x and y have always drifted
 * as bounded sines — `Math.sin(t * 0.07) * 1.8`. Continuous, never still,
 * never escaping. Forward motion was the lone outlier. This brings it in line
 * rather than inventing a new idea.
 */

export interface DriftProfile {
  /** How far forward the wander reaches, in world units. */
  reach: number;
  /** Seconds for one advance-and-return. Long — this should never feel cyclic. */
  period: number;
}

/**
 * Only the states that already drifted forward. Clear weather never did, and
 * giving every environment a dolly would be a bigger change to the feel than
 * this is meant to be.
 */
export const FORWARD_DRIFT: Partial<Record<WeatherState, DriftProfile>> = {
  fog: { reach: 34, period: 210 },
  'fog-night': { reach: 34, period: 210 },
  overcast: { reach: 30, period: 190 },
};

/**
 * Distance travelled forward at time t. Always <= 0 (forward is -z).
 *
 * A raised cosine for the primary term, so velocity eases to zero at both ends
 * of the wander instead of reversing abruptly — the turnaround should read as
 * the camera changing its mind, not as a bounce.
 *
 * The secondary term is the part that matters for "alive". A single sine has
 * two moments per cycle where the camera is perfectly still, and stillness is
 * exactly what we are trying to avoid. A shorter term at a deliberately
 * incommensurate period (0.271 of the primary, so the two effectively never
 * re-align) keeps some motion under the camera at all times and stops the
 * cycle from being readable.
 */
export function forwardDrift(t: number, profile: DriftProfile): number {
  const primary = (1 - Math.cos((2 * Math.PI * t) / profile.period)) / 2; // 0..1..0
  const secondary = (Math.sin((2 * Math.PI * t) / (profile.period * 0.271)) + 1) / 2; // 0..1
  return -(primary * profile.reach * 0.84 + secondary * profile.reach * 0.16);
}

export interface Framing {
  /** Added to whatever height the environment assigned this frame. */
  lift: number;
  /** Scales the forward reach. Cities need to keep their distance. */
  driftScale: number;
}

/**
 * Framing by density, in one table rather than scattered across conditionals.
 *
 * Cities are lifted because every environment puts the eye at roughly 1.5
 * units — pavement level. Correct in a meadow, wrong for a skyline: from down
 * there San Francisco renders as the inside of a canyon, with the hills, the
 * bay and the silhouette all out of frame.
 *
 * Cities also drift less. The reach that feels like weather in open country is
 * enough to carry the viewer through a downtown, and a skyline only reads as a
 * skyline from outside it.
 */
export const FRAMING: Record<NonNullable<WeatherData['urbanDensity']>, Framing> = {
  urban: { lift: 14, driftScale: 0.3 },
  town: { lift: 3, driftScale: 0.65 },
  rural: { lift: 0, driftScale: 1 },
};

/**
 * A boulevard is looked ALONG, not down at.
 *
 * The 14-unit lift exists to clear an arc of towers surrounding the camera and
 * see over them. On a street that same lift floats the viewer above the
 * rooftops and destroys the corridor — the whole effect depends on being down
 * in it, with buildings rising past the top of the frame on both sides.
 *
 * Drift is also freer here. Easing forward along the axis of a street reads as
 * walking down it, which is the one place the forward wander genuinely helps
 * rather than risking the framing.
 */
const BOULEVARD_FRAMING: Framing = { lift: 4.5, driftScale: 0.75 };

export function framingFor(
  density: WeatherData['urbanDensity'],
  layout: 'arc' | 'boulevard' = 'arc',
): Framing {
  if (density === 'urban' && layout === 'boulevard') return BOULEVARD_FRAMING;
  return FRAMING[density ?? 'rural'];
}
