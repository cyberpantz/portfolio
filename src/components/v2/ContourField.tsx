import { useEffect, useRef } from 'react';

/**
 * A contour survey that bulges toward the pointer.
 *
 * The field is fbm noise plus a soft Gaussian peak under the cursor, drawn as
 * isolines — every fifth one heavier, the way an index contour is drawn on a
 * real map. It is one implementation carrying three meanings for this
 * portfolio specifically: a technical drawing in hairlines, which is the
 * editorial system already in use; the terrain work in the weather
 * experiment, which derives real relief from elevation samples; and a field
 * diagram, since isolines and equipotential lines are the same mathematics
 * and sixteen years of this CV is solar, inverters and EV charging.
 *
 * Restraint rules, all deliberate:
 *   · lines sit at ~16% of ink — it is ground, never figure
 *   · the pointer is EASED over roughly two seconds, never tracked; a
 *     background that follows the cursor exactly reads as a toy
 *   · the field drifts on a ~2 minute cycle, so it is never quite static
 *     and never noticeably moving
 *   · prefers-reduced-motion renders one considered frame and stops
 *   · hidden tab cancels the loop entirely
 *   · no WebGL, or a context loss, leaves the page completely intact
 */

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;   // eased, pixels
uniform float uIntensity; // 0..1 fade-in
uniform vec3  uPaper;
uniform vec3  uInk;
uniform vec3  uAccent;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 43.21);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// Three octaves is plenty for a soft mask, and the haze needs two of
// these per pixel — at five octaves each they would cost more than the
// terrain itself.
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y;          // aspect-correct
  float t = uTime * 0.008;                      // ~2 min to cross the field

  float field = fbm(uv * 2.2 + vec2(t, t * 0.6));

  // The cursor is a hill, not a highlight. Radius in screen heights so the
  // summit is the same size on any display.
  vec2 pm = uPointer / uRes.y;
  float d = distance(uv, pm);
  float peak = exp(-(d * d) / (2.0 * 0.30 * 0.30)) * 0.38;
  field += peak;

  // Isolines. fwidth keeps them one pixel at any DPR — without it they
  // thicken on retina and crawl when the field moves.
  float LINES = 26.0;
  float f = field * LINES;
  // max() guards the divide where the field is momentarily flat.
  float dist = abs(fract(f) - 0.5) / max(fwidth(f), 1e-5);
  float line = 1.0 - smoothstep(0.0, 1.5, dist);

  // Every fifth contour is an index line, as on a survey sheet. Lines sit
  // at fract(f) == 0.5, mid-band, so floor(f) is stable along one line and
  // numbers it — no risk of the weight flickering across its own width.
  float index = step(mod(floor(f), 5.0), 0.5);
  line *= mix(0.55, 1.0, index);

  // --- reading haze ---------------------------------------------------
  // A cloud travelling with the pointer. It SOFTENS the contour weight
  // rather than painting over it: type under the cursor gets a quieter
  // ground, and the summit still reads through, the way a peak reads
  // through cloud. Erasing outright was tried and it killed the best part
  // of the picture — the cursor's own summit sits in exactly this spot.
  // Radius in screen-heights, so the cloud is the same size on any
  // display. 0.66 is the ceiling that still reads as a cloud — past about
  // 0.85 the lobed edge runs off the viewport and it just looks like the
  // whole page faded.
  vec2 hp = (uv - pm) / 0.66;
  float hr = length(hp);
  // Amorphous edge. Sampled in the POINTER's frame so the cloud carries
  // its shape along instead of the cursor sliding across a fixed stain.
  // Low frequency on purpose: big lobes, not fizz.
  //
  // 0.44, not 0.5: three octaves of value noise average 0.5 * 0.875, so
  // subtracting a half would bias the whole cloud permanently outward.
  hr += (fbm3(hp * 1.3 + vec2(uTime * 0.05, uTime * 0.037)) - 0.44) * 0.70;
  float haze = pow(1.0 - smoothstep(0.10, 1.0, hr), 1.4);
  // Internal density, so the interior is vapour and not a flat wash.
  haze *= 0.78 + 0.22 * fbm3(hp * 2.6 + vec2(uTime * 0.03, -uTime * 0.041));
  haze *= uIntensity;
  // Eased back from 0.66 now that the cloud is larger: at this radius it
  // fully envelops the cursor's own summit, and at the old strength the
  // peak and its accent ring disappeared inside it.
  line *= 1.0 - haze * 0.60;

  vec3 col = mix(uPaper, uInk, line * 0.16 * uIntensity);

  // Accent only on the summit, so the pointer reads as elevation rather
  // than as a glow following the mouse.
  // Broad enough to tint the whole summit, not just the single ring at
  // its apex — peak tops out at 0.38, so a threshold near that lights
  // almost nothing.
  float crown = smoothstep(0.10, 0.30, peak);
  col = mix(col, mix(col, uAccent, 0.55), crown * line * uIntensity);

  // The cloud needs its own value. Suppressing lines alone takes at most
  // 8% ink out of a 16% ground, and an ABSENCE of hairlines on paper is
  // not something the eye registers — the first version of this was
  // invisible on screen for exactly that reason. A faint body at ~4% ink
  // is what makes it read as fog rather than as nothing, and it is light
  // enough that body copy over it stays comfortably AAA.
  col = mix(col, mix(uPaper, uInk, 0.042), haze);

  // Dither — a 16%-contrast gradient bands badly without it.
  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

/*
 * Tokens are handed to the shader as plain sRGB 0..1 — NOT decoded to
 * linear light.
 *
 * This was linear once and it was wrong. The shader writes to an ordinary
 * 8-bit canvas, which the compositor reads as sRGB, and nothing here
 * encodes back on the way out — so linear values were being displayed as
 * though they were sRGB. In light mode the error hides, because those
 * values sit high on the curve where the two spaces nearly agree. In dark
 * mode it was ruinous: a #131311 ground rendered #020201, near-black and
 * visibly not the page's own background, and the contour lines went with
 * it at about 1.33:1.
 *
 * Mixing in sRGB is not physically correct for light transport, but these
 * are UI tints, it is what CSS itself does, and the palette's contrast
 * ratios were all computed in sRGB to begin with. Measured after the
 * change: light lines 1.36:1, dark 1.52:1 — the two themes finally agree,
 * and the ground matches --paper exactly, which is what lets the canvas
 * disappear into the page where there are no lines.
 */
function readTheme(el: HTMLElement) {
  const cs = getComputedStyle(el);
  const parse = (name: string, fallback: [number, number, number]) => {
    const raw = cs.getPropertyValue(name).trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(raw);
    if (!m) return fallback;
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as [
      number,
      number,
      number,
    ];
  };
  return {
    // Light-theme values, used only if a token is missing or malformed.
    paper: parse('--paper', [0.988, 0.984, 0.976]),
    ink: parse('--ink', [0.051, 0.051, 0.047]),
    accent: parse('--accent', [0.043, 0.361, 0.333]),
  };
}

export default function ContourField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    // No WebGL2 is not an error state — the page is complete without this.
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      pointer: gl.getUniformLocation(prog, 'uPointer'),
      intensity: gl.getUniformLocation(prog, 'uIntensity'),
      paper: gl.getUniformLocation(prog, 'uPaper'),
      ink: gl.getUniformLocation(prog, 'uInk'),
      accent: gl.getUniformLocation(prog, 'uAccent'),
    };

    // A full-screen shader at 3x is wasted battery for a background.
    const DPR = Math.min(devicePixelRatio || 1, 1.75);
    const resize = () => {
      const w = Math.floor(innerWidth * DPR);
      const h = Math.floor(innerHeight * DPR);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U.res, canvas.width, canvas.height);
    };
    addEventListener('resize', resize, { passive: true });
    resize();

    /* The colours come from the live CSS variables, so this follows the theme
       toggle rather than carrying its own palette — the mistake that made the
       weather HUD unreadable was hardcoding colour away from its ground. */
    const applyTheme = () => {
      const { paper, ink, accent } = readTheme(document.documentElement);
      gl.useProgram(prog);
      gl.uniform3f(U.paper, ...paper);
      gl.uniform3f(U.ink, ...ink);
      gl.uniform3f(U.accent, ...accent);
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', applyTheme);

    // Start the summit off-centre rather than at 0,0, so an untouched page
    // still has a composition.
    const target = { x: innerWidth * 0.7 * DPR, y: innerHeight * 0.62 * DPR };
    const eased = { ...target };
    const onMove = (e: PointerEvent) => {
      target.x = e.clientX * DPR;
      target.y = (innerHeight - e.clientY) * DPR; // GL origin is bottom-left
    };
    addEventListener('pointermove', onMove, { passive: true });

    let intensity = 0;
    let raf = 0;
    let running = false;
    const t0 = performance.now();

    const frame = (now: number) => {
      eased.x += (target.x - eased.x) * 0.02; // ~2s to settle
      eased.y += (target.y - eased.y) * 0.02;
      intensity += (1 - intensity) * 0.02;

      gl.uniform1f(U.time, (now - t0) / 1000);
      gl.uniform2f(U.pointer, eased.x, eased.y);
      gl.uniform1f(U.intensity, intensity);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!running && !reduced) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    if (reduced) {
      // One considered frame: the composition, without the motion.
      gl.uniform1f(U.time, 30);
      gl.uniform2f(U.pointer, eased.x, eased.y);
      gl.uniform1f(U.intensity, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      start();
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stop();
      removeEventListener('resize', resize);
      removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
      scheme.removeEventListener('change', applyTheme);
      themeObserver.disconnect();
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, []);

  /*
   * z-0, NOT -z-10.
   *
   * v2.css sets a background on `html` AND on `body`. Once the root has its
   * own background, body's stops propagating to the canvas and paints as
   * body's own box background instead — and CSS paint order puts in-flow
   * block backgrounds (step 3) AFTER negative-z-index descendants (step 2).
   * A `-z-10` canvas is therefore painted over by body's opaque paper and
   * is invisible, with no error to show for it.
   *
   * At z-0 the canvas is a positioned element painting in step 4, above
   * body's background; the header and main sit at z-10 above the canvas.
   *
   * pointer-events-none so a drag across a gap in the content still
   * selects text rather than hitting the canvas.
   */
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 size-full"
      style={{ background: 'var(--paper)' }}
    />
  );
}
