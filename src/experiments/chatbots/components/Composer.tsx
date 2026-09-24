import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { SendIcon } from './icons';
import s from './product.module.css';

/**
 * The composer.
 *
 * Live during `think`, because thinking happens before a node accepts and
 * someone typing over it is not doing anything wrong. Sending mid-think
 * flushes the scheduler rather than queueing behind beats nobody is
 * reading any more.
 *
 * IT IS NEVER TYPED INTO. `readOnly`, always.
 *
 * This was the hardest call in the piece and it went the other way for
 * most of its life. The argument for free text is obvious — a chat you
 * cannot type into barely looks like a chat. The argument against is
 * that there is no model here, so every typed sentence was answered by a
 * hand-written router guessing at intent from shape, and a guess that
 * lands wrong in a portfolio piece does not read as an interesting
 * limitation. It reads as the work being sloppy.
 *
 * So the composer became a DESTINATION rather than a field. Lines arrive
 * from the tray, you read them sitting in your own message box, and you
 * press send yourself. Everything downstream of that is authored, which
 * means every reply in this demo is one somebody chose.
 *
 * Two further states, and they are not the same stop:
 *
 *   locked      Tempo-1 safety. A real `disabled`: out of the tab order,
 *               inert, because the only thing to do next is dial.
 *
 *   constrained The node asked a closed question and put the answers on
 *               screen. Recessive, pointing up at the chips.
 *
 * Neither leaves an inert box: both say in the placeholder what to do
 * instead, which is the difference between a control that is off and a
 * control that looks broken.
 */
export type ComposerHandle = {
  /** Fill from a tray line, stashing whatever was already there. */
  fill(text: string): void;
  /** Restore the stashed draft. Returns false if there was none. */
  restore(): boolean;
  hasStash(): boolean;
  focus(): void;
};

export const Composer = forwardRef<
  ComposerHandle,
  {
    placeholder: string;
    locked: boolean;
    /** The node is waiting on one of its own answers. */
    constrained?: boolean;
    /** Shown while constrained — names what to do instead. */
    constrainedHint?: string;
    onSend: (text: string) => void;
    onStashChange?: (has: boolean) => void;
  }
>(function Composer(
  { placeholder, locked, constrained = false, constrainedHint, onSend, onStashChange },
  ref
) {
  const [value, setValue] = useState('');
  const [touch, setTouch] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  /*
   * Exactly one stashed draft. "Put my draft back" needs a draft to put
   * back — without this the button lies, and a button that lies is the
   * thing the spec forbids everywhere else.
   */
  const stash = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    fill(text) {
      const had = area.current?.value ?? '';
      stash.current = had.trim() ? had : null;
      onStashChange?.(!!stash.current);
      setValue(text);
      // Typed, not appeared — the fill animates in the tray, and landing
      // here lets the visitor read it before they commit.
      requestAnimationFrame(() => {
        const el = area.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollTop = el.scrollHeight;
      });
    },
    restore() {
      if (stash.current == null) return false;
      setValue(stash.current);
      stash.current = null;
      onStashChange?.(false);
      area.current?.focus();
      return true;
    },
    hasStash: () => stash.current != null,
    focus: () => area.current?.focus(),
  }));

  /*
   * Auto-grow on every value change, not just typing.
   *
   * It used to resize inside onChange, which never fires for a
   * programmatic fill — so pasting a 58-word line from the tray left the
   * box one row tall with the text scrolled out of sight. Driving it from
   * the value covers typing, tray fills and draft restores identically.
   */
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(96, el.scrollHeight);
    el.style.height = `${next}px`;
    // Only scroll once it has actually hit the cap.
    el.style.overflowY = el.scrollHeight > 96 ? 'auto' : 'hidden';
  }, [value]);

  /*
   * A constrained node still sends — the tray fills the box and the
   * button has to work, or the amoxicillin line dies with the typing.
   */
  const armed = value.trim().length > 0 && !locked;

  const submit = () => {
    if (!armed) return;
    onSend(value);
    setValue('');
    stash.current = null;
    onStashChange?.(false);
  };

  return (
    <div className={s.composerWrap}>
      <div className={s.composer} data-composer data-quiet={locked || constrained ? '1' : '0'}>
        {/*
         * readOnly blocks typing, not assignment, so a tray fill still
         * lands. Unconditional rather than `constrained && !value`, which
         * would re-lock the field the moment someone cleared a filled
         * line — a control that changes its rules mid-edit.
         */}
        <textarea
          ref={area}
          className={s.input}
          rows={1}
          value={value}
          disabled={locked}
          readOnly
          placeholder={
            locked ? 'Call the number above first.' : constrained ? constrainedHint : placeholder
          }
          aria-label="Type a message"
          onChange={(e) => setValue(e.target.value)}
          onTouchStart={() => setTouch(true)}
          onKeyDown={(e) => {
            /*
             * Enter sends, Shift+Enter is a newline — except on touch,
             * where Enter is a newline and the button is the only way to
             * send. A phone keyboard's return key is not a send key.
             */
            if (e.key !== 'Enter' || e.shiftKey || touch) return;
            e.preventDefault();
            submit();
          }}
        />
        <button
          type="button"
          className={s.send}
          data-armed={armed ? '1' : '0'}
          disabled={!armed}
          aria-label="Send"
          onClick={submit}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
});
