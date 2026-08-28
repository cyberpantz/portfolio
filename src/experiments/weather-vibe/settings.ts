import { useState, useEffect } from 'react';

export interface AudioMultipliers {
  master:  number;
  ambient: number;
  effects: number;
  cityHum: number;
}

export interface VisualMultipliers {
  bloom:    number;
  vignette: number;
  grain:    number;
  ca:       number;
}

/** Which edge the settings panel is attached to. */
export type Dock = 'bottom' | 'right';

export interface Settings {
  audio:   AudioMultipliers;
  visuals: VisualMultipliers;
  /** Persisted like everything else here — a layout choice someone made once
   *  should not be undone by a reload. */
  dock:    Dock;
}

const STORAGE_KEY = 'weather-vibe-settings';

const DEFAULTS: Settings = {
  audio:   { master: 1, ambient: 1, effects: 1, cityHum: 1 },
  visuals: { bloom: 1, vignette: 1, grain: 1, ca: 1 },
  dock:    'bottom',
};

const fresh = (): Settings => ({
  audio:   { ...DEFAULTS.audio },
  visuals: { ...DEFAULTS.visuals },
  dock:    DEFAULTS.dock,
});

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      audio:   { ...DEFAULTS.audio,   ...(parsed.audio   ?? {}) },
      visuals: { ...DEFAULTS.visuals, ...(parsed.visuals ?? {}) },
      // Validated rather than trusted: this value is read straight back out of
      // localStorage, where anything could be sitting.
      dock:    parsed.dock === 'right' ? 'right' : 'bottom',
    };
  } catch {
    return fresh();
  }
}

let state: Settings = loadFromStorage();
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function getSettings(): Settings { return state; }

export function setAudio(partial: Partial<AudioMultipliers>): void {
  state = { ...state, audio: { ...state.audio, ...partial } };
  persist();
  notify();
}

export function setVisuals(partial: Partial<VisualMultipliers>): void {
  state = { ...state, visuals: { ...state.visuals, ...partial } };
  persist();
  notify();
}

export function setDock(dock: Dock): void {
  state = { ...state, dock };
  persist();
  notify();
}

export function resetSettings(): void {
  // Dock is deliberately preserved. RESET is understood as "put the sliders
  // back", and having the panel leap to the other edge would read as a bug.
  const { dock } = state;
  state = { ...fresh(), dock };
  persist();
  notify();
}

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(state);
  useEffect(() => {
    const fn = () => setS({ ...state });
    listeners.add(fn);
    fn(); // sync once to catch any mutation between useState init and subscription
    return () => { listeners.delete(fn); };
  }, []);
  return s;
}
