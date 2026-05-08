// Rain-on-glass: grid of coalescing drops over a condensation fog layer.
// Outputs RGBA — fog is opaque, drops are mostly transparent so the live
// 3D scene shows through behind them naturally via WebGL alpha blending.

uniform float uTime;
uniform sampler2D uMask;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2  uv          = vUv;
  float condensation = texture2D(uMask, uv).r;

  // ── Drop grid ─────────────────────────────────────────────────────────
  // 12×7 cells on a 16:9 screen ≈ square cells.
  const vec2 GRID = vec2(12.0, 7.0);
  const float ASPECT_CORRECTION = 1.037; // aspect * GRID.y / GRID.x ≈ 1.778 * 7/12

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

      if (h0 > 0.38) {  // ~62% of cells have a drop
        vec2  center  = vec2(0.2 + h1 * 0.6, 0.25 + h2 * 0.5);
        float period  = 4.0 + h0 * 18.0;  // 4–22 s lifecycle
        float phase   = fract((uTime * 0.09 + h1 * 11.0) / period);
        float maxR    = 0.07 + h2 * 0.18;  // cell-space radius 0.07–0.25

        float radius  = 0.0;
        float dripAmt = 0.0;

        if (phase < 0.52) {
          // Growing: accumulating water
          radius = maxR * smoothstep(0.0, 0.52, phase);
        } else if (phase < 0.76) {
          // Dripping: drop centre slides downward
          float dp = (phase - 0.52) / 0.24;
          radius   = maxR;
          dripAmt  = dp * 0.58;
          center.y += dripAmt;
        } else {
          // Reset: shrinks as water disperses
          float dp = (phase - 0.76) / 0.24;
          radius   = maxR * (1.0 - dp);
          dripAmt  = 0.58;
          center.y += dripAmt;
        }

        // Delta in cell-space, corrected for screen aspect ratio
        vec2  delta = cellUv - vec2(float(ix), float(iy)) - center;
        delta.x    *= ASPECT_CORRECTION;

        // Slightly elliptical (taller than wide, like a real drop)
        float dist = length(delta / vec2(1.0, 1.28));

        if (dist < radius && radius > 0.005) {
          float t01  = dist / radius;
          float edge = smoothstep(1.0, 0.52, t01);
          dropAlpha  = max(dropAlpha, edge);

          // Primary specular: small bright glint upper-left
          vec2  hi1    = vec2(-0.26 * radius, -0.32 * radius);
          float hi1d   = length(delta - hi1) / (radius * 0.36);
          specular     = max(specular, smoothstep(1.0, 0.0, hi1d) * edge * 0.95);

          // Secondary specular: fainter reflection lower-right
          vec2  hi2    = vec2(0.20 * radius, 0.24 * radius);
          float hi2d   = length(delta - hi2) / (radius * 0.22);
          specular     = max(specular, smoothstep(1.0, 0.0, hi2d) * edge * 0.30);
        }

        // Drip trail: thin capsule tracing where the drop slid
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

  // ── Composite ─────────────────────────────────────────────────────────
  // Fog layer: dark blue-grey condensation, punctured by drops and trails
  float fogAlpha = condensation * 0.88;
  fogAlpha      *= (1.0 - dropAlpha  * 0.96);
  fogAlpha      *= (1.0 - trailAlpha * 0.72);

  // Drop surface: very thin wet-glass tint so drops aren't fully invisible
  float dropSurf = dropAlpha * 0.14 + trailAlpha * 0.09;

  vec3 glassColor = vec3(0.05, 0.09, 0.16);
  vec3 dropColor  = vec3(0.18, 0.28, 0.42);
  vec3 color      = mix(glassColor, dropColor, dropAlpha * 0.55 + trailAlpha * 0.3);

  // Specular glints sit on top of the tint
  color += vec3(0.88, 0.94, 1.0) * specular;

  float alpha = clamp(fogAlpha + dropSurf, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha);
}
