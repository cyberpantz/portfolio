import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import { PALETTES } from './weather-vibe/conditions';
import { weatherAudio } from './weather-vibe/audio';
import SettingsPanel from './weather-vibe/SettingsPanel';
import { getActiveLayerLabels } from './weather-vibe/audio';
import GlobeModal from './weather-vibe/GlobeModal';

export default function WeatherVibe() {
  const { weather, status, setLocation } = useWeather();
  const audioStarted = useRef(false);
  const [audioReady, setAudioReady] = useState(false);
  const [globeOpen, setGlobeOpen] = useState(false);

  useEffect(() => {
    if (!weather) return;
    if (audioStarted.current) {
      // AudioContext already running — update immediately when location changes
      weatherAudio.setState(weather);
      return;
    }
    const start = () => {
      if (audioStarted.current) return;
      audioStarted.current = true;
      setAudioReady(true);
      weatherAudio.setState(weather);
    };
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
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: palette.textColor }}
          >
            CLICK FOR AUDIO
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
