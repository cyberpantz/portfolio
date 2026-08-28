import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2 } from 'lucide-react';
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import { PALETTES, CHROME } from './weather-vibe/conditions';
import { weatherAudio } from './weather-vibe/audio';
import SettingsPanel from './weather-vibe/SettingsPanel';
import { getActiveLayerLabels } from './weather-vibe/audio';
import GlobeModal from './weather-vibe/GlobeModal';

export default function WeatherVibe() {
  const { weather, status, setLocation } = useWeather();
  const audioStarted = useRef(false);
  /** Set by the effect below so the CTA button can invoke the same path. */
  const startAudioRef = useRef<(() => void) | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  /** Flips on the click itself, so the button can acknowledge before anything
      heavy happens. Distinct from audioReady, which drives the exit. */
  const [starting, setStarting] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const [globeOpen, setGlobeOpen] = useState(false);

  useEffect(() => {
    if (!weather) return;
    if (audioStarted.current) {
      // AudioContext already running — update immediately when location changes
      weatherAudio.setState(weather);
      return;
    }
    startAudioRef.current = () => {
      if (audioStarted.current) return;
      audioStarted.current = true;
      setStarting(true);
      setAudioReady(true);

      /*
        The audio work is deferred by two frames, and that is the whole fix
        for the CTA appearing to hang.

        weatherAudio.setState() constructs the AudioContext, generates
        pink-noise buffers and wires up oscillators — all synchronous, all on
        the main thread. Called immediately after setAudioReady it runs before
        React can paint, so the exit animation had no frame to start on and the
        button simply sat there until the audio graph finished building.

        One rAF gets us to the next frame; the second guarantees that frame has
        actually been painted before we block again.
      */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          weatherAudio.setState(weather);
        });
      });
    };
    const start = () => startAudioRef.current?.();
    // The window listeners stay: a click anywhere still counts, so nobody has
    // to find the button. The button exists for the people who look for one,
    // and for anyone on a keyboard, who a window click listener never serves.
    window.addEventListener('click', start, { once: true });
    window.addEventListener('touchstart', start, { once: true });
    return () => {
      window.removeEventListener('click', start);
      window.removeEventListener('touchstart', start);
    };
  }, [weather]);

  /*
   * This has to stay above the early return below.
   *
   * useWeather seeds its state from a localStorage cache, so on a first
   * ever visit `weather` is null for the first render, the early return
   * fires, and this hook never runs. When the fetch resolves the next
   * render does reach it — the hook count goes 5 → 6 and React throws
   * "Rendered more hooks than during the previous render", killing the
   * scene. On the second visit the cache is warm, `weather` is set on
   * render one, and the counts happen to match. That asymmetry is why
   * it only ever failed the first time.
   */
  const activeLayerLabels = useMemo(
    () => (weather ? getActiveLayerLabels(weather) : ''),
    [weather]
  );

  if (!weather) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-[var(--exp-chrome-h,0px)] bg-black flex items-center justify-center">
        <span style={{ fontFamily: 'monospace', color: '#C8D8F0', fontSize: 11, opacity: 0.4, letterSpacing: '0.2em' }}>
          LOCATING...
        </span>
      </div>
    );
  }

  const palette = PALETTES[weather.state];
  const bg = palette.background;

  return (
    <div
      className="fixed inset-x-0 bottom-0 top-[var(--exp-chrome-h,0px)]"
      style={{ background: bg }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={weather.state}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        >
          <Scene weather={weather} />
        </motion.div>
      </AnimatePresence>
      <HUD weather={weather} status={status} onOpenGlobe={() => setGlobeOpen(true)} />
      <SettingsPanel palette={palette} activeLayerLabels={activeLayerLabels} />
      <AnimatePresence>
        {!audioReady && (
          /*
            A real invitation, not a hint.

            This was 10px of monospace at 0.5 opacity, pulsing, with
            pointer-events disabled — it announced a requirement without
            offering a way to satisfy it, and half the piece is sound. Now it
            is a button: findable, clickable, and reachable by keyboard, which
            the window click listener never covered.
          */
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.6, delay: 0.8, ease: [0.19, 1, 0.22, 1] }}
            style={{ pointerEvents: 'auto' }}
          >
            <motion.button
              type="button"
              onClick={() => startAudioRef.current?.()}
              /* The breathing stops the instant it is pressed — a control that
                 keeps inviting you after you have accepted reads as broken. */
              animate={starting ? { scale: 0.97 } : { scale: [1, 1.035, 1] }}
              transition={
                starting
                  ? { duration: 0.18, ease: 'easeOut' }
                  : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
              }
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
              onFocus={() => setCtaHover(true)}
              onBlur={() => setCtaHover(false)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 20px',
                /*
                  The teal is the SITE's accent, not the weather's.

                  Filling with the weather palette's accent was nearly
                  invisible — against its own background it measures 1.16:1 on
                  a clear day and 1.40:1 in fog, because those palettes choose
                  accent to sit WITH the sky, so it cannot also stand out from
                  it. Filling with textColor read, but changed colour with
                  every weather and swamped the scene behind the glass.

                  A dark translucent panel with a teal edge solves both: the
                  background stays constant so the scene reads through it, and
                  the line that moves is the one colour that belongs to the
                  portfolio rather than to the forecast.
                */
                /*
                  Opaque enough to be read, not to be a slab.

                  At 0.34 alpha the label measured 2.32:1 over a snow sky and
                  3.29:1 over clear day — the glass was letting too much light
                  through for anything to sit on it. 0.58 puts the worst case
                  at 5.06:1 while blur(10px) keeps it reading as glass.

                  The resting colour is fixed, NOT palette.textColor. That
                  token is picked to contrast with the SKY; here it lands on
                  dark glass, so on light-sky weather it was dark navy on grey.
                */
                background: ctaHover || starting ? CHROME.glassStrong : CHROME.glass,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${ctaHover || starting ? CHROME.teal : `${CHROME.teal}4d`}`,
                boxShadow: ctaHover && !starting ? `0 0 0 3px ${CHROME.teal}1f` : '0 0 0 0 transparent',
                color: ctaHover || starting ? CHROME.teal : CHROME.fg,
                fontFamily: 'monospace',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                /* Always, not only on dark palettes — the glass is dark in
                   every weather now, so the text always benefits. */
                textShadow: '0 1px 6px rgba(0,0,0,0.55)',
                transition:
                  'background-color 0.45s cubic-bezier(0.19,1,0.22,1), border-color 0.45s cubic-bezier(0.19,1,0.22,1), color 0.45s cubic-bezier(0.19,1,0.22,1), box-shadow 0.45s cubic-bezier(0.19,1,0.22,1)',
              }}
            >
              <motion.span
                aria-hidden="true"
                style={{ display: 'inline-flex' }}
                animate={{ scale: ctaHover && !starting ? 1.15 : 1 }}
                transition={{ duration: 0.5, ease: [0.19, 1, 0.22, 1] }}
              >
                <Volume2 size={14} />
              </motion.span>
              {starting ? 'Starting' : 'Turn on sound'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {globeOpen && (
          <GlobeModal
            currentLat={weather.latitude}
            currentLng={weather.longitude}
            onClose={() => setGlobeOpen(false)}
            onLocate={async (lat, lng, label, population) => {
              await setLocation(lat, lng, label, population);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
