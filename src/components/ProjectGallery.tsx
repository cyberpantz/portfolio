import type { Project } from '../data/projects';

interface Props {
  project: Project;
  imageIdx: number;
  onImageChange: (idx: number) => void;
}

function Placeholder({ color, label }: { color: string; label: string }) {
  const safeId = label.replace(/\W+/g, '-');
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

  return (
    <div className="w-full h-full flex flex-col">
      {/* Main image */}
      <div className="relative flex-1 overflow-hidden bg-ink-surface">
        {images.length > 0 ? (
          <img
            key={`${project.id}-${imageIdx}`}
            src={images[imageIdx]}
            alt={`${project.name} screenshot ${imageIdx + 1}`}
            className="w-full h-full object-cover animate-gallery-in"
          />
        ) : (
          <Placeholder color={project.color} label="screenshot" />
        )}

        {hasMultiple && (
          <div className="absolute bottom-4 left-4 font-mono text-[10px] text-white/30 tracking-[0.1em]">
            {String(imageIdx + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </div>
        )}
      </div>

      {/* Thumbnail strip — only when >1 image */}
      {hasMultiple && (
        <div className="flex border-t border-rule flex-shrink-0" style={{ height: 48 }}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onImageChange(i)}
              className={`relative flex-1 overflow-hidden cursor-pointer transition-opacity
                          ${i < images.length - 1 ? 'border-r border-rule' : ''}
                          ${i === imageIdx ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
              {i === imageIdx && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
