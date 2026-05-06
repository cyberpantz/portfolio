import { gameSounds, interactionSounds } from '@/config/sounds';
import { getVolumeEnabled } from './volumeControl';

/**
 * Play a sound effect with fallback to vibration
 * @param soundKey - Key from foodSounds or interactionSounds, or direct file path
 * @param fallbackVibration - Whether to vibrate if sound fails (default: true)
 */
export function playSound(soundUrl: string, volume: number = 0.5, fallbackVibration: boolean = true) {
  // Check if volume is enabled
  if (!getVolumeEnabled() || !soundUrl) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = volume;
    audio.play().catch(() => {
      // Fallback to vibration if audio fails
      if (fallbackVibration && navigator.vibrate) {
        navigator.vibrate(10);
      }
    });
  } catch (error) {
    // Final fallback to vibration
    if (error && fallbackVibration && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }
}


/**
 * Play an interaction sound (drop, collect, etc.)
 * @param interactionType - The interaction type ('drop', 'default')
 */
export function playInteractionSound(interactionType: string = 'default') {
  const config = interactionSounds[interactionType]
  playSound(config.url, config.vol);
}

export function playGameSound(gameAction: string) {
  const config = gameSounds[gameAction]
  playSound(config.url, config.vol);
}
 