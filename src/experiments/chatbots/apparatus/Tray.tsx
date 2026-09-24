import type { Line } from '../scripts/types';
import a from './apparatus.module.css';

/**
 * The line tray — where a visitor gets the things they send.
 *
 * Lives in the apparatus, not the device: a real care navigator has no
 * tray, and anything inside the bezel appears in every screenshot of this
 * piece. It is styled in the USER's voice rather than the assistant's, so
 * it never reads as the assistant putting words in your mouth.
 *
 * Two taps, and the second one is the point. Tapping a line fills the
 * composer; it does NOT send. The beat where you read the meat
 * thermometer sitting in your own composer before pressing send is where
 * the joke lands, and pressing send yourself is what makes the message
 * feel authored rather than played at you.
 */
export function Tray({
  lines,
  hasStash,
  onFill,
  onRestore,
  disabled,
}: {
  lines: Line[];
  hasStash: boolean;
  onFill: (line: Line) => void;
  onRestore: () => void;
  disabled: boolean;
}) {
  const show = lines.length > 0;
  if (!show && !hasStash) return null;

  return (
    <div className={a.tray}>
      {/*
       * "Say", not "Your line".
       *
       * A verb tells you what the list DOES; a noun phrase only labels
       * it. And it lets the sentence underneath go entirely — there were
       * three pieces of chrome here explaining one tap, which is the
       * tell that an interaction is costing more than it returns. The
       * composer's placeholder says "Tap a line below" and the filled
       * state explains the rest better than any sentence did: once a
       * line is sitting in the box with the send arrow lit, nothing
       * needs saying.
       */}
      <p className={a.trayHead}>Say</p>

      {/*
       * A list of options, not a stack of message cards.
       *
       * These were full-width tinted rectangles with a bubble's radius,
       * five of them — which is the visual grammar of a transcript, so
       * the tray read as a second conversation competing with the real
       * one, and won, because it was bigger. Rules instead of cards:
       * same information, a third of the weight, and it reads as a menu
       * because that is what it is.
       */}
      {lines.map((l) => (
        <button
          key={l.id}
          type="button"
          className={a.line}
          disabled={disabled}
          onClick={() => onFill(l)}
        >
          <span className={a.lineBullet} aria-hidden="true">
            ▸
          </span>
          <span className={a.lineText}>
            {l.preview}
            {/*
             * One flag on the long one, instead of a count on every row.
             *
             * "58w" next to "3w" was arithmetic nobody asked for, and it
             * left a ragged column wherever a line had no count — the
             * emoji one. The count only ever existed to warn that one
             * option is a wall of text, so it says that, once.
             */}
            {l.words != null && l.words >= 30 && (
              <span className={a.lineLong}>longer</span>
            )}
          </span>
          {/*
           * Points up, at the composer it fills. The only signifier on
           * these that says "this goes somewhere" rather than "this is a
           * quotation" — and it is always drawn, never hover-only,
           * because a hint that needs a mouse is no hint on a phone.
           */}
          <span className={a.lineGo} aria-hidden="true">
            ↑
          </span>
        </button>
      ))}

      {/*
       * Only rendered when there is something to put back. A button that
       * offers to restore nothing is a button that lies, and the spec
       * forbids that everywhere else.
       */}
      {hasStash && (
        <button type="button" className={a.line} onClick={onRestore}>
          <span>↩ Put my draft back</span>
        </button>
      )}

      {/*
       * There was an invitation here — "Or type anything at all, it's
       * built to cope." It was true and it was a mistake; nothing types
       * into this demo now, because nothing behind it can answer a
       * sentence it was not shown.
       *
       * What replaced it moved to the top, where an instruction belongs.
       * Nothing takes its place at the bottom: the list ends, and the
       * next thing is the rig's own controls.
       */}
    </div>
  );
}
