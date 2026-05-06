/**
 * Volume Control Utility
 * Manages global volume state with localStorage persistence
 */

const VOLUME_KEY = 'mealtrip_volume_enabled';

/**
 * Get volume enabled state from localStorage
 */
export function getVolumeEnabled(): boolean {
  if (typeof window === 'undefined') return true;

  const stored = localStorage.getItem(VOLUME_KEY);
  return stored === null ? true : stored === 'true';
}

/**
 * Set volume enabled state in localStorage
 */
export function setVolumeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(VOLUME_KEY, enabled.toString());
}

/**
 * Toggle volume enabled state
 */
export function toggleVolume(): boolean {
  const newState = !getVolumeEnabled();
  setVolumeEnabled(newState);
  return newState;
}
