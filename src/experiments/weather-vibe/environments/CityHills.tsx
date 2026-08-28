import { useMemo } from 'react';
import { Shape, ShapeGeometry, Color } from 'three';
import type { Palette } from '../conditions';
import { cityHillHeight, cityLandColor } from '../cityTerrain';

/**
 * The land a city is built on.
 *
 * Flat billboard silhouettes at fixed depths, matching the MountainRidge
 * pattern already used for rural backdrops — cheap, and it reads correctly at
 * distance where nobody can tell a silhouette from geometry.
 *
 * The difference from those ridges is where the profile comes from. These
 * sample `cityHillHeight` at their own z, which is the same function each
 * building calls to find its base. That shared origin is the entire point: a
 * tower at z -100 and the ridge drawn at z -100 are reading the same curve, so
 * the buildings sit ON the hills rather than near them.
 *
 * Depths bracket the building arc (which spans roughly z -23 to -125), so the
 * city interleaves with the land instead of standing in front of a backdrop.
 */

/**
 * Depths. The nearest was -15, which was a mistake: a 420-wide silhouette that
 * close to the camera is not a hill, it is a wall, and it swallowed the bottom
 * half of the frame. The building arc runs z -30 to -119, so the layers now
 * start behind the closest towers and step back from there — the city reads in
 * front of the land rather than embedded in a curtain.
 */
const LAYERS = [
  { z: -45, shade: 0.0 },
  { z: -85, shade: 0.35 },
  { z: -125, shade: 0.7 },
  { z: -165, shade: 1.0 },
];

const RIDGE_WIDTH = 420;
const SEGMENTS = 150;

/**
 * How far below ground each silhouette continues. Only needs to outlast the
 * terrain in front of it; -60 was cargo-culted from the rural ridges, which
 * sit much further away and can afford to be sloppy about it.
 */
const RIDGE_SKIRT = 26;

/**
 * Aerial perspective: distant land loses contrast against the sky. Near ridges
 * stay dark and far ones drift toward the background colour, which is what
 * separates the layers without drawing a line between them.
 */
/**
 * Hills sample the SAME land ramp as the pavement — see cityLandColor. That
 * shared origin is what makes a flat city flat: with relief near zero the
 * ridge silhouette collapses onto the ground, and because it is now the same
 * tone, it simply disappears. Deriving the two separately is what turned
 * Jakarta's non-existent hills into dark slabs lying on a pale street.
 *
 * `shade` doubles as depth here, so the far ridges also pick up the aerial
 * wash for free.
 */
function landColor(palette: Palette, shade: number): Color {
  return cityLandColor(palette, 0.1 + shade * 0.75);
}

function Ridge({
  z,
  color,
  groundY,
  relief,
}: {
  z: number;
  color: Color;
  groundY: number;
  relief: number;
}) {
  const geometry = useMemo(() => {
    const shape = new Shape();
    // Skirt well below ground so the shape never reveals its own bottom edge
    // over uneven terrain or when the camera tilts down.
    shape.moveTo(-RIDGE_WIDTH / 2, groundY - RIDGE_SKIRT);

    for (let i = 0; i <= SEGMENTS; i++) {
      const x = (i / SEGMENTS - 0.5) * RIDGE_WIDTH;
      shape.lineTo(x, groundY + cityHillHeight(x, z, relief));
    }

    shape.lineTo(RIDGE_WIDTH / 2, groundY - RIDGE_SKIRT);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, [z, groundY, relief]);

  return (
    <mesh position={[0, 0, z]} geometry={geometry}>
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

interface Props {
  palette: Palette;
  groundY: number;
  /** 0 = flat city, 1 = maximally hilly. Below ~0.02 this renders nothing. */
  relief: number;
}

export default function CityHills({ palette, groundY, relief }: Props) {
  const colors = useMemo(
    () => LAYERS.map((l) => landColor(palette, l.shade)),
    [palette],
  );

  // Flat cities get no geometry at all rather than a flat quad — Miami and
  // Chicago should cost nothing here, not draw four invisible rectangles.
  if (relief <= 0.02) return null;

  return (
    <>
      {/* Farthest first, so the painter's order matches the depth order. */}
      {[...LAYERS].reverse().map((layer, i) => {
        const idx = LAYERS.length - 1 - i;
        return (
          <Ridge
            key={layer.z}
            z={layer.z}
            color={colors[idx]}
            groundY={groundY}
            relief={relief}
          />
        );
      })}
    </>
  );
}
