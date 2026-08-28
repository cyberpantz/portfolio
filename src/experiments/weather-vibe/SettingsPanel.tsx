// src/experiments/weather-vibe/SettingsPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CHROME, type Palette } from './conditions';
import {
  getSettings, setAudio, setVisuals, setDock, resetSettings, useSettings,
  type AudioMultipliers, type VisualMultipliers, type Dock,
} from './settings';
import { weatherAudio } from './audio';
import { Volume2, VolumeX } from 'lucide-react';

interface SliderProps {
  label:    string;
  value:    number;        // 0–1, or 0–2 where max is 200
  onChange: (v: number) => void;
  accent?:  string;        // filled track + thumb color (MASTER only)
  textColor: string;
  /** Ceiling in percent. Visual effects go to 200 so the slider has somewhere
   *  to go ABOVE the shipped look; audio stays at 100, where 1.0 is unity
   *  gain and anything past it just clips. */
  max?: number;
}

function Slider({ label, value, onChange, accent, textColor, max = 100 }: SliderProps) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          color: textColor, fontFamily: 'monospace', fontSize: 11,
          letterSpacing: '0.1em', opacity: accent ? 1 : 0.85,
        }}>
          {label}
        </span>
        <span style={{ color: accent ?? textColor, fontFamily: 'monospace', fontSize: 11, opacity: 0.9 }}>
          {pct}%
        </span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={0}
        max={max}
        step={1}
        value={pct}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="sv-slider"
        style={{ color: accent ?? `rgba(176,192,208,0.7)` }}
      />
    </div>
  );
}

/** The panel's fixed ground — see the note where textColor is set. */
const PANEL_BG = '#04060E';

/** WCAG contrast of a hex colour against the panel ground. */
function contrastOnPanel(hex: string): number {
  const lum = (h: string) => {
    const v = h.replace('#', '');
    const ch = (i: number) => {
      const c = parseInt(v.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  };
  const a = lum(hex);
  const b = lum(PANEL_BG);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface SettingsPanelProps {
  palette:           Palette;
  activeLayerLabels: string;
}

export default function SettingsPanel({ palette, activeLayerLabels }: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [triggerHover, setTriggerHover] = useState(false);
  /* Seeded from the audio engine rather than assumed false — the panel can
     mount long after the toggle was last used, and a control that lies about
     its own state is worse than no control. */
  const [muted, setMuted] = useState(() => weatherAudio.isMuted);
  const toggleMute = () => {
    weatherAudio.toggle();
    setMuted(weatherAudio.isMuted);
  };
  const panelRef        = useRef<HTMLDivElement>(null);
  const triggerRef      = useRef<HTMLButtonElement>(null);
  const settings        = useSettings();
  /*
    The panel supplies its own foreground, and does NOT take it from the
    palette.

    palette.textColor is chosen to be legible against the SKY. This panel is a
    fixed near-black sheet, so on any light-sky weather that token is exactly
    the wrong colour: clear-day's #1A3A5C measures 1.74:1 here, golden hour
    1.39:1, and partly-cloudy, fog and snow are no better. Five of the nine
    states were effectively unreadable. It went unnoticed because the scene
    sat in overcast, whose textColor happens to be near-white at 16.5:1.

    A constant ground deserves a constant foreground, so this comes from
    CHROME in conditions.ts — the same tokens the audio CTA and the settings
    pill use. 13.47:1 here.
  */
  const textColor = CHROME.fg;

  /*
    Accent stays the weather's — it is emphasis on a dark sheet and most
    palettes clear 7:1 there. Storm's #2244AA does not, at 2.39:1.

    Measured rather than named: a hardcoded `state === 'storm'` check would
    silently stop protecting anything the moment a palette is retuned, and
    this keeps working for whatever gets added later.
  */
  const accent = contrastOnPanel(palette.accent) >= 3 ? palette.accent : CHROME.teal;

  // Inject slider styles once via DOM to prevent duplication across mounts
  useEffect(() => {
    const id = 'sv-slider-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      .sv-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 2px;
        background: rgba(176,192,208,0.12);
        border-radius: 1px;
        outline: none;
        cursor: pointer;
      }
      .sv-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
        margin-top: -4px;
        cursor: pointer;
      }
      .sv-slider::-moz-range-thumb {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: currentColor;
        border: none;
        cursor: pointer;
      }
    `;
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);

  // Close when clicking outside the panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleAudio(key: keyof AudioMultipliers, v: number) {
    const patch: Partial<AudioMultipliers> = { [key]: v };
    setAudio(patch);
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  function handleVisuals(key: keyof VisualMultipliers, v: number) {
    const patch: Partial<VisualMultipliers> = { [key]: v };
    setVisuals(patch);
  }

  function handleReset() {
    resetSettings();
    weatherAudio.setAudioMultipliers(getSettings().audio);
  }

  const dimBorder = `rgba(176,192,208,0.08)`;
  const isRight = settings.dock === 'right';

  /** Two small edge glyphs rather than a labelled control: the shape of the
   *  icon is the explanation, and it costs one line in a dense panel. */
  const dockBtn = (target: Dock, label: string) => {
    const active = settings.dock === target;
    return (
      <button
        key={target}
        type="button"
        onClick={() => setDock(target)}
        aria-label={label}
        aria-pressed={active}
        style={{
          width: 22, height: 22,
          display: 'grid', placeItems: 'center',
          background: 'none',
          border: `1px solid ${active ? `${accent}88` : dimBorder}`,
          cursor: 'pointer',
          opacity: active ? 1 : 0.55,
          transition: 'opacity 0.2s ease, border-color 0.2s ease',
        }}
      >
        {/* A 12x12 frame with the docked edge filled. */}
        <span aria-hidden="true" style={{ position: 'relative', width: 12, height: 12, border: `1px solid ${active ? accent : textColor}` }}>
          <span style={{
            position: 'absolute',
            background: active ? accent : textColor,
            ...(target === 'bottom'
              ? { left: 0, right: 0, bottom: 0, height: 4 }
              : { top: 0, bottom: 0, right: 0, width: 4 }),
          }} />
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Trigger pill — bottom-centre. It used to sit below the mute button;
          the mute control now lives inside this panel, so this is the only
          persistent chrome at the bottom of the scene. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        /* Flush with the bottom edge — a tab is attached to something. */
        style={{ bottom: 0, pointerEvents: 'auto', zIndex: 20 }}
      >
        <button
          ref={triggerRef}
          onClick={() => setOpen(o => !o)}
          onMouseEnter={() => setTriggerHover(true)}
          onMouseLeave={() => setTriggerHover(false)}
          onFocus={() => setTriggerHover(true)}
          onBlur={() => setTriggerHover(false)}
          aria-label={open ? 'Close settings' : 'Open settings'}
          aria-expanded={open}
          style={{
            /* Dark glass in both states. It used to be a near-transparent
               light wash (0.07 alpha) carrying palette.textColor, which on
               light-sky weather meant dark navy on a pale sky — the same
               mistake as the CTA.

               It also had no hover at all: `transition: opacity, background`
               was declared but nothing ever changed them, so it sat at 0.5
               opacity permanently and never answered the pointer. Inline
               styles cannot express :hover, which is why this needs state. */
            background: open || triggerHover ? CHROME.glassStrong : CHROME.glass,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',

            /* A tab, not a pill: rounded at the top, square where it meets the
               edge, and with no bottom border — the edge it sits on is its
               fourth side. */
            borderRadius: '10px 10px 0 0',
            borderTop: `1px solid rgba(176,192,208,${open || triggerHover ? 0.22 : 0.12})`,
            borderLeft: `1px solid rgba(176,192,208,${open || triggerHover ? 0.22 : 0.12})`,
            borderRight: `1px solid rgba(176,192,208,${open || triggerHover ? 0.22 : 0.12})`,
            borderBottom: 'none',

            /*
              It GROWS upward rather than translating.

              Nudging a bottom-anchored tab with translateY lifts it clear of
              the edge and opens a gap underneath, which reads as detached.
              Adding the movement to padding-top instead keeps the base pinned
              while the tab gets taller — the same nudge, still attached.
            */
            padding: `${triggerHover || open ? 9 : 4}px 16px 6px`,

            color: triggerHover ? '#FFFFFF' : CHROME.fg,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            fontFamily: 'monospace',
            fontSize: 9,
            letterSpacing: '0.15em',
            opacity: open || triggerHover ? 1 : 0.62,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            /* Same easing as the audio CTA and the portfolio's buttons. */
            transition:
              'opacity 0.4s cubic-bezier(0.19,1,0.22,1), background-color 0.4s cubic-bezier(0.19,1,0.22,1), border-color 0.4s cubic-bezier(0.19,1,0.22,1), color 0.4s cubic-bezier(0.19,1,0.22,1), padding-top 0.4s cubic-bezier(0.19,1,0.22,1)',
          }}
        >
          {/* The gear turns — the one gesture this control can make that means
              what the control does. Matches the theme toggle's disc on the
              main site. */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transform: `rotate(${open ? 90 : triggerHover ? 60 : 0}deg)`,
              transition: 'transform 0.6s cubic-bezier(0.19,1,0.22,1)',
            }}
          >
            ⚙
          </span>
          SETTINGS
        </button>
      </div>

      {/* Scene dim overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: 'none', zIndex: 19 }}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            className={isRight ? 'absolute top-0 right-0 bottom-0' : 'absolute bottom-0 left-0 right-0'}
            /* Each dock slides in off its own edge — a right-hand panel that
               rose from the floor would read as the wrong drawer. */
            initial={isRight ? { x: '100%' } : { y: '100%' }}
            animate={isRight ? { x: 0 } : { y: 0 }}
            exit={isRight ? { x: '100%' } : { y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            style={{
              background: 'rgba(4,6,14,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              ...(isRight
                ? {
                    width: 'min(340px, 86vw)',
                    borderLeft: `1px solid rgba(176,192,208,0.12)`,
                    overflowY: 'auto' as const,
                  }
                : { borderTop: `1px solid rgba(176,192,208,0.12)` }),
              zIndex: 25,
              pointerEvents: 'auto',
            }}
          >
            {/*
              Panel chrome strip: grab bar plus the dock switcher.

              The switcher started next to RESET, which was wrong in the right
              dock — a 340px column cannot hold the layer list and three
              controls, so the layer list truncated to make room. This strip is
              empty in both orientations and is where panel-level controls
              belong: at the panel's own edge, not among the scene settings.
            */}
            <div style={{ position: 'relative', padding: isRight ? '12px 12px 6px' : '10px 16px 6px' }}>
              {/* Grab bar — horizontal on the bottom dock, vertical on the
                  right, so it always reads as the edge you would pull. */}
              <div style={{
                width: isRight ? 3 : 32,
                height: isRight ? 28 : 3,
                background: 'rgba(176,192,208,0.22)',
                borderRadius: 2,
                margin: isRight ? '0 0 0 2px' : '2px auto 0',
              }} />

              <div style={{
                position: 'absolute',
                top: isRight ? 10 : 6,
                right: 12,
                display: 'flex',
                gap: 6,
              }}>
                {dockBtn('bottom', 'Dock panel to the bottom')}
                {dockBtn('right', 'Dock panel to the right')}
              </div>
            </div>

            <div style={{ padding: '0 20px 18px' }}>
              {/* Two-column layout */}
              {/* Side by side across the bottom; stacked down the right, where
                  there is height but no width. */}
              <div style={{ display: 'flex', gap: 20, flexDirection: isRight ? 'column' : 'row' }}>

                {/* ── Audio ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 10,
                    letterSpacing: '0.2em', opacity: 0.7,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>AUDIO</div>

                  {/*
                    A switch, not a button.

                    role="switch" with aria-checked is the accurate semantic:
                    this is a persistent on/off state, and a switch announces
                    "Sound, on" rather than leaving a screen reader to infer
                    whether a pressed button means sound is on or that pressing
                    turns it on. The label stays fixed and the control moves —
                    which is the point of a switch, and why it reads at a glance
                    next to the sliders it governs.
                  */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!muted}
                    onClick={toggleMute}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      width: '100%',
                      marginBottom: 14,
                      padding: '7px 2px 11px',
                      background: 'none',
                      border: 'none',
                      borderBottom: `1px solid ${dimBorder}`,
                      color: textColor,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: muted ? 0.6 : 0.9 }}>
                      {muted
                        ? <VolumeX size={13} aria-hidden="true" />
                        : <Volume2 size={13} aria-hidden="true" style={{ color: accent }} />}
                      SOUND
                    </span>

                    {/* Track */}
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'relative',
                        flex: 'none',
                        width: 34,
                        height: 18,
                        borderRadius: 9,
                        background: muted ? 'rgba(176,192,208,0.14)' : accent,
                        opacity: muted ? 1 : 0.9,
                        transition: 'background-color 0.32s cubic-bezier(0.19,1,0.22,1)',
                      }}
                    >
                      {/* Thumb */}
                      <span
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: 3,
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: muted ? 'rgba(176,192,208,0.55)' : 'rgba(4,6,14,0.92)',
                          transform: `translateX(${muted ? 0 : 16}px)`,
                          transition:
                            'transform 0.32s cubic-bezier(0.19,1,0.22,1), background-color 0.32s ease',
                        }}
                      />
                    </span>
                  </button>

                  <Slider label="MASTER"   value={settings.audio.master}  accent={accent} textColor={textColor} onChange={v => handleAudio('master',  v)} />
                  <Slider label="AMBIENT"  value={settings.audio.ambient}  textColor={textColor} onChange={v => handleAudio('ambient',  v)} />
                  <Slider label="EFFECTS"  value={settings.audio.effects}  textColor={textColor} onChange={v => handleAudio('effects',  v)} />
                  <Slider label="CITY HUM" value={settings.audio.cityHum}  textColor={textColor} onChange={v => handleAudio('cityHum',  v)} />
                </div>

                {/* Divider */}
                {/* The rule turns with the layout. */}
                <div style={isRight
                  ? { height: 1, background: dimBorder }
                  : { width: 1, background: dimBorder }} />

                {/* ── Visuals ── */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: textColor, fontFamily: 'monospace', fontSize: 10,
                    letterSpacing: '0.2em', opacity: 0.7,
                    marginBottom: 12, paddingBottom: 6,
                    borderBottom: `1px solid ${dimBorder}`,
                  }}>VISUALS</div>

                  <Slider label="BLOOM"       value={settings.visuals.bloom}    textColor={textColor} onChange={v => handleVisuals('bloom',    v)} max={200} />
                  <Slider label="VIGNETTE"    value={settings.visuals.vignette}  textColor={textColor} onChange={v => handleVisuals('vignette',  v)} max={200} />
                  <Slider label="GRAIN"       value={settings.visuals.grain}     textColor={textColor} onChange={v => handleVisuals('grain',     v)} max={200} />
                  <Slider label="ABERRATION"  value={settings.visuals.ca}        textColor={textColor} onChange={v => handleVisuals('ca',        v)} max={200} />
                </div>
              </div>

              {/* Footer: active layers + reset */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 14, paddingTop: 10,
                borderTop: `1px solid rgba(176,192,208,0.06)`,
              }}>
                <span style={{
                  color: textColor, fontFamily: 'monospace',
                  fontSize: 10, letterSpacing: '0.1em', opacity: 0.55,
                  minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {activeLayerLabels}
                </span>

                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    flex: 'none',
                    background: 'none',
                    border: `1px solid rgba(176,192,208,0.15)`,
                    color: textColor,
                    fontFamily: 'monospace',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    padding: '4px 10px',
                    borderRadius: 2,
                    cursor: 'pointer',
                    opacity: 0.75,
                  }}
                >
                  RESET
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
