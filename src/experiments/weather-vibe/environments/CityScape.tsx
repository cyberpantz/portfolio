import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { isNightPalette, type Palette } from '../conditions';
import { readAudioLevels } from '../audioLevels';
import { cityHillHeight } from '../cityTerrain';
import { shadedBox } from '../faceShade';
import { buildingsFor, type CityLayout, type Landmark } from '../cityLayout';
import { TransamericaPyramid } from './landmarks';
import { Graffiti } from './cityDetail';

/**
 * The windows breathe with the soundtrack.
 *
 * Mid and high bands rather than bass: the location recordings are street
 * sounds — voices, traffic, brakes — and those live in the mids. Bass would
 * have tied the lights to the city hum drone, which is nearly constant and so
 * would have produced nearly no movement.
 *
 * The floor matters as much as the range. Lights never drop below their
 * resting brightness, they only lift above it, so silence looks like a normal
 * night rather than a blackout.
 *
 * RANGE IS THE WHOLE BALLGAME, and my first attempt got it badly wrong at
 * 0.55 — a 2.4x swing. The problem is not that big numbers look garish, it is
 * that Bloom is downstream: individual windows are painted at slightly
 * different brightnesses, so as the intensity sweeps up they cross the bloom
 * threshold one after another and POP into visible glow. Read as a whole that
 * does not look like the city getting brighter, it looks like a different set
 * of windows being lit each frame.
 *
 * 0.26 is the second correction. 0.55 popped; 0.14 was then so timid it read
 * as nothing at all, because the drive feeding it was itself only reaching
 * about 0.2 of its nominal range. With auto-gain in audioLevels the drive now
 * genuinely spans 0..1, so this is the real swing: 0.40 at rest to 0.66 at
 * peak. Bright enough to read, still short of where windows start crossing
 * the bloom threshold one at a time.
 */
const WINDOW_BASE = 0.4;
const WINDOW_RANGE = 0.26;

/**
 * Window patterns. `cols`/`rows` set the grid, the insets set how much of each
 * cell is glass, `lit` is the share illuminated after dark.
 *
 * These read as building eras, which is why they matter more than they look
 * like they should: a ribbon-windowed slab beside a punched-opening block
 * beside a tall-slotted tower is what makes a skyline feel accumulated rather
 * than issued.
 */
const FENESTRATION = [
  { cols: 6, rows: 12, insetX: 0.18, insetY: 0.18, lit: 0.40 }, // punched openings
  { cols: 5, rows: 9,  insetX: 0.28, insetY: 0.10, lit: 0.34 }, // tall slots
  { cols: 1, rows: 15, insetX: 0.04, insetY: 0.30, lit: 0.55 }, // ribbon / curtain wall
  { cols: 4, rows: 7,  insetX: 0.14, insetY: 0.12, lit: 0.30 }, // large sparse panes
] as const;

/**
 * Building silhouettes.
 *
 * Every tower was a plain extruded box, so a skyline varied only in height
 * and width — which reads as a bar chart, not a city. What distinguishes a
 * real skyline is what happens at the TOP: setbacks, mechanical penthouses,
 * masts and crowns. That is also where the eye goes, since the tops are the
 * only part silhouetted against the sky.
 *
 * Each variant is expressed as caps stacked on the same box rather than as
 * new geometry types, so they reuse shadedBox and the single shared material
 * — the silhouette changes, the draw setup does not.
 */
type CapSpec = { scale: number; height: number };

const SILHOUETTES: { w: number; caps: CapSpec[] }[] = [
  { w: 0.42, caps: [] },                                            // flat slab
  { w: 0.66, caps: [{ scale: 0.72, height: 0.16 }] },               // single setback
  { w: 0.82, caps: [{ scale: 0.74, height: 0.13 }, { scale: 0.5, height: 0.1 }] }, // ziggurat
  { w: 0.92, caps: [{ scale: 0.30, height: 0.07 }] },               // rooftop plant
  { w: 1.00, caps: [{ scale: 0.55, height: 0.09 }, { scale: 0.12, height: 0.3 }] }, // mast
];

function pickSilhouette(roll: number): CapSpec[] {
  for (const s of SILHOUETTES) if (roll <= s.w) return s.caps;
  return [];
}

/**
 * Facade materials, as multipliers on the sky-derived concrete tone.
 *
 * Multipliers rather than absolute colours on purpose: a brick building at
 * dusk should be a dusk-lit brick, not the same swatch it was at noon. These
 * ride whatever the weather has already done to the facade tone.
 *
 * Weights are cumulative and deliberately concrete-heavy — roughly two in
 * five buildings stay plain, which is what keeps the coloured ones reading as
 * materials rather than decoration.
 */
const FACADES: { w: number; rgb: [number, number, number] }[] = [
  { w: 0.28, rgb: [1.00, 1.00, 1.00] }, // concrete
  { w: 0.44, rgb: [1.30, 1.06, 0.80] }, // sandstone
  { w: 0.60, rgb: [1.48, 0.82, 0.66] }, // brick / terracotta
  { w: 0.76, rgb: [0.74, 0.95, 1.38] }, // blue glass
  { w: 0.86, rgb: [0.76, 1.24, 0.98] }, // green glass
  { w: 0.94, rgb: [1.24, 0.90, 0.64] }, // bronze
  { w: 1.00, rgb: [1.12, 1.12, 1.18] }, // pale stone
];

function pickFacade(roll: number): [number, number, number] {
  for (const f of FACADES) if (roll <= f.w) return f.rgb;
  return FACADES[0].rgb;
}

// Deterministic pseudo-random — same seed = same city every session
function makeRng(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

interface Props {
  palette: Palette;
  groundY: number;
  /** Terrain ruggedness, 0..1. Buildings step up the slope; 0 keeps them level. */
  relief?: number;
  layout?: CityLayout;
  landmarks?: Landmark[];
}

export default function CityScape({
  palette,
  groundY,
  relief = 0,
  layout = 'arc',
  landmarks = [],
}: Props) {
  // Night: CanvasTexture with randomly lit windows (white = emits, black = dark)
  //
  // SEEDED, like the building layout above it. This used to call Math.random()
  // directly, which meant every re-run of the memo dealt a completely new set
  // of lit windows — so any remount moved every light in the city. The file
  // header already promised "same seed = same city every session"; the windows
  // were the one part not keeping that promise.
  const night = isNightPalette(palette);

  /**
   * One texture per fenestration type, not one for the whole city.
   *
   * Every tower shared a single window texture built from one seed, so the
   * entire skyline carried the identical grid — the same failure as the
   * facades all being grey and the tops all being flat.
   */
  const windowTexes = useMemo(
    () =>
      FENESTRATION.map((f, i) => {
        const rng = makeRng(1337 + i * 613);
        const W = 64;
        const H = 128;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = night ? '#000' : '#fff';
        ctx.fillRect(0, 0, W, H);

        const cellW = W / f.cols;
        const cellH = H / f.rows;
        const winW = cellW * (1 - f.insetX * 2);
        const winH = cellH * (1 - f.insetY * 2);

        for (let r = 0; r < f.rows; r++) {
          for (let c = 0; c < f.cols; c++) {
            const lit = rng() <= f.lit;
            // Same three rolls either way, so day and night stay in step.
            const a = rng(), b2 = rng(), c2 = rng();

            if (night) {
              if (!lit) continue;
              ctx.fillStyle = `rgb(${Math.floor(210 + a * 45)},${Math.floor(190 + b2 * 45)},${Math.floor(150 + c2 * 55)})`;
            } else {
              // 0.50–0.70 of the facade tone: a grid at distance, not a
              // checkerboard up close.
              const v = Math.floor(128 + a * 51);
              ctx.fillStyle = `rgb(${v},${v},${v})`;
            }
            ctx.fillRect(c * cellW + cellW * f.insetX, r * cellH + cellH * f.insetY, winW, winH);
          }
        }

        const tex = new CanvasTexture(canvas);
        // Three treats a texture as linear unless told otherwise. Canvas
        // pixels are sRGB, so without this the day windows render nearer 0.73
        // and the grid washes out. The night emissive map got away with it
        // because black-to-bright has contrast to spare.
        tex.colorSpace = SRGBColorSpace;
        return tex;
      }),
    [night],
  );

  // Day buildings: desaturate the sky hue then darken → neutral concrete tone
  // Pure darkening of a saturated sky yields near-black blue; desaturation first
  // produces a warm gray that reads as actual buildings at distance.
  const dayColor = useMemo(() => {
    const c = new Color(palette.background);
    const gray = (c.r + c.g + c.b) / 3;
    const sat  = 0.12; // retain 12 % of original hue
    // These multipliers were calibrated when the material was UNLIT, so this
    // colour was the final pixel. Under lambert it is multiplied again by the
    // lighting (~0.6-0.9), which was making buildings roughly twice as dark as
    // intended — near-black cutouts against a grey sky. Raised to compensate.
    return new Color(
      (gray * (1 - sat) + c.r * sat) * 0.74,
      (gray * (1 - sat) + c.g * sat) * 0.72,
      (gray * (1 - sat) + c.b * sat) * 0.69,
    );
  }, [palette.background]);

  // Stable layout — seeded so buildings never jump between weather states.
  // Arrangement comes from cityLayout.ts: most cities get the arc, a few opt
  // into a boulevard.
  const buildings = useMemo(() => buildingsFor(layout), [layout]);

  /**
   * One material shared by all 32 towers rather than 32 identical ones. They
   * were always visually identical, and sharing means the audio-reactive
   * update below is a single property write per frame instead of 32.
   */
  const nightMaterials = useMemo(() => {
    if (!night) return null;
    return windowTexes.map((tex) => new MeshStandardMaterial({
      color: new Color('#030508'),
      emissiveMap: tex,
      emissive: new Color('#EED8C0'),
      emissiveIntensity: WINDOW_BASE,
      roughness: 1,
      metalness: 0,
      // Modulates diffuse only, so the emissive window map keeps full
      // strength — a lit window is lit whichever way its wall faces.
      vertexColors: true,
    }));
  }, [night, windowTexes]);

  /**
   * Geometry per tower, built once. Each carries baked per-face shading, and
   * each is extended below ground (see the note in the render) — so height
   * depends on the hill under it, which is why this is keyed on relief rather
   * than shared.
   */
  const towers = useMemo(() => {
    const SKIRT = 6; // how far below groundY the box continues
    const rng = makeRng(7717);

    return buildings.map((b) => {
      const base = cityHillHeight(b.x, b.z, relief);
      const total = base + b.h + SKIRT;

      /**
       * Per-building tint: lightness spread PLUS a facade material.
       *
       * The first version varied only lightness with a faint warm nudge —
       * a range of greys, which is why this read as a housing block while the
       * small towns, which have real facade colours, read as places. Cities
       * are not monochrome: brick, sandstone, bronze and tinted glass are all
       * ordinary, and a skyline usually carries several at once.
       *
       * Weighted so concrete still dominates. The point is a few buildings
       * that are plainly a different material, not a paintbox — and because
       * these multiply the sky-derived facade tone, they stay tied to the
       * light rather than reading as flat colour.
       */
      const value = 0.74 + rng() * 0.56; // 0.74–1.30
      const facade = pickFacade(rng());

      const tint = {
        r: value * facade[0],
        g: value * facade[1],
        b: value * facade[2],
      };

      // Caps sit on the real roofline, which is the top of the box before the
      // below-ground skirt is added.
      const roofY = groundY + base + b.h;
      let capY = roofY;
      const caps = pickSilhouette(rng()).map((c) => {
        const ch = b.h * c.height;
        const geom = shadedBox(b.w * c.scale, ch, b.d * c.scale, tint);
        const y = capY + ch / 2;
        capY += ch;
        return { geom, y };
      });

      return {
        x: b.x,
        z: b.z,
        rot: b.rot,
        /** Which fenestration this building was built with. */
        variant: Math.floor(rng() * FENESTRATION.length),
        w: b.w,
        d: b.d,
        /** Ground level at this building — where paint and planting sit. */
        baseY: groundY + base,
        // Top stays at groundY + base + b.h; bottom lands at groundY - SKIRT.
        centerY: roofY - total / 2,
        geom: shadedBox(b.w, total, b.d, tint),
        caps,
      };
    });
  }, [buildings, relief, groundY]);

  /** Stable across renders so the tag textures are generated once. */
  const taggableWalls = useMemo(
    () =>
      towers
        .filter((t) => t.z > -95)
        .map((t) => ({ x: t.x, z: t.z, d: t.d, w: t.w, baseY: t.baseY })),
    [towers],
  );

  // Created outside the reconciler, so they have to be disposed by hand.
  useEffect(() => () => nightMaterials?.forEach((m) => m.dispose()), [nightMaterials]);
  useEffect(() => () => windowTexes.forEach((t) => t.dispose()), [windowTexes]);
  useEffect(
    () => () =>
      towers.forEach((t) => {
        t.geom.dispose();
        t.caps.forEach((c) => c.geom.dispose());
      }),
    [towers],
  );

  useFrame(() => {
    if (!nightMaterials) return;
    const { mid, high } = readAudioLevels();
    // Weighted so ordinary street noise lands mid-range instead of pinned at
    // the ceiling — a value that spends its life clamped at 1 is a constant,
    // and a constant is not a reaction.
    const drive = Math.min(1, mid * 0.5 + high * 0.6);
    const next = WINDOW_BASE + drive * WINDOW_RANGE;
    // A handful of writes instead of one — still nothing next to 32.
    for (const m of nightMaterials) m.emissiveIntensity = next;
  });

  return (
    <>
      {/* Each tower sits on the ground beneath it, not on a shared plane.
          cityHillHeight is the same function CityHills draws its silhouettes
          from, so a building and the hill under it cannot disagree.

          Every box is also EXTENDED DOWNWARD to below ground level rather than
          stopping at its own base. The ridges are opaque billboards at four
          fixed depths, so a building standing between two of them can have a
          base higher than the ridge in front of it — and a box that stopped at
          its base would then show sky underneath, which reads as a floating
          tower. Sinking the bottom past groundY costs nothing (it is hidden by
          whatever is in front) and makes the gap impossible rather than
          unlikely. Only the skyline silhouette is ever seen. */}
      {towers.map((b, i) => {
        return (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.rot, 0]}>
          {b.caps.map((c, ci) => (
            <mesh key={ci} position={[0, c.y, 0]} geometry={c.geom}>
              {nightMaterials ? (
                <primitive object={nightMaterials[b.variant]} attach="material" />
              ) : (
                <meshLambertMaterial color={dayColor} map={windowTexes[b.variant]} vertexColors />
              )}
            </mesh>
          ))}
          <mesh position={[0, b.centerY, 0]} geometry={b.geom}>
          {nightMaterials ? (
            <primitive object={nightMaterials[b.variant]} attach="material" />
          ) : (
            // map multiplies, so white texels keep dayColor exactly and the
            // window texels darken it. No second colour to keep in sync.
            // Lambert, not basic: buildings are lit by CityLit's dedicated
            // per-weather sun. The vertex colours survive as a shallow floor.
            <meshLambertMaterial color={dayColor} map={windowTexes[b.variant]} vertexColors />
          )}
          </mesh>
        </group>
        );
      })}

      {/* Paint, on the near walls only — a tag 200 units away is a smudge.
          `walls` is memoised: built inline it was a new array every render,
          which re-ran the texture generation and disposed the live textures
          on each pass. */}
      <Graffiti walls={taggableWalls} layout={layout} />

      {landmarks.map((l, i) =>
        l.kind === 'transamerica' ? (
          <TransamericaPyramid
            key={i}
            x={l.x}
            z={l.z}
            groundY={groundY + cityHillHeight(l.x, l.z, relief)}
            rot={l.rot}
            height={l.height}
            color={dayColor}
          />
        ) : null,
      )}
    </>
  );
}
