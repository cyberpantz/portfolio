import { useMemo } from 'react';
import type { Palette } from '../conditions';
import { cityLandColor } from '../cityTerrain';

/**
 * Pavement.
 *
 * Every weather environment draws its own ground plane in a rural tone — the
 * overcast one is `#2B2619`, bare soil, and it is correct there because a
 * GrassField is planted on top of it. Suppressing that grass for cities
 * exposed the dirt, which lit by a 0.6 ambient reads as a black slab across
 * the bottom of the frame. That is what put the void under the skyline.
 *
 * Patching eleven environments to know about density would spread city logic
 * through files that have no other reason to care. Instead this lays a single
 * paved surface just above whatever ground the active environment drew, for
 * urban scenes only. One component, every weather state covered, and the
 * environments stay unaware.
 *
 * It stops at z -200, so the distant water (which starts at -210) is still
 * visible past its edge rather than being paved over.
 */

interface Props {
  palette: Palette;
  groundY: number;
}

export default function CityGround({ palette, groundY }: Props) {
  // Depth 0 — the near end of the same land ramp the hills sample further
  // along. Shared so a flat hill is indistinguishable from the ground rather
  // than a dark slab lying on it. See cityLandColor.
  const color = useMemo(() => cityLandColor(palette, 0), [palette]);

  return (
    // Fractionally above the environment's own plane: same height would
    // z-fight, and a visible margin would show a seam at the horizon.
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY + 0.02, -85]}>
      <planeGeometry args={[900, 230]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}
