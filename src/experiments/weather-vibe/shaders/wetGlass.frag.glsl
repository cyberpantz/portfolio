// Rain on glass — foreground overlay
// Drop simulation adapted from "Heartfelt" by Martijn Steinrucken (BigWings) - 2017
// Original: https://www.shadertoy.com/view/ltffzl  License: CC BY-NC-SA 3.0
//
// Architecture: alpha-blended quad over the 3D scene.
// Alpha ≈ 0 where drops / trails / wipes clear the glass → scene shows through.
// Alpha ≈ 1 in fogged areas → dark glass tint overlays the scene.

uniform float uTime;
uniform float uRainAmount;   // 0..1, driven by windspeed
uniform sampler2D uMask;     // condensation mask (white = fogged, black = wiped)
uniform vec2  uResolution;

varying vec2 vUv;

#define S(a, b, t) smoothstep(a, b, t)

// ── Noise helpers (BigWings originals) ───────────────────────────────────────
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

  float r          = sqrt(S(1., y, st.y));
  float cd         = abs(st.x - x);
  float trail      = S(.23 * r, .15 * r * r, cd);
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

// ── Main ─────────────────────────────────────────────────────────────────────
void main() {
  // BigWings drop math uses centre-origin, aspect-corrected UVs
  float aspect = uResolution.x / uResolution.y;
  vec2 cuv = (vUv - 0.5) * vec2(aspect, 1.0);

  float t = uTime * .2;

  float rainAmount  = uRainAmount;
  float staticDrops = S(-.5, 1., rainAmount) * 2.;
  float layer1      = S(.25, .75, rainAmount);
  float layer2      = S(.0,  .5,  rainAmount);

  vec2 c = Drops(cuv, t, staticDrops, layer1, layer2);
  // c.x = drop/droplet coverage  c.y = trail coverage

  // Condensation mask — white=fully fogged, black=wiped by user
  float condensation = texture2D(uMask, vUv).r;

  // Fog alpha: present where condensation is high; cleared by drops and trails
  float fogAlpha = condensation * (1.0 - c.x * 0.92) * (1.0 - c.y * 0.72);

  // Dark blue-grey glass tint
  vec3 col = vec3(0.04, 0.07, 0.14);

  // Specular highlight on drop surfaces
  col += vec3(0.55, 0.75, 1.0) * c.x * 0.55;

  // Subtle warm trail shimmer
  col += vec3(0.20, 0.35, 0.55) * c.y * 0.25;

  // Lightning flash
  float lt        = (uTime + 3.) * 0.5;
  float lightning = sin(lt * sin(lt * 10.)) * pow(max(0., sin(lt + sin(lt))), 10.);
  col *= 1.0 + lightning * 0.8;

  // Slow blue-hour tint cycle
  float tint = sin(uTime * 0.08) * 0.5 + 0.5;
  col = mix(col, col * vec3(0.8, 0.9, 1.3), tint * 0.3);

  float alpha = clamp(fogAlpha * 0.86 + c.x * 0.08, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
