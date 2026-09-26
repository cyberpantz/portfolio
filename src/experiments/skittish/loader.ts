/**
 * Scatter points over the cat's surface.
 *
 * The mesh arrives in its bind pose with four bone influences per vertex,
 * and every point sampled from it inherits those influences — so the cloud
 * is skinned by the same rig the mesh is, and the animation drives points
 * rather than triangles.
 *
 * Sampling here rather than baking a fixed cloud means the count is a
 * property of the device instead of the build, and a phone and a large
 * display can each get a sensible one.
 */

import type { Rig } from './rig';

export type Cloud = {
  pos: Float32Array;
  nrm: Float32Array;
  /** Four joint indices per point, as floats because that is what an
      attribute can carry. */
  idx: Float32Array;
  wgt: Float32Array;
  count: number;
};

export async function fetchRigBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`skittish: cat rig ${res.status}`);
  return res.arrayBuffer();
}

/**
 * Scatter `count` points over the surface, weighted by triangle area.
 *
 * Area-weighted, so density is even over the animal rather than even per
 * triangle — a model's tessellation follows its detail, so the face would
 * otherwise come out a bright knot and the flank would go bare.
 */
export function scatter(mesh: Rig['mesh'], count: number, rand: () => number = Math.random): Cloud {
  const nt = mesh.tris.length / 3;

  /* Prefix sum of triangle areas, so a uniform random number picks a
     triangle in proportion to how much surface it holds. */
  const cum = new Float64Array(nt);
  let total = 0;
  for (let t = 0; t < nt; t++) {
    const a = mesh.tris[t * 3] * 3, b = mesh.tris[t * 3 + 1] * 3, c = mesh.tris[t * 3 + 2] * 3;
    const e1x = mesh.pos[b] - mesh.pos[a], e1y = mesh.pos[b + 1] - mesh.pos[a + 1], e1z = mesh.pos[b + 2] - mesh.pos[a + 2];
    const e2x = mesh.pos[c] - mesh.pos[a], e2y = mesh.pos[c + 1] - mesh.pos[a + 1], e2z = mesh.pos[c + 2] - mesh.pos[a + 2];
    const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
    total += 0.5 * Math.hypot(cx, cy, cz);
    cum[t] = total;
  }

  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const idx = new Float32Array(count * 4);
  const wgt = new Float32Array(count * 4);

  for (let p = 0; p < count; p++) {
    /* Binary search rather than a linear scan: 15,000 triangles times
       120,000 points is two billion comparisons the other way. */
    const r = rand() * total;
    let lo = 0, hi = nt - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const ia = mesh.tris[lo * 3], ib = mesh.tris[lo * 3 + 1], ic = mesh.tris[lo * 3 + 2];

    /* Uniform in the triangle: fold the square in half along its diagonal
       rather than rejecting, which would throw away half the numbers. */
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w0 = 1 - u - v;

    for (let k = 0; k < 3; k++) {
      pos[p * 3 + k] = mesh.pos[ia * 3 + k] * w0 + mesh.pos[ib * 3 + k] * u + mesh.pos[ic * 3 + k] * v;
      nrm[p * 3 + k] = mesh.nrm[ia * 3 + k] * w0 + mesh.nrm[ib * 3 + k] * u + mesh.nrm[ic * 3 + k] * v;
    }
    const l = Math.hypot(nrm[p * 3], nrm[p * 3 + 1], nrm[p * 3 + 2]) || 1;
    nrm[p * 3] /= l; nrm[p * 3 + 1] /= l; nrm[p * 3 + 2] /= l;

    /*
     * Skin weights come from the vertex with the LARGEST barycentric
     * share, not from an average.
     *
     * Averaging four-slot weight lists is meaningless when the slots hold
     * different joints: slot 0 might be the jaw on one vertex and an ear
     * on the next, and mixing them produces a point attached to neither.
     * The nearest vertex's list is correct by construction, and at this
     * density the error is smaller than a point.
     */
    const near = w0 >= u && w0 >= v ? ia : u >= v ? ib : ic;
    for (let k = 0; k < 4; k++) {
      idx[p * 4 + k] = mesh.idx[near * 4 + k];
      wgt[p * 4 + k] = mesh.wgt[near * 4 + k];
    }
  }
  return { pos, nrm, idx, wgt, count };
}
