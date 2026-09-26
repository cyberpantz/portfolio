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
  /*
   * The spring, and the pair of numbers that decide whether this feels
   * alive or underwater.
   *
   * They are not free parameters — they are a frequency and a damping
   * ratio in disguise. Natural frequency is sqrt(stiffness); the damping
   * ratio is (1 - damping) / (2·ω·dt) at 60fps. The first version ran at
   * stiffness 5.2, which is ω = 2.3 rad/s: a natural period of nearly three
   * seconds, and critically damped on top. Every response was correct and
   * arrived far too late to feel like a response at all.
   *
   * 64 gives ω = 8 rad/s, a period of 0.79s, and 0.82 damping puts ζ at
   * 0.68 — under one, so there is a little overshoot left. That overshoot
   * is not a defect to tune out: it is the ears carrying past the skull and
   * coming back, and it is most of what makes the movement read as an
   * animal rather than a transform.
   */
  stiffness: 64,
  damping: 0.82,

  /*
   * Breeze force — and it had to go up with the spring.
   *
   * A steady force displaces a spring by F/k, so stiffening the spring
   * twelvefold without touching this would have divided the breeze by
   * twelve and left the cat standing in dead air.
   */
  breeze: 0.9,
  /* How fast the breeze pattern travels. Slow — a breeze, not a gale. */
  breezeSpeed: 0.42,

  /*
   * How far the head will go, in radians.
   *
   * A cat's head is not a turret. Past about 25 degrees of in-plane nod the
   * silhouette stops reading as a head at an angle and starts reading as a
   * head coming off, and past 40 of yaw a single profile has run out of
   * shape to foreshorten. Both are limits of the drawing, not of the cat.
   */
  nodMax: 0.40,
  yawMax: 0.70,
  pawMax: 0.52,

  /*
   * Stealth.
   *
   * `notice` is how far the pointer must move before the cat re-aims at
   * all. It is the whole difference between watching and tracking: without
   * it the head glides continuously and reads as a servo following a
   * magnet. With it, the cat holds still, then commits.
   *
   * `ease` is the time constant of that commitment, in seconds. It was
   * 0.55, which on top of a slow spring meant the head was still arriving
   * a second and a half after you moved. A cat's head turn takes about a
   * quarter of a second; the stillness before it is what makes it stealthy,
   * not the slowness of the turn itself.
   */
  notice: 0.10,
  noticeDelay: 0.08,
  ease: 0.20,
  pawNotice: 0.14,
  pawEase: 0.28,
  /* How close the pointer must come before a paw is worth moving for. */
  pawRange: 0.52,

  /*
   * The bloom: seconds from one point of light to a whole cat.
   *
   * Unhurried, because it is the first thing anyone sees and it is the only
   * time the piece gets to show that the cat is made of something. Rushed,
   * it looks like a loading state.
   */
  bloom: 2.4,
  /* How much of that time is spent waiting, per unit of distance from the
     origin. Nought would grow every part at once — a cat inflating. This
     staggers it so the shape unfurls outward from the middle. */
  bloomStagger: 0.55,

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

/*
 * Shared by both shaders, so the breeze the simulation applies, the ripple
 * the renderer draws, and the pose they both have to agree on come from one
 * description rather than two that drift apart.
 */
const FIELD = /* glsl */ `
  uniform vec2  uNeck;
  uniform vec2  uElbow;
  uniform float uHeadCx;
  uniform float uHeadR;
  uniform float uYaw;
  uniform float uNod;
  uniform float uPaw;
  uniform float uBloom;
  uniform float uBloomStagger;

  /*
   * Growth, per particle.
   *
   * Everything starts at the origin and the cat scales out of it. Each
   * particle waits in proportion to how far it has to go, so the shape
   * unfurls from the middle outward rather than inflating uniformly — the
   * difference between something growing and something being resized.
   */
  float grown(vec2 home) {
    float d = clamp(length(home) / 1.05, 0.0, 1.0) * uBloomStagger;
    return smoothstep(d, d + (1.0 - uBloomStagger), uBloom);
  }

  /*
   * The head, posed.
   *
   * Two rotations, and they are different in kind. The nod is a plain
   * in-plane turn about the neck — a cat raising its chin really is that,
   * seen from the side. The yaw is not: turning to face you rotates through
   * the screen, and a flat silhouette rotated that way would simply get
   * thinner and vanish.
   *
   * So the head is first given depth it does not have. Each particle is
   * lifted onto a half-cylinder of radius uHeadR about the vertical axis
   * through the head — the particles near the middle of the skull come
   * toward the viewer, the ones at the edge stay put. Rotating THAT
   * foreshortens: the muzzle swings toward you and compresses, the back of
   * the skull swings away. Which is what a head turning looks like.
   *
   * Returns the posed position in xy and the depth it gained in z, relative
   * to the flat rest pose, so that at rest it contributes nothing.
   */
  vec3 headPose(vec2 home, float w) {
    if (w <= 0.0) return vec3(home, 0.0);

    float dx = home.x - uHeadCx;
    float z  = sqrt(max(0.0, uHeadR * uHeadR - dx * dx));
    float cy = cos(uYaw), sy = sin(uYaw);
    vec2  p  = vec2(uHeadCx + dx * cy + z * sy, home.y);
    float z2 = -dx * sy + z * cy;

    vec2 q = p - uNeck;
    float cn = cos(uNod), sn = sin(uNod);
    q = vec2(q.x * cn - q.y * sn, q.x * sn + q.y * cn);

    return vec3(mix(home, uNeck + q, w), (z2 - z) * w);
  }

  /* The paw, swung from the elbow. One rotation, because a cat reaching is
     one rotation — the shoulder does the work and the foot follows. */
  vec2 pawPose(vec2 home, float w) {
    if (w <= 0.0) return home;
    vec2 q = home - uElbow;
    float c = cos(uPaw * w), s = sin(uPaw * w);
    return uElbow + vec2(q.x * c - q.y * s, q.x * s + q.y * c);
  }

  vec3 pose(vec2 home, float wHead, float wPaw) {
    vec3 h = headPose(home, wHead);
    float g = grown(home);
    return vec3(pawPose(h.xy, wPaw) * g, h.z * g);
  }

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
  uniform float uTime;
  uniform float uDt;
  uniform float uStiff;
  uniform float uDamp;
  uniform float uBreeze;
  uniform float uBreezeSpeed;
  varying vec2 vUv;
  ${FIELD}

  void main() {
    vec4 s = texture2D(uState, vUv);
    vec2 off = s.xy;
    vec2 vel = s.zw;

    vec4 hm = texture2D(uHome, vUv);
    vec2 home = hm.xy;
    float wHead = hm.z;
    float wPaw  = hm.w;

    /*
     * The particle is not sprung to where it started. It is sprung to where
     * that part of the cat currently IS.
     *
     * This is the whole mechanism. The head's pose is recomputed every frame
     * from the pointer, the spring chases it, and the chasing is what makes
     * the movement look like an animal rather than a transform: the ears
     * arrive after the skull, the field lags and then catches up, and none
     * of that had to be animated. It falls out of the same spring that
     * gathers the cat at load.
     */
    vec2 target = pose(home, wHead, wPaw).xy - home;

    /*
     * The breeze is sampled at HOME, not where the particle currently is.
     *
     * Sampling at the live position couples the force field to the thing it
     * is moving — particles blown into a crest get blown harder, and the
     * field boils. At home it is a standing pattern the sheet rides over,
     * which is stable and is what cloth on a line actually does.
     */
    vec2 f = breeze(home, uTime * uBreezeSpeed) * uBreeze;

    /* Hooke, toward the posed place. */
    f -= (off - target) * uStiff;

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

  /* Cheap per-particle noise, so size and shade vary without a second
     texture lookup. The home texture's spare channels went to the part
     weights, which earn them more. */
  float hash12(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  void main() {
    vec4 st = texture2D(uState, aRef);
    vec4 hm = texture2D(uHome, aRef);
    vec2 p = hm.xy + st.xy;
    vSeed = hash12(aRef);

    float t = uTime * uWaveSpeed;
    /* The sheet ripple, plus whatever depth the turned head has gained.
       Both are stateless: a wave and a rotation are each a function of
       where you are and what the clock says. */
    float z = sheet(p, t) * uWave + pose(hm.xy, hm.z, hm.w).z;

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
    gl_PointSize = uSize * uScale * (0.7 + 0.6 * vSeed) * (1.0 / max(0.25, -mv.z));
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
