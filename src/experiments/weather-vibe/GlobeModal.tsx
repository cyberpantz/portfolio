import { Canvas } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import GlobeScene from './GlobeScene';
import { formatReverseGeocodeLabel, geocodeCity } from './useWeather';
import type { ReverseGeocodeResponse } from './useWeather';

interface GlobeModalProps {
  currentLat: number;
  currentLng: number;
  onLocate: (lat: number, lng: number, label?: string, population?: number) => void | Promise<void>;
  onClose: () => void;
}

type Pin = { lat: number; lng: number; label?: string; population?: number };
type ExitPhase = 'open' | 'closing' | 'locating';
type AnimateCameraTo = (lat: number, lng: number) => Promise<void>;

const EXIT_MS = 420;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    );
    const geo = (await res.json()) as ReverseGeocodeResponse;
    return formatReverseGeocodeLabel(geo) ?? `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
  }
}

export default function GlobeModal({
  currentLat,
  currentLng,
  onLocate,
  onClose,
}: GlobeModalProps) {
  const [query, setQuery] = useState('');
  const [pendingPin, setPendingPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [exitPhase, setExitPhase] = useState<ExitPhase>('open');
  const animateCameraToRef = useRef<AnimateCameraTo | null>(null);

  useEffect(() => {
    void animateCameraToRef.current?.(currentLat, currentLng);
  }, [currentLat, currentLng]);

  const closeWithAnimation = useCallback(async () => {
    if (exitPhase !== 'open') return;
    setExitPhase('closing');
    await delay(EXIT_MS);
    onClose();
  }, [exitPhase, onClose]);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') void closeWithAnimation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeWithAnimation]);

  async function search() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const result = await geocodeCity(trimmed);
      if (!result) {
        setShakeKey((n) => n + 1);
        return;
      }
      const pin = {
        lat: result.latitude,
        lng: result.longitude,
        label: result.name,
        population: result.population,
      };
      setPendingPin(pin);
      setQuery(result.name);
      void animateCameraToRef.current?.(pin.lat, pin.lng);
    } finally {
      setLoading(false);
    }
  }

  async function handlePinDrop(lat: number, lng: number) {
    const label = await reverseGeocode(lat, lng);
    const pin = { lat, lng, label };
    setPendingPin(pin);
    setQuery(label);
    void animateCameraToRef.current?.(lat, lng);
  }

  async function handleLocate() {
    if (!pendingPin) return;
    setLoading(true);
    await animateCameraToRef.current?.(pendingPin.lat, pendingPin.lng);
    setExitPhase('locating');
    await delay(EXIT_MS);
    onClose();
    await onLocate(pendingPin.lat, pendingPin.lng, query.trim() || pendingPin.label, pendingPin.population);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void search();
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: exitPhase === 'open' ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: exitPhase === 'open' ? 0.28 : EXIT_MS / 1000, ease: 'easeInOut' }}
      onClick={() => void closeWithAnimation()}
    >
      <motion.div
        className="relative flex w-full max-w-[920px] flex-col items-center"
        initial={{ opacity: 0, scale: 0.88 }}
        animate={
          exitPhase === 'locating'
            ? { opacity: 0, scale: 0.42, y: -140, rotateZ: -5, filter: 'blur(3px)' }
            : exitPhase === 'closing'
              ? { opacity: 0, scale: 0.76, y: -34, filter: 'blur(2px)' }
              : { opacity: 1, scale: 1, y: 0, rotateZ: 0, filter: 'blur(0px)' }
        }
        exit={{ opacity: 0, scale: 0.88 }}
        transition={
          exitPhase === 'open'
            ? { type: 'spring', stiffness: 280, damping: 24 }
            : { duration: EXIT_MS / 1000, ease: [0.55, 0, 0.1, 1] }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void closeWithAnimation()}
          disabled={exitPhase !== 'open'}
          className="absolute -right-1 -top-9 font-mono text-[11px] tracking-[0.2em] text-white/55 transition hover:text-white"
        >
          CLOSE
        </button>

        <div className="h-[min(92vw,72vh,760px)] w-[min(92vw,72vh,760px)]">
          <Canvas camera={{ position: [0, 0, 5], fov: 45 }} gl={{ alpha: true, antialias: true }}>
            <GlobeScene
              currentLat={currentLat}
              currentLng={currentLng}
              pendingPin={pendingPin}
              onPinDrop={handlePinDrop}
              animateCameraToRef={animateCameraToRef}
            />
          </Canvas>
        </div>

        <motion.input
          key={shakeKey}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="city, region or country..."
          autoComplete="off"
          spellCheck={false}
          aria-label="Search for a location"
          animate={shakeKey ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
          transition={{ duration: 0.3 }}
          className="mt-4 w-full max-w-[340px] border border-white/25 bg-transparent px-3 py-2 text-center font-mono text-[12px] tracking-[0.14em] text-white outline-hidden placeholder:text-white/35 focus:border-white/60"
        />

        {pendingPin ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleLocate}
            disabled={loading || exitPhase !== 'open'}
            /* The shared experiment button: bordered, uppercase, teal, filling
               on hover. Same class list as the Quizzolator's Begin — this was
               the one control still styled as bare text, which read as a link
               rather than the primary action of the screen. */
            className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-3 border border-accent
                       px-7 text-exp-micro font-medium tracking-[0.16em] uppercase text-accent
                       transition-colors duration-300 hover:bg-accent hover:text-ink
                       disabled:cursor-not-allowed disabled:border-rule disabled:text-exp-dim
                       disabled:hover:bg-transparent"
          >
            {loading ? 'Going' : 'Go'}
            <span aria-hidden="true">→</span>
          </motion.button>
        ) : (
          <p className="mt-4 font-mono text-[10px] tracking-[0.18em] text-white/35">
            DRAG GLOBE · CLICK SURFACE · ENTER TO SEARCH
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
