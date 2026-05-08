import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWeather } from './weather-vibe/useWeather';
import Scene from './weather-vibe/Scene';
import HUD from './weather-vibe/HUD';
import { PALETTES } from './weather-vibe/conditions';
import { weatherAudio } from './weather-vibe/audio';

export default function WeatherVibe() {
  const { weather, status, setCity } = useWeather();
  const audioStarted = useRef(false);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    if (!weather) return;
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

  if (!weather) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <span style={{ fontFamily: 'monospace', color: '#C8D8F0', fontSize: 11, opacity: 0.4, letterSpacing: '0.2em' }}>
          LOCATING...
        </span>
      </div>
    );
  }

  const bg = PALETTES[weather.state].background;

  return (
    <div className="fixed inset-0" style={{ background: bg }}>
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
      <HUD weather={weather} status={status} onSetCity={setCity} />
      <AnimatePresence>
        {!audioReady && (
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.2em', color: PALETTES[weather.state].textColor }}
          >
            CLICK FOR AUDIO
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
