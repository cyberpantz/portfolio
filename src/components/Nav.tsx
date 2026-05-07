import { useState, useEffect, useRef } from 'react';
import { useActiveSection } from '../hooks/useActiveSection';

const SECTIONS = ['about', 'work', 'projects', 'explorations', 'contact'];

interface NavProps {
  showAvailability?: boolean;
}

export default function Nav({ showAvailability = false }: NavProps) {
  const active = useActiveSection(['about', 'work', 'projects', 'skills', 'contact']);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 px-6 sm:px-12 flex items-center
                 bg-ink/[0.88] backdrop-blur-md border-b border-rule"
      style={{ height: 52 }}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="font-serif text-[17px] text-fg cursor-pointer"
      >
        Frank Young
      </button>
      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.5)]" aria-hidden="true" />

      <div className="flex-1" />

      {showAvailability && (
        <div className="hidden sm:flex items-center gap-1.5 mr-8 px-2.5 py-1 rounded-full
                        border border-accent/20 bg-accent/[0.05]">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent))]" aria-hidden="true" />
          <span className="font-mono text-[10px] text-accent tracking-[0.08em]">open to work</span>
        </div>
      )}

      {/* Desktop links */}
      <div className="hidden sm:flex gap-7" role="list">
        {SECTIONS.map((s) =>
          s === 'explorations' ? (
            <a
              key={s}
              href="/explorations"
              role="listitem"
              className="font-mono text-[11px] tracking-[0.08em] transition-colors text-fg-sub hover:text-fg"
            >
              {s}
            </a>
          ) : (
            <button
              key={s}
              type="button"
              role="listitem"
              onClick={() => scrollTo(s)}
              className={`font-mono text-[11px] tracking-[0.08em] transition-colors cursor-pointer
                          ${active === s ? 'text-accent' : 'text-fg-sub hover:text-fg'}`}
            >
              {s}
            </button>
          )
        )}
      </div>

      {/* Mobile hamburger */}
      <div className="sm:hidden" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex flex-col justify-center gap-[5px] w-8 h-8 cursor-pointer"
        >
          <span className={`block h-px bg-fg-sub transition-all duration-200 origin-center
                            ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block h-px bg-fg-sub transition-all duration-200
                            ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-px bg-fg-sub transition-all duration-200 origin-center
                            ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div
            id="mobile-menu"
            role="menu"
            className="absolute top-[52px] inset-x-0 bg-ink/95 backdrop-blur-md border-b border-rule
                       flex flex-col py-2"
          >
            {SECTIONS.map((s) =>
              s === 'explorations' ? (
                <a
                  key={s}
                  href="/explorations"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="font-mono text-[12px] tracking-[0.08em] text-fg-sub hover:text-fg
                             px-6 py-3 transition-colors"
                >
                  {s}
                </a>
              ) : (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={() => scrollTo(s)}
                  className={`font-mono text-[12px] tracking-[0.08em] text-left
                              px-6 py-3 transition-colors cursor-pointer
                              ${active === s ? 'text-accent' : 'text-fg-sub hover:text-fg'}`}
                >
                  {s}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
