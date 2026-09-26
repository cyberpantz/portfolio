#!/usr/bin/env python3
"""
Draw the Lazers cover, with the shader's own arithmetic.

    node scripts/lazers-cover.mjs && python3 scripts/lazers-cover.py

Every other exploration's cover is a Playwright screenshot of the live
page, which is the right way to make one. This exists because that needs a
Chromium that will launch, and where it will, it should be used instead.

What makes this honest rather than an impression: none of the constants
are retyped. Point size, the fattening on the depth pass, the depth bias,
the ambient floor, the light direction, the ink colour and the back-face
cutoff are all read out of Field.tsx, and the camera comes from the same
pose file the behaviour wrote. The drawing then follows the shader step
for step — area-weighted sampling, back-face cull, a depth pre-pass with
fat splats, then hard-edged discs — so the difference between this and a
screenshot is the rasteriser, not the picture.

The one thing it cannot reproduce is the browser's own point rasterisation
at sub-pixel sizes. Points here are drawn as discs with the same diameter
in pixels, which is what the GPU is doing, but a GPU resolves a 1.7px disc
its own way.
"""
import json
import os
import re
import struct
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FIELD = ROOT / 'src/experiments/lazers/Field.tsx'
SCRATCH = ROOT / '.scratch'
OUT = Path(os.environ['OUT']) if os.environ.get('OUT') else ROOT / 'src/assets/explorations/lazers.png'

# The grid draws covers into a 4:3 box at up to 840 CSS pixels, so this is
# that at 2x and a little over, which is where the other covers sit.
import os
W, H = (800, 600) if os.environ.get('DRAFT') else (1600, 1200)

# The page renders at a device pixel ratio capped at 2, and point size
# scales with the drawing buffer's height over 700. A 1200px-tall cover is
# a 600px-tall stage at 2x, which is a small laptop window: the honest
# scale for it is its own height over 700.
SCALE = H / 700


def constant(name, pattern):
    """Pull a number out of Field.tsx rather than retyping it here."""
    src = FIELD.read_text()
    m = re.search(pattern, src)
    if not m:
        raise SystemExit(f'could not find {name} in {FIELD.name} — has it been restructured?')
    return m.group(1)


UNIT = float(constant('uSize', r'uSize: \{ value: ([\d.]+) \}'))
FAT = float(constant('FAT', r'const FAT = ([\d.]+);'))
BIAS = float(constant('DEPTH_BIAS', r'const DEPTH_BIAS = ([\d.]+);'))
AMBIENT = float(constant('AMBIENT', r'const AMBIENT = ([\d.]+);'))
CUTOFF = float(constant('the back-face cutoff', r'vFacing < (-?[\d.]+)'))
LIGHT = np.array([float(x) for x in re.findall(
    r'vec3 light = normalize\(vec3\(([-\d., ]+)\)\)', FIELD.read_text())[0].split(',')])
LIGHT /= np.linalg.norm(LIGHT)
INK = np.array([int(constant('uInk', r"uInk: \{ value: new THREE\.Color\('#([0-9a-f]{6})'\)")[i:i+2], 16)
                for i in (0, 2, 4)], float)

meta = json.loads((SCRATCH / 'cover.json').read_text())
nv = meta['nv']
tris = np.array(meta['tris']).reshape(-1, 3)
data = np.fromfile(SCRATCH / 'cover.bin', dtype=np.float32)
P = data[:nv * 3].reshape(nv, 3).astype(float)
N = data[nv * 3:].reshape(nv, 3).astype(float)

eye = np.array(meta['eye']); fwd = np.array(meta['fwd'])
right = np.array(meta['right']); up = np.array(meta['up'])
focal = 1.0 / np.tan(np.radians(meta['fov']) / 2)

# ---------------------------------------------------------------- points

"""
The same scatter the browser does.

Area-weighted over the triangles, so density follows surface rather than
tessellation, and the count is the one a wide display gets — this is a
picture of the piece at its best, not at its most cautious.
"""
COUNT = 170_000
rng = np.random.default_rng(11)
a, b, c = tris[:, 0], tris[:, 1], tris[:, 2]
area = 0.5 * np.linalg.norm(np.cross(P[b] - P[a], P[c] - P[a]), axis=1)
cum = np.cumsum(area)
pick = np.searchsorted(cum, rng.random(COUNT) * cum[-1])
u, v = rng.random(COUNT), rng.random(COUNT)
flip = u + v > 1
u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
w0 = 1 - u - v

pts = P[a[pick]] * w0[:, None] + P[b[pick]] * u[:, None] + P[c[pick]] * v[:, None]
nrm = N[a[pick]] * w0[:, None] + N[b[pick]] * u[:, None] + N[c[pick]] * v[:, None]
nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9

# ------------------------------------------------------------ projection

rel = pts - eye
depth = rel @ fwd
ahead = depth > 0.05
rel, nrm, depth = rel[ahead], nrm[ahead], depth[ahead]

# Back-facing points are not drawn at all — the far side of a porous shell
# shows through it, and what shows through a cat's skull is its own face.
to_cam = -rel / (np.linalg.norm(rel, axis=1, keepdims=True) + 1e-9)
facing = np.einsum('ij,ij->i', nrm, to_cam)
seen = facing >= CUTOFF
rel, nrm, depth = rel[seen], nrm[seen], depth[seen]

sx = ((rel @ right) * focal / depth / meta['aspect'] * 0.5 + 0.5) * W
sy = (1 - ((rel @ up) * focal / depth * 0.5 + 0.5)) * H
size = UNIT * SCALE / np.maximum(0.25, depth)          # gl_PointSize
shade = AMBIENT + (1 - AMBIENT) * np.clip(nrm @ LIGHT, 0, 1)

ix, iy = np.round(sx).astype(int), np.round(sy).astype(int)
inside = (ix >= 0) & (ix < W) & (iy >= 0) & (iy < H)
ix, iy, depth, size, shade = ix[inside], iy[inside], depth[inside], size[inside], shade[inside]


def splat(radius, order, into, value=None):
    """Draw discs. `into` is a depth buffer when `value` is None."""
    r = int(np.ceil(radius.max()))
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            hit = dx * dx + dy * dy <= radius * radius
            jx, jy = ix + dx, iy + dy
            ok = hit & (jx >= 0) & (jx < W) & (jy >= 0) & (jy < H)
            if not ok.any():
                continue
            if value is None:
                np.minimum.at(into, (jy[ok], jx[ok]), order[ok])
            else:
                keep = order[ok] <= into[1][jy[ok], jx[ok]]
                yy, xx = jy[ok][keep], jx[ok][keep]
                into[0][yy, xx] = value[ok][keep]
                into[1][yy, xx] = order[ok][keep]


"""
Two passes, as the page does it.

First the fat splats, pushed away from the camera along the view ray, which
lay down where the nearest surface is. Then the real points, drawn only
where they are at that surface. Without this the eyes and the mouth read
straight through the back of the skull, because a cloud this sparse covers
about an eighth of what is behind it.
"""
near = np.full((H, W), 1e9)
pushed = depth * (1 + BIAS / np.maximum(0.25, depth))
splat(np.maximum(0.5, size * FAT / 2), pushed, near)

visible = depth <= near[iy, ix] + BIAS
ix, iy, depth, size, shade = ix[visible], iy[visible], depth[visible], size[visible], shade[visible]

# --------------------------------------------------------------- drawing

"""
The page's own backdrop, from the exploration route's stylesheet: a soft
radial lift behind the animal falling to near-black at the corners.
"""
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx / W - 0.5) / 1.20) ** 2 + ((yy / H - 0.20) / 0.70) ** 2) * 2
d = np.clip(d, 0, 1)
stops = np.array([[0.00, 0x1a, 0x1a, 0x1d], [0.62, 0x13, 0x13, 0x15], [1.00, 0x0b, 0x0b, 0x0c]], float)
img = np.stack([np.interp(d, stops[:, 0], stops[:, i + 1]) for i in range(3)], -1)

colour = (INK[None, :] * shade[:, None])
buf = (img, np.full((H, W), 1e9))
splat(np.maximum(0.5, size / 2), depth, buf, value=colour)
img = buf[0]

# ----------------------------------------------------------- the laser

"""
The dot, drawn the way its shader draws it: a hot core in a wide soft halo,
added rather than blended, and sized by distance so it holds the same size
on screen wherever it is.
"""
lp = np.array(meta['laser'])
lrel = lp - eye
lz = lrel @ fwd
lx = ((lrel @ right) * focal / lz / meta['aspect'] * 0.5 + 0.5) * W
ly = (1 - ((lrel @ up) * focal / lz * 0.5 + 0.5)) * H
lr = np.linalg.norm(lrel) * 0.055 * focal / lz * 0.5 * H      # its quad, in pixels

gy, gx = np.mgrid[0:H, 0:W]
dd = np.sqrt((gx - lx) ** 2 + (gy - ly) ** 2) / lr
inside = dd <= 1.0
core = np.clip((0.30 - dd) / 0.30, 0, 1) ** 2 * 0.93
core = np.where(inside, core, 0)
halo = np.clip((1.0 - dd) / 0.86, 0, 1) ** 2 * 0.45
halo = np.where(inside, halo, 0)
tint = np.stack([
    np.full_like(core, 1.0),
    0.13 + (0.78 - 0.13) * core,
    0.10 + (0.74 - 0.10) * core,
], -1)
img = np.clip(img + tint * np.clip(core + halo, 0, 1)[..., None] * 255, 0, 255)

OUT.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(img.astype(np.uint8)).save(OUT)
print(f'{OUT}  {W}x{H}  '
      f'{len(ix)} points drawn of {COUNT} sampled  '
      f'(point {np.median(size):.2f}px, prime {np.median(size) * FAT:.2f}px)')
