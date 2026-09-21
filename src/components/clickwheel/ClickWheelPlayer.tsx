import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import BootMark from './BootMark';
import ClockScreen from './ClockScreen';
import AboutScreen from './AboutScreen';
import NowPlaying from './NowPlaying';
import ScreenCrack from './ScreenCrack';
import { useTracks } from './useTracks';
import { useAudio } from './useAudio';
import BootScreen from './BootScreen';
import Screen from './Screen';
import { frameToState, currentRow, moveSelection, type Frame } from './lcd/tree';
import { useWheelInput, type WheelButton } from './useWheelInput';
import { useTilt } from './useTilt';
import { ZONES } from './zones';
import s from './ClickWheelPlayer.module.css';

/**
 * Click-wheel player.
 *
 * A recreation of the white 3rd/4th-generation click-wheel iPod, drawn
 * from a photograph. The boot mark is the original's; the menu copy is
 * not, because the menus here lead somewhere different.
 *
 * Built so far (spec §10): the object, the wheel, the menus, the audio
 * engine and Now Playing. Still to come: the entrance timeline, dithered
 * album art, and the marquee for long titles.
 */

export type ClickWheelPlayerProps = {
  /** Body width in px. Everything else is a percentage of it. */
  width?: number;
  /** Anodised colourways, after the mini. */
  theme?: 'silver' | 'blue' | 'green' | 'pink' | 'gold' | 'black';
  /** Message shown with the Extras toy. */
  message?: string;
  /** Wheel tick sound. */
  clicks?: boolean;
  /** How long the boot screen holds before the menu appears. */
  bootMs?: number;
  /**
   * Degrees of wheel rotation per row. Higher is calmer.
   * Exposed so it can be tuned against the length of the track list
   * without editing the input hook.
   */
  degreesPerTick?: number;
};

/** Reference photo: body 650x1100. */
const RATIO = 1.692;

/*
 * Continuous ("squircle") corners.
 *
 * Generated per size in userSpaceOnUse rather than objectBoundingBox: the
 * latter normalises x and y independently, so on a 1.692-ratio body the
 * corners would come out elliptical rather than round. n = 4.5 is the
 * squircle exponent — at n = 2 this degenerates to the circular arc a
 * plain border-radius would give.
 */
function squirclePath(w: number, h: number, r: number, n = 4.5, seg = 32) {
  const arc = (cx: number, cy: number, sx: number, sy: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * (Math.PI / 2);
      pts.push([
        cx + sx * r * Math.cos(t) ** (2 / n),
        cy + sy * r * Math.sin(t) ** (2 / n),
      ]);
    }
    return pts;
  };
  /*
   * Order matters, and getting it wrong is not subtle: the corners detach
   * and render as four separate blobs outside the body.
   *
   * The path has to walk the perimeter continuously — the straight edges
   * are the implicit L between one arc's end and the next arc's start. So
   * the corners must run clockwise TR -> BR -> BL -> TL, with TR and BL
   * reversed so each arc begins where the previous one left off:
   *
   *   TR (rev)  (w-r, 0) -> (w, r)        then down the right edge
   *   BR        (w, h-r) -> (w-r, h)      then along the bottom
   *   BL (rev)  (r, h)   -> (0, h-r)      then up the left edge
   *   TL        (0, r)   -> (r, 0)        then close along the top
   */
  const pts = [
    ...arc(w - r, r, 1, -1).reverse(),
    ...arc(w - r, h - r, 1, 1),
    ...arc(r, h - r, -1, 1).reverse(),
    ...arc(r, r, -1, -1),
  ];
  return (
    `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} ` +
    pts.slice(1).map((p) => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') +
    ' Z'
  );
}

export default function ClickWheelPlayer({
  width = 256,
  theme = 'blue',
  message = 'TWERKALIZING...',
  clicks = true,
  bootMs = 2600,
  degreesPerTick = 20,
}: ClickWheelPlayerProps) {
  const uid = useId().replace(/:/g, '');
  const clipId = `cw-squircle-${uid}`;
  const height = Math.round(width * RATIO);
  // Corner radius tracks width, matching the reference at 34/260.
  const path = useMemo(
    () => squirclePath(width, height, width * 0.131),
    [width, height]
  );

  const [pressed, setPressed] = useState(false);

  /*
   * Depth of the extruded wall, in px, and how many copies build it.
   *
   * The real device is about 61.8mm wide and 15.7mm thick, so at this
   * width the wall is ~65px deep. 20 slices covers that at ~3px apart,
   * which is under the ~4px at which the banding becomes visible at an
   * 11 degree turn. More slices is just more DOM for no gain.
   */
  const slices = useMemo(() => {
    const depth = width * 0.25;
    const n = 20;
    return Array.from({ length: n }, (_, i) => ({
      z: -((i + 1) / n) * depth,
      // Darkens toward the back: the wall turning out of the light.
      dim: 1 - (i / n) * 0.45,
    }));
  }, [width]);

  /*
   * Navigation is a STACK of frames, not a current-screen pointer.
   *
   * MENU has to return you to the row you left from, not to the top of
   * the parent list — losing that is the single thing that makes a
   * recreated menu feel wrong. A stack remembers it for free.
   */
  const [stack, setStack] = useState<Frame[]>([{ node: 'root', selected: 0, scroll: 0 }]);
  const [overlay, setOverlay] = useState<'blob' | 'clock' | 'about' | 'now' | null>(null);
  const [booting, setBooting] = useState(true);
  /*
   * Backlight starts OFF, as the device did. An unlit LCD is perfectly
   * readable in daylight — that was the point of the technology — so the
   * screen is legible from the first frame and the lamp is something the
   * visitor turns on rather than something the page assumes.
   *
   * 0 is a real off now: the panel's own ground is the unlit colour and
   * still holds the navy ink at 5.47:1, so nothing needs the lamp to be
   * legible. It used to sit at 0.35 because the "off" state was a wash
   * over a bright ground and a true zero swallowed the contrast.
   */
  const [backlight, setBacklight] = useState(0);
  /*
   * Which world clock is highlighted.
   *
   * Held here rather than inside ClockScreen because the WHEEL moves it,
   * and the wheel handlers live at this level. ClockScreen derives its
   * own scroll window from this, so the player never has to know how many
   * rows fit on the screen.
   */
  const [clockSel, setClockSel] = useState(0);
  /*
   * Whether the highlighted clock is open full screen.
   *
   * A boolean beside the existing index rather than a second index: the
   * detail screen shows whichever row is selected, so the wheel keeps
   * moving that ONE selection and stepping through cities works inside
   * the detail view for free, with the list already in the right place
   * when MENU comes back to it.
   */
  const [clockDetail, setClockDetail] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), bootMs);
    return () => clearTimeout(t);
  }, [bootMs]);

  const { tracks } = useTracks();
  const audio = useAudio(tracks);

  /* The wheel handlers are created once and must not close over audio's
     changing identity, so they reach it through a ref. Declared HERE,
     above the handlers that use it — a `const` referenced before its
     declaration is a TDZ error at call time, not a compile error, so this
     ordering is load-bearing. */
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const frame = stack[stack.length - 1];
  const menu = useMemo(
    // backlight > 0 puts a tick on the Backlight row, so the toggle says
    // what it did rather than leaving the visitor to infer it from a glow.
    () => frameToState(frame, tracks, { backlight: backlight > 0 }),
    [frame, tracks, backlight]
  );

  /*
   * Handlers read live values through refs rather than closing over state,
   * so useWheelInput never re-binds its pointer listeners mid-scrub. They
   * also never call a setter from inside another setter's updater —
   * updaters must be pure, and StrictMode invokes them twice.
   */
  const busy = useRef({ booting, overlay, frame, tracks, clockDetail });
  busy.current = { booting, overlay, frame, tracks, clockDetail };

  const onTick = useCallback((dir: 1 | -1) => {
    const { booting: b, overlay: o, tracks: tr } = busy.current;
    if (b) return;
    // In Now Playing the wheel seeks instead of scrolling — spec §5.
    // 2% of the duration per tick, which is a usable scrub on a 3 minute
    // track and still fine on an 8 minute one.
    if (o === 'now') { audioRef.current.seekBy(dir * 0.02); return; }
    // The clock list scrolls. Clamped rather than wrapping: a short list
    // that loops makes it impossible to tell the ends apart.
    if (o === 'clock') {
      setClockSel((v) => Math.max(0, Math.min(ZONES.length - 1, v + dir)));
      return;
    }
    if (o) return;                            // other overlays ignore it
    setStack((st) => {
      const next = [...st];
      next[next.length - 1] = moveSelection(next[next.length - 1], dir, tr);
      return next;
    });
  }, []);

  const onButton = useCallback((btn: WheelButton) => {
    const { booting: b, overlay: o, frame: f } = busy.current;
    if (b) return;

    if (btn === 'menu') {
      // Back out one level: overlay first, then up the stack. Never both.
      // Audio keeps playing — leaving Now Playing is navigation, not stop.
      // The clock is two levels deep, so its detail view pops before the
      // overlay does — otherwise MENU would skip the list entirely.
      if (o === 'clock' && busy.current.clockDetail) setClockDetail(false);
      else if (o) setOverlay(null);
      else setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
      return;
    }

    // Transport glyphs work from anywhere once something is loaded, which
    // is how the real device behaved: play/pause and skip did not require
    // being on the Now Playing screen.
    if (btn === 'play') { audioRef.current.toggle(); return; }
    if (btn === 'next') { audioRef.current.step(1); return; }
    if (btn === 'prev') { audioRef.current.step(-1); return; }

    if (btn !== 'center') return;

    // Keyboard Enter has no pointerup, so release the press state on a timer.
    setPressed(true);
    setTimeout(() => setPressed(false), 110);

    // The clock list is the one overlay with somewhere to go: centre opens
    // the highlighted city full screen. Its rows draw a chevron, and a
    // chevron that did nothing was the complaint this answers.
    if (o === 'clock') { setClockDetail(true); return; }
    if (o) return;                            // other overlays ignore the centre
    const row = currentRow(f, busy.current.tracks);
    if (!row?.go) return;                     // a row with nowhere to go stays put

    const go = row.go;
    switch (go.kind) {
      case 'menu':
        setStack((st) => [...st, { node: go.node, selected: 0, scroll: 0 }]);
        break;
      case 'screen':
        // Always enter the clock at the list. Landing straight back in a
        // detail view because that is where you were last time reads as
        // the menu having ignored the press.
        if (go.screen === 'clock') setClockDetail(false);
        setOverlay(go.screen);
        break;
      case 'toggle':
        setBacklight((v) => (v > 0 ? 0 : 1));
        break;
      case 'track':
        audioRef.current.playIndex(go.index);
        setOverlay('now');
        break;
    }
  }, []);

  /*
   * Declared BEFORE useWheelInput, which consumes it.
   *
   * A `const` used above its declaration is a temporal dead zone error at
   * call time, not a compile error — TypeScript will not catch it and the
   * page throws "Cannot access 'tiltRef' before initialization" on mount.
   * The same note is on audioRef above; both orderings are load-bearing.
   *
   * Tilt is measured from the POD's box, so the flat point is the centre
   * of the device rather than the centre of the page — and hovering
   * anywhere on it arms the keyboard.
   */
  const tiltRef = useTilt<HTMLDivElement>();

  const wheel = useWheelInput({ onTick, onButton, clicks, degreesPerTick, hoverTarget: tiltRef });

  const nowTrack = tracks[audio.state.index];

  return (
    <div className={s.mount} style={{ ['--pod-w' as string]: `${width}px` }}>
      <div className={s.stage}>
        <div
          ref={tiltRef}
          className={s.pod}
          data-theme={theme}
          style={{ ['--pod-w' as string]: `${width}px` }}
        >
      {/* The clip path the body and lip both reference. Zero-size so it
          never takes layout. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={path} />
          </clipPath>
        </defs>
      </svg>

      {/* The side wall: copies of the silhouette stepped back in Z. Drawn
          before the face so the face sits in front of them. */}
      {slices.map((sl, i) => (
        <div
          key={i}
          className={s.slice}
          style={{
            clipPath: `url(#${clipId})`,
            transform: `translateZ(${sl.z}px)`,
            filter: `brightness(${sl.dim})`,
          }}
        />
      ))}

      {/* body = the colour, sheen = the room reflected in it, lip = the
          machined edge.

          The sheen is NOT clipped to the squircle: it is oversized and
          moves, so clipping it to the body's own path would drag the clip
          along with it. It is masked by .body's stacking instead — the
          overhang falls outside the visible shape and is covered by .lip's
          hard outline. */}
      <div className={s.body} style={{ clipPath: `url(#${clipId})` }} />
      <div className={s.sheenClip} style={{ clipPath: `url(#${clipId})` }}>
        <div className={s.sheen} />
      </div>
      {/* Curvature is fixed to the shape, so it sits outside the moving
          layer and is clipped directly. */}
      <div className={s.curve} style={{ clipPath: `url(#${clipId})` }} />
      <div className={s.lip} style={{ clipPath: `url(#${clipId})` }} />

      <div className={s.screen}>
        {/* --bl fades the additive lamp layer. The panel's own ground is
            already the unlit state, so one number covers both. */}
        <div className={s.lcd} style={{ ['--bl' as string]: backlight }}>
          {/* 176x132 logical, mapped 1:1 into the well at width 256 — an
              exact integer ratio, so `image-rendering: pixelated` has
              nothing to interpolate. Spec §8: no blurry upscaling. */}
          {booting && <BootMark />}
          {/* The twerkalizing potato lives under Extras > Twerkalizer now.
              It is a toy, not a loading state, and the boot screen wanted
              the banana. */}
          {!booting && overlay === 'blob' && <BootScreen message={message} />}
          {!booting && overlay === 'clock' && (
            <ClockScreen selected={clockSel} detail={clockDetail} />
          )}
          {!booting && overlay === 'about' && <AboutScreen />}
          {!booting && overlay === 'now' && nowTrack && (
            <NowPlaying
              state={{
                track: nowTrack,
                index: audio.state.index,
                total: tracks.length,
                elapsed: audio.state.elapsed,
                // Fall back to the manifest's duration until metadata lands,
                // so the bar is not stuck at zero for the first second.
                duration: audio.state.duration || nowTrack.duration || 0,
                playing: audio.state.playing,
                buffered: audio.state.buffered,
                // The header names where the track came from, as the real
                // screen did — the playlist, not the track counter.
                source: nowTrack.album ?? 'All Songs',
                error: audio.state.error,
                loading: audio.state.loading,
              }}
            />
          )}
          {!booting && !overlay && <Screen state={menu} />}
          {/* On the glass, so it persists across every screen. */}
          <ScreenCrack />
          <div className={s.backlight} />
          <div className={s.glass} />
        </div>
      </div>

      {/* A group rather than a button: it carries rotation, four glyph
          taps and a centre press, which is more than one control. */}
      <div
        ref={wheel.ref}
        className={s.wheel}
        role="group"
        aria-label="Click wheel. Arrow keys scroll, Enter selects, Escape goes back, Space plays. The keys also work while the pointer is over the device."
        tabIndex={0}
        onKeyDown={wheel.onKeyDown}
      >
        <span className={`${s.glyph} ${s.menu}`}>MENU</span>
        <span className={`${s.glyph} ${s.prev}`}>&#9668;&#9668;</span>
        <span className={`${s.glyph} ${s.next}`}>&#9658;&#9658;</span>
        <span className={`${s.glyph} ${s.play}`}>&#9658;&#10073;&#10073;</span>

        {/* The centre is a real button: it has one action, so it should be
            reachable and announced as one rather than being a div the
            wheel happens to hit-test around. */}
        <button
          type="button"
          className={s.center}
          data-press={pressed ? '1' : '0'}
          aria-label="Select"
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onClick={() => onButton('center')}
        />
          </div>
        </div>
      </div>
    </div>
  );
}
