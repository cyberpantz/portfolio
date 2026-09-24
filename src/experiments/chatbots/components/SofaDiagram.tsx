/**
 * The sofa, as a crime scene.
 *
 * The direct parallel to the ear map, and for the same reason: the
 * question "where, exactly?" is one that a chat bubble asks badly and a
 * picture asks instantly. Nobody types "the front left corner of the
 * left arm, about a third of the way up".
 *
 * Drawn here rather than supplied, unlike the ear — and the difference
 * is the point. That failed six times because an ear is curves, and a
 * bad curve can only be fixed by guessing at control points. A sofa is
 * five rounded rectangles in a row. Boxes converge; beziers do not.
 * Knowing which kind of drawing is safe to attempt is most of the skill
 * in attempting one.
 *
 * It disappears below 420px rather than being shrunk into uselessness,
 * and the text buttons beside it remain the real controls at every
 * width — see the note on the function for what that now means.
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
export function SofaDiagram({
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
  const region = (id: string) => ({
    fill: 'currentColor',
    fillOpacity: on(id) ? 0.18 : 0.04,
    stroke: 'currentColor',
    strokeWidth: on(id) ? 2.6 : 1.6,
    strokeOpacity: on(id) ? 1 : 0.5,
    strokeLinejoin: 'round' as const,
  });

  return (
    <svg
      viewBox="0 0 200 128"
      width="100%"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', color: 'var(--s-accent)' }}
    >
      {/* Back — the vertical surface, and the one they climb. */}
      <rect x="22" y="8" width="156" height="46" rx="11" {...region('back')} {...hit('back')} />

      {/* Arms. One region, two shapes: nobody has a favourite arm. */}
      <rect x="4" y="36" width="34" height="66" rx="13" {...region('arms')} {...hit('arms')} />
      <rect x="162" y="36" width="34" height="66" rx="13" {...region('arms')} {...hit('arms')} />

      {/* Seat cushions. */}
      <rect x="42" y="50" width="38" height="42" rx="8" {...region('seat')} {...hit('seat')} />
      <rect x="81" y="50" width="38" height="42" rx="8" {...region('seat')} {...hit('seat')} />
      <rect x="120" y="50" width="38" height="42" rx="8" {...region('seat')} {...hit('seat')} />

      {/* The base, and the cave behind it. */}
      <rect x="16" y="94" width="168" height="16" rx="6" {...region('under')} {...hit('under')} />
      <rect x="30" y="110" width="9" height="12" rx="3" {...region('under')} {...hit('under')} />
      <rect x="161" y="110" width="9" height="12" rx="3" {...region('under')} {...hit('under')} />

      {/*
       * Three claw marks on the near arm, always drawn.
       *
       * Not a region and not interactive — a joke that holds still. The
       * diagram has to read as "a sofa this has happened to" before a
       * visitor has hovered anything, or it is just furniture.
       */}
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.55"
        fill="none"
      >
        <path d="M13 52 q3 12 1 24" />
        <path d="M20 50 q3 13 1 26" />
        <path d="M27 53 q3 11 1 22" />
      </g>
    </svg>
  );
}
