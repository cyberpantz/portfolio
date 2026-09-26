/**
 * The camera, and the surface the pointer lands on.
 *
 * These live together and apart from the renderer because the staging
 * depends on both at once: where the cat ends up facing is a fact about
 * the camera angle and the plane tilt jointly, and it is the thing the
 * piece is judged on. Anything that wants to check the staging has to use
 * the same numbers the renderer uses, not a copy of them.
 */

export const CAM_FOV = 34;

/* The cat fills roughly a unit cube, and the camera sits off to one side
   so it is seen at three-quarters rather than in profile. Strict profile is
   the pose in which a head turn is least readable — it can only shorten. */
export const CAM_DIR: readonly [number, number, number] = norm([0.62, 0.22, 1]);

/*
 * Far enough back to leave air around the animal.
 *
 * At 3.05 the cat filled about nine tenths of the frame's height, which is
 * a portrait rather than a scene — and the laser needs somewhere to be that
 * is not on top of the cat. 3.7 puts it at roughly three quarters and gives
 * the dot room to circle.
 */
export const CAM_DIST = 3.7;

/** What the camera aims at: slightly above the middle, so the cat sits low
    in frame with headroom rather than centred like a specimen. */
export const CAM_LOOK: readonly [number, number, number] = [0, 0.12, 0];

/**
 * How far the pointer plane is tilted from facing the camera toward lying
 * on the floor. 0 is camera-facing, 1 is flat.
 *
 * This one number decides the staging, so it is worth saying what it buys.
 * A camera-facing plane maps screen-up to world-up almost exactly, which
 * means the vertical half of the pointer's travel does nothing to the cat's
 * heading: the laser goes up and down a wall and the cat only ever tips its
 * chin. Laying the plane flat is worse — at this camera's twelve degrees of
 * elevation the horizon sits three quarters of the way up the frame, so the
 * top of the canvas has no floor in it at all and the middle maps to a
 * point far behind the animal.
 *
 * At 0.6 the frame reads as a room seen at a shallow angle, and the three
 * positions that matter land where they should. The camera sits at a
 * heading of −58°, and measured against that:
 *
 *   top centre      the cat turns to −175° — its back to the viewer
 *   dead centre     inside the dead zone: no turn at all, sitting idle
 *   bottom centre   −12°, facing the viewer, crouched over the dot
 */
export const PLANE_TILT = 0.6;

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * The pointer plane's normal, given the direction the camera looks.
 *
 * Tipping the normal up toward vertical lays the plane itself down toward
 * the floor by the same angle, so moving the cursor up the frame sends the
 * laser up AND away, and down sends it down and toward the viewer. That is
 * what makes the vertical half of the pointer's travel mean something: it
 * is depth as well as height, and depth is what the cat turns for.
 *
 * The normal is built from the direction BACK toward the camera, which is
 * why `look` is negated here. Tilting the other one produces a plane
 * leaning the opposite way and inverts the whole staging: the cat turns
 * its back when the pointer is at the bottom and faces you at the top,
 * which is a coherent-looking piece that does the wrong thing. That is
 * what shipped for about ten minutes until the staging test caught it.
 *
 * @param look unit vector along the camera's view direction — pointing
 *   INTO the scene, as `Camera.getWorldDirection` returns it.
 */
export function planeNormal(look: readonly [number, number, number]): [number, number, number] {
  const k = PLANE_TILT;
  return norm([-look[0] * (1 - k), -look[1] * (1 - k) + k, -look[2] * (1 - k)]);
}
