/**
 * Tone Generator Utility
 * Creates clean, musical tones using Web Audio API
 * Desktop only - no mobile support
 */

import { getVolumeEnabled } from './volumeControl';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  return audioContext;
}

/**
 * Resume the AudioContext — call synchronously inside a user gesture (tap/click).
 * Required on iOS before any tones will play; safe to call multiple times.
 */
export function resumeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/**
 * Play a musical tone
 * @param frequency - Frequency in Hz (e.g., 440 for A4)
 * @param duration - Duration in seconds (default 0.15)
 * @param volume - Volume from 0 to 1 (default 0.3)
 */
export function playTone(frequency: number, duration: number = 0.15, volume: number = 0.3): void {
  // Check if volume is enabled
  if (!getVolumeEnabled()) return;

  const context = getAudioContext();
  if (!context) return; // Skip on mobile or if context unavailable

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine'; // Clean sine wave tone

  // Quick fade out to avoid clicking
  gainNode.gain.setValueAtTime(volume, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + duration);
}

/**
 * Musical notes for Simon Says-style interactions
 * Extended chromatic scale frequencies (6 octaves including sub-bass)
 */
export const MUSICAL_NOTES = {
  // Octave 1 (sub-bass - 808 territory)
  C1: 32.70,
  Db1: 34.65,
  D1: 36.71,
  Eb1: 38.89,
  E1: 41.20,
  F1: 43.65,
  Gb1: 46.25,
  G1: 49.00,
  Ab1: 51.91,
  A1: 55.00,
  Bb1: 58.27,
  B1: 61.74,

  // Octave 2 (bass/sub-bass)
  C2: 65.41,
  Db2: 69.30,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  Gb2: 92.50,
  G2: 98.00,
  Ab2: 103.83,
  A2: 110.00,
  Bb2: 116.54,
  B2: 123.47,

  // Octave 3 (lower)
  C3: 130.81,
  Db3: 138.59,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  Gb3: 185.00,
  G3: 196.00,
  Ab3: 207.65,
  A3: 220.00,
  Bb3: 233.08,
  B3: 246.94,

  // Octave 4 (middle)
  C4: 261.63,
  Db4: 277.18,
  D4: 293.66,
  Eb4: 311.13,
  E4: 329.63,
  F4: 349.23,
  Gb4: 369.99,
  G4: 392.00,
  Ab4: 415.30,
  A4: 440.00,
  Bb4: 466.16,
  B4: 493.88,

  // Octave 5 (higher)
  C5: 523.25,
  Db5: 554.37,
  D5: 587.33,
  Eb5: 622.25,
  E5: 659.25,
  F5: 698.46,
  Gb5: 739.99,
  G5: 783.99,
  Ab5: 830.61,
  A5: 880.00,
  Bb5: 932.33,
  B5: 987.77,

  // Octave 6 (even higher - for bells/chimes/cymbals)
  C6: 1046.50,
  Db6: 1108.73,
  D6: 1174.66,
  Eb6: 1244.51,
  E6: 1318.51,
  F6: 1396.91,
  Gb6: 1479.98,
  G6: 1567.98,
  Ab6: 1661.22,
  A6: 1760.00,
  Bb6: 1864.66,
  B6: 1975.53,
} as const;


/**
 * Play a note by name
 */
export function playNote(note: keyof typeof MUSICAL_NOTES, duration?: number, volume?: number): void {
  playTone(MUSICAL_NOTES[note], duration, volume);
}

/**
 * Drum types for rhythm
 */
export type DrumType = 'kick' | 'snare' | 'hihat' | 'crash';

/**
 * Melody definition for sequencing notes and drums
 */
export interface MelodyNote {
  note: keyof typeof MUSICAL_NOTES | 'rest';
  duration: number; // Duration in seconds
  drum?: DrumType; // Optional drum hit
}

/**
 * Play an 808-style kick drum
 */
function playKick(context: AudioContext, startTime: number, volume: number = 0.5): void {
  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.connect(gain);
  gain.connect(context.destination);

  // Pitch envelope: 150Hz → 40Hz (punchy drop)
  osc.frequency.setValueAtTime(150, startTime);
  osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.5);

  // Volume envelope
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

  osc.start(startTime);
  osc.stop(startTime + 0.5);
}

/**
 * Play a snare drum
 */
function playSnare(context: AudioContext, startTime: number, volume: number = 0.4): void {
  // Create white noise
  const bufferSize = context.sampleRate * 0.2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;

  // High-pass filter for snare brightness
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1000;

  const gain = context.createGain();

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

  noise.start(startTime);
  noise.stop(startTime + 0.2);
}

/**
 * Play a closed hi-hat
 */
function playHiHat(context: AudioContext, startTime: number, volume: number = 0.2): void {
  // Create white noise
  const bufferSize = context.sampleRate * 0.05;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;

  // Very high filter for metallic sound
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;

  const gain = context.createGain();

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);

  noise.start(startTime);
  noise.stop(startTime + 0.05);
}

/**
 * Play a crash cymbal
 */
function playCrash(context: AudioContext, startTime: number, volume: number = 0.5): void {
  // Create white noise
  const bufferSize = context.sampleRate * 2.0; // Longer for crash sustain
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = buffer;

  // Band-pass filter for cymbal shimmer
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 4000; // Bright metallic range
  filter.Q.value = 1.0;

  const gain = context.createGain();

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  // Long decay for crash
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.5);

  noise.start(startTime);
  noise.stop(startTime + 1.5);
}

/**
 * Play a sequence of notes as a melody with optional drums
 * @param melody - Array of notes with durations and optional drums
 * @param volume - Overall volume for the melody (default 0.3)
 */
export function playMelody(melody: MelodyNote[], volume: number = 0.3): void {
  // Check if volume is enabled
  if (!getVolumeEnabled()) return;

  const context = getAudioContext();
  if (!context) return; // Skip on mobile or if context unavailable

  let currentTime = context.currentTime;

  melody.forEach(({ note, duration, drum }) => {
    // Play note if not a rest
    if (note !== 'rest') {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.value = MUSICAL_NOTES[note];
      oscillator.type = 'triangle'; // Softer sound for melodies

      // Fade in and out to avoid clicks
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + duration);
    }

    // Play drum if specified
    if (drum) {
      switch (drum) {
        case 'kick':
          playKick(context, currentTime, volume * 1.2);
          break;
        case 'snare':
          playSnare(context, currentTime, volume * 0.8);
          break;
        case 'hihat':
          playHiHat(context, currentTime, volume * 0.6);
          break;
        case 'crash':
          playCrash(context, currentTime, volume * 1.0);
          break;
      }
    }

    currentTime += duration;
  });
}
