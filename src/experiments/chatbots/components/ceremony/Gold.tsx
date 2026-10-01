/** One hidden gradient for every gilded Lucide stroke: stroke="url(#sb-gold)". */
export function GoldDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id="sb-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#d9a84e" />
          <stop offset="1" stopColor="#7a5418" />
        </linearGradient>
      </defs>
    </svg>
  );
}
