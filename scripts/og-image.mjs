/**
 * Generates the social share cards from the REAL ContourField shader.
 *
 *   pnpm og
 *
 * The GLSL is not duplicated here — it is read straight out of
 * src/components/v2/ContourField.tsx at run time, so the card and the live
 * page can never drift apart. Change the shader, re-run this, and the card
 * follows. If the regex below stops matching, that is the file having been
 * restructured, and this fails loudly rather than silently shipping a stale
 * picture.
 *
 * Why a browser: the shader needs a real WebGL2 context, and the type needs
 * Bodoni Moda. Playwright's Chromium gives both, and renders the fonts with
 * the same rasteriser the site uses.
 *
 * Output: public/og/{home,hire}-{light,dark}.png at 1200x630, the size
 * LinkedIn, Slack, iMessage and X all key on.
 */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src/components/v2/ContourField.tsx');
const OUT = resolve(ROOT, 'public/og');

/* ---- one source of truth: pull the shaders out of the component ---- */
const component = readFileSync(SRC, 'utf8');
const grab = (name) => {
  const m = new RegExp('const ' + name + ' = `([\\s\\S]*?)`;').exec(component);
  if (!m) throw new Error(`Could not find ${name} in ${SRC} — has the file been restructured?`);
  return m[1];
};
const VERT = grab('VERT');
const FRAG = grab('FRAG');

/* ---- palettes, mirroring the tokens in v2.css ---- */
const LIGHT = {
  paper: 'fcfbf9', ink: '0d0d0c', accent: '0b5c55',
  muted: '#545049', sub: '#2e2e2c', dark: false,
};
const DARK = {
  paper: '131311', ink: 'f4f2ec', accent: '6fd0c2',
  muted: '#aaa59c', sub: '#dcd8cf', dark: true,
};

const CARDS = [
  {
    file: 'home',
    eyebrow: 'PORTFOLIO', dot: false,
    head: ['Frank Young'],
    sub: 'Design and engineering — products built end to end.',
  },
  {
    file: 'hire',
    eyebrow: 'AVAILABLE FOR WORK', dot: true,
    head: ['I design', 'and build.'],
    sub: 'Contract, freelance or full-time — San Francisco Bay Area.',
  },
];

/*
 * Two values below are deliberately NOT the live page's:
 *
 *  intensity 0.72 — the haze and the peak share a centre in the shader, so
 *    at full intensity the cloud swallows its own summit. On a static card
 *    there is no cursor moving it off, so it is eased back until the
 *    contour rings read.
 *  weight 0.70 — the field is multiplied over itself. The shader's 16% line
 *    weight is tuned for a full-screen ground behind live text; a share card
 *    is seen at ~550px in a feed, where those hairlines vanish. Same drawing,
 *    heavier stroke, the way a print hairline is set heavier than a screen one.
 */
const RENDER = { time: 30, ptr: [1010, 350], intensity: 0.72, weight: 0.7 };

const page_fn = async ({ VERT, FRAG, card, theme, R }) => {
  const W = 1200, H = 630, M = 88;
  const hex = (h) => {
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  const gc = document.createElement('canvas');
  gc.width = W; gc.height = H;
  const gl = gc.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('no WebGL2 in this Chromium — try --enable-unsafe-swiftshader');
  const sh = (ty, s) => {
    const o = gl.createShader(ty);
    gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o));
    return o;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(pr, n);
  gl.viewport(0, 0, W, H);
  gl.uniform2f(U('uRes'), W, H);
  gl.uniform1f(U('uTime'), R.time);
  gl.uniform2f(U('uPointer'), R.ptr[0], R.ptr[1]);
  gl.uniform1f(U('uIntensity'), R.intensity);
  gl.uniform3f(U('uPaper'), ...hex(theme.paper));
  gl.uniform3f(U('uInk'), ...hex(theme.ink));
  gl.uniform3f(U('uAccent'), ...hex(theme.accent));
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(gc, 0, 0);
  x.globalAlpha = R.weight;
  x.globalCompositeOperation = theme.dark ? 'lighten' : 'multiply';
  x.drawImage(gc, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';

  const accent = '#' + theme.accent;
  let y = 150;
  x.font = '500 21px Archivo, sans-serif';
  x.letterSpacing = '3.4px';
  if (card.dot) {
    x.beginPath(); x.arc(M + 6, y - 7, 6, 0, 6.284); x.fillStyle = accent; x.fill();
    x.fillStyle = theme.muted;
    x.fillText(card.eyebrow, M + 28, y);
  } else {
    x.fillStyle = theme.muted;
    x.fillText(card.eyebrow, M, y);
  }
  x.letterSpacing = '0px';

  x.fillStyle = '#' + theme.ink;
  x.font = '400 116px "Bodoni Moda", serif';
  // A two-line headline is lifted so it does not crowd the footer.
  y = card.head.length > 1 ? 268 : 292;
  card.head.forEach((ln) => { x.fillText(ln, M - 4, y); y += 118; });

  const ruleY = y - 52;
  x.strokeStyle = accent; x.lineWidth = 2;
  x.beginPath(); x.moveTo(M, ruleY); x.lineTo(M + 96, ruleY); x.stroke();

  x.font = '400 25px Archivo, sans-serif';
  x.fillStyle = theme.sub;
  x.fillText(card.sub, M, ruleY + 46);

  x.font = '500 20px Archivo, sans-serif';
  x.letterSpacing = '2.6px';
  x.fillStyle = theme.muted;
  x.fillText('FRANKYOUNG.DEV', M, H - 62);
  x.letterSpacing = '0px';

  return c.toDataURL('image/png');
};

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1300, height: 700 } });

// A real document so the webfonts load and rasterise the way the site's do.
await page.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500&family=Archivo:wght@400;500&display=swap">
</head><body></body></html>`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.load('400 116px "Bodoni Moda"');
  await document.fonts.load('500 21px Archivo');
  await document.fonts.ready;
});

mkdirSync(OUT, { recursive: true });
for (const card of CARDS) {
  for (const [name, theme] of [['light', LIGHT], ['dark', DARK]]) {
    const url = await page.evaluate(page_fn, { VERT, FRAG, card, theme, R: RENDER });
    const out = resolve(OUT, `${card.file}-${name}.png`);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', out.replace(ROOT + '/', ''));
  }
}

await browser.close();
