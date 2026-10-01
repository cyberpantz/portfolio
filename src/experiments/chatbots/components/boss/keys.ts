type Closest = { closest?: (sel: string) => unknown };

/** Space/Enter press Cancel — unless focus is on some other control, which handles its own keys. */
export function isPressKey(e: { key: string; target: unknown }, pressEl: unknown): boolean {
  if (e.key !== ' ' && e.key !== 'Enter') return false;
  const own = (e.target as Closest)?.closest?.('button, a, input, textarea, select');
  return !own || own === pressEl;
}
