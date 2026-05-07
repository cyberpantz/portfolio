import { useActiveSection } from '../hooks/useActiveSection';

const SECTIONS = ['about', 'work', 'projects', 'explorations', 'contact'];

interface NavProps {
  showAvailability?: boolean;
}

export default function Nav({ showAvailability = false }: NavProps) {
  const active = useActiveSection(['about','work','projects','skills','contact']);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 h-13 px-12 flex items-center
                    bg-ink/[0.88] backdrop-blur-md border-b border-rule"
         style={{ height: 52 }}>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="font-serif text-[17px] text-fg cursor-pointer"
      >
        Frank Young
      </button>
      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.5)]" />

      <div className="flex-1" />

      {showAvailability && (
        <div className="flex items-center gap-1.5 mr-8 px-2.5 py-1 rounded-full
                        border border-accent/20 bg-accent/[0.05]">
          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent))]" />
          <span className="font-mono text-[10px] text-accent tracking-[0.08em]">open to work</span>
        </div>
      )}

      <div className="flex gap-7">
        {SECTIONS.map((s) =>
          s === 'explorations' ? (
            <a
              key={s}
              href="/explorations"
              className="font-mono text-[11px] tracking-[0.08em] transition-colors text-fg-sub hover:text-fg"
            >
              {s}
            </a>
          ) : (
            <button
              key={s}
              type="button"
              onClick={() => scrollTo(s)}
              className={`font-mono text-[11px] tracking-[0.08em] transition-colors cursor-pointer
                          ${active === s ? 'text-accent' : 'text-fg-sub hover:text-fg'}`}
            >
              {s}
            </button>
          )
        )}
      </div>
    </nav>
  );
}
