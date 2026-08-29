import { useEffect, useMemo } from 'react';
import { CanvasTexture, Color, SRGBColorSpace, DoubleSide, Shape, ShapeGeometry } from 'three';
import type { Palette } from '../conditions';
import type { CityLayout } from '../cityLayout';

/**
 * Ground-level detail: paint and planting.
 *
 * Without either, a city reads as an architectural render — massing, no
 * evidence of anyone. These are the two cheapest signals that people use the
 * place: something grew there, and someone wrote on it.
 */

function makeRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ── Spray paint ─────────────────────────────────────────────────────────── */

/**
 * Marker inks: near-black, red, blue.
 *
 * The first palette was six bright hues — orange, purple, green, yellow —
 * which is a highlighter set, not a marker. Tags are overwhelmingly one bold
 * ink, and a wall usually carries two or three different hands in different
 * colours rather than one rainbow.
 */
const TAG_INKS = ['#161418', '#C62228', '#203CB2', '#E2A81E', '#1C9656'];

type Pt = [number, number];

/** Cubic bezier sampled to points — the curves are the whole point here. */
function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 16): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
      u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return out;
}

/**
 * One pseudo-letter.
 *
 * The counters — the enclosed loops — are what make a tag read as
 * handwriting. The previous version had none, which is why it looked like a
 * line graph no matter how the rhythm was tuned. Each form advances PAST
 * itself so the next letter has air; letters piled on the same x produced a
 * knot rather than a word.
 */
function glyph(rng: () => number, x: number, base: number, amp: number): { pts: Pt[]; x: number } {
  const roll = rng();
  const pts: Pt[] = [];

  if (roll < 0.34) {
    // loop — swept past a full turn so the stroke crosses itself
    const r = amp * (0.28 + rng() * 0.14);
    const cx = x + r;
    const cy = base - r * 0.55;
    for (let i = 0; i < 26; i++) {
      const a = -1.7 + (i / 25) * Math.PI * 2 * 1.05;
      pts.push([cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r]);
    }
    return { pts, x: cx + r * 1.25 };
  }
  if (roll < 0.62) {
    const w = amp * (0.55 + rng() * 0.35);
    pts.push(...bez([x, base], [x + w * 0.2, base - amp], [x + w * 0.8, base - amp], [x + w, base]));
    return { pts, x: x + w * 1.15 };
  }
  if (roll < 0.82) {
    const w = amp * 0.3;
    pts.push(
      ...bez(
        [x, base - amp * 0.9],
        [x + w * 1.3, base - amp * 0.25],
        [x - w * 0.4, base + amp * 0.25],
        [x + w, base + amp * 0.45],
      ),
    );
    return { pts, x: x + w * 1.8 };
  }
  const w = amp * 0.5;
  pts.push(
    ...bez(
      [x, base - amp * 0.55],
      [x + w, base - amp * 0.85],
      [x + w * 1.25, base + amp * 0.15],
      [x + w * 0.35, base + amp * 0.3],
    ),
  );
  return { pts, x: x + w * 1.5 };
}

/**
 * A wall of tags — written by DIFFERENT PEOPLE.
 *
 * The mistake worth recording: each earlier attempt fixed the look but kept
 * one template, so every wall in every city was the same writer with a
 * different seed. First it was smooth parallel ribbons, then angular
 * polylines with a throwie outline, then a single cursive hand with a
 * mandatory underline. All of them one rule, applied everywhere.
 *
 * Writers do not share a hand. So there are four here — a cursive tag, a
 * bubble throw-up, an angular piece with arrows, and a fast scrawl — and a
 * wall picks one or two at random, in any of five inks, at different scales.
 * The variety between walls is the point, more than the fidelity of any one.
 */
type Hand = (
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  ink: string,
  base: number,
  amp: number,
  x: number,
  w: number,
) => void;

function trace(ctx: CanvasRenderingContext2D, pts: Pt[], ink: string, w: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, w);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Connected curves, enclosed counters, a long underline flourish. */
const cursive: Hand = (ctx, rng, ink, base, amp, x0, w) => {
  const pts: Pt[] = [];
  let x = x0;
  for (let i = 0; i < 4 + Math.floor(rng() * 2); i++) {
    const g = glyph(rng, x, base, amp);
    pts.push(...g.pts);
    x = g.x + amp * 0.16;
  }
  const span = x - x0;
  pts.push(
    ...bez(
      [x, base + amp * 0.15],
      [x - span * 0.35, base + amp * 0.75],
      [x - span * 0.75, base + amp * 0.55],
      [x0 - 6, base + amp * 0.1],
    ),
  );
  trace(ctx, pts, ink, w);
  const [dx, dy] = pts[Math.floor(rng() * pts.length)];
  trace(ctx, [[dx, dy], [dx, dy + 16 + rng() * 30]], ink, w / 3, 0.75);
};

/** Fat rounded letters, heavy dark outline, a highlight down one edge. */
const throwie: Hand = (ctx, rng, ink, base, amp, x0, w) => {
  const pts: Pt[] = [];
  let x = x0;
  for (let i = 0; i < 3; i++) {
    // Radius and baseline both wander — three identical circles read as
    // chain links rather than letters.
    const r = amp * (0.42 + rng() * 0.3);
    const cx = x + r;
    const cy = base - r * 0.2 + (rng() - 0.5) * amp * 0.35;
    const squash = 0.78 + rng() * 0.4;
    for (let a = 0; a <= 22; a++) {
      const t = (a / 22) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r * 1.15, cy + Math.sin(t) * r * squash]);
    }
    x = cx + r * (1.25 + rng() * 0.35);
  }
  trace(ctx, pts, '#0E0C10', w * 2.1);
  trace(ctx, pts, ink, w * 1.15);
  trace(ctx, pts.map(([px, py]) => [px - 2, py - 3] as Pt), '#FFFFFF', w * 0.3, 0.45);
};

/** Sharp, fast, arrowed — the piece idiom rather than the tag idiom. */
const angular: Hand = (ctx, rng, ink, base, amp, x0, w) => {
  const pts: Pt[] = [[x0, base]];
  let x = x0;
  for (let i = 0; i < 7 + Math.floor(rng() * 4); i++) {
    x += amp * (0.35 + rng() * 0.5);
    pts.push([x, base - amp * (rng() * 1.3 - 0.35)]);
  }
  trace(ctx, pts, ink, w);
  const [ax, ay] = pts[pts.length - 1];
  trace(ctx, [[ax, ay], [ax - amp * 0.4, ay - amp * 0.3]], ink, w);
  trace(ctx, [[ax, ay], [ax - amp * 0.42, ay + amp * 0.22]], ink, w);
  for (let i = 0; i < 2; i++) {
    const [px, py] = pts[Math.floor(rng() * (pts.length - 1))];
    trace(ctx, [[px - amp * 0.5, py + amp * 0.35], [px + amp * 0.5, py - amp * 0.35]], ink, w * 0.6);
  }
};

/** Thin, quick, unreadable — the thirty-second version. */
const scrawl: Hand = (ctx, rng, ink, base, amp, x0, w) => {
  const pts: Pt[] = [[x0, base]];
  let x = x0;
  for (let i = 0; i < 16 + Math.floor(rng() * 10); i++) {
    x += amp * (0.12 + rng() * 0.22);
    pts.push([x, base + (rng() - 0.5) * amp * 1.5]);
  }
  trace(ctx, pts, ink, w * 0.5);
};

const HANDS: Hand[] = [cursive, throwie, angular, scrawl];

function makeTagTexture(seed: number): CanvasTexture {
  const rng = makeRng(seed);
  const W = 256;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H); // transparent — this is a decal, not a panel

  const inks = [...TAG_INKS].sort(() => rng() - 0.5);
  const layers = 1 + (rng() < 0.65 ? 1 : 0);

  for (let L = 0; L < layers; L++) {
    const hand = HANDS[Math.floor(rng() * HANDS.length)];
    hand(
      ctx,
      rng,
      inks[L % inks.length],
      H * (0.62 - L * 0.34) + rng() * 10,
      H * (0.26 - L * 0.08),
      10 + rng() * 30,
      Math.max(2, H * (0.05 - L * 0.014)),
    );
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

interface GraffitiProps {
  /** Buildings eligible to be tagged — pass only the near ones, and pass a
   *  memoised array: this generates canvas textures from it. */
  walls: { x: number; z: number; d: number; w: number; baseY: number }[];
  layout: CityLayout;
  seed?: number;
}

/**
 * A couple of tagged walls, never a gallery. Two is enough to say the city is
 * lived in; more would say the city is a set dressed to look lived in.
 */
export function Graffiti({ walls, layout, seed = 5150 }: GraffitiProps) {
  const tags = useMemo(() => {
    if (walls.length === 0) return [];
    const rng = makeRng(seed);

    /*
      Draw only from walls that are actually ON SCREEN.

      Picking freely from every near building sounds fair and isn't: of 23
      candidates in the arc layout only 10 sit within 40° of centre, so two
      blind picks both landed in frame about 19% of the time. Four runs in
      five showed one tag or none, which reads as "the feature is broken"
      rather than "the dice were unkind".
    */
    const IN_FRAME_DEG = 38;
    const visible = walls.filter(
      (wl) => Math.abs(Math.atan2(wl.x, Math.abs(wl.z)) * (180 / Math.PI)) < IN_FRAME_DEG,
    );
    const pool = [...(visible.length >= 2 ? visible : walls)];

    const count = Math.min(2, pool.length);
    const picked: typeof walls = [];
    for (let i = 0; i < count; i++) {
      picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }

    return picked.map((wall, i) => {
      /*
        Which face gets painted depends on which face you can SEE.

        On a boulevard the buildings flank the street, so what faces you is
        the long side along the avenue — their camera-facing ends are edge-on
        slivers. Painting those put the tags where nobody was looking. The
        street-facing side is the wall a person would actually stand at.

        On the arc layout the towers face the viewer squarely, so the
        camera-facing side is right.
      */
      const onSide = layout === 'boulevard';
      // Which way the street is, from this building.
      const toStreet = wall.x >= 0 ? -1 : 1;
      // Most of the wall's width, and a higher cap — at street distance the
      // previous 9-unit ceiling made these postage stamps on a tower.
      const span = onSide ? wall.d : wall.w;
      const w = Math.min(span * 0.88, 13);

      return {
        tex: makeTagTexture(seed + i * 977),
        w,
        h: w * 0.5,
        // Low on the building: paint goes where a person can reach.
        pos: onSide
          ? ([wall.x + toStreet * (wall.w / 2 + 0.06), wall.baseY + 2.6 + i * 0.6, wall.z] as const)
          : ([wall.x, wall.baseY + 2.6 + i * 0.6, wall.z + wall.d / 2 + 0.06] as const),
        rot: onSide ? ([0, toStreet * (Math.PI / 2), 0] as const) : ([0, 0, 0] as const),
      };
    });
  }, [walls, layout, seed]);

  useEffect(() => () => tags.forEach((t) => t.tex.dispose()), [tags]);

  return (
    <>
      {tags.map((t, i) => (
        <mesh key={i} position={t.pos} rotation={t.rot}>
          <planeGeometry args={[t.w, t.h]} />
          <meshLambertMaterial map={t.tex} transparent depthWrite={false} side={DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

/* ── Street trees ────────────────────────────────────────────────────────── */

/** A soft, slightly irregular canopy — a street tree, not the rural pines. */
function canopyShape(rng: () => number, r: number): Shape {
  const shape = new Shape();
  const lobes = 9;
  for (let i = 0; i <= lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = r * (0.78 + rng() * 0.34);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr * 1.12;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

interface TreesProps {
  palette: Palette;
  groundY: number;
  layout: CityLayout;
}

/**
 * Planting along the street.
 *
 * A boulevard gets two rows flanking the carriageway, which is what a
 * boulevard IS; the arc layout gets a looser scatter across the foreground,
 * since there is no street to line. Both sit on the same hill function as the
 * buildings, so nothing floats.
 */
export function StreetTrees({ palette, groundY, layout }: TreesProps) {
  const trees = useMemo(() => {
    const rng = makeRng(8821);
    const out: { x: number; z: number; h: number; seed: number }[] = [];

    if (layout === 'boulevard') {
      // Just inside the building line (x ±15), so they read as street planting.
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 11; i++) {
          const t = i / 10;
          out.push({
            x: side * (11.5 + rng() * 2.2),
            z: -(14 + t * t * 250 + rng() * 8),
            h: 4.6 + rng() * 2.8,
            seed: 100 + out.length,
          });
        }
      }
    } else {
      for (let i = 0; i < 16; i++) {
        out.push({
          x: (rng() - 0.5) * 150,
          z: -(20 + rng() * 70),
          h: 4.4 + rng() * 3,
          seed: 100 + i,
        });
      }
    }
    return out;
  }, [layout]);

  const { canopy, trunk } = useMemo(() => {
    const bg = new Color(palette.background);
    const gray = (bg.r + bg.g + bg.b) / 3;
    // Foliage keeps some of the sky's light so it belongs to the weather,
    // but holds its own green rather than becoming another grey mass.
    const leaf = new Color(
      gray * 0.30 + 0.030,
      gray * 0.44 + 0.075,
      gray * 0.30 + 0.036,
    );
    return { canopy: leaf, trunk: leaf.clone().multiplyScalar(0.45) };
  }, [palette.background]);

  const geoms = useMemo(
    () => trees.map((t) => new ShapeGeometry(canopyShape(makeRng(t.seed), t.h * 0.34))),
    [trees],
  );
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);

  if (trees.length === 0) return null;

  return (
    <>
      {trees.map((t, i) => {
        /*
          Trees stand on the PAVEMENT, not on the hill function.

          Sampling cityHillHeight here looked correct and floated every tree.
          The hills are not a surface anyone stands on: the visible ground is
          CityGround, a flat plane, and the ridges are billboards behind it.
          Buildings can sample the hills because each one extends six units
          below its base, so the skirt hides the gap and only its top actually
          rises. A tree has no skirt, so it hovered by exactly the hill height
          — 0.6 to 12.4 units at San Francisco's relief, which is taller than
          the tree.
        */
        const base = groundY;
        const trunkH = t.h * 0.42;
        return (
          <group key={i} position={[t.x, base, t.z]} rotation={[0, (i % 5) * 0.6, 0]}>
            {/* Sunk slightly so there is never a hairline seam at the kerb. */}
            <mesh position={[0, trunkH * 0.5 - 0.25, 0]}>
              <cylinderGeometry args={[t.h * 0.026, t.h * 0.042, trunkH + 0.5, 5]} />
              <meshLambertMaterial color={trunk} />
            </mesh>
            {/* Crossed billboards, like the rural trees — cheap volume. */}
            <mesh geometry={geoms[i]} position={[0, trunkH + t.h * 0.3, 0]}>
              <meshLambertMaterial color={canopy} side={DoubleSide} />
            </mesh>
            <mesh
              geometry={geoms[i]}
              position={[0, trunkH + t.h * 0.3, 0]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <meshLambertMaterial color={canopy.clone().multiplyScalar(0.82)} side={DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
