/**
 * A cat, as primitives, sampled to a point cloud.
 *
 * ── Why build it rather than load it ────────────────────────────────────
 *
 * A model file would have better anatomy, and it would also be an asset
 * with a licence, a fixed topology, and no idea which of its vertices are
 * the head. This is a handful of ellipsoids and cones with names. The head
 * is its own object because it was declared as one, so turning it is a
 * matrix rather than a trick — which is the entire reason for the rewrite.
 *
 * ── Even density is the whole look ──────────────────────────────────────
 *
 * Points are allocated to each part in proportion to its surface AREA, and
 * sampled evenly within it. Allocate equally per part and the ears — a
 * fortieth of the surface — come out as bright knots while the flank goes
 * thin. The 2D version learned this the same way.
 *
 * ── Everything here carries a normal ────────────────────────────────────
 *
 * That is what the flat version could never have. A sampled surface knows
 * which way it faces at every point, so the cloud can be lit properly
 * instead of shaded from a fudge, and a lit form is what makes a turning
 * head legible.
 */

export const BONE = { BODY: 0, HEAD: 1, PAW: 2, TAIL: 3 } as const;
export type BoneId = (typeof BONE)[keyof typeof BONE];

/** Joints, in cat space: x forward is NEGATIVE (the cat faces -x), y up. */
export const JOINTS = {
  neck: [-0.30, 0.34, 0] as const,
  shoulder: [-0.30, -0.18, 0.15] as const,
  tailRoot: [0.52, -0.40, 0] as const,
};

type Ellipsoid = { kind: 'ellipsoid'; at: [number, number, number]; r: [number, number, number]; bone: BoneId };
type Cone = {
  kind: 'cone';
  at: [number, number, number];
  dir: [number, number, number];
  h: number;
  r: number;
  bone: BoneId;
  /*
   * Non-uniform squash about `at`, in world axes.
   *
   * A cone is radially symmetric, and an ear is not: it is a thin fin, wide
   * across and narrow front-to-back. Without this the ears read as horns —
   * which they did.
   */
  squash?: [number, number, number];
};
type Tube = { kind: 'tube'; path: [number, number, number][]; r0: number; r1: number; bone: BoneId };
type Part = Ellipsoid | Cone | Tube;

/**
 * The sculpt.
 *
 * Proportions are a sitting domestic cat at roughly two units tall, chosen
 * against the silhouette rather than from life: the rump is the widest
 * thing, the chest rises forward of it, and the head sits ahead of the
 * shoulders rather than on top of them, which is the difference between a
 * cat and a meerkat.
 */
export const PARTS: Part[] = [
  /*
   * Proportions measured off a reference cat rather than guessed.
   *
   * The first sculpt had a small head on a fat body, which is what made it
   * read as a toy. On a real cat the torso is barely wider than the skull —
   * 1.06 to 1 — where this was 1.60. Three more corrections came from the
   * same measurement: the skull is WIDER than it is long (1.24), the ears
   * sit much further apart than they look (a span of 1.3 skull lengths),
   * and the muzzle is short and broad rather than long and narrow.
   */

  /* Rump, mid-body, chest — three overlapping masses. Two left a visible
     waist where the chest met the rump; a cat sitting has no waist, it has
     one continuous curve from ear to floor. */
  { kind: 'ellipsoid', at: [0.22, -0.54, 0], r: [0.42, 0.40, 0.295], bone: BONE.BODY },
  { kind: 'ellipsoid', at: [0.06, -0.29, 0], r: [0.37, 0.39, 0.285], bone: BONE.BODY },
  { kind: 'ellipsoid', at: [-0.08, -0.01, 0], r: [0.33, 0.43, 0.275], bone: BONE.BODY },
  /* Neck. In BODY, not HEAD: it is what the head turns against. */
  { kind: 'ellipsoid', at: [-0.23, 0.29, 0], r: [0.20, 0.21, 0.205], bone: BONE.BODY },

  /* Skull — wider than long, and bigger than it was. */
  { kind: 'ellipsoid', at: [-0.40, 0.60, 0], r: [0.225, 0.195, 0.275], bone: BONE.HEAD },
  /* Muzzle — short, broad, and low on the face. */
  { kind: 'ellipsoid', at: [-0.555, 0.525, 0], r: [0.105, 0.115, 0.165], bone: BONE.HEAD },
  /* Ears — set wide on the skull and canted out, which is most of what
     makes a cat read as a cat from any distance. */
  { kind: 'cone', at: [-0.375, 0.705, 0.185], dir: [-0.05, 0.90, 0.44], h: 0.205, r: 0.140, bone: BONE.HEAD, squash: [0.42, 1, 1] },
  { kind: 'cone', at: [-0.375, 0.705, -0.185], dir: [-0.05, 0.90, -0.44], h: 0.205, r: 0.140, bone: BONE.HEAD, squash: [0.42, 1, 1] },

  /* Front legs, tucked under the chest. The near one is its own bone. */
  { kind: 'tube', path: [[-0.25, -0.10, 0.125], [-0.29, -0.50, 0.135], [-0.30, -0.85, 0.14]], r0: 0.105, r1: 0.07, bone: BONE.PAW },
  { kind: 'ellipsoid', at: [-0.36, -0.895, 0.14], r: [0.11, 0.065, 0.09], bone: BONE.PAW },
  { kind: 'tube', path: [[-0.24, -0.10, -0.125], [-0.28, -0.50, -0.135], [-0.29, -0.85, -0.14]], r0: 0.105, r1: 0.07, bone: BONE.BODY },
  { kind: 'ellipsoid', at: [-0.35, -0.895, -0.14], r: [0.11, 0.065, 0.09], bone: BONE.BODY },

  /* Hind legs, folded — a sitting cat is mostly thigh. */
  { kind: 'ellipsoid', at: [0.10, -0.55, 0.245], r: [0.30, 0.28, 0.14], bone: BONE.BODY },
  { kind: 'ellipsoid', at: [0.10, -0.55, -0.245], r: [0.30, 0.28, 0.14], bone: BONE.BODY },
  { kind: 'ellipsoid', at: [-0.09, -0.895, 0.215], r: [0.155, 0.065, 0.095], bone: BONE.BODY },
  { kind: 'ellipsoid', at: [-0.09, -0.895, -0.215], r: [0.155, 0.065, 0.095], bone: BONE.BODY },

  /* Tail: out, around and forward, the way a sitting cat parks it. */
  {
    kind: 'tube',
    path: [
      [0.48, -0.44, 0], [0.68, -0.64, 0.06], [0.76, -0.85, 0.17],
      [0.62, -0.94, 0.32], [0.36, -0.95, 0.39], [0.08, -0.93, 0.39],
    ],
    r0: 0.08, r1: 0.05,
    bone: BONE.TAIL,
  },
];

/* ------------------------------------------------------------ sampling */

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];

/* --------------------------------------------------------- the surface
 *
 * The parts above are not the cat. They are an armature for it.
 *
 * Sampling each primitive's own surface draws every sphere in full,
 * including the two-thirds of it buried inside its neighbours — so the
 * body came out as a visible stack of balls with seams where they met, and
 * the legs looked stuck on rather than grown from.
 *
 * What is wanted is the surface of their smooth union: one skin over the
 * whole armature, with the chest flowing into the rump and the legs
 * emerging from the body. That is a signed distance field with a soft
 * minimum, and the cloud is points that sit on its zero.
 */

/** Polynomial smooth minimum. k is the blend radius, in cat units. */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function sdEllipsoid(p: V3, c: V3, r: V3): number {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z);
  if (k0 === 0) return -Math.min(r[0], r[1], r[2]);
  const k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return (k0 * (k0 - 1)) / k1;
}

/** Distance to a segment, minus a radius that tapers along it. */
function sdSegment(p: V3, a: V3, b: V3, ra: number, rb: number): number {
  const ba = sub(b, a), pa = sub(p, a);
  const d = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const t = d > 0 ? Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / d)) : 0;
  const q: V3 = [pa[0] - ba[0] * t, pa[1] - ba[1] * t, pa[2] - ba[2] * t];
  return len(q) - (ra + (rb - ra) * t);
}

/**
 * The whole animal, as one distance function.
 *
 * Blend radii differ by joint on purpose. The body masses melt into one
 * another generously, because a sitting cat has no edges anywhere along its
 * back. The ears blend barely at all — an ear that melts into the skull
 * stops being an ear, and the ears are most of what makes the silhouette
 * legible at a glance.
 */
/** Distance to ONE primitive, unblended. Used to decide ownership. */
export function sdPart(p: V3, part: Part): number {
  {
    let s: number;
    if (part.kind === 'ellipsoid') s = sdEllipsoid(p, part.at as unknown as V3, part.r as unknown as V3);
    else if (part.kind === 'cone') {
      const tip: V3 = [
        part.at[0] + part.dir[0] * part.h, part.at[1] + part.dir[1] * part.h, part.at[2] + part.dir[2] * part.h,
      ];
      /* Squashed shapes are evaluated in the space where they are round,
         then the distance is scaled back by the tightest axis. That
         under-reports distance away from the surface, which is harmless
         here: every use of this field is a Newton step that only needs the
         sign and the local gradient to be right. */
      const q = part.squash
        ? ([
            part.at[0] + (p[0] - part.at[0]) / part.squash[0],
            part.at[1] + (p[1] - part.at[1]) / part.squash[1],
            part.at[2] + (p[2] - part.at[2]) / part.squash[2],
          ] as V3)
        : p;
      const k = part.squash ? Math.min(part.squash[0], part.squash[1], part.squash[2]) : 1;
      s = sdSegment(q, part.at as unknown as V3, tip, part.r, part.r * TIP) * k;
    } else {
      s = Infinity;
      for (let i = 1; i < part.path.length; i++) {
        const f0 = (i - 1) / (part.path.length - 1), f1 = i / (part.path.length - 1);
        s = Math.min(s, sdSegment(
          p, part.path[i - 1] as unknown as V3, part.path[i] as unknown as V3,
          part.r0 + (part.r1 - part.r0) * f0, part.r0 + (part.r1 - part.r0) * f1,
        ));
      }
    }
    return s;
  }
}

/** Blend radius for a part: ears barely melt, bodies melt generously. */
const blendOf = (part: Part) => (part.bone === BONE.HEAD && part.kind === 'cone' ? 0.02 : 0.12);

export function sdCat(p: V3): number {
  let d = Infinity;
  for (const part of PARTS) {
    const s = sdPart(p, part);
    d = d === Infinity ? s : smin(d, s, blendOf(part));
  }
  return d;
}

/**
 * Which primitive owns this piece of surface.
 *
 * Seeds are generated per primitive and then walked onto the blended skin,
 * and at every seam the primitives on both sides walk their points onto the
 * SAME ridge. The result is double density exactly along the joins — bright
 * arcs round the neck, the shoulder and the haunch, which read as wireframe
 * on an object that has none.
 *
 * So each landed point is asked which primitive it is actually nearest to,
 * and is kept only by that one. Every patch of skin gets claimed once, and
 * the seams stop glowing.
 */
function nearestPart(p: V3): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < PARTS.length; i++) {
    const d = sdPart(p, PARTS[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/* How blunt an ear ends, as a fraction of its base radius. At 0.12 the
   apex is a spike and the ears read as horns; a cat's ear tapers to a soft
   rounded point, and the softness is most of what stops it looking like a
   Halloween decoration. */
const TIP = 0.42;

const EPS = 0.004;
function gradCat(p: V3): V3 {
  const d = sdCat(p);
  return norm([
    sdCat([p[0] + EPS, p[1], p[2]]) - d,
    sdCat([p[0], p[1] + EPS, p[2]]) - d,
    sdCat([p[0], p[1], p[2] + EPS]) - d,
  ]);
}

/** Any unit vector perpendicular to `n`, chosen to avoid the degenerate case. */
function basis(n: V3): [V3, V3] {
  const up: V3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(up, n));
  return [u, cross(n, u) as V3];
}

/** Knud Thomsen's approximation — within ~1% for anything cat-shaped. */
function ellipsoidArea(r: V3): number {
  const p = 1.6075;
  const s = ((r[0] * r[1]) ** p + (r[0] * r[2]) ** p + (r[1] * r[2]) ** p) / 3;
  return 4 * Math.PI * s ** (1 / p);
}

function tubeArea(t: Tube): number {
  let a = 0;
  for (let i = 1; i < t.path.length; i++) {
    const l = len(sub(t.path[i], t.path[i - 1]));
    const f = (i - 0.5) / (t.path.length - 1);
    a += 2 * Math.PI * (t.r0 + (t.r1 - t.r0) * f) * l;
  }
  return a;
}

function partArea(p: Part): number {
  if (p.kind === 'ellipsoid') return ellipsoidArea(p.r);
  if (p.kind === 'cone') return Math.PI * p.r * Math.hypot(p.h, p.r);
  return tubeArea(p);
}

export type Cloud = {
  pos: Float32Array;   // xyz per point
  nrm: Float32Array;   // unit normal per point
  bone: Uint8Array;    // which part of the animal it belongs to
  count: number;
};

/**
 * Sample every part, in proportion to its area.
 *
 * Ellipsoids are sampled by taking a uniform direction on the unit sphere
 * and scaling it, then keeping the point with probability proportional to
 * the local area stretch. Without that rejection step the flat faces of a
 * squashed ellipsoid come out sparse and the poles come out crowded, which
 * on a cat means a dense stripe down the spine.
 */
export function buildCat(count: number, rand: () => number = Math.random): Cloud {
  const areas = PARTS.map(partArea);
  const total = areas.reduce((a, b) => a + b, 0);

  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const bone = new Uint8Array(count);

  let w = 0;
  for (let pi = 0; pi < PARTS.length; pi++) {
    const part = PARTS[pi];
    const share = pi === PARTS.length - 1 ? count - w : Math.round((areas[pi] / total) * count);
    let placed = 0, guard = 0;
    while (placed < share && w < count && guard < share * 8) {
      guard++;
      /*
       * Seed on the primitive, then walk onto the real surface.
       *
       * A few Newton steps along the gradient: p -= d·∇d. The seed is
       * already within a hair of the answer, so this converges in three,
       * and a point that started buried inside a neighbour walks out to the
       * union's skin instead of being drawn inside the cat where nobody can
       * see it.
       */
      const [seed] = samplePart(part, rand);
      const p: V3 = [seed[0], seed[1], seed[2]];
      for (let step = 0; step < 3; step++) {
        const d = sdCat(p);
        const g = gradCat(p);
        p[0] -= d * g[0]; p[1] -= d * g[1]; p[2] -= d * g[2];
      }
      /* Discard the ones that did not land, and the ones that travelled so
         far they are no longer sampling the part they were allocated to —
         those pile up along seams and read as bright welds. */
      if (Math.abs(sdCat(p)) > 0.006) continue;
      /* Only the nearest primitive keeps it. Without this the joins carry
         twice the points of the flanks and glow. */
      if (nearestPart(p) !== pi) continue;

      const n = gradCat(p);
      pos[w * 3] = p[0]; pos[w * 3 + 1] = p[1]; pos[w * 3 + 2] = p[2];
      nrm[w * 3] = n[0]; nrm[w * 3 + 1] = n[1]; nrm[w * 3 + 2] = n[2];
      bone[w] = part.bone;
      w++; placed++;
    }
  }
  return { pos, nrm, bone, count: w };
}

function sampleSphere(rand: () => number): V3 {
  const z = rand() * 2 - 1;
  const t = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), r * Math.sin(t), z];
}

function samplePart(part: Part, rand: () => number): [V3, V3] {
  if (part.kind === 'ellipsoid') {
    const [a, b, c] = part.r;
    const maxStretch = Math.max(a * b, a * c, b * c);
    for (let tries = 0; tries < 64; tries++) {
      const d = sampleSphere(rand);
      /* Local area element of the map sphere -> ellipsoid. */
      const stretch = Math.hypot(b * c * d[0], a * c * d[1], a * b * d[2]);
      if (rand() * maxStretch > stretch) continue;
      const p: V3 = [part.at[0] + a * d[0], part.at[1] + b * d[1], part.at[2] + c * d[2]];
      const n = norm([d[0] / (a * a), d[1] / (b * b), d[2] / (c * c)] as V3);
      return [p, n];
    }
    const d = sampleSphere(rand);
    return [[part.at[0] + a * d[0], part.at[1] + b * d[1], part.at[2] + c * d[2]], d];
  }

  if (part.kind === 'cone') {
    const axis = norm(part.dir);
    const [u, v] = basis(axis);
    /* sqrt, so points spread evenly over the lateral area rather than
       bunching at the tip where the circumference is small. */
    const t = Math.sqrt(rand());
    const ang = rand() * Math.PI * 2;
    const rr = part.r * (1 - (1 - TIP) * t);
    const c = Math.cos(ang), s = Math.sin(ang);
    const p: V3 = [
      part.at[0] + axis[0] * part.h * t + (u[0] * c + v[0] * s) * rr,
      part.at[1] + axis[1] * part.h * t + (u[1] * c + v[1] * s) * rr,
      part.at[2] + axis[2] * part.h * t + (u[2] * c + v[2] * s) * rr,
    ];
    const radial: V3 = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
    const slope = part.r / part.h;
    let n = norm([
      radial[0] + axis[0] * slope, radial[1] + axis[1] * slope, radial[2] + axis[2] * slope,
    ]);
    if (part.squash) {
      const sq = part.squash;
      p[0] = part.at[0] + (p[0] - part.at[0]) * sq[0];
      p[1] = part.at[1] + (p[1] - part.at[1]) * sq[1];
      p[2] = part.at[2] + (p[2] - part.at[2]) * sq[2];
      /* Normals of a scaled surface transform by the inverse — for a
         diagonal scale that is a division, not a multiplication. */
      n = norm([n[0] / sq[0], n[1] / sq[1], n[2] / sq[2]]);
    }
    return [p, n];
  }

  /* Tube: pick a segment by length, a point along it, then a ring angle. */
  const segs = part.path.length - 1;
  const lens: number[] = [];
  let tot = 0;
  for (let i = 0; i < segs; i++) { const l = len(sub(part.path[i + 1], part.path[i])); lens.push(l); tot += l; }
  let pick = rand() * tot, si = 0;
  while (si < segs - 1 && pick > lens[si]) { pick -= lens[si]; si++; }
  const f = lens[si] > 0 ? pick / lens[si] : 0;
  const a = part.path[si], b = part.path[si + 1];
  const centre: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const along = (si + f) / segs;
  const rr = part.r0 + (part.r1 - part.r0) * along;
  const axis = norm(sub(b, a));
  const [u, v] = basis(axis);
  const ang = rand() * Math.PI * 2;
  const c = Math.cos(ang), s = Math.sin(ang);
  const n: V3 = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
  return [[centre[0] + n[0] * rr, centre[1] + n[1] * rr, centre[2] + n[2] * rr], n];
}
