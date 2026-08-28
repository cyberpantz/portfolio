import type * as React from 'react';
import type { FigureId } from '../../data/quizzes/types';

/**
 * Hand-drawn silhouettes rather than an icon dependency. Small, part
 * of the charm, and owning them means they can be styled per state.
 *
 * All on a 48×36 grid, all `currentColor`, all aria-hidden — the
 * visible caption is the accessible name, so nothing is announced
 * twice.
 */

const S = {
  fill: 'currentColor',
  stroke: 'none',
} as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 36"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {children}
    </svg>
  );
}

const Cow = () => (
  <Frame>
    <path {...S} d="M11 14c0-3 2-5 5-5h17c3 0 5 2 5 5v9c0 3-2 5-5 5H16c-3 0-5-2-5-5z" />
    <path {...S} d="M33 9l6-5c1 3 1 6-1 7zM16 9l-6-5c-1 3-1 6 1 7z" />
    <circle cx="20" cy="17" r="1.8" fill="var(--color-ink)" />
    <circle cx="29" cy="17" r="1.8" fill="var(--color-ink)" />
    <path {...S} d="M18 23h13v4c0 1-1 2-2 2H20c-1 0-2-1-2-2z" opacity="0.55" />
    <path {...S} d="M14 28h3v6h-3zM31 28h3v6h-3z" opacity="0.8" />
  </Frame>
);

const Pig = () => (
  <Frame>
    <path {...S} d="M12 15c0-4 3-7 7-7h11c4 0 7 3 7 7v7c0 4-3 7-7 7H19c-4 0-7-3-7-7z" />
    <path {...S} d="M16 8l-2-5 6 2zM32 8l2-5-6 2z" />
    <ellipse cx="24" cy="22" rx="5" ry="4" opacity="0.55" />
    <circle cx="22" cy="22" r="1.1" fill="var(--color-ink)" />
    <circle cx="26" cy="22" r="1.1" fill="var(--color-ink)" />
    <circle cx="19" cy="15" r="1.6" fill="var(--color-ink)" />
    <circle cx="29" cy="15" r="1.6" fill="var(--color-ink)" />
    <path {...S} d="M15 29h3v5h-3zM30 29h3v5h-3z" opacity="0.8" />
  </Frame>
);

const Chicken = () => (
  <Frame>
    <path {...S} d="M17 16c0-5 4-9 9-9s9 4 9 9v5c0 5-4 9-9 9s-9-4-9-9z" />
    <path {...S} d="M22 8c0-2 1-3 2-4 1 1 2 2 2 4 1-2 2-2 3-2 0 3-2 5-4 5s-3-1-3-3z" />
    <path {...S} d="M17 17l-5 2 5 2z" />
    <circle cx="21" cy="15" r="1.7" fill="var(--color-ink)" />
    <path {...S} d="M35 18c4 1 6 4 6 7-3 0-6-2-7-5z" opacity="0.7" />
    <path {...S} d="M22 30h2v4h-2zM28 30h2v4h-2z" opacity="0.8" />
  </Frame>
);

/**
 * The fleece is one closed path with an arc between each point on an
 * ellipse, so the bumps read as a single silhouette. The previous
 * version was five overlapping circles, which at 48px was a blob.
 */
const Sheep = () => (
  <Frame>
    {/* Legs in two clear pairs — evenly spaced reads as a table.
        Drawn first so the fleece sits over the top of them. */}
    <path {...S} d="M12.5 21h3v12h-3zM17 21h3v12h-3zM25.5 21h3v12h-3zM30 21h3v12h-3z" />
    {/* fleece */}
    <path
      {...S}
      d="M33.5 16A2.7 2.7 0 0 1 32.1 20.2A3.2 3.2 0 0 1 28.1 23.4A3.6 3.6 0 0 1 22.5 24.9A3.7 3.7 0 0 1 16.6 24.4A3.4 3.4 0 0 1 11.6 22A2.9 2.9 0 0 1 8.9 18.2A2.7 2.7 0 0 1 8.9 13.8A2.9 2.9 0 0 1 11.6 10A3.4 3.4 0 0 1 16.6 7.6A3.7 3.7 0 0 1 22.5 7.1A3.6 3.6 0 0 1 28.1 8.6A3.2 3.2 0 0 1 32.1 11.8A2.7 2.7 0 0 1 33.5 16Z"
    />
    {/* Head — bigger, sitting clear of the fleece to the right. A
        smooth mass against a bumpy one is what makes it read. */}
    <path
      {...S}
      d="M31.5 13.5c0-3.4 2.7-6 6.2-6 3.6 0 6.3 2.5 6.3 5.7 0 1.6-.6 3-1.7 4.1l-2.9 2.8c-.9.9-2.1 1.4-3.4 1.4-2.6 0-4.5-2-4.5-4.6z"
    />
    {/* Ear, laid back along the head rather than standing up */}
    <path {...S} d="M33.2 9.9c-1.9-.6-3.8-.2-4.8 1 1.5.9 3.4 1 4.9.4z" />
    <circle cx="39.2" cy="13" r="1.3" fill="var(--color-ink)" />
  </Frame>
);

/**
 * The horns are the whole identification. Everything else could be a
 * sheep or a dog; a swept-back curl and a beard could not.
 */
const Goat = () => (
  <Frame>
    {/* legs, in two pairs, with hooves */}
    <path {...S} d="M12 21h3v11h-3zM16 21h3v11h-3zM26 21h3v11h-3zM30 21h3v11h-3z" />
    <path {...S} d="M11.4 30.5h4.2v2.5h-4.2zM15.4 30.5h4.2v2.5h-4.2zM25.4 30.5h4.2v2.5h-4.2zM29.4 30.5h4.2v2.5h-4.2z" />
    {/* barrel — rounded, with a slightly dipped back */}
    <path
      {...S}
      d="M8.5 17.5c0-4 3-6.8 7.2-6.8h12.6c4.2 0 7.2 2.6 7.2 6.4v2.6c0 3.9-3 6.5-7.2 6.5H15.7c-4.2 0-7.2-2.7-7.2-6.6z"
    />
    {/* tail, attached to the rump */}
    <path {...S} d="M9.6 12.2c-1.6-2.4-3.4-3.6-5.4-3.4.6 2.6 2.2 4.5 4.4 5.4z" />
    {/* neck — a real one, so the head is not swallowed by the body */}
    <path {...S} d="M29.4 13.8l6-5.4 4.4 4.9-5.2 4.6c-1.5 1.3-3.4 1.2-4.7-.2s-1.2-2.7.2-4z" />
    {/* head, compact and pointing right */}
    <path
      {...S}
      d="M33.6 9.6c0-2.6 2-4.4 4.8-4.4 2.9 0 4.9 1.8 4.9 4.4v3.2c0 1.4-.7 2.5-1.9 3.1l-3 1.5c-2.4 1.2-4.8-.3-4.8-2.9z"
    />
    {/* beard, hanging from the jaw */}
    <path {...S} d="M35.4 16.2l3.4-1.4 1.2 5.9c.2.9-.2 1.6-.9 1.8s-1.3-.2-1.6-1z" />
    {/* horns — the identification. Two swept curls, offset as a pair. */}
    <path
      d="M39.2 6.6c1.9-3.6.9-6.3-2.2-6.8-2.9-.5-4.9 1.2-4.9 3.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M36.3 6.8c1.5-3 .7-5.3-1.8-5.7-2.3-.4-3.9 1-3.9 3.3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.7"
    />
    {/* ear, laid back along the neck */}
    <path {...S} d="M34.2 8.6c-2-1.4-4-1.6-5.6-.6 1.4 1.6 3.4 2.4 5.4 2.2z" />
    <circle cx="39.4" cy="10" r="1.2" fill="var(--color-ink)" />
  </Frame>
);

/**
 * A horse is a long neck and long legs. Make either one short and it
 * turns into a dog.
 */
const Horse = () => (
  <Frame>
    {/* legs — long, which with the neck is the whole identification */}
    <path {...S} d="M12 20h2.8v13h-2.8zM16.2 20h2.8v13h-2.8zM25.4 20h2.8v13h-2.8zM29.6 20h2.8v13h-2.8z" />
    <path {...S} d="M11.4 31.8h4v1.8h-4zM15.6 31.8h4v1.8h-4zM24.8 31.8h4v1.8h-4zM29 31.8h4v1.8h-4z" />
    {/* barrel — rounded, deeper at the chest */}
    <path
      {...S}
      d="M9 17c0-4 3-6.8 7.2-6.8h11.4c4.2 0 7.4 2.8 7.4 6.8v2.6c0 3.8-3 6.2-7.2 6.2H16.2C12 25.8 9 23.4 9 19.6z"
    />
    {/* neck — long and rising, the thing that stops it reading as a dog */}
    <path {...S} d="M28.2 14.4l4.6-8.6c.9-1.7 2.9-2.3 4.5-1.4s2.1 2.9 1.2 4.6l-4.4 8.2c-.9 1.7-2.7 2.2-4.2 1.4s-1.6-2.5-.7-4.2z" />
    {/* head, angled down toward the muzzle */}
    <path
      {...S}
      d="M35.4 3.2c1.9-1 4.2-.3 5.2 1.6l2.4 4.5c1 1.9.3 4.1-1.6 5.1l-1.8 1-6-11.2z"
    />
    {/* ears — small, close together, both pointing up */}
    <path {...S} d="M35.8 4.4l-.5-3.2 2.6 2.1zM38.9 2.9l.7-2.6 1.5 3z" />
    {/* mane along the back edge of the neck */}
    <path {...S} d="M27.4 14.8l4.8-9c.6-1.1 1.7-1.8 2.9-1.9-1.7 1.1-2.5 2.3-3.4 4l-3.9 7.4z" opacity="0.6" />
    {/* tail, attached at the rump and falling away */}
    <path {...S} d="M9.6 12.6c-2.6.4-4.4 2.4-5.4 5.9-.6 2.3-.6 4.4.2 6.3 1.6-1.8 2.6-3.8 3-6 .4-2.4 1.2-4.4 2.6-5.6z" />
    <circle cx="38.6" cy="7.2" r="1.2" fill="var(--color-ink)" />
  </Frame>
);

const Duck = () => (
  <Frame>
    <ellipse {...S} cx="25" cy="22" rx="12" ry="8" />
    <circle {...S} cx="34" cy="13" r="6" />
    <path {...S} d="M40 13l6 2-6 2z" opacity="0.7" />
    <circle cx="35" cy="12" r="1.5" fill="var(--color-ink)" />
    <path {...S} d="M16 20c3-3 8-3 11 0-3 3-8 3-11 0z" opacity="0.5" />
    <path {...S} d="M22 30l-3 4h8z" opacity="0.7" />
  </Frame>
);

const Goose = () => (
  <Frame>
    <ellipse {...S} cx="22" cy="24" rx="11" ry="7" />
    <path {...S} d="M31 24c0-8 1-13 5-16 3 2 3 6 2 9-1 3-2 5-2 7z" />
    <circle {...S} cx="37" cy="7" r="4" />
    <path {...S} d="M41 7l5 1-5 2z" opacity="0.7" />
    <circle cx="38" cy="6" r="1.3" fill="var(--color-ink)" />
    <path {...S} d="M14 22c3-3 7-3 10 0-3 3-7 3-10 0z" opacity="0.5" />
    <path {...S} d="M19 31l-3 4h8z" opacity="0.7" />
  </Frame>
);

export const FIGURES: Record<FigureId, () => React.ReactElement> = {
  cow: Cow,
  pig: Pig,
  chicken: Chicken,
  sheep: Sheep,
  goat: Goat,
  horse: Horse,
  duck: Duck,
  goose: Goose,
};

export function Figure({ id }: { id: FigureId }) {
  const Shape = FIGURES[id];
  return Shape ? <Shape /> : null;
}
