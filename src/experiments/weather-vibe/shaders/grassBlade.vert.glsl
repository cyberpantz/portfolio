// Adapted from spacejack/terra (MIT) — blade shape reconstructed in shader.
// Each blade's 10 vertices share the same offset/shape attributes; vindex (0..9)
// tells the shader which vertex within the blade it is.

attribute float vindex;   // 0 .. BLADE_VERTS-1
attribute vec4  offset;   // (worldX, worldZ, 0, rotationY)
attribute vec4  shape;    // (width, height, lean, curve)
attribute float aColorVar;

uniform float uTime;
uniform float uWindStrength;
uniform float uGroundY;
uniform vec3  uColorBase;
uniform vec3  uColorTip;

varying vec4 vColor;

// Rotate a 2D vector (x,y) by pre-computed (cos r, sin r)
vec2 rot2(float x, float y, vec2 r) {
  return vec2(x * r.x - y * r.y, x * r.y + y * r.x);
}

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}

void main() {
  const float SEGS  = 4.0;
  const float VERTS = (SEGS + 1.0) * 2.0; // 10

  float di    = floor(vindex / 2.0);  // row 0..SEGS
  float hpct  = di / SEGS;            // normalised height 0..1
  float bedge = mod(vindex, 2.0);     // 0=left, 1=right

  float bx  = offset.x;
  float bz  = offset.y;
  float rot = offset.w;
  float w   = shape.x;
  float h   = shape.y;

  // ── Blade local-space position ──────────────────────────────────────────
  // X = width (tapered, cubic), Y = height (Three.js up), Z = lean direction
  vec3 vpos = vec3(
    w * (bedge - 0.5) * (1.0 - pow(hpct, 3.0)),  // taper
    h * hpct,                                       // height along +Y
    0.0
  );

  // Lean + natural curve: rotate blade in YZ plane so the tip droops forward
  float leanAmt = shape.z * hpct + shape.w * hpct * hpct;
  vec2 lv = vec2(cos(leanAmt), sin(leanAmt));
  vec2 yz = rot2(vpos.y, vpos.z, lv);
  vpos.y = yz.x;
  vpos.z = yz.y;

  // World orientation: rotate in XZ plane so each blade faces a random direction
  vec2 rv = vec2(cos(rot), sin(rot));
  vec2 xz = rot2(vpos.x, vpos.z, rv);
  vpos.x = xz.x;
  vpos.z = xz.y;

  // ── Wind ────────────────────────────────────────────────────────────────
  // Directional wave; phase is per-blade so whole blade moves as one unit.
  // Amplitude = hpct² so root stays, tip swings.
  float phase = (bx * 0.55 + bz * 0.45) * 0.22 + uTime * 1.4;
  float turb  = vnoise(vec2(bx * 0.35, bz * 0.35) + uTime * 0.09) * 0.5 + 0.75;
  float hSq   = hpct * hpct;
  // Apply wind as a small YZ rotation (same plane as lean), matching reference approach
  float windAmt = sin(phase) * hSq * 0.32 * uWindStrength * turb;
  vec2 wv = vec2(cos(windAmt), sin(windAmt));
  vec2 yzW = rot2(vpos.y, vpos.z, wv);
  vpos.y = yzW.x;
  vpos.z = yzW.y;

  // ── World translate ──────────────────────────────────────────────────────
  vpos.x += bx;
  vpos.y += uGroundY;
  vpos.z += bz;

  // ── Colour ──────────────────────────────────────────────────────────────
  vec3 col = mix(uColorBase, uColorTip, pow(hpct, 0.7));
  col *= 1.0 + aColorVar * 0.22;
  // AO: darken at base
  float ao = 0.55 + hpct * 0.45;
  // Per-blade random tint (from reference)
  col.r += cos(bx * 80.0) * 0.07;
  col.g += sin(bz * 140.0) * 0.05;
  vColor = vec4(col * ao, 1.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vpos, 1.0);
}
