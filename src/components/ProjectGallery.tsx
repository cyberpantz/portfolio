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
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
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

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main image */}
      <div className="relative flex-1 overflow-hidden bg-ink-surface">
        {images.length > 0 ? (
          <img
            key={`${project.id}-${safeIdx}`}
            src={images[safeIdx]}
            alt={`${project.name} screenshot ${safeIdx + 1}`}
            className="w-full h-full object-cover animate-gallery-in"
          />
        ) : (
          <Placeholder color={project.color} label="screenshot" uid={project.id} />
        )}

      </div>

      {/* Arrow nav — only when >1 image */}
      {hasMultiple && (
        <div className="flex items-center justify-between border-t border-rule flex-shrink-0 px-4"
             style={{ height: 44 }}>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() => onImageChange(Math.max(safeIdx - 1, 0))}
            disabled={safeIdx === 0}
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
            disabled={safeIdx === images.length - 1}
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
