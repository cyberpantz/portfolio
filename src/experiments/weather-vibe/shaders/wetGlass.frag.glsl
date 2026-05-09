// Rain-on-glass: coalescing drop grid + condensation drips over a fog layer.
// Outputs RGBA — fog is opaque, drops/trails are mostly transparent so the live
// 3D scene shows through naturally via WebGL alpha blending.

uniform float uTime;
uniform sampler2D uMask;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// ── Condensation drips ────────────────────────────────────────────────────────
// Returns how much each pixel is cleared by a running drip (0..1),
// and writes a bead highlight into the out param.
float computeDrips(vec2 uv, float condensation, float time, out float beadGlow) {
  float clearAmt = 0.0;
  beadGlow = 0.0;

  for (int i = 0; i < 8; i++) {
    float fi = float(i);

    float xCol     = hash(vec2(fi * 3.71, 0.17));
    float speed    = 0.014 + hash(vec2(fi, 1.30)) * 0.022;  // slow realistic drip
    float phase    = fract(time * speed + hash(vec2(fi, 2.73)) * 12.0);
    float frontY   = 1.0 - phase;           // UV y=1 is screen top; front moves down
    float trailLen = 0.10 + hash(vec2(fi, 3.10)) * 0.22;
    float width    = 0.0022 + hash(vec2(fi, 4.51)) * 0.0028;

    // Path wiggles slightly as it descends (two overlapping sines)
    float wiggle = sin(uv.y * 20.0 + fi * 3.14 + time * 0.25) * 0.004
                 + sin(uv.y * 41.0 + fi * 1.57 + time * 0.12) * 0.0015;
    float inPath = smoothstep(width, 0.0, abs(uv.x - xCol - wiggle));

    // Trail zone: from the front upward by trailLen
    float trailTop = frontY + trailLen;
    float inTrail  = 0.0;
    if (uv.y > frontY && uv.y < trailTop) {
      // Clear strongest near the front, taper toward top of trail
      inTrail = smoothstep(trailTop, frontY + trailLen * 0.15, uv.y);
    }

    // Only drip where there's meaningful condensation
    float condFactor = smoothstep(0.30, 0.65, condensation);

    clearAmt = max(clearAmt, inPath * inTrail * condFactor);

    // Water bead at the drip front — small bright teardrop blob
    vec2  beadDelta = vec2((uv.x - xCol - wiggle) / (width * 2.5),
                            (uv.y - frontY)         / (width * 6.0));
    float beadDist  = length(beadDelta);
    beadGlow = max(beadGlow,
      smoothstep(1.0, 0.0, beadDist) * 0.75 * condFactor * inPath);
  }

  return clearAmt;
}

void main() {
  vec2  uv           = vUv;
  float condensation = texture2D(uMask, uv).r;

  // ── Drop grid ─────────────────────────────────────────────────────────
  const vec2  GRID              = vec2(12.0, 7.0);
  const float ASPECT_CORRECTION = 1.037;

  vec2 cell   = floor(uv * GRID);
  vec2 cellUv = fract(uv * GRID);

  float dropAlpha  = 0.0;
  float specular   = 0.0;
  float trailAlpha = 0.0;

  for (int iy = -1; iy <= 1; iy++) {
    for (int ix = -1; ix <= 1; ix++) {
      vec2  nc = cell + vec2(float(ix), float(iy));
      float h0 = hash(nc);
      float h1 = hash(nc * 1.71 + vec2(0.31, 0.47));
      float h2 = hash(nc * 2.34 + vec2(1.13, 0.79));

      if (h0 > 0.38) {
        vec2  center  = vec2(0.2 + h1 * 0.6, 0.25 + h2 * 0.5);
        float period  = 4.0 + h0 * 18.0;
        float phase   = fract((uTime * 0.09 + h1 * 11.0) / period);
        float maxR    = 0.07 + h2 * 0.18;

        float radius  = 0.0;
        float dripAmt = 0.0;

        if (phase < 0.52) {
          radius = maxR * smoothstep(0.0, 0.52, phase);
        } else if (phase < 0.76) {
          float dp = (phase - 0.52) / 0.24;
          radius   = maxR;
          dripAmt  = dp * 0.58;
          center.y += dripAmt;
        } else {
          float dp = (phase - 0.76) / 0.24;
          radius   = maxR * (1.0 - dp);
          dripAmt  = 0.58;
          center.y += dripAmt;
        }

        vec2  delta = cellUv - vec2(float(ix), float(iy)) - center;
        delta.x    *= ASPECT_CORRECTION;
        float dist  = length(delta / vec2(1.0, 1.28));

        if (dist < radius && radius > 0.005) {
          float t01  = dist / radius;
          float edge = smoothstep(1.0, 0.52, t01);
          dropAlpha  = max(dropAlpha, edge);

          vec2  hi1  = vec2(-0.26 * radius, -0.32 * radius);
          specular   = max(specular, smoothstep(1.0, 0.0, length(delta - hi1) / (radius * 0.36)) * edge * 0.95);

          vec2  hi2  = vec2(0.20 * radius, 0.24 * radius);
          specular   = max(specular, smoothstep(1.0, 0.0, length(delta - hi2) / (radius * 0.22)) * edge * 0.30);
        }

        if (dripAmt > 0.04 && radius > 0.03) {
          vec2  trailMid = center - vec2(0.0, dripAmt * 0.5);
          vec2  tp       = cellUv - vec2(float(ix), float(iy)) - trailMid;
          tp.x          *= ASPECT_CORRECTION;
          float td       = length(tp / vec2(radius * 0.26, dripAmt * 0.58));
          trailAlpha     = max(trailAlpha, smoothstep(1.0, 0.25, td) * 0.55);
        }
      }
    }
  }

  // ── Condensation drips ────────────────────────────────────────────────
  float beadGlow;
  float dripClear = computeDrips(uv, condensation, uTime, beadGlow);

  // ── Composite ─────────────────────────────────────────────────────────
  float fogAlpha = condensation * 0.88;
  fogAlpha      *= (1.0 - dropAlpha  * 0.96);
  fogAlpha      *= (1.0 - trailAlpha * 0.72);
  fogAlpha      *= (1.0 - dripClear  * 0.90);  // drips clear fog as they run

  float dropSurf = dropAlpha * 0.14 + trailAlpha * 0.09 + dripClear * 0.06;

  vec3 glassColor = vec3(0.05, 0.09, 0.16);
  vec3 dropColor  = vec3(0.18, 0.28, 0.42);
  vec3 color      = mix(glassColor, dropColor, dropAlpha * 0.55 + trailAlpha * 0.3 + dripClear * 0.2);

  color += vec3(0.88, 0.94, 1.0) * specular;           // drop specular
  color += vec3(0.80, 0.90, 1.00) * beadGlow * 0.55;   // drip bead highlight

  float alpha = clamp(fogAlpha + dropSurf, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
