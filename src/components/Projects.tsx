import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PROJECTS } from '../data/projects';
import { Tag } from './ui/Tag';
import ProjectGallery from './ProjectGallery';

export default function Projects() {
  const [selected, setSelected] = useState<number | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const proj = selected !== null ? PROJECTS[selected]! : null;

  const open = (i: number) => { setSelected(i); setActiveImage(0); };
  const close = () => setSelected(null);

  useEffect(() => {
    if (selected === null) return;
    const handler = (e: KeyboardEvent) => {
      const count = proj?.images?.length ?? 0;
      if (e.key === 'ArrowRight' && activeImage < count - 1) setActiveImage(i => i + 1);
      if (e.key === 'ArrowLeft'  && activeImage > 0)         setActiveImage(i => i - 1);
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected, activeImage, proj]);

  return (
    <section id="projects" className="py-24 border-b border-rule">
      <div className="px-6 sm:px-12 max-w-[900px] mx-auto">
        <div className="font-mono text-[11px] tracking-[0.14em] text-fg-muted mb-8 uppercase">
          Personal Projects
        </div>
        <h2
          className="font-serif font-normal text-fg mb-14 leading-[1.1]"
          style={{ fontSize: 'clamp(32px, 4vw, 48px)' }}
        >
          Things <span className="text-accent italic">built.</span>
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {selected === null ? (

          /* ── Grid view ── */
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 sm:px-12 py-10">
              <div className="flex flex-wrap justify-center gap-4">
                {PROJECTS.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => open(i)}
                    className="group w-full sm:w-[350px] cursor-pointer text-left"
                  >
                    <div className="h-48 rounded-sm overflow-hidden border border-rule group-hover:border-rule-strong transition-colors">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: p.color }} />
                      )}
                    </div>
                    <div className="pt-3 px-0.5">
                      <div className="flex items-baseline justify-between mb-1">
                        <h3 className="font-sans text-sm text-fg font-medium leading-snug">{p.name}</h3>
                        <span className="font-mono text-[9px] text-accent tracking-[0.14em] uppercase">{p.year}</span>
                      </div>
                      <p className="font-mono text-[10px] text-fg-muted leading-relaxed line-clamp-2">{p.tagline}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

        ) : (

          /* ── Detail view ── */
          <motion.div
            key={`detail-${selected}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-rule">
              {/* Back button */}
              <div className="px-6 sm:px-12 py-3 border-b border-rule">
                <button
                  type="button"
                  onClick={close}
                  className="font-mono text-[11px] text-fg-muted tracking-[0.08em] hover:text-fg transition-colors cursor-pointer"
                >
                  ← all projects
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr]">
                {/* Left: gallery */}
                <div
                  className="relative border-b sm:border-b-0 sm:border-r border-rule bg-ink-surface overflow-hidden group"
                >
                  <ProjectGallery project={proj!} imageIdx={activeImage} onImageChange={setActiveImage} />

                  {activeImage > 0 && (
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => setActiveImage(i => i - 1)}
                      className="absolute left-0 top-0 h-full w-14 flex items-center justify-start pl-3
                                 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer
                                 bg-gradient-to-r from-black/40 to-transparent"
                    >
                      <ChevronLeft size={28} className="text-white drop-shadow" strokeWidth={1.5} />
                    </button>
                  )}
                  {activeImage < (proj!.images?.length ?? 1) - 1 && (
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => setActiveImage(i => i + 1)}
                      className="absolute right-0 top-0 h-full w-14 flex items-center justify-end pr-3
                                 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer
                                 bg-gradient-to-l from-black/40 to-transparent"
                    >
                      <ChevronRight size={28} className="text-white drop-shadow" strokeWidth={1.5} />
                    </button>
                  )}

                  {(proj!.images?.length ?? 0) > 1 && (
                    <div className="absolute bottom-3 right-3 font-mono text-[10px] text-white/60 tracking-[0.08em] tabular-nums">
                      {activeImage + 1} / {proj!.images!.length}
                    </div>
                  )}
                </div>

                {/* Right: detail */}
                <div className="px-6 py-6 sm:px-12 sm:py-10 flex flex-col justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-accent tracking-[0.14em] mb-4 uppercase">
                      {proj!.year}
                    </div>
                    <h3 className="font-serif text-3xl text-fg mb-2 font-normal">{proj!.name}</h3>
                    <div className="font-mono text-xs text-fg-sub mb-6 tracking-[0.04em]">
                      {proj!.tagline}
                    </div>
                    <p className="text-sm text-fg-sub leading-[1.75] mb-7">{proj!.description}</p>
                    <div className="flex gap-1.5 flex-wrap mb-7">
                      {proj!.tags.map((t) => (
                        <Tag key={t} label={t} tone="accent" />
                      ))}
                    </div>
                  </div>

                  {proj!.url && (
                    <a
                      href={proj!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex self-start px-4 py-2 rounded-sm border border-accent/30 text-accent
                                 font-mono text-[11px] tracking-[0.06em] no-underline
                                 transition-colors hover:bg-accent/10"
                    >
                      visit site ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

        )}
      </AnimatePresence>
    </section>
  );
}
