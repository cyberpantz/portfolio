/**
 * Turning the cat mask into particle homes.
 *
 * Two pieces, deliberately split: `samplePoints` is arithmetic over an alpha
 * array and runs anywhere, `loadMask` is the browser half that produces that
 * array. The split exists so the sampling can be tested in node against the
 * real PNG rather than eyeballed in a canvas — it is the part most likely to
 * be quietly wrong, and a bad distribution looks like a broken shader.
 */

export type Point = { x: number; y: number };

/**
 * Stratified sampling, not random rejection.
 *
 * Picking N random opaque pixels gives a Poisson distribution: clumps and
 * holes at every scale, which reads as a rendering fault rather than as a
 * cat. Walking a grid and taking one jittered point per covered cell gives
 * even density with enough irregularity that no lattice is visible.
 *
 * The cell size is solved for, not guessed: to land `want` points in an area
 * of `covered` pixels, cells must be sqrt(covered / want) across.
 */
export function samplePoints(
  alpha: Uint8Array | Uint8ClampedArray,
  w: number,
  h: number,
  want: number,
  rand: () => number = Math.random,
): Point[] {
  let covered = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] > 128) covered++;
  if (covered === 0) return [];

  const cell = Math.max(1, Math.sqrt(covered / want));
  const out: Point[] = [];

  for (let cy = 0; cy < h; cy += cell) {
    for (let cx = 0; cx < w; cx += cell) {
      /* Jitter inside the cell, then test THAT pixel — testing the centre
         and jittering afterwards would push points outside the silhouette
         along every edge, fraying the outline. */
      const px = Math.min(w - 1, Math.floor(cx + rand() * cell));
      const py = Math.min(h - 1, Math.floor(cy + rand() * cell));
      if (alpha[py * w + px] <= 128) continue;
      /* To [-1, 1], y up. The field is square because the mask is. */
      out.push({ x: (px / w) * 2 - 1, y: 1 - (py / h) * 2 });
    }
  }
  return out;
}

/**
 * Fit the sampled points to exactly `count` particles.
 *
 * The grid cannot hit a target count precisely — it lands within a few
 * percent — and the simulation needs a texture of an exact size. Short:
 * duplicate points with a small offset, which is invisible at this density.
 * Long: drop from the end, which is unbiased because the caller shuffles.
 */
export function fitTo(points: Point[], count: number, rand: () => number = Math.random): Float32Array {
  const out = new Float32Array(count * 2);
  if (points.length === 0) return out;
  for (let i = 0; i < count; i++) {
    const p = points[i % points.length];
    const dup = i >= points.length ? 0.004 : 0;
    out[i * 2] = p.x + (rand() - 0.5) * dup;
    out[i * 2 + 1] = p.y + (rand() - 0.5) * dup;
  }
  return out;
}

/** Fisher–Yates. The fit above trims from the end, so order must be random. */
export function shuffle<T>(a: T[], rand: () => number = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic PRNG, so a test can assert on an exact distribution. */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** The browser half: fetch the PNG and hand back its alpha channel. */
export async function loadMask(url: string): Promise<{ alpha: Uint8ClampedArray; w: number; h: number }> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();

  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('skittish: no 2d context to read the mask with');
  ctx.drawImage(img, 0, 0);

  const rgba = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  return { alpha, w, h };
}
