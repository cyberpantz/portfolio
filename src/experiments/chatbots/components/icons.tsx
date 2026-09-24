/**
 * One icon set, drawn on a single 16px grid at one optical weight.
 *
 * Inline SVG rather than a font or a library: they inherit currentColor,
 * they are sized to the type they sit beside, and there is no second
 * library's idea of a line weight to argue with. `aria-hidden` on all of
 * them — every icon here sits beside its own label.
 */
const S = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function OptionIcon({ name }: { name: string }) {
  switch (name) {
    case 'er':
      return (
        <svg {...S}>
          <path d="M8 2.6v10.8M2.6 8h10.8" />
        </svg>
      );
    case 'urgent':
      return (
        <svg {...S}>
          <path d="M2.4 7.2 8 2.8l5.6 4.4" />
          <path d="M3.9 6.8v6.4h8.2V6.8" />
        </svg>
      );
    case 'tele':
      return (
        <svg {...S}>
          <rect x="2.2" y="3.1" width="11.6" height="8" rx="1.4" />
          <path d="M5.6 13.4h4.8" />
        </svg>
      );
    case 'primary':
      return (
        <svg {...S}>
          <circle cx="8" cy="5.6" r="2.6" />
          <path d="M3.2 13.4c0-2.6 2.1-4.2 4.8-4.2s4.8 1.6 4.8 4.2" />
        </svg>
      );
    default:
      return (
        <svg {...S}>
          <circle cx="8" cy="8" r="5.2" />
        </svg>
      );
  }
}

export function SendIcon() {
  return (
    <svg {...S} strokeWidth={1.6}>
      <path d="M3 8h9.2M8.6 4.2 12.8 8l-4.2 3.8" />
    </svg>
  );
}
