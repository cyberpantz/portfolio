import { useState } from 'react';
import s from './product.module.css';

/**
 * A spectrum you can read without being told.
 *
 * Three versions of this. It began as the chip component — three
 * separated pills, which is a spectrum flattened into an unordered list,
 * and a list cannot show that the middle is the middle. It became five
 * anonymous segments with the anchors written underneath, which fixed
 * the ordering and broke something worse: five small filled bars are
 * what every progress indicator on earth looks like, so the control
 * stopped announcing itself as a control at all. Nobody hovers a
 * readout.
 *
 * Named steps solve both at once. It is obviously input, because it is
 * obviously a set of choices; and obviously a scale, because they are
 * joined, in order, and fill from the left. No numbers — "how wrecked is
 * the sofa" is not a measurement, and a 3/5 would claim it was.
 *
 * Radiogroup semantics, so arrow keys work the way they do on anything
 * that looks like this.
 */
export function Scale({
  steps,
  onPick,
  chosen,
}: {
  steps: string[];
  onPick: (label: string) => void;
  chosen?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const settled = chosen != null;
  const taken = settled ? steps.indexOf(chosen) : -1;
  // Hover previews the fill; once answered, the answer holds it.
  const lit = hover ?? taken;

  return (
    <div
      className={s.scale}
      role="radiogroup"
      aria-label={`${steps[0]} to ${steps[steps.length - 1]}`}
      onPointerLeave={() => setHover(null)}
    >
      {steps.map((label, i) => (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={taken === i}
          className={s.scaleStep}
          disabled={settled}
          /* Everything up to and including the pointer fills, because
             the question is how far along — not which box. */
          data-lit={i <= lit ? '1' : undefined}
          data-taken={taken === i ? '1' : undefined}
          onPointerEnter={() => !settled && setHover(i)}
          onFocus={() => !settled && setHover(i)}
          onClick={() => onPick(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
