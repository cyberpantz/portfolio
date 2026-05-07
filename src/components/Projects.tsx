import { useState, useEffect, useRef } from 'react';
import { PROJECTS } from '../data/projects';
import { Tag } from './ui/Tag';
import ProjectGallery from './ProjectGallery';

export default function Projects() {
  const [activeProject, setActiveProject] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Reset to first image when project changes
  useEffect(() => {
    setActiveImage(0);
  }, [activeProject]);

  // Unified keyboard nav: gallery-level first, project-level at boundaries
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const imageCount = PROJECTS[activeProject]?.images?.length ?? 0;

      if (e.key === 'ArrowRight') {
        if (imageCount > 1 && activeImage < imageCount - 1) {
          setActiveImage((i) => i + 1);
        } else {
          setActiveProject((i) => (i + 1) % PROJECTS.length);
        }
      }
      if (e.key === 'ArrowLeft') {
        if (imageCount > 1 && activeImage > 0) {
          setActiveImage((i) => i - 1);
        } else {
          setActiveProject((i) => (i - 1 + PROJECTS.length) % PROJECTS.length);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeProject, activeImage]);

  const proj = PROJECTS[activeProject]!;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 border-y border-rule">
        {/* Left: gallery */}
        <div
          className="h-64 sm:h-auto border-b sm:border-b-0 sm:border-r border-rule bg-ink-surface overflow-hidden"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(dx) < 40) return;
            const imageCount = PROJECTS[activeProject]?.images?.length ?? 0;
            if (dx < 0) {
              if (imageCount > 1 && activeImage < imageCount - 1) setActiveImage(i => i + 1);
              else setActiveProject(i => (i + 1) % PROJECTS.length);
            } else {
              if (imageCount > 1 && activeImage > 0) setActiveImage(i => i - 1);
              else setActiveProject(i => (i - 1 + PROJECTS.length) % PROJECTS.length);
            }
          }}
        >
          <ProjectGallery
            project={proj}
            imageIdx={activeImage}
            onImageChange={setActiveImage}
          />
        </div>

        {/* Right: project detail */}
        <div className="px-6 py-6 sm:px-12 sm:py-10 flex flex-col justify-between">
          <div>
            <div className="font-mono text-[10px] text-accent tracking-[0.14em] mb-4 uppercase">
              {proj.year}
            </div>
            <h3 className="font-serif text-3xl text-fg mb-2 font-normal">{proj.name}</h3>
            <div className="font-mono text-xs text-fg-sub mb-6 tracking-[0.04em]">
              {proj.tagline}
            </div>
            <p className="text-sm text-fg-sub leading-[1.75] mb-7">{proj.description}</p>
            <div className="flex gap-1.5 flex-wrap mb-7">
              {proj.tags.map((t) => (
                <Tag key={t} label={t} tone="accent" />
              ))}
            </div>
          </div>

          {proj.url && (
            <a
              href={proj.url}
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

      {/* Project selector strip */}
      <div className="flex overflow-x-auto px-4 sm:px-12 border-b border-rule scrollbar-none">
        {PROJECTS.map((p, i) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setActiveProject(i)}
            className={`flex-1 overflow-hidden relative cursor-pointer transition-all
                        ${i < PROJECTS.length - 1 ? 'border-r border-rule' : ''}
                        ${i === activeProject
                          ? 'opacity-100'
                          : 'opacity-40 hover:opacity-80 hover:-translate-y-0.5'
                        }`}
            style={{ height: 72 }}
          >
            {p.images?.[0] ? (
              <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: p.color }} />
            )}
            {i === activeProject && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
        <div className="hidden sm:flex items-center pl-5 font-mono text-[10px] text-fg-muted tracking-[0.06em] gap-1.5 flex-shrink-0">
          <span>← →</span>
          <span>navigate</span>
        </div>
      </div>
    </section>
  );
}
