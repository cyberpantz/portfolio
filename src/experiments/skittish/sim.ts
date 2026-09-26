/**
 * The shaders, and the numbers that make the field feel like cloth.
 *
 * ── Why the state lives on the GPU ──────────────────────────────────────
 *
 * A hundred thousand particles cannot be integrated in JavaScript at sixty
 * frames a second. So each particle's offset-from-home and velocity live in
 * one RGBA texel, and a fragment shader advances every one of them in a
 * single pass. The pass ping-pongs between two targets because a shader
 * cannot read the texture it is writing.
 *
 * ── Why only the offset has state ───────────────────────────────────────
 *
 * The Z ripple — the cloth waving toward and away from you — is computed
 * fresh in the vertex shader every frame and stored nowhere. A travelling
 * wave has no memory: its height at a point is a function of that point and
 * the clock, and nothing else. Only the XY response needs history, because
 * that is where the pointer wake and the settling-back live, and those are
 * exactly the things a reader would notice arriving instantly.
 */

export const PARAMS = {
  /* Spring pulling each particle to its place in the cat. Higher snaps back
     faster and makes the animal feel stiffer — more paper than cloth. */
  stiffness: 5.2,
  /* Velocity retained per frame. This is the single most expressive number
     here: below about 0.86 the field is damp sand, above 0.94 it sloshes
     and never settles. */
  damping: 0.905,

  /* Breeze force. Cloth, not confetti: the waves are long relative to the
     cat, so neighbours move together and the whole flank lifts at once. */
  breeze: 0.085,
  /* How fast the breeze pattern travels. Slow — a breeze, not a gale. */
  breezeSpeed: 0.42,

  /* Pointer. `radius` is in field units where the cat is about 1.7 across,
     so 0.28 is a hand's width rather than a gust. */
  radius: 0.28,
  push: 2.4,

  /* Depth of the Z ripple, and how hard it shades. Without the shading the
     ripple is invisible: a wave seen face-on displaces nothing you can see
     until something varies with its slope. */
  wave: 0.16,
  waveSpeed: 0.62,

  /* Particle size in pixels at the reference distance, and the spread of
     per-particle jitter around it. Uniform sizes read as a printed halftone;
     a little variance reads as dust. */
  size: 2.6,
  sizeJitter: 0.55,
} as const;

/* Shared by both shaders, so the breeze the simulation applies and the
   ripple the renderer draws come from one description of the same air. */
const FIELD = /* glsl */ `
  vec2 breeze(vec2 p, float t) {
    float a = sin(p.x * 2.6 + t * 0.55) + sin(p.y * 1.9 - t * 0.41);
    float b = sin((p.x + p.y) * 3.7 - t * 0.73);
    float c = sin(p.y * 5.2 + t * 0.95);
    return vec2(a * 0.35 + c * 0.12, b * 0.28 + a * 0.08);
  }
  float sheet(vec2 p, float t) {
    return sin(p.x * 3.0 + t * 0.80) * 0.52
         + sin(p.y * 2.2 - t * 0.61) * 0.34
         + sin((p.x - p.y) * 4.6 + t * 1.10) * 0.14;
  }
`;

export const SIM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const SIM_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uState;
  uniform sampler2D uHome;
  uniform vec2  uPointer;
  uniform float uPointerOn;
  uniform float uTime;
  uniform float uDt;
  uniform float uStiff;
  uniform float uDamp;
  uniform float uBreeze;
  uniform float uBreezeSpeed;
  uniform float uRadius;
  uniform float uPush;
  varying vec2 vUv;
  ${FIELD}

  void main() {
    vec4 s = texture2D(uState, vUv);
    vec2 off = s.xy;
    vec2 vel = s.zw;
    vec2 home = texture2D(uHome, vUv).xy;

    /*
     * The breeze is sampled at HOME, not at the particle's current place.
     *
     * Sampling where the particle actually is couples the force field to the
     * thing the force field is moving, which is a feedback loop: particles
     * blown into a crest get blown harder, and the field boils. Sampling at
     * home makes it a standing pattern the sheet rides over, which is both
     * stable and what cloth on a line actually does.
     */
    vec2 f = breeze(home, uTime * uBreezeSpeed) * uBreeze;

    /*
     * Pointer repulsion, falling off as a gaussian rather than as 1/r².
     *
     * An inverse square has no natural edge — it is either clipped, which
     * gives a visible circular seam in the field, or unbounded, which throws
     * the nearest particles off screen. A gaussian reaches zero smoothly, so
     * the disturbance has a soft boundary and no particle is ever launched.
     */
    vec2 d = (home + off) - uPointer;
    float r = length(d);
    float falloff = exp(-(r * r) / (uRadius * uRadius));
    f += (d / max(r, 1e-4)) * falloff * uPush * uPointerOn;

    /* Hooke, toward the cat. This is the whole of "flows back". */
    f -= off * uStiff;

    vel = (vel + f * uDt) * uDamp;
    off += vel * uDt;

    gl_FragColor = vec4(off, vel);
  }
`;

export const DRAW_VERT = /* glsl */ `
  precision highp float;
  uniform sampler2D uState;
  uniform sampler2D uHome;
  uniform float uTime;
  uniform float uSize;
  uniform float uWave;
  uniform float uWaveSpeed;
  uniform float uScale;
  attribute vec2 aRef;
  varying float vShade;
  varying float vSeed;
  ${FIELD}

  void main() {
    vec4 st = texture2D(uState, aRef);
    vec4 hm = texture2D(uHome, aRef);
    vec2 p = hm.xy + st.xy;
    vSeed = hm.w;

    float t = uTime * uWaveSpeed;
    float z = sheet(p, t) * uWave;

    /*
     * Shade by the sheet's SLOPE, not its height.
     *
     * Seen face-on, a wave moving toward and away from the camera changes
     * almost nothing: the particles shift a few pixels and the shape is
     * identical. What a real cloth shows is light — faces tilted toward the
     * source brighten, faces tilted away fall off. A finite difference gives
     * that tilt for the cost of two more evaluations, and it is the whole
     * reason the field reads as a surface rather than as a flat spray.
     */
    float e = 0.06;
    float dx = sheet(p + vec2(e, 0.0), t) - sheet(p - vec2(e, 0.0), t);
    float dy = sheet(p + vec2(0.0, e), t) - sheet(p - vec2(0.0, e), t);
    vec3 n = normalize(vec3(-dx * uWave, -dy * uWave, 2.0 * e));
    vShade = clamp(0.42 + 0.58 * dot(n, normalize(vec3(-0.35, 0.55, 0.78))), 0.0, 1.4);

    vec4 mv = modelViewMatrix * vec4(p, z, 1.0);
    gl_Position = projectionMatrix * mv;
    /* Perspective size attenuation, and a per-particle jitter so the field
       reads as dust rather than as a printed halftone. */
    gl_PointSize = uSize * uScale * (0.7 + 0.6 * hm.z) * (1.0 / max(0.25, -mv.z));
  }
`;

export const DRAW_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uAlpha;
  varying float vShade;
  varying float vSeed;

  void main() {
    /* Round, and soft at the rim. A square point at this density reads as a
       grid the instant two of them line up. */
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.15, d);
    gl_FragColor = vec4(uInk * vShade, a * uAlpha);
  }
`;
