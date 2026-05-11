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

export interface Settings {
  audio:   AudioMultipliers;
  visuals: VisualMultipliers;
}

const STORAGE_KEY = 'weather-vibe-settings';

const DEFAULTS: Settings = {
  audio:   { master: 1, ambient: 1, effects: 1, cityHum: 1 },
  visuals: { bloom: 1, vignette: 1, grain: 1, ca: 1 },
};

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      audio:   { ...DEFAULTS.audio,   ...(parsed.audio   ?? {}) },
      visuals: { ...DEFAULTS.visuals, ...(parsed.visuals ?? {}) },
    };
  } catch {
    return { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
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

export function resetSettings(): void {
  state = { audio: { ...DEFAULTS.audio }, visuals: { ...DEFAULTS.visuals } };
  persist();
  notify();
}

export function useSettings(): Settings {
  const [s, setS] = useState<Settings>(state);
  useEffect(() => {
    const fn = () => setS({ ...state });
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return s;
}
