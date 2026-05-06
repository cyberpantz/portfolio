import { useEffect } from 'react';

/**
 * Bind ←/→ to step a numeric index within [0, max).
 */
export function useKeyboardNav(setter: (fn: (i: number) => number) => void, max: number) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setter((i) => Math.min(i + 1, max - 1));
      if (e.key === 'ArrowLeft')  setter((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setter, max]);
}
