import { useMemo } from 'react';
import { Color, CanvasTexture } from 'three';
import type { Palette } from '../conditions';

// Deterministic pseudo-random — same seed = same city every session
function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

interface Props {
  palette: Palette;
  groundY: number;
}

export default function CityScape({ palette, groundY }: Props) {
  // Night: CanvasTexture with randomly lit windows (white = emits, black = dark)
  const windowTex = useMemo(() => {
    if (!palette.isDark) return null;
    const W = 64, H = 128;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 6; c++) {
        if (Math.random() > 0.40) continue; // 40% of windows lit
        // Slight warm variation per window
        const g = Math.floor(170 + Math.random() * 85);
        const b = Math.floor(60  + Math.random() * 90);
        ctx.fillStyle = `rgb(255,${g},${b})`;
        ctx.fillRect(2 + c * 10, 3 + r * 10, 7, 7);
      }
    }
    return new CanvasTexture(canvas);
  }, [palette.isDark]);

  // Day silhouette: background hue pushed dark — same tonality as sky, just darker
  const dayColor = useMemo(() => {
    const c = new Color(palette.background);
    return new Color(c.r * 0.20, c.g * 0.21, c.b * 0.32);
  }, [palette.background]);

  // Stable layout — seeded so buildings never jump between weather states
  const buildings = useMemo(() => {
    const rng = makeRng(42);
    return Array.from({ length: 32 }, (_, i) => {
      const t    = i / 31;
      const angle  = (t - 0.5) * 1.45;               // arc ±41° in radians
      const radius = 80 + rng() * 30;                 // 80–110 units away
      return {
        x: radius * Math.sin(angle) + (rng() - 0.5) * 7, // slight jitter
        z: -radius * Math.cos(angle),
        h: 16 + rng() * 32,  // height 16–48 units
        w:  5 + rng() * 9,   // width  5–14 units
        d:  3 + rng() * 4,   // depth  3–7  units (thin — these are silhouettes)
      };
    });
  }, []);

  return (
    <>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, groundY + b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          {palette.isDark ? (
            <meshStandardMaterial
              color="#030508"
              emissiveMap={windowTex ?? undefined}
              emissive="#CC6018"
              emissiveIntensity={windowTex ? 1.0 : 0}
              roughness={1}
              metalness={0}
            />
          ) : (
            <meshBasicMaterial color={dayColor} />
          )}
        </mesh>
      ))}
    </>
  );
}
