import { drawText, measure, truncate } from './text';

/**
 * The menu screen, drawn into a raw ImageData.
 *
 * No DOM and no canvas API beyond the pixel buffer it is handed, so it can
 * be unit-tested and so the caller owns the loop — the same shape as
 * bootBlob's render(), which lets Screen drive either one identically.
 */

export const LCD_W = 176;
export const LCD_H = 132;
/** Raster multiplier — matches bootBlob, so text and blob agree on scale. */
export const LCD_S = 2;

export type Rgb = [number, number, number];

export const PALETTE = {
  /*
   * The UNLIT ground.
   *
   * This was 198,207,230 — a bright backlit blue — which left the lamp
   * with nothing to do: the panel looked lit whether the backlight was on
   * or off, so turning it on only added a rim glow to an already-bright
   * screen. The ground is now the duller grey-blue of an LCD lit by
   * nothing but the room, and the backlight layer ADDS light on top.
   *
   * 154,167,192 is as dark as this can go and keep the navy ink at 5.47:1
   * unlit, which is the state a visitor sees first. One stop darker drops
   * it under 4.5.
   */
  bg: [154, 167, 192] as Rgb,
  /** Deep navy, never black — spec §4.2. */
  ink: [30, 45, 92] as Rgb,
  /** Header band and the selection bar. */
  bar: [57, 65, 140] as Rgb,
  /** Knocked-out text on the selection bar. */
  knock: [226, 230, 246] as Rgb,
  rule: [131, 140, 166] as Rgb,
};

export type MenuItem = {
  label: string;
  /** Right-hand chevron: this row opens something. */
  chevron?: boolean;
  /** Right-hand tick: this row is a setting, and it is ON. */
  check?: boolean;
};

export type MenuState = {
  title: string;
  items: MenuItem[];
  /** Index of the highlighted row. */
  selected: number;
  /** First visible row, for lists longer than the screen. */
  scroll: number;
  battery?: number;
};

const HEAD_H = 21;
const ROW_H = 19;
export const VISIBLE_ROWS = Math.floor((LCD_H - HEAD_H) / ROW_H);

function fill(img: ImageData, x0: number, y0: number, w: number, h: number, c: Rgb, scale: number) {
  const d = img.data;
  const W = img.width;
  const H = img.height;
  for (let y = y0 * scale; y < (y0 + h) * scale; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0 * scale; x < (x0 + w) * scale; x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
  }
}

/** Clamp the selection and pull the scroll window to follow it. */
export function reconcile(state: MenuState): MenuState {
  const n = state.items.length;
  if (n === 0) return { ...state, selected: 0, scroll: 0 };
  const selected = Math.max(0, Math.min(n - 1, state.selected));
  let scroll = state.scroll;
  if (selected < scroll) scroll = selected;
  if (selected >= scroll + VISIBLE_ROWS) scroll = selected - VISIBLE_ROWS + 1;
  scroll = Math.max(0, Math.min(Math.max(0, n - VISIBLE_ROWS), scroll));
  return { ...state, selected, scroll };
}

/**
 * The battery glyph: outline, nub, and a fill proportional to charge.
 *
 * Exported because Now Playing needs the identical one — the real device
 * drew the same battery in the same corner on every screen, and two
 * near-identical batteries drifting apart is exactly the sort of thing
 * that makes a recreation feel off without anyone being able to say why.
 */
export function drawBattery(img: ImageData, x: number, y: number, level: number, ink: Rgb, s: number) {
  fill(img, x, y, 20, 9, ink, s);
  // Punch the interior back out to the ground so the outline is an
  // outline, then fill only the charged part of it.
  fill(img, x + 1, y + 1, 18, 7, PALETTE.bar, s);
  fill(img, x + 20, y + 3, 2, 3, ink, s);
  const lvl = Math.max(0, Math.min(1, level));
  if (lvl > 0) fill(img, x + 2, y + 2, Math.round(16 * lvl), 5, ink, s);
}

export function drawMenu(img: ImageData, state: MenuState, scale = LCD_S) {
  const { title, items, selected, scroll, battery = 0.72 } = state;

  fill(img, 0, 0, LCD_W, LCD_H, PALETTE.bg, scale);

  // ---- header ----
  fill(img, 0, 0, LCD_W, HEAD_H, PALETTE.bar, scale);
  const tw = measure(title);
  drawText(img, title, Math.round((LCD_W - tw) / 2), 4, PALETTE.knock, scale);

  drawBattery(img, LCD_W - 26, 6, battery, PALETTE.knock, scale);

  fill(img, 0, HEAD_H - 1, LCD_W, 1, PALETTE.rule, scale);

  // ---- rows ----
  if (items.length === 0) {
    drawText(img, 'No songs loaded', 6, HEAD_H + 6, PALETTE.ink, scale);
    return;
  }

  for (let i = 0; i < VISIBLE_ROWS; i++) {
    const idx = scroll + i;
    if (idx >= items.length) break;
    const item = items[idx];
    const y = HEAD_H + i * ROW_H;
    const on = idx === selected;

    if (on) fill(img, 0, y, LCD_W, ROW_H, PALETTE.bar, scale);
    const fg = on ? PALETTE.knock : PALETTE.ink;

    // Reserve room for whatever sits on the right so a long label never
    // collides with it.
    const room = LCD_W - 12 - (item.chevron || item.check ? 10 : 0);
    drawText(img, truncate(item.label, room), 5, y + 3, fg, scale);

    if (item.chevron) {
      // Drawn as pixels rather than a glyph: at this size a font's ">"
      // thresholds into a smudge, and the reference's chevron is a clean
      // two-pixel-wide diagonal.
      const cx = LCD_W - 10;
      const cy = y + Math.floor(ROW_H / 2);
      for (let k = 0; k < 4; k++) {
        fill(img, cx + k, cy - 4 + k, 2, 1, fg, scale);
        fill(img, cx + k, cy + 3 - k, 2, 1, fg, scale);
      }
    } else if (item.check) {
      /*
       * A tick, for a setting that is on. Same right-hand slot as the
       * chevron and mutually exclusive with it: a row either leads
       * somewhere or holds a value, never both.
       *
       * Also pixels rather than a glyph — at 12px a font's checkmark
       * thresholds into a blob, and this needs to be legible knocked out
       * of the selection bar as well as on the plain ground.
       */
      const cx = LCD_W - 13;
      const cy = y + Math.floor(ROW_H / 2);
      // short arm, down-right
      for (let k = 0; k < 3; k++) fill(img, cx + k, cy + k, 2, 2, fg, scale);
      // long arm, up-right
      for (let k = 0; k < 5; k++) fill(img, cx + 2 + k, cy + 2 - k, 2, 2, fg, scale);
    }
  }

  // ---- scrollbar ----
  // Only when the list actually overflows; a permanent track on a
  // five-item menu is noise.
  if (items.length > VISIBLE_ROWS) {
    const trackY = HEAD_H;
    const trackH = LCD_H - HEAD_H;
    fill(img, LCD_W - 3, trackY, 3, trackH, PALETTE.rule, scale);
    const thumbH = Math.max(8, Math.round((VISIBLE_ROWS / items.length) * trackH));
    const span = trackH - thumbH;
    const denom = Math.max(1, items.length - VISIBLE_ROWS);
    const thumbY = trackY + Math.round((scroll / denom) * span);
    fill(img, LCD_W - 3, thumbY, 3, thumbH, PALETTE.ink, scale);
  }
}
