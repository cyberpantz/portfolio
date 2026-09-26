/**
 * Which particles belong to which moving part.
 *
 * The field is one undifferentiated cloud, so before anything can turn its
 * head it has to know which grains ARE the head. These weights do that: one
 * number per particle per part, 1 at the centre of the part and falling to 0
 * outside it.
 *
 * They are weights and not flags on purpose. A hard boundary shears — the
 * last row of head particles rotates away and the first row of neck
 * particles does not, and the cat tears along a line. A ramp over a band
 * means the neck bends instead of snapping.
 *
 * Every constant below was measured off cat-mask.png, not chosen. A
 * different silhouette needs them measured again, which is what
 * `scripts/cat-anatomy.py` prints.
 */

/** Field coordinates: x right, y up, the mask normalised to [-1, 1]. */
export type Vec2 = { x: number; y: number };

export const ANATOMY = {
  /* Where the head pivots. The narrowest row between the ears joining the
     skull and the shoulders widening — y=304 of 1536 in the source. */
  neck: { x: -0.563, y: 0.604 } as Vec2,
  /* Rotating in-plane alone reads as a tilt, not a look. So the head is
     treated as a half-cylinder of this radius about this vertical axis, and
     a yaw foreshortens it the way a real head turning does. */
  headCx: -0.563,
  headR: 0.229,
  /* The band over which head becomes neck. Above `headFull` a particle
     turns completely, below `headNone` not at all. */
  headFull: 0.656,
  headNone: 0.513,

  /* The front paw, and the elbow it swings from. The paw is the leftmost,
     lowest run in the mask; the elbow is up the leg from it. */
  paw: { x: -0.486, y: -0.610 } as Vec2,
  elbow: { x: -0.480, y: -0.300 } as Vec2,
  /* Full weight inside, none beyond. Deliberately tight: the rear paw sits
     only 0.17 away and must not come along. */
  pawFull: 0.085,
  pawNone: 0.155,
} as const;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 1 for a particle in the head, 0 below the neck, ramped between. */
export function headWeight(y: number): number {
  return smooth(ANATOMY.headNone, ANATOMY.headFull, y);
}

/** 1 at the front paw, falling off with distance from it. */
export function pawWeight(x: number, y: number): number {
  const d = Math.hypot(x - ANATOMY.paw.x, y - ANATOMY.paw.y);
  return 1 - smooth(ANATOMY.pawFull, ANATOMY.pawNone, d);
}

/**
 * Is the pointer in front of the cat?
 *
 * The cat sits in profile facing left, so "in front" is the region to the
 * left of its chest. Scoped this way on purpose: a head that tracks a
 * pointer behind it has to turn further than a single silhouette can show
 * before it stops reading as a cat.
 */
export function inFront(px: number, py: number): number {
  const ahead = 1 - smooth(-0.50, -0.20, px);
  /* And roughly at its level — a pointer far above the ears or below the
     floor is not something it would look at. */
  const level = 1 - smooth(0.55, 1.15, Math.abs(py - ANATOMY.neck.y + 0.25));
  return ahead * level;
}
