import { LCD_H, LCD_W } from './lcd/menu';

/**
 * A crack in the glass.
 *
 * Every one of these that survived to 2026 has one. It is drawn on the
 * GLASS, not into the LCD raster: damage sits above the picture, so it
 * stays put across the boot mark, the menus, the clock and Now Playing
 * rather than being something each screen has to remember to draw.
 *
 * Geometry is generated once from a seeded random walk — six fractures
 * radiating from an impact with four hairline branches — and then frozen
 * here. A crack that regenerated on every load would be a different
 * object every time you looked at it.
 *
 * Placed low and right, clear of the header bar and the selected row, so
 * it never lands on the text you are trying to read.
 */

const MAIN = [
  'M146.0 106.0 L140.2 102.7 L134.0 100.4 L127.9 97.6 L121.4 96.0 L115.0 94.4 L108.4 93.1',
  'M146.0 106.0 L147.1 101.8 L147.7 97.5 L148.5 93.3 L150.1 89.2 L151.9 85.3 L153.5 81.3',
  'M146.0 106.0 L148.5 107.4 L151.2 108.3 L153.8 109.3 L156.6 109.9 L159.4 110.0 L162.2 110.4',
  'M146.0 106.0 L142.8 109.4 L139.4 112.6 L136.0 115.8 L132.6 119.0 L128.8 121.7 L125.1 124.5',
  'M146.0 106.0 L151.2 105.0 L156.6 104.6 L161.8 103.6 L167.1 103.8 L172.4 103.1 L176.0 102.2',
  'M146.0 106.0 L145.7 108.5 L145.6 111.0 L145.6 113.5 L145.7 116.0 L145.4 118.5 L145.6 121.0',
];

const HAIR = [
  'M134.0 100.4 L130.2 101.1 L126.6 102.7 L123.2 104.4 L119.5 105.5',
  'M147.7 97.5 L146.9 95.5 L146.3 93.5 L145.7 91.5 L145.1 89.4',
  'M136.0 115.8 L132.8 116.2 L129.7 117.0 L126.6 117.6 L123.4 118.3',
  'M161.8 103.6 L163.6 101.1 L164.7 98.3 L165.9 95.4 L167.6 92.9',
];

const IMPACT = { x: 146, y: 106 };

export default function ScreenCrack() {
  return (
    <svg
      viewBox={`0 0 ${LCD_W} ${LCD_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        /* Above the LCD, below the specular. Damage is on the glass, the
           reflection is on top of the glass. */
        zIndex: 1,
      }}
    >
      {/*
        Each fracture is drawn TWICE: a dark line for the void, and a
        brighter one offset half a pixel up-left for the lit face of the
        split. That pairing is what makes it read as broken glass rather
        than as a scratch drawn on with a pen — a real crack has two
        surfaces and only one of them faces the lamp.
      */}
      <g fill="none" strokeLinecap="round">
        <g stroke="rgba(255,255,255,0.55)" transform="translate(-0.5,-0.5)">
          {MAIN.map((d, i) => (
            <path key={`mh${i}`} d={d} strokeWidth={0.9} />
          ))}
          {HAIR.map((d, i) => (
            <path key={`hh${i}`} d={d} strokeWidth={0.6} opacity={0.7} />
          ))}
        </g>
        <g stroke="rgba(38,52,92,0.55)">
          {MAIN.map((d, i) => (
            <path key={`m${i}`} d={d} strokeWidth={0.8} />
          ))}
          {HAIR.map((d, i) => (
            <path key={`h${i}`} d={d} strokeWidth={0.55} opacity={0.6} />
          ))}
        </g>

        {/* The impact itself: two small rings of crushed glass. */}
        <circle cx={IMPACT.x} cy={IMPACT.y} r={2.2} stroke="rgba(38,52,92,0.5)" strokeWidth={0.7} />
        <circle cx={IMPACT.x} cy={IMPACT.y} r={4.4} stroke="rgba(38,52,92,0.3)" strokeWidth={0.6} />
        <circle cx={IMPACT.x - 0.4} cy={IMPACT.y - 0.4} r={2.2} stroke="rgba(255,255,255,0.4)" strokeWidth={0.6} />
      </g>
    </svg>
  );
}
