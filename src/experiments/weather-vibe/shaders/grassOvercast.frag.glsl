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
  float fine   = vnoise(vWorldXZ * 1.4);
  float coarse = fbm(vWorldXZ * 0.14) * 0.5 + 0.5;

  // ── Colors ────────────────────────────────────────────────────────────────
  vec3 wetMud    = vec3(0.16, 0.14, 0.10); // dark wet mud
  vec3 clay      = vec3(0.30, 0.27, 0.22); // grey clay
  vec3 deadGrass = vec3(0.30, 0.34, 0.22); // grey-green dead grass
  vec3 liveGrass = vec3(0.24, 0.35, 0.17); // darker damp live grass

  float grassAmt = smoothstep(0.04, 0.20, vHeight);

  vec3 col = mix(wetMud, clay, coarse * 0.6);
  col = mix(col, deadGrass, grassAmt * (1.0 - fine * 0.5));
  col = mix(col, liveGrass, grassAmt * fine * 0.7);

  // ── Puddle patches: low flat areas collect rain ──────────────────────────
  // Puddles appear where height is low AND coarse noise makes a hollow
  float puddleMask = smoothstep(0.10, 0.02, vHeight)
                   * smoothstep(0.40, 0.55, coarse);

  // Subtle shimmer from reflected overcast sky
  float shimX = sin(vWorldXZ.x * 0.65 + uTime * 0.32) * 0.5 + 0.5;
  float shimZ = sin(vWorldXZ.y * 0.48 + uTime * 0.27) * 0.5 + 0.5;
  float shimmer = shimX * shimZ;

  vec3 puddleCol = vec3(0.12, 0.14, 0.17)               // dark water base
                 + vec3(0.05, 0.06, 0.08) * shimmer;     // sky reflection glint
  col = mix(col, puddleCol, puddleMask * 0.80);

  gl_FragColor = vec4(col, 1.0);
}
