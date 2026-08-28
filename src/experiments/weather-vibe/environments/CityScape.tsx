import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from 'three';
import { isNightPalette, type Palette } from '../conditions';
import { readAudioLevels } from '../audioLevels';
import { cityHillHeight } from '../cityTerrain';
import { shadedBox } from '../faceShade';
import { buildingsFor, type CityLayout, type Landmark } from '../cityLayout';
import { TransamericaPyramid } from './landmarks';

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
   * Both window textures come from the same seeded pass, so the building that
   * has a light on in the top-left corner at night has a window in the
   * top-left corner by day. Same city, different hour.
   *
   * NIGHT is an emissive map: black ground, warm lit rectangles, 40% occupancy.
   *
   * DAY is a colour map, and it exists because correcting the day/night test
   * left daytime buildings as flat untextured slabs — which was arguably worse
   * than the bug it fixed. Glass in daylight is not brighter than concrete, it
   * is DARKER, so this paints white (multiplies to the untouched facade tone)
   * with grey windows that multiply down. Every window is drawn rather than
   * 40%, because unlit glass does not disappear at noon.
   */
  const windowTex = useMemo(() => {
    const rng = makeRng(1337);
    const W = 64, H = 128;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = night ? '#000' : '#fff';
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 6; c++) {
        const lit = rng() <= 0.40;
        // Draw from the same three rolls either way, so the day and night
        // textures stay in step regardless of which branch is taken.
        const a = rng(), b2 = rng(), c2 = rng();

        if (night) {
          if (!lit) continue;
          ctx.fillStyle = `rgb(${Math.floor(210 + a * 45)},${Math.floor(190 + b2 * 45)},${Math.floor(150 + c2 * 55)})`;
        } else {
          // 0.50–0.70 of the facade tone. Enough to read as a grid at
          // distance without turning the tower into a checkerboard.
          const v = Math.floor(128 + a * 51);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
        }
        ctx.fillRect(2 + c * 10, 3 + r * 10, 7, 7);
      }
    }
    const tex = new CanvasTexture(canvas);
    // Three treats a texture as linear unless told otherwise. Canvas pixels
    // are sRGB, so without this the day windows — drawn at 128/255 to sit at
    // half the facade tone — render nearer 0.73, and the grid that should read
    // as windows washes out to almost nothing. The night emissive map got away
    // with it because black-to-bright has contrast to spare.
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [night]);

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
  const nightMaterial = useMemo(() => {
    if (!night) return null;
    return new MeshStandardMaterial({
      color: new Color('#030508'),
      emissiveMap: windowTex ?? undefined,
      emissive: new Color('#EED8C0'),
      emissiveIntensity: windowTex ? WINDOW_BASE : 0,
      roughness: 1,
      metalness: 0,
      // Modulates diffuse only, so the emissive window map keeps full
      // strength — a lit window is lit whichever way its wall faces.
      vertexColors: true,
    });
  }, [night, windowTex]);

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
       * Per-building tint. Value spread does most of the work — a skyline
       * reads as many buildings mainly through differing lightness, not hue.
       * The warm/cool axis is kept narrow and deliberately biased warm, since
       * concrete, brick and travertine all skew that way and a purely neutral
       * city is what made this look like a housing block.
       */
      const value = 0.72 + rng() * 0.62; // 0.72–1.34
      const warm = (rng() - 0.35) * 0.14; // slight bias toward warm

      return {
        x: b.x,
        z: b.z,
        rot: b.rot,
        // Top stays at groundY + base + b.h; bottom lands at groundY - SKIRT.
        centerY: groundY + base + b.h - total / 2,
        geom: shadedBox(b.w, total, b.d, {
          r: value * (1 + warm),
          g: value,
          b: value * (1 - warm * 0.9),
        }),
      };
    });
  }, [buildings, relief, groundY]);

  // Created outside the reconciler, so they have to be disposed by hand.
  useEffect(() => () => nightMaterial?.dispose(), [nightMaterial]);
  useEffect(() => () => windowTex?.dispose(), [windowTex]);
  useEffect(() => () => towers.forEach((t) => t.geom.dispose()), [towers]);

  useFrame(() => {
    if (!nightMaterial || !windowTex) return;
    const { mid, high } = readAudioLevels();
    // Weighted so ordinary street noise lands mid-range instead of pinned at
    // the ceiling — a value that spends its life clamped at 1 is a constant,
    // and a constant is not a reaction.
    const drive = Math.min(1, mid * 0.5 + high * 0.6);
    nightMaterial.emissiveIntensity = WINDOW_BASE + drive * WINDOW_RANGE;
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
        <mesh key={i} position={[b.x, b.centerY, b.z]} rotation={[0, b.rot, 0]} geometry={b.geom}>
          {nightMaterial ? (
            <primitive object={nightMaterial} attach="material" />
          ) : (
            // map multiplies, so white texels keep dayColor exactly and the
            // window texels darken it. No second colour to keep in sync.
            // Lambert, not basic: buildings are lit by CityLit's dedicated
            // per-weather sun. The vertex colours survive as a shallow floor.
            <meshLambertMaterial color={dayColor} map={windowTex ?? undefined} vertexColors />
          )}
        </mesh>
        );
      })}

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
