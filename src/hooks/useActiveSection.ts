import { useEffect, useState } from 'react';

/**
 * Tracks which section is currently in view based on scroll position.
 * Returns the id of the active section.
 */
export function useActiveSection(ids: string[], offset = 80): string {
  const [active, setActive] = useState(ids[0] ?? '');

  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + offset;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) current = id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [ids, offset]);

  return active;
}
