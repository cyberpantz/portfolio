uniform float uTime;
uniform float uWindStrength;

varying float vHeight;
varying vec2  vWorldXZ;

// ── Value noise ──────────────────────────────────────────────────────────────
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
  // World XZ from undisplaced position (stable noise anchor)
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec2 wXZ = worldPos.xz;

  // Grass density: organic patches of dense vs sparse grass
  float density = fbm(wXZ * 0.16);          // 0..~1, large patches
  density = smoothstep(0.25, 0.75, density); // sharpen edges a bit

  // Directional wind wave travelling diagonally across the field
  float wavePhase = (wXZ.x * 0.55 + wXZ.y * 0.45) * 0.22 + uTime * 1.5;
  float windWave  = sin(wavePhase) * 0.5 + 0.5;

  // Turbulence breaks the wave into natural variation
  float turb = vnoise(wXZ * 0.5 + uTime * 0.10) * 0.7 + 0.3;

  // Blade height: fine noise so each area has its own height profile
  float bladeVar = fbm(wXZ * 1.8) * 0.5 + 0.5;

  // Final displacement height
  float h = density * bladeVar * (0.28 + windWave * 0.24 * turb) * uWindStrength;

  vHeight  = h;
  vWorldXZ = wXZ;

  // Displace in local Z — on a plane rotated -90° around X, local +Z = world +Y
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0, 0.0, h), 1.0);
}
