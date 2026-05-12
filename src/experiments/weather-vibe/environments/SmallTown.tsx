import { useMemo } from 'react';
import { Shape, ExtrudeGeometry } from 'three';
import type { Palette } from '../conditions';

const BRICK_COLORS = [
  '#8B4030', '#B05840', '#C47A5A', '#D4B896',
  '#9A7A5A', '#C8A870', '#A08060', '#CC9060',
];

const ROOF_COLORS = [
  '#2A2218', '#342820', '#3A3030', '#2C2220',
  '#382A20', '#303230', '#281E18', '#302820',
];

function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

interface BuildingProps {
  x: number; z: number;
  w: number; h: number; d: number;
  color: string;
  roofColor: string;
  roofType: 'gable' | 'flat';
  groundY: number;
  windowColor: string;
}

function Building({ x, z, w, h, d, color, roofColor, roofType, groundY, windowColor }: BuildingProps) {
  const peakH = w * 0.28;

  const roofGeom = useMemo(() => {
    if (roofType !== 'gable') return null;
    const shape = new Shape();
    shape.moveTo(-w / 2 - 0.12, 0);
    shape.lineTo(0, peakH);
    shape.lineTo(w / 2 + 0.12, 0);
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: d + 0.24, bevelEnabled: false });
  }, [w, d, peakH, roofType]);

  // Window grid: one row per floor, evenly spaced across width
  const windows = useMemo(() => {
    const list: { wx: number; wy: number }[] = [];
    const floors = Math.max(1, Math.round(h / 2.2));
    const margin = w * 0.14;
    const usableW = w - margin * 2;
    const perFloor = Math.max(1, Math.floor(usableW / 1.7));
    const spacing = usableW / perFloor;
    for (let f = 0; f < floors; f++) {
      const wy = (f + 0.5) * (h / floors) + 0.10;
      for (let j = 0; j < perFloor; j++) {
        list.push({ wx: -usableW / 2 + (j + 0.5) * spacing, wy });
      }
    }
    return list;
  }, [w, h]);

  const frontZ = z + d / 2; // face toward camera

  return (
    <group>
      {/* Body */}
      <mesh position={[x, groundY + h / 2, z]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Gable roof */}
      {roofType === 'gable' && roofGeom && (
        <mesh position={[x, groundY + h, z - d / 2 - 0.12]} geometry={roofGeom}>
          <meshBasicMaterial color={roofColor} />
        </mesh>
      )}

      {/* Flat parapet */}
      {roofType === 'flat' && (
        <mesh position={[x, groundY + h + 0.12, z]}>
          <boxGeometry args={[w + 0.20, 0.22, d + 0.20]} />
          <meshBasicMaterial color={roofColor} />
        </mesh>
      )}

      {/* Windows */}
      {windows.map(({ wx, wy }, i) => (
        <mesh key={i} position={[x + wx, groundY + wy, frontZ + 0.04]}>
          <planeGeometry args={[0.46, 0.60]} />
          <meshBasicMaterial color={windowColor} />
        </mesh>
      ))}
    </group>
  );
}

interface Props {
  palette: Palette;
  groundY: number;
}

export default function SmallTown({ palette, groundY }: Props) {
  // Night: warm amber glow from inside. Day: grey-blue glass reflection.
  const windowColor = palette.isDark ? '#FFE07A' : '#A0B8C8';

  const buildings = useMemo(() => {
    const rng = makeRng(8231);
    const front = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12;
      return {
        x:         (t - 0.5) * 90 + (rng() - 0.5) * 6,
        z:         -(5 + rng() * 4),
        w:         4.5 + rng() * 4.5,
        h:         2.5 + rng() * 2.2,
        d:         2 + rng() * 2,
        color:     BRICK_COLORS[Math.floor(rng() * BRICK_COLORS.length)],
        roofColor: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
        roofType:  (rng() > 0.35 ? 'gable' : 'flat') as 'gable' | 'flat',
      };
    });
    const back = Array.from({ length: 8 }, (_, i) => {
      const t = (i + 0.5) / 8;
      return {
        x:         (t - 0.5) * 100 + (rng() - 0.5) * 10,
        z:         -(11 + rng() * 6),
        w:         5 + rng() * 6,
        h:         1.5 + rng() * 1.5,
        d:         2 + rng() * 3,
        color:     BRICK_COLORS[Math.floor(rng() * BRICK_COLORS.length)],
        roofColor: ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)],
        roofType:  (rng() > 0.35 ? 'gable' : 'flat') as 'gable' | 'flat',
      };
    });
    return [...front, ...back];
  }, []);

  return (
    <>
      {buildings.map((b, i) => (
        <Building key={i} {...b} groundY={groundY} windowColor={windowColor} />
      ))}
    </>
  );
}
