import { LCD_H, LCD_S, LCD_W, PALETTE, drawBattery, type Rgb } from './menu';
import { drawText, measure, truncate } from './text';
import { ZONES, type Zone } from '../zones';

/**
 * Extras > Clock — the world-clock list, drawn into a raw ImageData.
 *
 * Laid out from a photograph of the real screen. Each row is TWO lines
 * tall and carries four things: the time over the city on the left, the
 * weekday over the date on the right, and a small analogue face at the
 * far left that is drawn in negative when it is night there. The face is
 * what makes the list read at a glance — you see that Tokyo is dark
 * before you have read a single digit.
 *
 * Same contract as drawMenu and drawNowPlaying: no DOM, no canvas API,
 * just pixels, so the caller owns the loop and this stays testable.
 *
 * Two deliberate departures from the photograph:
 *
 *   - No chevrons. The real rows opened a per-clock detail screen. This
 *     tree's own rule is that a chevron is a promise there is something
 *     behind it, and there is nothing behind these, so drawing one would
 *     be a lie for the sake of the screenshot.
 *   - No year on the date. The photo shows "Oct 18 2005", which at this
 *     width costs about 24px and would push the longest city name into
 *     an ellipsis. A world clock is never asked what year it is.
 */

const HEAD_H = 21;
/** Two 12px lines plus breathing room. */
export const CLOCK_ROW_H = 36;
export const CLOCK_VISIBLE = Math.floor((LCD_H - HEAD_H) / CLOCK_ROW_H);

const FACE_R = 11;
const FACE_CX = 17;
const TEXT_X = 34;
const RIGHT_EDGE = LCD_W - 4;

export type ClockRow = {
  label: string;
  time: string;
  weekday: string;
  date: string;
  /** Drives the negative face. */
  night: boolean;
};

export type ClockListState = {
  rows: ClockRow[];
  selected: number;
  scroll: number;
  battery?: number;
};

/*
 * One formatter set per zone, built once and kept.
 *
 * This runs every second across every visible row, and Intl.DateTimeFormat
 * construction is expensive enough that rebuilding 4 of them per row per
 * tick would be felt. The try/catch also belongs here rather than at the
 * call site: an identifier the browser does not know throws RangeError
 * from the CONSTRUCTOR, so catching it once means an unknown zone quietly
 * degrades to local time instead of throwing inside the draw loop.
 */
type Fmt = {
  time: Intl.DateTimeFormat;
  weekday: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  hour: Intl.DateTimeFormat;
};
const fmtCache = new Map<string, Fmt>();

function build(inZone: Record<string, string>): Fmt {
  return {
    // hour12 forced rather than left to the locale: the row is measured
    // against a fixed column, and a 24-hour locale would change its width.
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...inZone }),
    weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long', ...inZone }),
    date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...inZone }),
    // hourCycle h23 rather than hour12:false — the latter renders midnight
    // as "24" in some implementations, which would read as permanent night.
    hour: new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', ...inZone }),
  };
}

function fmtFor(tz: string | null): Fmt {
  const key = tz ?? '';
  const hit = fmtCache.get(key);
  if (hit) return hit;
  let f: Fmt;
  try {
    f = build(tz ? { timeZone: tz } : {});
  } catch {
    f = build({});
  }
  fmtCache.set(key, f);
  return f;
}

/** Night runs 18:00 to 06:00 — the hours the real face was drawn dark. */
function isNight(hour: number): boolean {
  return hour < 6 || hour >= 18;
}

/** One row per zone, resolved at `now`. Pure apart from Intl. */
export function clockRows(now: Date, zones: Zone[] = ZONES): ClockRow[] {
  return zones.map((z) => {
    const f = fmtFor(z.tz);
    const hour = parseInt(f.hour.format(now), 10);
    return {
      label: z.label,
      time: f.time.format(now),
      weekday: f.weekday.format(now),
      date: f.date.format(now),
      night: isNight(Number.isNaN(hour) ? 12 : hour),
    };
  });
}

/** Keep the selection on screen. Same contract as menu's reconcile. */
export function reconcileClocks(selected: number, scroll: number, n: number) {
  if (n === 0) return { selected: 0, scroll: 0 };
  const sel = Math.max(0, Math.min(n - 1, selected));
  let sc = scroll;
  if (sel < sc) sc = sel;
  if (sel >= sc + CLOCK_VISIBLE) sc = sel - CLOCK_VISIBLE + 1;
  sc = Math.max(0, Math.min(Math.max(0, n - CLOCK_VISIBLE), sc));
  return { selected: sel, scroll: sc };
}

// ---- pixel helpers -------------------------------------------------
// menu.ts keeps its own fill private, and nowPlaying.ts has the same pair.
// Three small copies beat one shared module that every screen has to
// import just to put a rectangle down.

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

/** One LOGICAL pixel, which is an s x s block in the raster. */
function px(img: ImageData, x: number, y: number, c: Rgb, s: number) {
  fill(img, Math.round(x), Math.round(y), 1, 1, c, s);
}

/**
 * The analogue face.
 *
 * Drawn rather than rasterised from a font: at 22px across, a glyph
 * thresholds to a grey smudge, and the hands have to point somewhere
 * specific anyway. Distance-tested rather than Bresenham — the circle is
 * tiny, the loop is 23x23, and an exact ring is worth more here than the
 * cycles saved.
 */
function face(
  img: ImageData, cx: number, cy: number, hour: number, minute: number,
  fg: Rgb, night: boolean, s: number
) {
  /*
   * Day and night are ABSOLUTE, not relative to the row.
   *
   * The first version swapped these along with the selection bar, which
   * inverted the meaning exactly where it matters: a night city, once
   * highlighted, drew a pale face and read as daytime. In the reference
   * photo the selected row is California at 5:24 PM and its face is
   * white — the same white as an unselected daytime face. The face
   * answers "is it dark there", and the answer cannot depend on where
   * the cursor happens to be.
   *
   * Only the RING follows the row, because it is the one part that has
   * to stay visible against whichever ground it is sitting on.
   */
  const interior = night ? PALETTE.ink : PALETTE.knock;
  const hands = night ? PALETTE.knock : PALETTE.ink;

  for (let dy = -FACE_R - 1; dy <= FACE_R + 1; dy++) {
    for (let dx = -FACE_R - 1; dx <= FACE_R + 1; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= FACE_R - 0.8) px(img, cx + dx, cy + dy, interior, s);
      else if (Math.abs(d - FACE_R) <= 0.9) px(img, cx + dx, cy + dy, fg, s);
    }
  }

  // 0 at twelve, growing clockwise — the same convention as the wheel.
  const hand = (angle: number, len: number) => {
    for (let t = 0; t <= len; t += 0.5) {
      px(img, cx + Math.sin(angle) * t, cy - Math.cos(angle) * t, hands, s);
    }
  };
  const m = (minute / 60) * Math.PI * 2;
  const h = (((hour % 12) + minute / 60) / 12) * Math.PI * 2;
  hand(h, FACE_R - 5);
  hand(m, FACE_R - 2);
  px(img, cx, cy, hands, s);
}

export function drawClockList(img: ImageData, state: ClockListState, scale = LCD_S) {
  const { rows, selected, scroll, battery = 0.72 } = state;

  fill(img, 0, 0, LCD_W, LCD_H, PALETTE.bg, scale);

  // ---- header: same furniture as every other screen ----
  fill(img, 0, 0, LCD_W, HEAD_H, PALETTE.bar, scale);
  const tw = measure('Clock');
  drawText(img, 'Clock', Math.round((LCD_W - tw) / 2), 4, PALETTE.knock, scale);
  drawBattery(img, LCD_W - 26, 6, battery, PALETTE.knock, scale);
  fill(img, 0, HEAD_H - 1, LCD_W, 1, PALETTE.rule, scale);

  if (rows.length === 0) {
    drawText(img, 'No clocks', 6, HEAD_H + 6, PALETTE.ink, scale);
    return;
  }

  for (let i = 0; i < CLOCK_VISIBLE; i++) {
    const idx = scroll + i;
    if (idx >= rows.length) break;
    const r = rows[idx];
    const top = HEAD_H + i * CLOCK_ROW_H;
    const on = idx === selected;

    const ink = on ? PALETTE.knock : PALETTE.ink;
    if (on) fill(img, 0, top, LCD_W, CLOCK_ROW_H, PALETTE.bar, scale);

    // The face needs the raw numbers, not the formatted string.
    const [hh, mm] = r.time.replace(/\s*[AP]M$/i, '').split(':').map(Number);
    const h12 = r.time.toUpperCase().includes('PM') ? (hh % 12) + 12 : hh % 12;
    face(img, FACE_CX, top + CLOCK_ROW_H / 2, h12, mm || 0, ink, r.night, scale);

    /*
     * The right column is measured FIRST and the city truncated to
     * whatever is left. Sized the other way round, a long city name would
     * run under the date — and at this width "Los Angeles" and "Sep 21"
     * together are within a few pixels of the edge.
     */
    const rw = Math.max(measure(r.weekday), measure(r.date));
    const room = RIGHT_EDGE - TEXT_X - rw - 6;

    drawText(img, r.time, TEXT_X, top + 3, ink, scale);
    drawText(img, truncate(r.label, room), TEXT_X, top + 18, ink, scale);

    drawText(img, r.weekday, RIGHT_EDGE - measure(r.weekday), top + 3, ink, scale);
    drawText(img, r.date, RIGHT_EDGE - measure(r.date), top + 18, ink, scale);
  }
}
