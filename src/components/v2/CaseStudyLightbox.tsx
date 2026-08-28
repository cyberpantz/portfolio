import { useCallback, useEffect, useState } from 'react';
import Lightbox, { type Slide } from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';

/**
 * Lightbox for the case-study plates.
 *
 * Progressive enhancement rather than a rewrite: the images stay server-
 * rendered by astro:assets, keeping the responsive srcset, the lazy loading
 * and the no-JS rendering. This island adds nothing to the page visually — it
 * only listens for clicks on the figures Astro already emitted and opens them
 * larger. With JS off, the case study is exactly what it was.
 *
 * THE PORTAL IS THE WHOLE TRICK. The case study also renders inside a native
 * <dialog> opened with showModal(), which puts it in the browser's top layer —
 * and the top layer sits above everything in the normal stacking context, no
 * matter the z-index. A lightbox portalled to document.body (the library's
 * default) would open BEHIND the dialog and look like nothing happened. So the
 * portal root is resolved per click from the clicked element's own ancestry:
 * inside the dialog it mounts into the dialog, on the routed standalone page
 * it falls back to the body.
 */

interface Props {
  slides: Slide[];
  /**
   * The project this instance belongs to.
   *
   * REQUIRED for correctness, not decoration. The homepage renders one case
   * study per project, each inside its own <dialog>, so several of these
   * islands are alive at once. The first version queried
   * `[data-cs-shot]` across the whole document, which meant every instance
   * bound to every plate on the page: clicking one project's third plate
   * opened index 2 of ALL THREE projects simultaneously, and whichever
   * painted last was the one you saw. The indices were per-project; the
   * selector was not.
   */
  group: string;
}

export default function CaseStudyLightbox({ slides, group }: Props) {
  const [index, setIndex] = useState(-1);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const close = useCallback(() => setIndex(-1), []);

  useEffect(() => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>(
        `[data-cs-group="${CSS.escape(group)}"][data-cs-shot]`,
      ),
    );

    const onClick = (event: Event) => {
      const el = event.currentTarget as HTMLElement;
      const i = Number(el.dataset.csShot);
      if (Number.isNaN(i)) return;
      setPortalRoot(el.closest('dialog') ?? document.body);
      setIndex(i);
    };

    triggers.forEach((el) => el.addEventListener('click', onClick));
    return () => triggers.forEach((el) => el.removeEventListener('click', onClick));
  }, [slides, group]);

  return (
    <Lightbox
      open={index >= 0}
      index={index}
      close={close}
      slides={slides}
      plugins={[Captions, Zoom]}
      portal={portalRoot ? { root: portalRoot } : undefined}
      controller={{ closeOnBackdropClick: true }}
      captions={{ descriptionTextAlign: 'center', showToggle: false }}
      // The screens are wide and detailed; being able to push in is the
      // reason for opening one at all.
      zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
      styles={{ container: { backgroundColor: 'rgb(8 8 7 / 0.94)' } }}
      // Single plates are common in these case studies; hide the arrows
      // rather than render two dead controls.
      render={
        slides.length <= 1
          ? { buttonPrev: () => null, buttonNext: () => null }
          : undefined
      }
    />
  );
}
