// Adapted from "Heartfelt" by Martijn Steinrucken aka BigWings - 2017
// Original: https://www.shadertoy.com/view/ltffzl
// License: CC BY-NC-SA 3.0
// Adapted for postprocessing Effect (Three.js / R3F):
//   - Heart/story narrative removed
//   - iChannel0 / iResolution / iTime → inputBuffer / resolution / uTime
//   - textureLod replaced with manual Gaussian blur
//   - USE_POST_PROCESSING lightning/vignette kept (complements existing composer effects)

uniform float uTime;
uniform float uRainAmount;   // 0..1, driven by windspeed
uniform vec2  uResolution;

#define S(a, b, t) smoothstep(a, b, t)

// ── Noise helpers ─────────────────────────────────────────────────────────────
vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
  return S(0., b, t) * S(1., b, t);
}

// ── Drop layers ───────────────────────────────────────────────────────────────
vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a    = vec2(6., 1.);
  vec2 grid = a * 2.;
  vec2 id   = floor(uv * grid);

  float colShift = N(id.x);
  uv.y += colShift;
  id = floor(uv * grid);

  vec3 n  = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(.5, 0.);

  float x = n.x - .5;
  float y = UV.y * 20.;
  float wiggle = sin(y + sin(y));
  x += wiggle * (.5 - abs(x)) * (n.z - .5);
  x *= .7;

  float ti = fract(t + n.z);
  y = (Saw(.85, ti) - .5) * .9 + .5;
  vec2 p = vec2(x, y);

  float d        = length((st - p) * a.yx);
  float mainDrop = S(.4, .0, d);

  float r         = sqrt(S(1., y, st.y));
  float cd        = abs(st.x - x);
  float trail     = S(.23 * r, .15 * r * r, cd);
  float trailFront = S(-.02, .02, st.y - y);
  trail *= trailFront * r * r;

  y = UV.y;
  float trail2   = S(.2 * r, .0, cd);
  float droplets = max(0., (sin(y * (1. - y) * 120.) - st.y)) * trail2 * trailFront * n.z;
  y  = fract(y * 10.) + (st.y - .5);
  float dd = length(st - vec2(x, y));
  droplets = S(.3, 0., dd);

  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 40.;
  vec2  id = floor(uv);
  uv = fract(uv) - .5;
  vec3  n  = N13(id.x * 107.45 + id.y * 3543.654);
  vec2  p  = (n.xy - .5) * .7;
  float d  = length(uv - p);
  float fade = Saw(.025, fract(t + n.z));
  return S(.3, 0., d) * fract(n.z * 10.) * fade;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s  = StaticDrops(uv, t) * l0;
  vec2  m1 = DropLayer2(uv, t) * l1;
  vec2  m2 = DropLayer2(uv * 1.85, t) * l2;
  float c  = s + m1.x + m2.x;
  c = S(.3, 1., c);
  return vec2(c, max(m1.y * l0, m2.y * l1));
}

// ── Manual Gaussian blur (replaces textureLod) ────────────────────────────────
// sigma maps LOD 0..6 → blur radius 0..0.018 in UV space.
vec3 sampleBlurred(sampler2D tex, vec2 uv, float lod) {
  float sigma = lod * 0.003;
  if (sigma < 0.0005) return texture2D(tex, uv).rgb;
  vec3  col = vec3(0.0);
  float wt  = 0.0;
  // 3×3 Gaussian kernel — cheap but convincing at these blur radii
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2  off    = vec2(float(i), float(j)) * sigma;
      float weight = exp(-dot(off, off) / (2.0 * sigma * sigma));
      col += texture2D(tex, uv + off).rgb * weight;
      wt  += weight;
    }
  }
  return col / wt;
}

// ── Main ──────────────────────────────────────────────────────────────────────
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Passthrough when not in a wet weather state
  if (uRainAmount < 0.01) { outputColor = inputColor; return; }
  // Centre-origin UVs matching Shadertoy convention
  vec2 centredUv = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

  float t = uTime * .2;

  float rainAmount   = uRainAmount;
  float maxBlur      = mix(3., 6., rainAmount);
  float minBlur      = 2.;

  float staticDrops  = S(-.5, 1., rainAmount) * 2.;
  float layer1       = S(.25, .75, rainAmount);
  float layer2       = S(.0,  .5,  rainAmount);

  vec2 c = Drops(centredUv, t, staticDrops, layer1, layer2);

  // Expensive normals (screen-space derivative for refraction offset)
  vec2 e  = vec2(.001, 0.);
  float cx = Drops(centredUv + e,    t, staticDrops, layer1, layer2).x;
  float cy = Drops(centredUv + e.yx, t, staticDrops, layer1, layer2).x;
  vec2 n   = vec2(cx - c.x, cy - c.x);

  float focus = mix(maxBlur - c.y, minBlur, S(.1, .2, c.x));
  vec3  col   = sampleBlurred(inputBuffer, uv + n, focus);

  // Subtle blue-grey tint shift (foggier in heavy rain)
  float colFade = sin(uTime * .1) * .5 + .5;
  col *= mix(vec3(1.), vec3(.8, .9, 1.3), colFade * .35);

  // Lightning flash
  float lt  = (uTime + 3.) * .5;
  float lightning = sin(lt * sin(lt * 10.));
  lightning *= pow(max(0., sin(lt + sin(lt))), 10.);
  col *= 1. + lightning * .5;

  outputColor = vec4(col, 1.0);
}
