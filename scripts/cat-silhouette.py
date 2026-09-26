#!/usr/bin/env python3
"""
Normalise a cat silhouette into a mask the particle field can sample.

Takes either kind of source:
  · a cutout with an alpha channel
  · ink on paper — black shape on a white ground

and emits a square, padded, white-on-transparent PNG.

Squaring matters more than it looks. The field samples this to place
particles, so the mask's aspect ratio becomes the field's aspect ratio; a
tall mask would give a tall field with dead space either side of it. The
margin is the room the particles need to scatter into when you push them,
and it is why the cat does not touch the edges.

    pip install pillow numpy scipy
    python3 scripts/cat-silhouette.py IN.png OUT.png
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SIZE = 1536       # output edge, in pixels
MARGIN = 0.08     # empty fraction on each side
MIN_PART = 0.01   # drop specks under 1% of the largest piece


def read_mask(src: str) -> np.ndarray:
    """True where the cat is, whichever way the source encodes it."""
    im = Image.open(src)
    if im.mode in ('RGBA', 'LA') or 'transparency' in im.info:
        a = np.asarray(im.convert('RGBA'))[..., 3]
        if (a < 250).mean() > 0.01:
            return a > 100
    # No usable alpha, so it is ink on paper. Whichever tone is rarer is
    # the subject: this works for black-on-white and for white-on-black
    # without asking which one it was given.
    g = np.asarray(im.convert('L'))
    dark = g < 128
    return dark if dark.mean() < 0.5 else ~dark


def main(src: str, dst: str) -> None:
    m = read_mask(src)

    # One subject. A stray speck would become a knot of particles hanging
    # in space, which reads as a bug rather than as a cat.
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= MIN_PART * sizes.max()]
        m = np.isin(lab, keep)

    ys, xs = np.where(m)
    crop = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    side = int(max(crop.shape) / (1 - 2 * MARGIN))
    pad = np.zeros((side, side), bool)
    oy, ox = (side - crop.shape[0]) // 2, (side - crop.shape[1]) // 2
    pad[oy:oy + crop.shape[0], ox:ox + crop.shape[1]] = crop

    out = np.zeros((side, side, 4), np.uint8)
    out[..., :3] = 255
    out[..., 3] = pad * 255
    Image.fromarray(out).resize((SIZE, SIZE), Image.LANCZOS).save(dst)

    fill = pad.mean()
    print(f'  content {crop.shape[1]}x{crop.shape[0]} -> {SIZE}x{SIZE}, {fill:.0%} covered')
    if fill < 0.12:
        print('  warning: sparse. The field will be mostly empty.')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
