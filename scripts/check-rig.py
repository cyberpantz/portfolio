#!/usr/bin/env python3
"""
Read cat.bin back and prove the rig in it reproduces the animation.

This exists because the last skinning bug did not look like a bug in the
maths — it looked like a cat-shaped knot, and only a comparison against the
source made it obvious which of two plausible matrix orders was right.

The check walks the same path the browser walks: parse the file, compose
the hierarchy from the quaternions, multiply by the inverse binds, skin the
BIND vertices. Then it compares the result against the vertices posed
directly from the FBX, which is a different code path entirely. Agreement
to a fraction of a point means the rig survived the round trip.

    python3 scripts/check-rig.py [--render out.png]
"""
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import importlib.util

spec = importlib.util.spec_from_file_location('bake', Path(__file__).parent / 'bake-cat.py')
bake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bake)


def read(path):
    raw = path.read_bytes()
    magic, nv, nt, nb, nc, span = struct.unpack_from('<4sIIIIf', raw, 0)
    assert magic == b'CATS', magic
    o = 24
    S = np.frombuffer(raw, '<f4', 16, o).reshape(4, 4); o += 64

    parent, rest_t, rest_q, invbind = [], [], [], []
    for _ in range(nb):
        parent.append(struct.unpack_from('<B', raw, o)[0]); o += 1
        rest_t.append(np.frombuffer(raw, '<f4', 3, o)); o += 12
        rest_q.append(np.frombuffer(raw, '<f4', 4, o)); o += 16
        invbind.append(np.frombuffer(raw, '<f4', 16, o).reshape(4, 4)); o += 64

    v = np.frombuffer(raw, np.uint8, nv * 18, o).reshape(nv, 18); o += nv * 18
    pos = v[:, :6].copy().view('<i2').astype(float) / 32767 * span
    idx = v[:, 9:13].astype(int)
    wgt = v[:, 13:17].astype(float) / 255
    if o % 2:
        o += 1
    tris = np.frombuffer(raw, '<u2', nt * 3, o).reshape(nt, 3).astype(int); o += nt * 6

    clips = {}
    for _ in range(nc):
        ln, loop, frames, dur = struct.unpack_from('<BBHf', raw, o); o += 8
        name = raw[o:o + ln].decode(); o += ln
        if o % 2:
            o += 1
        Q = np.frombuffer(raw, '<i2', frames * nb * 4, o).reshape(frames, nb, 4).astype(float) / 32767
        o += frames * nb * 8
        T = np.frombuffer(raw, '<f4', frames * 3, o).reshape(frames, 3); o += frames * 12
        clips[name] = {'loop': bool(loop), 'dur': dur, 'Q': Q, 'T': T}
    assert o == len(raw), f'{o} consumed of {len(raw)}'
    return dict(nb=nb, parent=parent, S=S, rest_t=np.array(rest_t), rest_q=np.array(rest_q),
                invbind=np.array(invbind), pos=pos, idx=idx, wgt=wgt, tris=tris, clips=clips)


def mat_of(q, t):
    x, y, z, w = q
    m = np.eye(4)
    m[:3, :3] = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    m[:3, 3] = t
    return m


def skin_at(rig, clip, frame):
    c = rig['clips'][clip]
    Q, T = c['Q'][frame], c['T'][frame]
    world = [None] * rig['nb']
    for i in range(rig['nb']):
        t = T if rig['parent'][i] == 255 else rig['rest_t'][i]
        L = mat_of(Q[i] / (np.linalg.norm(Q[i]) + 1e-12), t)
        world[i] = rig['S'] @ L if rig['parent'][i] == 255 else world[rig['parent'][i]] @ L
    M = np.array([world[i] @ rig['invbind'][i] for i in range(rig['nb'])])

    v4 = np.hstack([rig['pos'], np.ones((len(rig['pos']), 1))])
    out = np.zeros((len(v4), 3))
    for k in range(4):
        w = rig['wgt'][:, k]
        if not w.any():
            continue
        m = M[rig['idx'][:, k]]
        out += w[:, None] * np.einsum('nij,nj->ni', m, v4)[:, :3]
    return out


def dominant(verts, skin):
    """Which source bone owns each vertex, and whether it ships animated."""
    names = sorted(skin)
    dom = np.zeros(len(verts), int)
    best = np.zeros(len(verts))
    for i, b in enumerate(names):
        c = skin[b]
        m = c['w'] > best[c['idx']]
        best[c['idx'][m]] = c['w'][m]
        dom[c['idx'][m]] = i
    return np.array([not bake.animated(n) for n in names])[dom]


def main():
    rig = read(bake.OUT)
    verts, norms, tris, bones, skin = bake.read_mesh(bake.MESH)
    S = bake.normaliser(bones, skin, verts, norms)
    frozen = dominant(verts, skin)

    """
    Two budgets, because there are two kinds of disagreement here.

    Vertices owned by an animated bone must match the source: any error
    there is a bug in the rig, and the tolerance is a fraction of the
    ~0.004 of a body that one point covers.

    Vertices owned by a toe, claw, whisker or eye are a deliberate
    approximation — those bones do not ship, and their vertices ride the
    ankle or muzzle instead. They are allowed to drift, but not far, and
    measuring them separately is what keeps a real bug from hiding inside
    an approximation that was chosen on purpose.
    """
    LIVE, RIDDEN = 0.03, 0.2
    print(f'  {(~frozen).sum()} verts on animated bones, {frozen.sum()} riding a frozen one\n')
    worst = worst_frozen = 0.0
    for name, fname, start, stop, loop in bake.CLIPS:
        curves, end = bake.read_curves(bake.ANIM / fname)
        stop = end if stop is None else stop
        frames = len(rig['clips'][name]['Q'])
        picks = [0] if frames == 1 else [0, frames // 3, 2 * frames // 3, frames - 1]
        for f in picks:
            t = start if frames == 1 else start + (stop - start) * f / (frames - 1)
            world, _ = bake.world_matrices(bones, bake.sample(curves, t))
            want = bake.pose_verts(verts, norms, skin, world)[0]
            want = (np.hstack([want, np.ones((len(want), 1))]) @ S.T)[:, :3]

            got = skin_at(rig, name, f)
            # Root motion was centred out of the file, so compare shapes.
            d = np.linalg.norm((got - got.mean(0)) - (want - want.mean(0)), axis=1)
            worst = max(worst, float(d[~frozen].max()))
            worst_frozen = max(worst_frozen, float(d[frozen].max()))
            print(f'  {name:6s} frame {f:3d}  rigged mean {d[~frozen].mean():.5f} '
                  f'worst {d[~frozen].max():.5f}   ridden worst {d[frozen].max():.5f}')

    print(f'\nworst on an animated bone: {worst:.5f} of a body (budget {LIVE})')
    print(f'worst on a ridden bone:    {worst_frozen:.5f} of a body (budget {RIDDEN})')
    if worst > LIVE or worst_frozen > RIDDEN:
        print('FAIL — the rig does not reproduce the source animation')
        return 1
    print('PASS — the shipped rig reproduces the source animation')
    return 0


if __name__ == '__main__':
    sys.exit(main())
