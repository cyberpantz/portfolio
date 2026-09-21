import { useEffect, useRef } from 'react';
import { LCD_H, LCD_S, LCD_W, PALETTE, type Rgb } from './lcd/menu';
import { drawText, measure, truncate } from './lcd/text';
import { MARK_H, MARK_W, markBits } from './lcd/mark';

/**
 * Settings > About.
 *
 * A composed plate rather than a list of rows. The other screens are
 * lists because they are lists; this one has nothing to scroll and no
 * selection to move, so laying it out as five left-aligned strings wasted
 * the only screen in the whole device that could be a picture.
 *
 * The banana comes back at a quarter size as a maker's mark, the title
 * sits against it, and the year and version sit in an inverted band along
 * the bottom — a colophon, roughly.
 *
 * Everything is positioned from measure() rather than from constants. An
 * earlier pass at this used hardcoded x values and overflowed the moment
 * a string changed, which on a 176px screen is nearly always.
 */

const TITLE = 'bold 15px Helvetica, Arial, sans-serif';
const BODY = 'bold 11px Helvetica, Arial, sans-serif';
const TINY = 'bold 10px Helvetica, Arial, sans-serif';

const BAND_H = 22;

function fill(img: ImageData, x0: number, y0: number, w: number, h: number, c: Rgb, s: number) {
  const d = img.data;
  const W = img.width;
  const H = img.height;
  for (let y = y0 * s; y < (y0 + h) * s; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0 * s; x < (x0 + w) * s; x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
}

/**
 * The mark, blitted at RASTER resolution.
 *
 * ox/oy are logical; the mark itself lands one stored pixel per device
 * pixel, which is what keeps its curves smooth against the blockier text
 * around it. Returns its logical width so the caller can lay out beside it.
 */
function drawMark(img: ImageData, k: number, oxLogical: number, oyLogical: number, c: Rgb, s: number) {
  const bits = markBits();
  const dw = Math.max(1, Math.round(MARK_W * k));
  const dh = Math.max(1, Math.round(MARK_H * k));
  const W = img.width;
  const H = img.height;
  const ox = oxLogical * s;
  const oy = oyLogical * s;
  const d = img.data;
  for (let y = 0; y < dh; y++) {
    const yy = oy + y;
    if (yy < 0 || yy >= H) continue;
    const sy = Math.min(MARK_H - 1, ((y * MARK_H) / dh) | 0);
    for (let x = 0; x < dw; x++) {
      const xx = ox + x;
      if (xx < 0 || xx >= W) continue;
      const sx = Math.min(MARK_W - 1, ((x * MARK_W) / dw) | 0);
      if (!bits[sy * MARK_W + sx]) continue;
      const i = (yy * W + xx) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
  return Math.round(dw / s);
}

export default function AboutScreen() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d', { alpha: false });
    if (!ctx) return;
    const W = LCD_W * LCD_S;
    const H = LCD_H * LCD_S;
    el.width = W;
    el.height = H;
    const img = ctx.createImageData(W, H);
    const S = LCD_S;

    fill(img, 0, 0, LCD_W, LCD_H, PALETTE.bg, S);

    // ---- mark, left ----
    // k is against the RASTER size, so 0.42 is ~45 logical px wide.
    const mw = drawMark(img, 0.42, 10, 20, PALETTE.ink, S);

    /*
     * ---- title block, right of the mark ----
     *
     * Every string is truncated to the space actually left over rather
     * than trusted to fit. On a 176px panel the difference between "Drawn
     * in a browser" and "Drawn in a browser." is enough to run off the
     * edge, and copy changes should not be able to break the layout.
     */
    const x = 10 + mw + 12;
    const room = LCD_W - x - 8;
    drawText(img, truncate('Click Wheel', room, TITLE), x, 24, PALETTE.ink, S, TITLE);
    fill(img, x, 45, room, 1, PALETTE.ink, S);
    drawText(img, truncate('Frank Young', room, BODY), x, 52, PALETTE.ink, S, BODY);
    drawText(img, truncate('No images', room, BODY), x, 67, PALETTE.rule, S, BODY);

    // ---- colophon band ----
    // Inverted, so the plate has a base and the type has somewhere to sit.
    const bandY = LCD_H - BAND_H;
    fill(img, 0, bandY, LCD_W, BAND_H, PALETTE.bar, S);
    drawText(img, '2026', 9, bandY + 6, PALETTE.knock, S, TINY);
    const v = 'v0.4';
    drawText(img, v, LCD_W - 9 - measure(v, TINY), bandY + 6, PALETTE.knock, S, TINY);
    const mid = 'HTML · CSS · CANVAS';
    drawText(img, mid, Math.round((LCD_W - measure(mid, TINY)) / 2), bandY + 6, PALETTE.knock, S, TINY);

    ctx.putImageData(img, 0, 0);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      role="img"
      aria-label="About. Click Wheel, 2026. Drawn in a browser with HTML, CSS and canvas. No images. Version 0.4."
    />
  );
}
