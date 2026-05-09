varying float vHeight;
varying vec2  vWorldXZ;

uniform float uTime;

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.1; a *= 0.5; }
  return v;
}

void main() {
  float fine   = vnoise(vWorldXZ * 1.6);           // medium blade detail
  float coarse = fbm(vWorldXZ * 0.16) * 0.5 + 0.5; // patch variation

  // ── Colors ────────────────────────────────────────────────────────────────
  vec3 soilColor  = vec3(0.36, 0.27, 0.17); // bare soil
  vec3 grassDark  = vec3(0.22, 0.38, 0.14); // base grass (shadow)
  vec3 grassMid   = vec3(0.36, 0.54, 0.22); // mid-tone grass
  vec3 grassLight = vec3(0.52, 0.67, 0.33); // sun-facing blades
  vec3 grassTip   = vec3(0.66, 0.78, 0.42); // wind-caught tips (brightest)
  vec3 dryPatch   = vec3(0.60, 0.55, 0.28); // yellowing dry patches

  // Height drives grass vs soil
  float grassAmt = smoothstep(0.04, 0.18, vHeight);
  float tipAmt   = smoothstep(0.30, 0.48, vHeight) * 0.8;

  vec3 col = mix(soilColor, grassDark, grassAmt);
  col = mix(col, grassMid,  fine * grassAmt * 0.8);
  col = mix(col, grassLight, tipAmt);
  col = mix(col, grassTip,  tipAmt * fine);

  // Dry yellowing patches vary by coarse noise
  col = mix(col, dryPatch, smoothstep(0.62, 0.80, coarse) * grassAmt * 0.5);

  // ── Cloud shadow dapple: slow-moving large patches ───────────────────────
  float shadow = fbm(vWorldXZ * 0.04 + uTime * 0.018) * 0.5 + 0.5;
  col *= 0.80 + shadow * 0.20;

  // ── Tiny wildflower dots ─────────────────────────────────────────────────
  float dotN  = vnoise(vWorldXZ * 7.5);
  float dot2  = vnoise(vWorldXZ * 7.5 + 3.7);
  float dotMask = step(0.80, dotN) * step(0.80, dot2) * grassAmt;

  float hue = vnoise(vWorldXZ * 0.6 + 1.3);
  vec3 flowerCol = hue < 0.35 ? vec3(0.95, 0.85, 0.10) :       // yellow
                   hue < 0.65 ? vec3(0.93, 0.93, 0.88) :        // white
                                vec3(0.60, 0.38, 0.78);          // purple
  col = mix(col, flowerCol, dotMask * 0.70);

  gl_FragColor = vec4(col, 1.0);
}
