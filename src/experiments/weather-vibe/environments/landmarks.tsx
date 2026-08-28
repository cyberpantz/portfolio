import { useEffect, useMemo } from 'react';
import { Color, CylinderGeometry, BufferAttribute } from 'three';

/**
 * Hand-built landmarks.
 *
 * Deliberately not real geometry from a tiles API. Mapbox or OSM footprints
 * would cost an API key and a network dependency to serve one city out of the
 * millions this renders, and in a scene made of flat-shaded blocks, accurate
 * footprints look worse than stylised ones — a real skyline is mostly boring
 * boxes, and the two or three shapes that carry recognition are exactly the
 * ones a person would draw from memory.
 *
 * Silhouette is what makes a place identifiable. The Transamerica Pyramid is
 * perhaps five distinct forms, and it says San Francisco more forcefully than
 * a square kilometre of correct building outlines would.
 */

interface LandmarkProps {
  x: number;
  z: number;
  groundY: number;
  /** Yaw. The pyramid is most recognisable seen slightly off a corner. */
  rot?: number;
  /** Total height including the spire, in world units. Towers here run 20–54. */
  height?: number;
  color: Color;
}

/**
 * Adds flat per-face shading to a cone, the same trick the boxes use.
 *
 * The pyramid's four faces meet at shallow angles, so under a soft overcast
 * sky lambert alone barely separates them and the whole thing flattens into a
 * triangle. Baking a small per-face step guarantees the form reads even when
 * the lighting is nearly directionless.
 *
 * Non-indexed so each triangle owns its vertices; a shared-vertex cone would
 * smear the steps into a gradient.
 */
function facetedCone(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  tint: Color,
): CylinderGeometry {
  const geom = new CylinderGeometry(radiusTop, radiusBottom, height, segments, 1);
  const nonIndexed = geom.toNonIndexed() as unknown as CylinderGeometry;
  geom.dispose();

  const pos = nonIndexed.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const shades = [1.0, 0.9, 0.78, 0.86]; // one per side, cycling

  for (let i = 0; i < pos.count; i += 3) {
    // Face index from the average angle of the triangle's vertices.
    const ax = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const az = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const angle = Math.atan2(az, ax);
    const side = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4;
    const s = shades[side];

    for (let v = 0; v < 3; v++) {
      colors[(i + v) * 3] = s * tint.r;
      colors[(i + v) * 3 + 1] = s * tint.g;
      colors[(i + v) * 3 + 2] = s * tint.b;
    }
  }

  nonIndexed.setAttribute('color', new BufferAttribute(colors, 3));
  return nonIndexed;
}

/**
 * Transamerica Pyramid.
 *
 * Three parts carry the recognition, in order of importance:
 *
 * 1. The continuous four-sided taper running all the way to a point. Most
 *    drawings get this wrong by stopping the taper at a flat roof.
 * 2. The two wings — the elevator and stair shafts that break out of the
 *    slope a little over halfway up and rise as vertical fins. Without them
 *    it is just a pyramid; with them it is THE pyramid.
 * 3. Being conspicuously taller than everything near it. At 260m it is not
 *    subtle in life and should not be here either.
 *
 * The body is rotated a quarter-turn internally so its flat faces align to the
 * axes, which is what lets the wings sit flush against them at any height.
 */
export function TransamericaPyramid({
  x,
  z,
  groundY,
  rot = 0.55,
  height = 74,
  color,
}: LandmarkProps) {
  const baseR = height * 0.098;
  const tipR = baseR * 0.05;

  const { body, wings } = useMemo(() => {
    const pale = color.clone().lerp(new Color(1, 1, 1), 0.45);

    // Wings start where the taper has narrowed noticeably and stop short of
    // the spire, matching the real break at roughly floors 29 to 45.
    const wingBottom = 0.58;
    const wingTop = 0.90;
    const radiusAt = (t: number) => baseR + (tipR - baseR) * t;
    // Apothem, not circumradius: the wings ride the flat faces.
    const apothemAt = (t: number) => radiusAt(t) / Math.SQRT2;

    const midT = (wingBottom + wingTop) / 2;

    return {
      body: facetedCone(tipR, baseR, height, 4, pale),
      wings: {
        offset: apothemAt(midT) * 0.92,
        y: height * midT,
        h: height * (wingTop - wingBottom),
        w: baseR * 0.26,
        d: apothemAt(wingBottom) * 0.55,
        color: pale,
      },
    };
  }, [color, baseR, tipR, height]);

  useEffect(() => () => body.dispose(), [body]);

  return (
    <group position={[x, groundY, z]} rotation={[0, rot, 0]}>
      {/* Quarter-turn so the four flat faces face the axes. */}
      <group rotation={[0, Math.PI / 4, 0]}>
        <mesh position={[0, height / 2, 0]} geometry={body}>
          <meshLambertMaterial vertexColors />
        </mesh>

        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * wings.offset, wings.y, 0]}>
            <boxGeometry args={[wings.w, wings.h, wings.d]} />
            <meshLambertMaterial color={wings.color} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
