import { useEffect, useState } from 'react';

export default function Hero() {
  const [typed, setTyped] = useState('');
  const full = 'making complex things usable.';

  useEffect(() => {
    let i = 0;
    const t = window.setInterval(() => {
      setTyped(full.slice(0, i + 1));
      i++;
      if (i >= full.length) window.clearInterval(t);
    }, 38);
    return () => window.clearInterval(t);
  }, []);

  return (
    <section
      id="about"
      className="min-h-screen flex flex-col justify-end px-12 pb-18
                 border-b border-rule relative"
      style={{ paddingBottom: 72 }}
    >
      <div className="animate-fade-up max-w-[780px]">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-muted mb-7 uppercase">
          Staff Frontend Engineer · SF Bay Area · 20 years
        </div>

        <h1
          className="font-serif font-normal leading-[1.02] text-fg mb-7"
          style={{ fontSize: 'clamp(48px, 7vw, 88px)' }}
        >
          20 years of<br />
          <span className="text-accent italic">{typed}</span>
          <span className="cursor text-accent animate-blink">|</span>
        </h1>

        <p className="text-base text-fg-sub max-w-[520px] leading-[1.75] mb-10">
          I build the interfaces complexity hides behind —
          real-time fleet dashboards, vehicle configurators, healthcare tools.
          React, TypeScript, and an obsession with getting the details right.
        </p>

        <div className="flex flex-wrap gap-4">
          <a
            href={`mailto:${'phranque.y'}@${'gmail'}.com`}
            className="inline-flex px-5 py-2.5 rounded-sm bg-accent text-ink
                       font-mono text-xs font-medium tracking-[0.06em]
                       transition-opacity hover:opacity-85"
          >
            get in touch →
          </a>
          <a
            href="#work"
            className="inline-flex px-5 py-2.5 rounded-sm border border-rule-strong text-fg-sub
                       font-mono text-xs tracking-[0.06em]
                       transition-colors hover:text-fg hover:border-fg-sub"
          >
            view work ↓
          </a>
        </div>
      </div>

      {/* Decorative skill column */}
      <div className="absolute right-12 bottom-18 flex flex-col gap-0.5 opacity-15"
           style={{ bottom: 72 }}>
        {['React','TypeScript','Node.js','Microfrontends','LLMs','WCAG'].map((s) => (
          <div key={s} className="font-mono text-[10px] text-fg tracking-[0.08em] text-right">
            {s}
          </div>
        ))}
      </div>
    </section>
  );
}
