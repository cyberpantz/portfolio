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
        // Soft warm-white variation per window
        const rr = Math.floor(210 + Math.random() * 45);
        const g  = Math.floor(190 + Math.random() * 45);
        const b  = Math.floor(150 + Math.random() * 55);
        ctx.fillStyle = `rgb(${rr},${g},${b})`;
        ctx.fillRect(2 + c * 10, 3 + r * 10, 7, 7);
      }
    }
    return new CanvasTexture(canvas);
  }, [palette.isDark]);

  // Day buildings: desaturate the sky hue then darken → neutral concrete tone
  // Pure darkening of a saturated sky yields near-black blue; desaturation first
  // produces a warm gray that reads as actual buildings at distance.
  const dayColor = useMemo(() => {
    const c = new Color(palette.background);
    const gray = (c.r + c.g + c.b) / 3;
    const sat  = 0.12; // retain 12 % of original hue
    return new Color(
      (gray * (1 - sat) + c.r * sat) * 0.52,
      (gray * (1 - sat) + c.g * sat) * 0.50,
      (gray * (1 - sat) + c.b * sat) * 0.48,
    );
  }, [palette.background]);

  // Stable layout — seeded so buildings never jump between weather states
  const buildings = useMemo(() => {
    const rng = makeRng(42);
    return Array.from({ length: 32 }, (_, i) => {
      const t      = i / 31;
      const angle  = (t - 0.5) * 2.4;                // arc ±69° — wide enough to frame the view
      const radius = 65 + rng() * 60;                 // 65–125 units — more depth layering
      return {
        x: radius * Math.sin(angle) + (rng() - 0.5) * 18, // generous lateral jitter
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
              emissive="#EED8C0"
              emissiveIntensity={windowTex ? 0.4 : 0}
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
