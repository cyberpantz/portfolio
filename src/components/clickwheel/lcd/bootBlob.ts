// Boot / loading animation for the click-wheel player LCD.
// 1-bit line-art potato walking across a 176x132 logical screen, rasterised at 2x.
// Routines: 'flips', 'moonwalk', 'robot' — one per crossing, in order.
// No DOM assumptions: give render() an ImageData of RASTER_W x RASTER_H and a frame number.

export type RGB = [number, number, number];
export type BootBlobPalette = { bg: RGB; row: RGB; ink: RGB };
export type Dance = 'flips' | 'moonwalk' | 'robot';
export type BootBlobOptions = {
  message?: string;
  fps?: number;            // animation clock, default 12
  scanlines?: boolean;
  palette?: Partial<BootBlobPalette>;
  dances?: Dance[];        // played in order, one per crossing; default all three
  crossSeconds?: Partial<Record<Dance, number>>;
  flipAt?: number[];       // fractions of a flips crossing where he flips
  flipSeconds?: number;
};

export const LCD_W = 176;
export const LCD_H = 132;
export const LCD_S = 2;
export const RASTER_W = LCD_W * LCD_S;
export const RASTER_H = LCD_H * LCD_S;

export const DEFAULT_PALETTE: BootBlobPalette = {
  bg:  [0xc9, 0xd6, 0xe9],
  row: [0xd3, 0xdf, 0xef],
  ink: [0x1e, 0x2d, 0x5c],
};

export function createBootBlob(opts: BootBlobOptions = {}) {
  const W = LCD_W, H = LCD_H, S = LCD_S, BW = RASTER_W, BH = RASTER_H;
  const FPS = opts.fps ?? 12;
  const MESSAGE = opts.message ?? 'TWERKALIZING... PLEASE WAIT';
  const SCANLINES = opts.scanlines ?? true;
  const PAL: BootBlobPalette = { ...DEFAULT_PALETTE, ...opts.palette };
  const DANCES: Dance[] = opts.dances?.length ? opts.dances : ['flips', 'moonwalk', 'robot'];
  const CROSS: Record<Dance, number> = { flips: 6, moonwalk: 6, robot: 8, ...opts.crossSeconds };
  const FLIP_AT = opts.flipAt ?? [0.3, 0.68];
  const FLIP_LEN = opts.flipSeconds ?? 0.7;
  const BRUSH: [number, number][] = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];

  let px: Uint8ClampedArray = new Uint8ClampedArray(0);


  function clear() {
    for (let y = 0; y < BH; y++) {
      const c = (SCANLINES && ((y / S) | 0) % 3 === 2) ? PAL.row : PAL.bg;
      for (let x = 0; x < BW; x++) {
        const i = (y * BW + x) * 4;
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
      }
    }
  }
  function plot(bx: any, by: any) {                 // raw raster pixel
    if (bx < 0 || by < 0 || bx >= BW || by >= BH) return;
    const i = (by * BW + bx) * 4;
    px[i] = PAL.ink[0]; px[i + 1] = PAL.ink[1]; px[i + 2] = PAL.ink[2];
  }
  function dab(bx: any, by: any) { for (const [ox, oy] of BRUSH) plot(bx + ox, by + oy); }
  function set(x: any, y: any) { dab(Math.round(x * S), Math.round(y * S)); }   // logical pixel, brushed
  function line(x0: any, y0: any, x1: any, y1: any) {
    x0 = Math.round(x0 * S); y0 = Math.round(y0 * S); x1 = Math.round(x1 * S); y1 = Math.round(y1 * S);
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dab(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function poly(pts: any, close = true) {
    for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (close) line(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]);
  }
  // outline of a (possibly wobbly, tilted) ellipse; rFn(theta) returns radius scale
  function ellipse(cx: any, cy: any, rx: any, ry: any, a0 = 0, a1 = Math.PI * 2, rFn: ((th: number) => number) | null = null, tilt = 0) {
    const n = Math.max(12, Math.ceil(Math.max(rx, ry) * S * 2.2 * Math.abs(a1 - a0) / Math.PI));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = a0 + (a1 - a0) * i / n;
      const s = rFn ? rFn(th) : 1;
      let x = Math.cos(th) * rx * s, y = Math.sin(th) * ry * s;
      if (tilt) { const c = Math.cos(tilt), sn = Math.sin(tilt); [x, y] = [x * c - y * sn, x * sn + y * c]; }
      pts.push([cx + x, cy + y]);
    }
    poly(pts, false);
  }
  function circle(cx: any, cy: any, r: any) { ellipse(cx, cy, r, r); }
  function rect(x: any, y: any, w: any, h: any) { poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
  // ---------- 3x5 pixel font ----------
  const FONT: Record<string, number[]> = {
    A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7], F:[7,4,6,4,4],
    G:[3,4,5,5,3], H:[5,5,7,5,5], I:[7,2,2,2,7], J:[1,1,1,5,2], K:[5,5,6,5,5], L:[4,4,4,4,7],
    M:[5,7,7,5,5], N:[6,5,5,5,5], O:[2,5,5,5,2], P:[6,5,6,4,4], Q:[2,5,5,2,1], R:[6,5,6,5,5],
    S:[3,4,2,1,6], T:[7,2,2,2,2], U:[5,5,5,5,7], V:[5,5,5,5,2], W:[5,5,7,7,5], X:[5,5,2,5,5],
    Y:[5,5,2,2,2], Z:[7,1,2,4,7], '.':[0,0,0,0,2], ' ':[0,0,0,0,0], '-':[0,0,7,0,0],
  };
  function text(str: any, x: any, y: any) {
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c))
        for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) plot((x + c) * S + i, (y + r) * S + j);
      x += 4;
    }
  }
  const textWidth = (s: string) => s.length * 4 - 1;

  // ---------- character parts ----------
  function glove(x: any, y: any) {
    circle(x, y, 5);
    circle(x - 4, y - 4, 2); circle(x, y - 6, 2); circle(x + 4, y - 4, 2);
    line(x - 3, y + 5, x + 3, y + 5); // cuff
  }
  function shoe(x: any, y: any, dir = 1) {
    ellipse(x, y, 7, 3);
    line(x - 7 * dir, y, x - 7 * dir, y - 4);       // heel
    line(x - 7 * dir, y - 4, x - 3 * dir, y - 4);
  }
  // two-segment noodle limb with a bent joint (low-budget rigging)
  function limb(x0: any, y0: any, x1: any, y1: any, bend: any) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const jx = mx - dy / len * bend, jy = my + dx / len * bend;
    line(x0, y0, jx, jy); line(jx, jy, x1, y1);
  }
  // draws shoes, legs, gloves, arms for the given hand/foot positions
  function limbs(cx: any, cy: any, sx: any, sy: any, L: any, R: any, lf: any, rf: any) {
    const rx = 22 * sx, ry = 20 * sy;
    shoe(lf[0], lf[1], 1); shoe(rf[0], rf[1], -1);
    limb(cx - 8 * sx, cy + ry * 0.85, lf[0], lf[1] - 3, -3);
    limb(cx + 8 * sx, cy + ry * 0.85, rf[0], rf[1] - 3, 3);
    glove(L[0], L[1]); glove(R[0], R[1]);
    limb(cx - rx * 0.9, cy - 2, L[0] + 3, L[1] + 2, 4);
    limb(cx + rx * 0.9, cy - 2, R[0] - 3, R[1] + 2, -4);
  }
  function drop(x: any, y: any) { set(x, y - 1); set(x - 1, y); set(x + 1, y); set(x - 1, y + 1); set(x, y + 1); set(x + 1, y + 1); }

  function body(cx: any, cy: any, sx: any, sy: any, t: any, tilt: any, pupil: any, dir = 1, face: { eyes?: 'open' | 'closed' | 'wide'; mouth?: 'smile' | 'open' | 'tight'; facing?: 'side' | 'away' | 'camera' } = {}) {
    const { eyes = 'open', mouth = 'smile', facing = 'side' } = face;
    const rx = 22 * sx, ry = 20 * sy;
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const R = (x: number, y: number): [number, number] => [cx + x * c - y * sn, cy + x * sn + y * c];   // rotate a body-local point
    // potato: lopsided lumps that stay put, plus a slow jiggle on top
    const potato = (th: number) => 1
      + 0.14 * Math.cos(th - 0.9)            // one big bulge, low-left
      + 0.09 * Math.cos(2 * th + 2.1)        // slight egg-ish asymmetry
      + 0.05 * Math.cos(3 * th - 0.4)
      + 0.03 * Math.sin(4 * th + t * 3)
      + 0.04 * Math.sin(3 * th + t * 5);     // the original jiggle, softer
    ellipse(cx, cy, rx * 0.96, ry * 1.1, 0, Math.PI * 2, potato, tilt);
    if (facing === 'away') return;                          // back of the head: outline only
    // eyes
    const ex = 8 * sx, ey = -5 * sy;
    for (const side of [-1, 1]) {
      const [x, y] = R(side * ex, ey);
      if (eyes === 'closed') {
        const a = R(side * ex - 3, ey), b = R(side * ex + 3, ey);
        line(a[0], a[1], b[0], b[1]);
      } else {
        circle(x, y, eyes === 'wide' ? 5 : 4);
        const [px_, py_] = R(side * ex + pupil[0], ey + pupil[1]);
        set(px_, py_);
      }
    }
    // nose: points in the walking direction, or a small v when he's looking at you
    if (facing === 'camera') { const n0 = R(-2, -1), n1 = R(0, 2), n2 = R(2, -1); line(n0[0], n0[1], n1[0], n1[1]); line(n1[0], n1[1], n2[0], n2[1]); }
    else { const n0 = R(0, -1), n1 = R(2 * dir, 1), n2 = R(0, 2); line(n0[0], n0[1], n1[0], n1[1]); line(n1[0], n1[1], n2[0], n2[1]); }
    // mouth
    const m = R(0, 3 * sy);
    if (mouth === 'open') ellipse(m[0], m[1] + 3, 4, 5, 0, Math.PI * 2, null, tilt);
    else if (mouth === 'tight') { const a = R(-4, 4 * sy), b = R(4, 4 * sy); line(a[0], a[1], b[0], b[1]); }
    else ellipse(m[0], m[1], 8 * sx, 5 * sy, Math.PI * 0.15, Math.PI * 0.85, null, tilt);
  }

  // moonwalk: faces one way, glides the other. One foot flat sliding back, the other on its toes returning forward.
  function moonwalk(cx: any, floorY: any, face: any, t: any, speed: any, u: any) {
    // the illusion: the flat foot is pinned to the ground (slides back at exactly the travel speed)
    // while the body floats over it; the other foot rides high on its toes and returns to the front.
    const STRIDE = 38;
    const half = STRIDE / speed;                             // seconds for one flat slide
    const cyc = (t / (half * 2)) % 1;
    const cy = floorY - 30;                                  // no bob: he glides
    const feet = [];
    for (const off of [0, 0.5]) {
      const p = (cyc + off) % 1;
      if (p < 0.5) feet.push([cx + face * (STRIDE / 2 - STRIDE * (p / 0.5)), floorY, 0]);       // flat, pinned
      else { const q = (p - 0.5) / 0.5; feet.push([cx + face * (-STRIDE / 2 + STRIDE * q), floorY, Math.sin(q * Math.PI)]); }
    }
    for (const [fx, fy, toe] of feet) {
      if (toe < 0.05) shoe(fx, fy, face);
      else {                                                  // heel high, weight on the toe
        ellipse(fx - face * 2, fy - 2 - toe * 6, 7, 3, 0, Math.PI * 2, null, -face * 0.9 * toe);
        line(fx - face * 8, fy - 3 - toe * 11, fx - face * 8, fy - 7 - toe * 11);
        line(fx - face * 8, fy - 7 - toe * 11, fx - face * 4, fy - 7 - toe * 11);
      }
    }
    // legs: long and straight over the flat foot, knee up on the toe foot
    limb(cx - 6, cy + 17, feet[0][0], feet[0][1] - 3 - feet[0][2] * 9, (1 + feet[0][2] * 5) * -face);
    limb(cx + 6, cy + 17, feet[1][0], feet[1][1] - 3 - feet[1][2] * 9, (1 + feet[1][2] * 5) * face);
    // arms hang loose, drifting against the feet
    const sway = Math.sin(t * Math.PI / half) * 3;
    const L = [cx - 30 + sway, cy + 12], R = [cx + 30 + sway, cy + 12];
    glove(L[0], L[1]); glove(R[0], R[1]);
    limb(cx - 20, cy - 2, L[0] + 3, L[1] - 3, 3); limb(cx + 20, cy - 2, R[0] - 3, R[1] - 3, -3);
    // starts with his back to you, turns side-on, then looks straight at you for the finish
    const facing = u < 0.22 ? 'away' : u < 0.72 ? 'side' : 'camera';
    const tilt = -0.3 * face;
    body(cx, cy, 1, 1, t, tilt, facing === 'camera' ? [0, 0] : [face, 0], face,
      { facing, mouth: facing === 'camera' ? 'smile' : 'tight' });
    // wide-brimmed hat, pulled low, rotates with the lean
    const c = Math.cos(tilt), sn = Math.sin(tilt);
    const H = (x: number, y: number): [number, number] => [cx + x * c - y * sn, cy + x * sn + y * c];
    const brimY = -19;
    const b0 = H(-22, brimY), b1 = H(-8, brimY - 1), b2 = H(8, brimY - 1), b3 = H(22, brimY + 1 * face);
    line(b0[0], b0[1], b1[0], b1[1]); line(b1[0], b1[1], b2[0], b2[1]); line(b2[0], b2[1], b3[0], b3[1]);
    poly([H(-9, brimY - 1), H(-8, brimY - 13), H(8, brimY - 13), H(9, brimY - 1)], false);   // crown
    const band0 = H(-8, brimY - 5), band1 = H(8, brimY - 5);
    line(band0[0], band0[1], band1[0], band1[1]);                                           // hat band
  }

  // the robot: hard poses held for a few frames, right-angle arms, the odd freeze
  const ROBOT_POSES: [number, number, number, number, number, number][] = [
    //  [leftUpper, leftFore, rightUpper, rightFore, headTilt, squat]  angles in degrees, 0 = right, 90 = down
    [180, -90, 0, -90, 0, 0],
    [180, 90, 0, -90, 0.15, 0],
    [180, 90, 0, 90, -0.15, 4],
    [-90, 180, 0, -90, 0, 0],
    [180, -90, -90, 0, 0.15, 4],
    [180, 180, 0, 0, 0, 0],
    [-90, 180, -90, 0, -0.15, 0],
    [180, 90, 0, 90, 0, 4],
  ];
  function robot(cx: any, floorY: any, dir: any, frame: any, t: any) {
    const HOLD = 4;                                          // frames per pose
    const step = Math.floor(frame / HOLD);
    const freeze = step % 7 === 6;                           // every 7th beat he locks up
    const pose = ROBOT_POSES[(freeze ? step - 1 : step) % ROBOT_POSES.length];
    const jitter = freeze ? (frame % 2 ? 1 : -1) : 0;
    const [lu, lf, ru, rf, head, squat] = pose;
    const x = cx + jitter, cy = floorY - 26 + squat;
    const rad = (d: number) => d * Math.PI / 180;
    // rigid legs, feet planted; squat bends the knees outward
    shoe(x - 10, floorY, 1); shoe(x + 10, floorY, -1);
    limb(x - 7, cy + 18, x - 10, floorY - 3, -squat); limb(x + 7, cy + 18, x + 10, floorY - 3, squat);
    // arms: upper arm from the shoulder, forearm from the elbow, both snapped to 90 degrees
    for (const [side, up, fo] of [[-1, lu, lf], [1, ru, rf]] as [number, number, number][]) {
      const sx0 = x + side * 20, sy0 = cy - 2;
      const ex = sx0 + Math.cos(rad(up)) * 13, ey = sy0 + Math.sin(rad(up)) * 13;
      const hx = ex + Math.cos(rad(fo)) * 12, hy = ey + Math.sin(rad(fo)) * 12;
      line(sx0, sy0, ex, ey); line(ex, ey, hx, hy);
      glove(hx, hy);
    }
    body(x, cy, 1, 1, 0, head, [0, 0], dir, { mouth: 'tight' });   // t = 0 kills the jiggle: he's rigid
    if (freeze && frame % 4 < 2) text('ERR', x - 5, cy - 34);
  }

  // ---------- animation ----------

  // which crossing are we in, and how far through it
  function where(t: number): { crossing: number; dance: Dance; tt: number; len: number } {
    let i = 0, acc = 0;
    for (;;) {
      const len = CROSS[DANCES[i % DANCES.length]];
      if (t < acc + len) return { crossing: i, dance: DANCES[i % DANCES.length], tt: t - acc, len };
      acc += len; i++;
    }
  }

  function draw(frame: number) {
    const t = frame / FPS;
    const floorY = 108, margin = 34;
    const { crossing, dance, tt, len } = where(t);
    const dir = crossing % 2 ? -1 : 1;                 // walk right, then left
    const beat = Math.sin(t * Math.PI * 4);
    const stride = Math.sin(t * Math.PI * 5);
    const sx = 1 + 0.12 * beat, sy = 1 / sx;
    const xAt = (u: number) => dir > 0 ? margin + u * (W - 2 * margin) : W - margin - u * (W - 2 * margin);
    const lift = (f: number) => Math.max(0, f) * 5;

    clear();
    text(MESSAGE, (W - textWidth(MESSAGE)) >> 1, 4);
    line(0, 12, W, 12);
    line(0, floorY + 4, W, floorY + 4);                // ground

    function walk(cx: number, cy: number, moving = true) {
      if (moving) for (let x = ((frame * 2 * -dir) % 12 + 12) % 12; x < W; x += 12) set(x, floorY + 6);
      const st = moving ? stride : 0;
      limbs(cx, cy, sx, sy,
        [cx - 32 - st * 6 * dir, cy + 2 + Math.abs(st) * 2], [cx + 32 - st * 6 * dir, cy + 2 + Math.abs(st) * 2],
        [cx - 8 + st * 6 * dir, floorY - lift(st)], [cx + 8 - st * 6 * dir, floorY - lift(-st)]);
      body(cx, cy, sx, sy, t, 0.06 * dir, [dir, 0], dir);
    }

    if (dance === 'flips') {
      const u = tt / len, cx = xAt(u);
      let flip = 0;
      for (const f of FLIP_AT) { const s0 = f * len; if (tt >= s0 && tt < s0 + FLIP_LEN) flip = (tt - s0) / FLIP_LEN; }
      if (flip > 0) {
        const cy = floorY - 26 - Math.sin(flip * Math.PI) * 26;
        const rot = flip * Math.PI * 2 * dir, c = Math.cos(rot), sn = Math.sin(rot);
        const R = (x: number, y: number): [number, number] => [cx + x * c - y * sn, cy + x * sn + y * c];
        const L = R(-24, -6), Rg = R(24, -6), lf = R(-8, 26), rf = R(8, 26);
        shoe(lf[0], lf[1], 1); shoe(rf[0], rf[1], -1);
        const lh = R(-8, 17), rh = R(8, 17);
        limb(lh[0], lh[1], lf[0], lf[1], -3); limb(rh[0], rh[1], rf[0], rf[1], 3);
        glove(L[0], L[1]); glove(Rg[0], Rg[1]);
        const ls = R(-20, -2), rs = R(20, -2);
        limb(ls[0], ls[1], L[0], L[1], 3); limb(rs[0], rs[1], Rg[0], Rg[1], -3);
        body(cx, cy, 1, 1, t, rot, [0, -1], dir);
        for (let i = 0; i < 3; i++) line(cx - dir * (30 + i * 5), cy - 6 + i * 6, cx - dir * (38 + i * 5), cy - 6 + i * 6);
      } else {
        walk(cx, floorY - 26 - Math.abs(beat) * 3);
      }
    } else if (dance === 'moonwalk') {
      // moonwalk: travels in dir while facing the other way; ground still slides past
      const cx = xAt(tt / len);
      for (let x = ((frame * 2 * -dir) % 12 + 12) % 12; x < W; x += 12) set(x, floorY + 6);
      moonwalk(cx, floorY, -dir, t, (W - 2 * margin) / len, tt / len);
    } else {
      // robot: walk to the middle, do the robot, walk off
      const u = tt / len;
      const cx = u < 0.2 ? xAt(u / 0.2 * 0.5) : u < 0.82 ? xAt(0.5) : xAt(0.5 + (u - 0.82) / 0.18 * 0.5);
      if (u < 0.2 || u >= 0.82) walk(cx, floorY - 26 - Math.abs(beat) * 3);
      else robot(cx, floorY, dir, frame, t);
    }

  }


  /** Render one frame into an ImageData of RASTER_W x RASTER_H. */
  function render(frame: number, target: ImageData) {
    px = target.data;
    draw(frame);
  }

  /** Convenience: run a rAF loop on a canvas until the returned stop() is called. */
  function mount(canvas: HTMLCanvasElement) {
    canvas.width = BW; canvas.height = BH;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(BW, BH);
    let last = -1, raf = 0;
    const loop = (now: number) => {
      const frame = Math.floor(now / 1000 * FPS);
      if (frame !== last) { last = frame; render(frame, img); ctx.putImageData(img, 0, 0); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }

  return { render, mount, fps: FPS, width: BW, height: BH };
}
