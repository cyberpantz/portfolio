import { drawBattery, LCD_H, LCD_W, PALETTE, type Rgb } from './menu';
import { drawText, measure, truncate } from './text';
import { fmtTime, type Track } from '../useTracks';

/**
 * Now Playing, drawn into a raw ImageData.
 *
 * Laid out from a photograph of the real screen, which corrected three
 * things the first version had wrong:
 *
 *   - the header carries the PLAYLIST name, not the track counter, with
 *     the transport glyph at the left and the battery at the right
 *   - "n of m" sits below the header, left-aligned, on its own line
 *   - title, artist and album are CENTRED, not left-aligned
 *
 * Same contract as drawMenu: no DOM, no canvas API, just pixels.
 */

export type NowPlayingState = {
  track: Track;
  index: number;
  total: number;
  elapsed: number;
  duration: number;
  playing: boolean;
  /** 0-1 of the file fetched, for the buffered bar. */
  buffered: number;
  /** Playlist or album shown in the header. */
  source?: string;
  battery?: number;
  /** Set when the file could not be loaded. Replaces the transport row. */
  error?: string | null;
  /** Between a load and the first playable frame. */
  loading?: boolean;
};

const HEAD_H = 21;

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

/** ▶ or ∥, drawn as pixels — a font glyph thresholds to mush at this size. */
function transport(img: ImageData, x: number, y: number, playing: boolean, c: Rgb, s: number) {
  if (playing) {
    // Triangle: each column one pixel narrower, top and bottom.
    for (let i = 0; i < 5; i++) fill(img, x + i, y + i, 1, 9 - i * 2, c, s);
  } else {
    fill(img, x, y, 2, 9, c, s);
    fill(img, x + 4, y, 2, 9, c, s);
  }
}

/** Centre a string, or truncate it to fit first. */
function centred(img: ImageData, str: string, y: number, c: Rgb, s: number, pad = 8) {
  const room = LCD_W - pad * 2;
  const t = truncate(str, room);
  drawText(img, t, Math.round((LCD_W - measure(t)) / 2), y, c, s);
}

/** Text height to mask when the title slides — the 12px face rasterises to 20. */
const LINE_H = 20;

/**
 * How far a too-long title has slid left, in pixels, at time `t`.
 *
 * Hold at the start, run left until the last character is flush with the
 * right edge, hold again, then run back. It never wraps and never shows
 * two copies of the string: the real device eased out and back, and a
 * looping banner reads as a web page rather than as a device.
 *
 * Pure and exported so the timing can be asserted without a canvas. The
 * contract that matters: 0 while it fits, never negative, and never more
 * than `textW - room`, because past that the title has left the screen.
 */
export function marqueeOffset(
  textW: number, room: number, t: number, hold = 1200, speed = 22
): number {
  const over = textW - room;
  if (over <= 0) return 0;
  const travel = (over / speed) * 1000;
  const period = hold * 2 + travel * 2;
  const p = ((t % period) + period) % period;
  if (p < hold) return 0;                                   // hold at the head
  if (p < hold + travel) return ((p - hold) / travel) * over;         // out
  if (p < hold * 2 + travel) return over;                   // hold at the tail
  return over - ((p - hold * 2 - travel) / travel) * over;            // back
}

/**
 * The title line: centred when it fits, sliding when it does not.
 *
 * Only the title. The spec is explicit about that, and it is right —
 * artist and album sliding at the same time turns a calm screen into a
 * departures board.
 */
function titleLine(
  img: ImageData, str: string, y: number, c: Rgb, s: number, t: number, pad = 8
) {
  const room = LCD_W - pad * 2;
  const w = measure(str);
  if (w <= room) {
    drawText(img, str, Math.round((LCD_W - w) / 2), y, c, s);
    return;
  }
  drawText(img, str, Math.round(pad - marqueeOffset(w, room, t)), y, c, s);
  /*
   * Mask the margins AFTER drawing. drawText clips to the canvas, not to
   * a column, so without this the sliding title runs out under the
   * battery and the n-of-m line instead of disappearing at its own edge.
   */
  fill(img, 0, y, pad, LINE_H, PALETTE.bg, s);
  fill(img, LCD_W - pad, y, pad, LINE_H, PALETTE.bg, s);
}

export function drawNowPlaying(img: ImageData, st: NowPlayingState, scale = 2, t = 0) {
  const {
    track, index, total, elapsed, duration, playing, buffered,
    source, battery = 0.72, error = null, loading = false,
  } = st;

  fill(img, 0, 0, LCD_W, LCD_H, PALETTE.bg, scale);

  // ---- header: glyph left, source centred, battery right ----
  fill(img, 0, 0, LCD_W, HEAD_H, PALETTE.bar, scale);
  transport(img, 6, 6, playing, PALETTE.knock, scale);
  // Truncated to the gap between the glyph and the battery so it can never
  // collide with either.
  const head = truncate(source ?? track.album ?? 'Now Playing', LCD_W - 66);
  drawText(img, head, Math.round((LCD_W - measure(head)) / 2), 4, PALETTE.knock, scale);
  drawBattery(img, LCD_W - 26, 6, battery, PALETTE.knock, scale);
  fill(img, 0, HEAD_H - 1, LCD_W, 1, PALETTE.rule, scale);

  // ---- n of m ----
  drawText(img, `${index + 1} of ${total}`, 6, HEAD_H + 3, PALETTE.ink, scale);

  // ---- title / artist / album, centred ----
  let y = HEAD_H + 24;
  titleLine(img, track.title, y, PALETTE.ink, scale, t);
  if (track.artist) {
    y += 19;
    centred(img, track.artist, y, PALETTE.ink, scale);
  }
  if (track.album) {
    y += 19;
    centred(img, track.album, y, PALETTE.ink, scale);
  }

  /*
   * ---- failed load ----
   *
   * The transport row is REPLACED rather than drawn over: a progress bar
   * at 0:00 next to an error is a screen arguing with itself, and the
   * elapsed time is meaningless for a file that never opened. The title
   * above stays, so it is clear WHICH track failed.
   *
   * It reads as a statement, not an alert. There is no dialog to dismiss
   * and nothing is blocked — MENU still goes back, and the next track
   * still plays — so shouting about it would overstate the problem.
   */
  if (error) {
    const eY = LCD_H - 30;
    fill(img, 0, eY - 4, LCD_W, LCD_H - eY + 4, PALETTE.bar, scale);
    centred(img, error, eY, PALETTE.knock, scale);
    centred(img, 'MENU to go back', eY + 15, PALETTE.knock, scale);
    return;
  }

  // ---- progress ----
  const barY = LCD_H - 32;
  const barX = 8;
  const barW = LCD_W - 16;
  fill(img, barX, barY, barW, 8, PALETTE.ink, scale);
  fill(img, barX + 1, barY + 1, barW - 2, 6, PALETTE.bg, scale);

  // Buffered sits behind elapsed, lighter — so seeking into un-fetched
  // audio shows as a gap rather than as the bar simply stopping.
  const frac = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const bufW = Math.round((barW - 2) * Math.min(1, Math.max(0, buffered)));
  if (bufW > 0) fill(img, barX + 1, barY + 1, bufW, 6, PALETTE.rule, scale);
  const playW = Math.round((barW - 2) * frac);
  if (playW > 0) fill(img, barX + 1, barY + 1, playW, 6, PALETTE.ink, scale);

  // ---- times ----
  const el = fmtTime(elapsed);
  const rem = loading && duration <= 0
    ? 'Loading'
    : duration > 0 ? `-${fmtTime(Math.max(0, duration - elapsed))}` : '—:—';
  drawText(img, el, barX, barY + 13, PALETTE.ink, scale);
  drawText(img, rem, LCD_W - barX - measure(rem), barY + 13, PALETTE.ink, scale);
}
