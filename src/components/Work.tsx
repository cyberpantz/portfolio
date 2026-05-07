import { useState } from 'react';
import { EXPERIENCE, type Role } from '../data/experience';
import { Tag } from './ui/Tag';

function WorkRow({ item, defaultOpen }: { item: Role; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className="border-b border-rule">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 py-5 select-none cursor-pointer text-left"
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300
                      ${open
                        ? 'bg-accent border-accent shadow-[0_0_8px_rgb(var(--accent)/0.4)]'
                        : 'bg-transparent border border-rule-strong'}`}
          style={{ borderWidth: '1.5px' }}
        />

        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 mb-1">
            <span className={`font-serif text-xl transition-colors ${open ? 'text-fg' : 'text-[#aaa]'}`}>
              {item.co}
            </span>
            <span className="font-mono text-[11px] text-fg-muted">{item.role}</span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {item.tags.map((t) => (
              <Tag key={t} label={t} tone={open ? 'accent' : 'gray'} />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="font-mono text-[11px] text-fg-muted">{item.yr}</span>
          <span
            className={`font-mono text-base inline-block transition-transform duration-300
                        ${open ? 'rotate-90 text-accent' : 'rotate-0 text-fg-muted'}`}
          >
            ›
          </span>
        </div>
      </button>

      <div className={open ? 'expand-open' : 'expand-closed'}>
        <div className="pl-6 pb-5">
          {item.bullets.map((b, i) => (
            <div key={i} className="flex gap-3 items-start mb-2.5">
              <span className="w-1 h-1 rounded-full bg-accent flex-shrink-0 mt-[7px]" />
              <span className="text-sm text-fg-sub leading-[1.65]">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Work() {
  return (
    <section id="work" className="px-6 sm:px-12 py-24 border-b border-rule max-w-[900px] mx-auto">
      <div className="font-mono text-[11px] tracking-[0.14em] text-fg-muted mb-8 uppercase">
        Work History
      </div>
      <div className="animate-fade-up">
        <h2 className="font-serif font-normal text-fg mb-14 leading-[1.1]"
            style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}>
          A few defining<br /><span className="text-accent italic">chapters.</span>
        </h2>
      </div>
      <div>
        {EXPERIENCE.map((item, i) => (
          <WorkRow key={item.co} item={item} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}
