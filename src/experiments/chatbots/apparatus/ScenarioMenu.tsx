import { useEffect, useId, useRef, useState } from 'react';
import type { ScenarioId } from '../scripts/types';
import a from './apparatus.module.css';

/**
 * The title IS the control.
 *
 * It was a title with a menu beside it, and the menu's face repeated the
 * title verbatim — "Care Navigator  Care Navigator ⌄". Two elements
 * saying one thing, one of which was the only way to change it.
 *
 * So the heading opens. A visitor reads the name of the world they are
 * in and discovers, from the chevron, that there is another one; nothing
 * else on the page has to carry that.
 *
 * WHY THIS IS HAND-BUILT, having argued the opposite for the old one.
 * A native <select> cannot be a 24px semibold heading — the face has to
 * be a real element to carry the type, and once the face is a button the
 * list has to be built too. That is a genuine reason, and it comes with
 * the whole bill: roles, keyboard, focus return, outside-click, and a
 * listbox that a screen reader announces as a listbox. All of it is
 * below. A custom select that skips any of that is worse than the native
 * control it replaced, which is exactly why the previous version was
 * native.
 */
export function ScenarioMenu({
  value,
  options,
  onChange,
}: {
  value: ScenarioId;
  options: { id: ScenarioId; label: string }[];
  onChange: (id: ScenarioId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)));
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const current = options.find((o) => o.id === value) ?? options[0];

  /*
   * One scenario is not a choice. The heading stays a heading rather
   * than becoming a menu with nothing in it — the same rule the tray
   * lines follow, that a control offering nothing must not appear.
   */
  if (options.length < 2) return <b className={a.wallTitle}>{current?.label}</b>;

  /* ---- focus moves into the list, and comes back ------------------
   *
   * Keeping focus on the button and steering with aria-activedescendant
   * also works, but returning focus explicitly on close is the part
   * people forget, and it is the part that strands a keyboard user at
   * the top of the document.
   */
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const commit = (i: number) => {
    const next = options[i];
    if (next) onChange(next.id);
    close();
  };

  const onKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((n) => (n + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((n) => (n - 1 + options.length) % options.length);
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(active);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        // Tabbing away is a dismissal, but the focus is going somewhere
        // on purpose — do not drag it back to the button.
        close(false);
        break;
    }
  };

  return (
    <div className={a.menu} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={a.menuFace}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => {
          setActive(Math.max(0, options.findIndex((o) => o.id === value)));
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {current?.label}
        <svg
          className={a.menuChevron}
          width="13"
          height="8"
          viewBox="0 0 13 8"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M1.5 1.75 6.5 6.25 11.5 1.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          className={a.menuList}
          role="listbox"
          tabIndex={-1}
          aria-label="Scenario"
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onKey}
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.id === value}
              className={a.menuItem}
              data-active={i === active ? '1' : undefined}
              /* Pointer moves set the active row so the highlight never
                 disagrees with the cursor. */
              onPointerMove={() => setActive(i)}
              onClick={() => commit(i)}
            >
              <span className={a.menuTick} aria-hidden="true">
                {o.id === value ? '✓' : ''}
              </span>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
