import { BoxGeometry, BufferAttribute } from 'three';

/**
 * Boxes that read as buildings.
 *
 * Every structure in this scene used `meshBasicMaterial`, which is unlit — all
 * six faces of a box render the exact same colour. That is the real reason the
 * towns looked like coloured paper and the city looked like grey cardboard: not
 * missing texture, missing *form*. No amount of surface detail helps while
 * adjacent faces are indistinguishable.
 *
 * The obvious fix is real lights. The reason this bakes the shading into vertex
 * colours instead: switching to lit materials means retuning `ambientLight` in
 * every environment, and those same ambients light the ground planes, the
 * grass shader and everything else. Getting exposure right across eleven
 * palettes is a job for eyes, and doing it blind would trade a flat scene for
 * a blown-out one.
 *
 * Vertex colours are self-contained. They multiply into whatever material
 * colour is already there, cost nothing at runtime, look the same under every
 * palette, and cannot affect a single other object. For a flat-shaded
 * illustrative style this is also just the correct technique — it is the look,
 * not an approximation of it.
 */

/**
 * Per-face multipliers, in BoxGeometry's face order: +X, -X, +Y, -Y, +Z, -Z.
 *
 * These are deliberately SHALLOW now. They started at 0.45–1.12, doing all the
 * shading work themselves because nothing was lit. Buildings now have real
 * per-weather lights (see CityLit), so a strong baked term would fight the sun
 * — a face lit from the right would still carry a dark bake from the left.
 *
 * What remains is a floor, closer to ambient occlusion than to key light: it
 * guarantees adjacent faces never render identically even under a flat
 * overcast sky, and otherwise stays out of the way and lets the sun lead.
 */
const FACE_SHADE = [0.88, 1.0, 1.04, 0.72, 0.98, 0.82];

/**
 * A BoxGeometry carrying per-face shading in its colour attribute.
 *
 * Pair with a material that has `vertexColors` enabled: the colour multiplies
 * the material's own, so a red building stays red and simply gains a lit side
 * and a shaded side. On lit materials it modulates diffuse only, which means
 * emissive window maps stay at full strength — correct, since a lit window is
 * lit no matter which way the wall faces.
 */
export function shadedBox(
  width: number,
  height: number,
  depth: number,
  /**
   * Optional per-instance tint, folded into the same attribute.
   *
   * This is how thirty-two towers get thirty-two colours while still sharing
   * ONE material — which matters, because the shared material is what lets the
   * audio-reactive update be a single property write per frame instead of
   * thirty-two. Painting every building the same grey is what made a city read
   * as a row of identical concrete slabs; real skylines vary building to
   * building even when the palette is narrow.
   */
  tint?: { r: number; g: number; b: number },
): BoxGeometry {
  const geom = new BoxGeometry(width, height, depth);
  const count = geom.attributes.position.count; // 24 — four verts per face
  const colors = new Float32Array(count * 3);

  const tr = tint?.r ?? 1;
  const tg = tint?.g ?? 1;
  const tb = tint?.b ?? 1;

  for (let i = 0; i < count; i++) {
    const shade = FACE_SHADE[Math.floor(i / 4)] ?? 1;
    colors[i * 3] = shade * tr;
    colors[i * 3 + 1] = shade * tg;
    colors[i * 3 + 2] = shade * tb;
  }

  geom.setAttribute('color', new BufferAttribute(colors, 3));
  return geom;
}
