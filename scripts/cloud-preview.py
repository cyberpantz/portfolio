#!/usr/bin/env python3
"""
Render the cat point cloud offline, so the sculpt can be judged before it
ships.

The browser is the only place this piece truly runs, and there is no browser
in the environment it gets built in. A point cloud is the one part of a WebGL
piece that can be rendered honestly without one: projection is a matrix, and
occlusion is a z-buffer. Both are twenty lines of numpy.

It draws the same points, with the same normals and the same lighting model
as the shader, so what comes out is not an impression of the result — it is
the result, at a lower frame rate.

    python3 scripts/cloud-preview.py out.png [yaw_degrees ...]
"""
import sys
import numpy as np
from PIL import Image

W = H = 420
FOV = 38.0
DIST = 4.2
INK = np.array([232, 232, 224], float)
GROUND = np.array([19, 19, 21], float)
LIGHT = np.array([-0.45, 0.72, 0.52])
LIGHT /= np.linalg.norm(LIGHT)


def load(path='.scratch/cloud.bin'):
    raw = np.fromfile(path, dtype=np.uint8)
    stride = 25
    n = len(raw) // stride
    raw = raw[: n * stride].reshape(n, stride)
    f = raw[:, :24].copy().view(np.float32).reshape(n, 6)
    return f[:, :3].astype(float), f[:, 3:6].astype(float), raw[:, 24]


def render(pos, nrm, yaw_deg, pitch_deg=8.0):
    ya, pa = np.radians(yaw_deg), np.radians(pitch_deg)
    ry = np.array([[np.cos(ya), 0, np.sin(ya)], [0, 1, 0], [-np.sin(ya), 0, np.cos(ya)]])
    rx = np.array([[1, 0, 0], [0, np.cos(pa), -np.sin(pa)], [0, np.sin(pa), np.cos(pa)]])
    R = rx @ ry
    p = pos @ R.T
    n = nrm @ R.T
    p[:, 2] -= DIST                       # camera at origin looking down -z

    f = 1.0 / np.tan(np.radians(FOV) / 2)
    z = -p[:, 2]
    keep = z > 0.1
    p, n, z = p[keep], n[keep], z[keep]
    sx = (p[:, 0] * f / z * 0.5 + 0.5) * W
    sy = (1 - (p[:, 1] * f / z * 0.5 + 0.5)) * H

    # Lambert with a lift, so the shadowed side is dark but not empty —
    # exactly what the shader does.
    lam = np.clip(n @ LIGHT, 0, 1)
    shade = 0.20 + 0.80 * lam

    img = np.tile(GROUND, (H, W, 1))
    zbuf = np.full((H, W), 1e9)
    xi, yi = sx.astype(int), sy.astype(int)
    ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
    # Painter's order, nearest last, which is a z-buffer for equal-size points.
    order = np.argsort(-z[ok])
    xi, yi, sh = xi[ok][order], yi[ok][order], shade[ok][order]
    img[yi, xi] = INK * sh[:, None]
    return Image.fromarray(img.astype(np.uint8))


def main() -> None:
    out = sys.argv[1]
    angles = [float(a) for a in sys.argv[2:]] or [0, 35, 70, 180]
    pos, nrm, _ = load()
    sheet = Image.new('RGB', (W * len(angles) + 12 * (len(angles) - 1), H), tuple(GROUND.astype(int)))
    for i, a in enumerate(angles):
        sheet.paste(render(pos, nrm, a), (i * (W + 12), 0))
    sheet.save(out)
    print(f'  {len(pos):,} points, {len(angles)} views -> {out}')


if __name__ == '__main__':
    main()
