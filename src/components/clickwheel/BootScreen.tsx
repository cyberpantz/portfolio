import { useEffect, useRef } from 'react';
import { createBootBlob, type BootBlobOptions } from './lcd/bootBlob';

type Props = BootBlobOptions & { className?: string };

/** The LCD boot/loading screen. Drop inside Screen's glass stack. */
export default function BootScreen({ className, ...opts }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return createBootBlob(opts).mount(ref.current);   // cleanup cancels the rAF loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.message, opts.fps, opts.scanlines, opts.dances?.join()]);
  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
      aria-label={opts.message ?? 'Loading'}
      role="img"
    />
  );
}
