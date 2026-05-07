import { motion } from 'framer-motion';
import { useRef, useEffect } from 'react';
import type { Project } from '../data/projects';

interface Props {
  project: Project;
  imageIdx: number;
  onImageChange: (idx: number) => void;
}

function Placeholder({ color, label, uid }: { color: string; label: string; uid: string }) {
  const safeId = `${uid}-${label.replace(/\W+/g, '-')}`;
  return (
    <div
      className="w-full aspect-video flex items-center justify-center relative overflow-hidden"
      style={{ background: color }}
    >
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]">
        <defs>
          <pattern
            id={`h-${safeId}`}
            width="12"
            height="12"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="12" stroke="#fff" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#h-${safeId})`} />
      </svg>
      <span className="font-mono text-[11px] text-white/30 tracking-[0.08em] relative">
        {label}
      </span>
    </div>
  );
}

export default function ProjectGallery({ project, imageIdx, onImageChange }: Props) {
  const images = project.images ?? [];
  const hasMultiple = images.length > 1;
  const safeIdx = images.length > 0 ? Math.min(Math.max(imageIdx, 0), images.length - 1) : 0;
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    el.classList.remove('animate-gallery-in');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('animate-gallery-in');
  }, [safeIdx]);

  const canPrev = safeIdx > 0;
  const canNext = safeIdx < images.length - 1;

  return (
    <div className="w-full flex flex-col">
      {/* Main image — draggable horizontally */}
      <motion.div
        className="relative overflow-hidden bg-ink-surface cursor-grab active:cursor-grabbing"
        drag={hasMultiple ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: canNext ? 0.3 : 0.05, right: canPrev ? 0.3 : 0.05 }}
        onDragEnd={(_e, info) => {
          const { offset, velocity } = info;
          const swipe = Math.abs(offset.x) > 50 || Math.abs(velocity.x) > 400;
          if (!swipe) return;
          if (offset.x < 0 && canNext) onImageChange(safeIdx + 1);
          else if (offset.x > 0 && canPrev) onImageChange(safeIdx - 1);
        }}
      >
        {images.length > 0 ? (
          <img
            ref={imgRef}
            src={images[safeIdx]}
            alt={`${project.name} screenshot ${safeIdx + 1}`}
            draggable={false}
            className="w-full h-auto block animate-gallery-in select-none pointer-events-none"
          />
        ) : (
          <Placeholder color={project.color} label="screenshot" uid={project.id} />
        )}
      </motion.div>

      {/* Arrow nav — only when >1 image */}
      {hasMultiple && (
        <div className="flex items-center justify-between border-t border-rule flex-shrink-0 px-4"
             style={{ height: 44 }}>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onImageChange(Math.max(safeIdx - 1, 0))}
            disabled={!canPrev}
            className="font-mono text-sm text-fg-muted transition-colors
                       hover:text-fg disabled:opacity-20 disabled:cursor-not-allowed"
          >
            ←
          </button>

          <span aria-hidden="true" className="font-mono text-[10px] text-fg-muted tracking-[0.12em]">
            {String(safeIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </span>

          <button
            type="button"
            aria-label="Next image"
            onClick={() => onImageChange(Math.min(safeIdx + 1, images.length - 1))}
            disabled={!canNext}
            className="font-mono text-sm text-fg-muted transition-colors
                       hover:text-fg disabled:opacity-20 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
