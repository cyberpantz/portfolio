/**
 * The ear section.
 *
 * The artwork is Frank's, supplied as SVG. I restyled it to the skin
 * tokens and wired the regions; I did not draw it.
 *
 * That division of labour is deliberate and worth recording. Six attempts
 * at drawing this by writing bezier control points and checking the
 * render all failed the same way — the render tells you "that's a
 * banana", but translating that into "move the second control point four
 * units left" is another guess, so every iteration is a fresh roll rather
 * than a refinement. Given a real path, the remaining work — restyling,
 * mapping four regions, placing one shape — is positioning against a
 * fixed reference, which converges.
 *
 * Decorative: the text buttons beside it are the real controls at every
 * width. Hence aria-hidden, and hidden entirely below 420px.
 */
/**
 * Regions answer the pointer, not just report to it.
 *
 * The drawing started as a readout: hover a text button, watch the
 * matching part light up. That is half a map. The obvious gesture —
 * pointing at the thing you mean — did nothing, which makes the picture
 * look decorative even while it is being highlighted.
 *
 * So the shapes take the pointer too. Hover previews, click answers, and
 * the two halves stay in sync because they share one `hover` state in
 * the Picker above.
 *
 * ACCESSIBILITY IS UNCHANGED, deliberately. The svg stays `aria-hidden`
 * and out of the tab order: these are pointer-only shortcuts to buttons
 * that already exist, not a second set of controls. A keyboard or screen
 * reader user loses nothing, because the list beside it IS the control
 * and always was. Adding focusable regions would mean two tab stops per
 * answer, which is worse than none.
 */
export function EarDiagram({
  active,
  onHover,
  onPick,
  frozen,
}: {
  active: string | null;
  onHover?: (id: string | null) => void;
  onPick?: (id: string) => void;
  /** Once answered, the drawing stops taking input like everything else. */
  frozen?: boolean;
}) {
  const on = (id: string) => active === id;

  /** Pointer wiring, identical for every region in every diagram. */
  const hit = (id: string) =>
    frozen
      ? {}
      : {
          // Stroke-only shapes have almost no fill to hit; this makes the
          // whole region clickable rather than just its outline.
          pointerEvents: 'all' as const,
          cursor: 'pointer',
          onPointerEnter: () => onHover?.(id),
          onPointerLeave: () => onHover?.(null),
          onClick: () => onPick?.(id),
        };

  /** A selectable region: fills and thickens when it is the answer. */
  const region = (id: string, w = 8) => ({
    fill: 'currentColor',
    fillOpacity: on(id) ? 0.15 : 0,
    stroke: 'currentColor',
    strokeWidth: on(id) ? w * 1.5 : w,
    strokeOpacity: on(id) ? 1 : 0.45,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    style: {
      transition: 'fill-opacity 140ms ease, stroke-opacity 140ms ease, stroke-width 140ms ease',
    },
  });

  /** Context that is never an answer — the skull walls, the ear's folds. */
  const detail = (w: number, opacity: number) => ({
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: w,
    strokeOpacity: opacity,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  });

  return (
    <svg
      // Cropped to the artwork's real ink bounds, which the source
      // viewBox cut off at the bottom of the lobe.
      viewBox="36 40 786 600"
      width="150"
      height="115"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ color: 'var(--s-accent)', flex: 'none' }}
    >
      {/* canal walls running back into the skull */}
      <path
        d="M346 280C385 216 446 188 514 197c56 7 91 45 146 46 54 2 85-39 142-41"
        {...detail(5, 0.22)}
      />
      <path
        d="M338 387c45 56 106 77 171 68 58-8 97-46 151-44 54 1 88 42 144 44"
        {...detail(5, 0.22)}
      />

      {/* behind the ear — the mastoid. The one shape not in the source,
          tucked against the ear and under the canal so it reads as
          attached rather than as a floating lozenge. */}
      <path
        d="M300 430c60-22 140-12 166 26 24 36-48 66-120 50-50-11-70-52-46-76Z"
        {...region('behind', 6)} {...hit('behind')}
      />

      {/* outside — the pinna */}
      <path
        d="M282 62C180 43 89 113 64 234c-23 112 11 203 61 273 37 52 41 99 91 112 55 15 102-22 103-81 1-45-22-80-15-116 6-31 26-50 49-72 36-34 58-82 56-139-3-79-48-135-127-149Z"
        {...region('outer')} {...hit('outer')}
      />
      <path
        d="M278 126c-63-17-116 30-129 108-11 66 10 125 48 151 24 16 56 12 69 36 12 23 2 49 22 65"
        {...detail(6, 0.3)}
      />
      <path
        d="M282 157c35 20 40 64 12 94-25 26-69 20-88 54-12 21-13 46-4 68"
        {...detail(6, 0.3)}
      />

      {/* in the canal — entrance and middle read as one answer */}
      <path
        d="M299 327C323 303 346 284 381 280L500 280 500 386 379 382c-36-1-57 14-80 42-17-28-18-68 0-97Z"
        {...region('canal', 6)} {...hit('canal')}
      />
      <path d="M500 280H622V389l-122-3Z" {...region('canal', 6)} {...hit('canal')} />

      {/* deeper / inside — the far segment, against the drum */}
      <path d="M622 280H744c25 0 39 22 39 55s-14 56-39 56l-122-2Z" {...region('deep', 6)} {...hit('deep')} />

      {/* the eardrum: always drawn, never selectable. It is the landmark
          that makes "deeper" mean anything. */}
      <ellipse cx="756" cy="335" rx="30" ry="58" {...detail(6, 0.7)} />
    </svg>
  );
}
