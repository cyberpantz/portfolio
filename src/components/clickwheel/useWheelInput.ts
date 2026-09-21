import { useCallback, useEffect, useRef } from 'react';

/**
 * Click-wheel input: pointer rotation → discrete ticks, plus the four
 * glyph buttons and the centre. Spec §4.3 and §9.
 *
 * The whole thing runs off refs and calls back imperatively. Nothing here
 * sets React state per pointer event — a scrub fires dozens of moves a
 * second and re-rendering the object on each one would make the wheel feel
 * heavy, which is the one thing it cannot be.
 */

export type WheelButton = 'menu' | 'prev' | 'next' | 'play' | 'center';

export type WheelHandlers = {
  /** +1 clockwise, -1 anticlockwise, one call per tick. */
  onTick?: (dir: 1 | -1) => void;
  onButton?: (b: WheelButton) => void;
  /** Fired once when a scrub begins, for waking the backlight. */
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
};

export type WheelOptions = WheelHandlers & {
  /**
   * Degrees of rotation per tick.
   *
   * Spec §4.3 says 12, matching the real device — but the real device
   * held thousands of songs, where covering ground fast was the point. On
   * a six-row list 12 degrees means the ENTIRE library is 60 degrees of
   * turn, about a sixth of a revolution, which is why it felt impossible
   * to land on a row.
   *
   * 20 gives 18 ticks per revolution and 27.6px of arc per row, so
   * crossing this list is a comfortable quarter turn. Raise it toward 12
   * again if the library ever gets long.
   */
  degreesPerTick?: number;
  /** Wheel tick sound. */
  clicks?: boolean;
  /**
   * Element that, while hovered, makes the keyboard work without focus.
   *
   * Keys are normally only delivered to a focused element, which meant
   * having to Tab to the wheel before an arrow key did anything — a fair
   * amount of ceremony on a page that is one device. Hovering the object
   * is an unambiguous statement of intent, so it is treated as good as
   * focus.
   *
   * Scoped to hover rather than bound to the document outright because
   * arrows scroll the page: capturing them globally would break the page
   * to fix the widget.
   */
  hoverTarget?: React.RefObject<HTMLElement | null>;
};

/**
 * Signed shortest angular difference, in degrees, in (-180, 180].
 *
 * This is the crux of the whole hook. Raw atan2 output jumps by 360 when
 * the pointer crosses the -180/180 seam at the nine o'clock position, and
 * a naive `b - a` there produces a ~360° delta — which at 12° per tick
 * means thirty spurious ticks from one mouse move, sending the selection
 * flying. Normalising to the shortest arc makes the seam a non-event.
 */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Pointer position → degrees, 0 at twelve o'clock, increasing clockwise. */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  // atan2(dx, -dy) rather than the usual (dy, dx): this puts 0 at the top
  // and grows clockwise, which is how the wheel is actually read.
  return (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
}

/**
 * Which glyph a release landed on, or null.
 *
 * Quadrants centred on the four glyphs, and only in the outer part of the
 * ring — a tap near the centre button's edge should not fire MENU.
 */
export function hitZone(angle: number, radiusFrac: number): WheelButton | null {
  /*
   * The glyph band runs from just outside the centre button to the rim.
   * 0.36 rather than 0.42: the centre button is 33% of the wheel, so 0.36
   * starts the band as soon as the button ends and gives the four glyphs
   * the whole remaining ring. The old floor left a dead annulus between
   * the button and the taps that was easy to land in and did nothing.
   *
   * 1.04 at the top so a release a pixel or two past the rim — which is
   * common at the end of a flick — still counts.
   */
  if (radiusFrac < 0.36 || radiusFrac > 1.04) return null;
  const a = ((angle % 360) + 360) % 360;
  if (a >= 315 || a < 45) return 'menu';
  if (a >= 45 && a < 135) return 'next';
  if (a >= 135 && a < 225) return 'play';
  return 'prev';
}

export function useWheelInput(opts: WheelOptions = {}) {
  const {
    degreesPerTick = 20,
    clicks = true,
    hoverTarget,
    onTick,
    onButton,
    onScrubStart,
    onScrubEnd,
  } = opts;

  const ref = useRef<HTMLDivElement>(null);
  const acc = useRef(0);          // rotation banked but not yet a tick
  const ticked = useRef(0);       // ticks emitted this gesture
  const last = useRef<number | null>(null);
  const active = useRef(false);
  const ctx = useRef<AudioContext | null>(null);

  // Handlers change identity every render; reading them from a ref keeps
  // the pointer listeners stable instead of rebinding on each one.
  const cb = useRef(opts);
  cb.current = opts;

  /** 12ms square blip, ~2kHz, very quiet — spec §4.3. */
  const click = useCallback(() => {
    if (!clicks) return;
    try {
      if (!ctx.current) {
        const AC = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx.current = new AC();
      }
      const c = ctx.current;
      if (c.state === 'suspended') void c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = 2000;
      // Ramp rather than a hard stop: an abrupt gate on a square wave
      // adds a click of its own, on top of the one we want.
      gain.gain.setValueAtTime(0.035, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.012);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.014);
    } catch {
      /* no audio available — the wheel still works silently */
    }
  }, [clicks]);

  /**
   * Pointer position in the wheel's OWN coordinate space.
   *
   * This used to read getBoundingClientRect() and work in screen pixels,
   * which was fine while the device was flat and wrong the moment it
   * started tilting: under a 3D rotation that rect is the axis-aligned
   * bounding box of the PROJECTED shape, so the radius is inflated, the
   * circle is really an ellipse, and a screen-space angle no longer
   * corresponds to an angle on the wheel. Ticks came out uneven and the
   * glyph zones drifted — worst near the edges, where the projection is
   * most severe.
   *
   * offsetX/offsetY are already in the target's local box and are
   * un-projected by the browser, so the maths below is back to being
   * plain circle geometry on an undistorted disc.
   */
  const local = useCallback((e: PointerEvent) => {
    const el = ref.current;
    if (!el) return null;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return null;
    const cx = w / 2;
    const cy = h / 2;
    return {
      x: e.offsetX - cx,
      y: e.offsetY - cy,
      rad: w / 2,
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const down = (e: PointerEvent) => {
      /*
       * Bail if the press did not start on the RING itself.
       *
       * This must be a target check, not a geometry one. offsetX/offsetY
       * are relative to the EVENT TARGET, and on pointerdown that target
       * is the centre <button> whenever the press lands on it — so the
       * offsets are button-relative, the distance came out around 0.6 of
       * the radius instead of 0, the ring did not bail, and it called
       * setPointerCapture. That capture stole the pointer from the button,
       * which then never received its own pointerup, so `click` never
       * fired: the centre depressed and did nothing.
       *
       * The glyphs are pointer-events:none, so the only other possible
       * target is that button.
       */
      if (e.target !== el) return;

      const g = local(e);
      if (!g) return;
      // Belt and braces: a press inside the button's footprint is not a scrub.
      if (Math.hypot(g.x, g.y) / g.rad < 0.32) return;

      active.current = true;
      acc.current = 0;
      ticked.current = 0;
      last.current = pointerAngle(0, 0, g.x, g.y);
      el.setPointerCapture(e.pointerId);
      cb.current.onScrubStart?.();
    };

    const move = (e: PointerEvent) => {
      if (!active.current || last.current === null) return;
      const g = local(e);
      if (!g) return;
      const a = pointerAngle(0, 0, g.x, g.y);
      const d = angleDelta(last.current, a);
      last.current = a;
      acc.current += d;

      /*
       * while, not if. A fast flick can cover several ticks between two
       * pointermove events; emitting one per event would silently swallow
       * the rest and make the wheel feel like it is slipping.
       */
      while (Math.abs(acc.current) >= degreesPerTick) {
        const dir: 1 | -1 = acc.current > 0 ? 1 : -1;
        acc.current -= dir * degreesPerTick;
        ticked.current++;
        cb.current.onTick?.(dir);
        // The blip belongs HERE, on the pointer path, not only on the
        // keyboard one. It was dropped when this loop was rewritten for
        // local-space hit testing, and nothing caught it: an unused
        // useCallback is perfectly valid code, so the wheel just went
        // quiet under the mouse while still clicking under the arrow keys.
        click();
      }
    };

    const up = (e: PointerEvent) => {
      if (!active.current) return;
      active.current = false;
      const g = local(e);
      /*
       * A tap is a gesture that emitted NO ticks.
       *
       * This was a threshold on accumulated rotation — under 8 degrees
       * counted as a tap — and it made the glyphs intermittently dead:
       * 8 degrees is about 11px of arc on this wheel, which an ordinary
       * click easily exceeds if the hand moves at all, and the press then
       * silently became a scrub that did nothing.
       *
       * Ticks are the honest test. If the wheel never advanced, the user
       * was pressing, not turning — and it gives a full 12 degrees of
       * wobble for free, since that is what one tick costs.
       */
      if (g && ticked.current === 0) {
        const z = hitZone(pointerAngle(0, 0, g.x, g.y), Math.hypot(g.x, g.y) / g.rad);
        if (z) cb.current.onButton?.(z);
      }
      last.current = null;
      cb.current.onScrubEnd?.();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [local, click, degreesPerTick]);

  useEffect(() => () => { void ctx.current?.close(); }, []);

  /**
   * Keyboard equivalents for every wheel action — spec §9.
   *
   * Takes a plain KeyboardEvent so the same handler serves both the React
   * onKeyDown (when the wheel is focused) and the document listener below
   * (when it is merely hovered).
   */
  const handleKey = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      const k = e.key;
      const tick = (d: 1 | -1) => { cb.current.onTick?.(d); click(); };
      const many = (n: number, d: 1 | -1) => { for (let i = 0; i < n; i++) tick(d); };

      if (k === 'ArrowDown' || k === 'ArrowRight') { e.preventDefault(); tick(1); }
      else if (k === 'ArrowUp' || k === 'ArrowLeft') { e.preventDefault(); tick(-1); }
      else if (k === 'Enter') { e.preventDefault(); cb.current.onButton?.('center'); }
      else if (k === 'Backspace' || k === 'Escape') { e.preventDefault(); cb.current.onButton?.('menu'); }
      else if (k === ' ') { e.preventDefault(); cb.current.onButton?.('play'); }
      else if (k === '+' || k === '=') { e.preventDefault(); tick(1); }
      else if (k === '-' || k === '_') { e.preventDefault(); tick(-1); }
      /*
       * PageUp/Down and Home/End are what people reach for in any list, so
       * they work here too. Implemented as repeated ticks rather than a
       * separate jump path: the tick handler already clamps and reconciles
       * the scroll window, and a second way of moving the selection would
       * be a second thing to keep correct.
       */
      else if (k === 'PageDown') { e.preventDefault(); many(5, 1); }
      else if (k === 'PageUp') { e.preventDefault(); many(5, -1); }
      else if (k === 'Home') { e.preventDefault(); many(64, -1); }
      else if (k === 'End') { e.preventDefault(); many(64, 1); }
    },
    [click]
  );

  /*
   * Hover-to-type. Only while the pointer is over the device, and never
   * while the visitor is in a text field — otherwise typing "End" into a
   * search box elsewhere on the page would jump this list.
   */
  useEffect(() => {
    const host = hoverTarget?.current;
    if (!host) return;
    let over = false;
    const enter = () => { over = true; };
    const leave = () => { over = false; };

    const onDoc = (e: KeyboardEvent) => {
      if (!over) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // Focused already? The React handler has it; do not fire twice.
      if (ref.current && ref.current.contains(document.activeElement)) return;
      handleKey(e);
    };

    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    document.addEventListener('keydown', onDoc);
    return () => {
      host.removeEventListener('pointerenter', enter);
      host.removeEventListener('pointerleave', leave);
      document.removeEventListener('keydown', onDoc);
    };
  }, [hoverTarget, handleKey]);

  return { ref, onKeyDown: handleKey, playClick: click };
}
