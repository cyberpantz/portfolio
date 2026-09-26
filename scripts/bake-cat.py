#!/usr/bin/env python3
"""
Bake the rigged cat and its animation into one file the browser can fetch.

What ships is a skeleton and some clips, not a pose. Earlier versions froze
a sitting cat into the geometry and left twenty bones free to nod and
twitch, which is enough for a cat that only ever sits. It is not enough for
a cat that crouches: the legs, pelvis and spine are the crouch, and they
were exactly the parts that had been frozen. A crouch faked with what
remained could bow the chest and nothing else, which reads as a slouch.

So:

  · read the FBX mesh, skeleton and skin
  · read several animation clips and resample them to a fixed rate
  · write the BIND-pose mesh, the skeleton, the inverse binds and the clips

The browser composes the hierarchy, skins on the GPU, and blends between
clips. Every movement the cat makes is either animation somebody authored
or a rotation layered on top of it to aim the head — nothing in between is
invented here.

    python3 scripts/bake-cat.py
"""
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from fbx import load, connections, by_id, name_of, prop70  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MESH = ROOT / 'docs/resources/Cat/Meshes/Cat.fbx'
ANIM = ROOT / 'docs/resources/Cat/Animations'
OUT = ROOT / 'public/cat.bin'
META = ROOT / 'src/experiments/skittish/cat-rig.json'

FBX_TIME = 46186158000  # FBX's internal ticks per second
RATE = 30.0             # clip sample rate, frames per second

"""
The clips, and why these four.

`sit` is a held pose — measured, it does not move at all over its three
seconds, so one frame of it is the whole clip. Everything alive about the
sitting cat (breath, ears, tail, the head tracking the laser) is layered on
at runtime.

`rise` and `sneak` are what the cat does when the laser goes to the floor.
The transition exists in the pack, so the cat gets up properly instead of
melting from one shape into the other.

`settle` is the way back down, so the cat sits again rather than snapping
into the pose.

`swipe` is the bat. It was a hand-tuned spring before — out fast, back
slow, on a cooldown — which is a decent guess at the shape of a swipe and
still read as a mechanism. This is the real one: 1.03 seconds, and the left
front paw travels about two-thirds of a body length through it.

`loop` says whether the clip runs continuously or plays once and holds.
"""
CLIPS = [
    ('sit',   'Sitting_00-IP.fbx',            2.00, 2.00, True),
    ('rise',  'Trans_Sitting_to_Stand-IP.fbx', 0.0, None, False),
    ('sneak', 'Loco_Sneak-IP.fbx',             0.0, None, True),
    ('settle', 'Trans_Stand_to_Sitting-IP.fbx',  0.0, None, False),
    ('swipe', 'Attack_Left-IP.fbx',            0.0, None, False),
]

"""
Which bones animate.

Forty-four of the hundred and four. The rest are toes, claws, whiskers and
eyes: together they own about a third of the skin weight, so their SHAPE
matters and ships, but they barely move relative to the ankle or the muzzle
they hang from. Freezing them there costs a little toe splay and saves more
than half the clip data. Vertices weighted to a frozen bone are handed to
its nearest animated ancestor, which is what a foot does anyway.
"""


def animated(name: str) -> bool:
    return not any(k in name for k in ('Digit', 'Claw', 'Whisker', 'Eye'))


# --------------------------------------------------------------- matrices

def euler_xyz(rx, ry, rz):
    """FBX default rotation order is XYZ, in degrees."""
    x, y, z = math.radians(rx), math.radians(ry), math.radians(rz)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    rxm = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rym = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rzm = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rzm @ rym @ rxm


def trs(t, r):
    m = np.eye(4)
    m[:3, :3] = euler_xyz(*r)
    m[:3, 3] = t
    return m


def quat_of(m):
    """Rotation matrix to quaternion (x, y, z, w), via the largest diagonal.

    Picking the largest term rather than always using w keeps the divisor
    away from zero; the naive form loses all its precision at 180 degrees,
    which a tail passing behind the cat will reach.
    """
    r = m[:3, :3]
    tr = r[0, 0] + r[1, 1] + r[2, 2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = [(r[2, 1] - r[1, 2]) / s, (r[0, 2] - r[2, 0]) / s, (r[1, 0] - r[0, 1]) / s, 0.25 * s]
    elif r[0, 0] > r[1, 1] and r[0, 0] > r[2, 2]:
        s = math.sqrt(1.0 + r[0, 0] - r[1, 1] - r[2, 2]) * 2
        q = [0.25 * s, (r[0, 1] + r[1, 0]) / s, (r[0, 2] + r[2, 0]) / s, (r[2, 1] - r[1, 2]) / s]
    elif r[1, 1] > r[2, 2]:
        s = math.sqrt(1.0 + r[1, 1] - r[0, 0] - r[2, 2]) * 2
        q = [(r[0, 1] + r[1, 0]) / s, 0.25 * s, (r[1, 2] + r[2, 1]) / s, (r[0, 2] - r[2, 0]) / s]
    else:
        s = math.sqrt(1.0 + r[2, 2] - r[0, 0] - r[1, 1]) * 2
        q = [(r[0, 2] + r[2, 0]) / s, (r[1, 2] + r[2, 1]) / s, 0.25 * s, (r[1, 0] - r[0, 1]) / s]
    q = np.array(q, float)
    return q / (np.linalg.norm(q) + 1e-12)


# ------------------------------------------------------------------ mesh

def read_mesh(path):
    root, _ = load(str(path))
    objs = root.find('Objects')
    ids, conn = by_id(root), connections(root)

    geo = next(g for g in objs.findall('Geometry') if 'Eye' not in name_of(g))
    verts = np.array(geo.find('Vertices').props[0], float).reshape(-1, 3)
    norms = np.array(geo.find('LayerElementNormal').find('Normals').props[0], float).reshape(-1, 3)

    tris, poly = [], []
    for i in geo.find('PolygonVertexIndex').props[0]:
        if i < 0:
            poly.append(~i)
            for k in range(1, len(poly) - 1):
                tris.append((poly[0], poly[k], poly[k + 1]))
            poly = []
        else:
            poly.append(i)

    bones = {}
    for m in objs.findall('Model'):
        if len(m.props) > 2 and m.props[2] == 'LimbNode':
            bones[name_of(m)] = {
                'id': m.props[0],
                't': prop70(m, 'Lcl Translation', [0, 0, 0]),
                'r': prop70(m, 'Lcl Rotation', [0, 0, 0]),
                'parent': None,
            }
    byid = {b['id']: n for n, b in bones.items()}
    for n, b in bones.items():
        for pid, _ in conn.get(b['id'], []):
            if pid in byid:
                b['parent'] = byid[pid]
                break

    # Clusters carry the weights and the bind matrices, and name no bone.
    # The link runs the other way: the BONE is connected to the cluster as
    # its child, so the map has to be inverted before it can be read.
    children = {}
    for cid, parents in conn.items():
        for pid, _ in parents:
            children.setdefault(pid, []).append(cid)

    skin = {}
    for d in objs.findall('Deformer'):
        if len(d.props) < 3 or d.props[2] != 'Cluster':
            continue
        idx, wts = d.find('Indexes'), d.find('Weights')
        if not idx or not wts:
            continue
        bone = next((byid[c] for c in children.get(d.props[0], []) if c in byid), None)
        if bone is None:
            continue
        skin[bone] = {
            'idx': np.array(idx.props[0], int),
            'w': np.array(wts.props[0], float),
            # Two matrices, and which is which is not what the names say.
            # FBX documents Cluster.Transform as the MESH's transform at
            # bind time, the same for every cluster of a skin. This
            # exporter writes the inverse bind matrix instead — one per
            # bone, mesh space to bone space. Proved rather than assumed:
            # link @ xform comes out as the identity for all 92 of them,
            # so xform is exactly inverse(link).
            #
            # Getting this wrong applies the inverse bind twice and the cat
            # arrives as a flattened knot, which is precisely what it did.
            'link': np.array(d.find('TransformLink').props[0], float).reshape(4, 4).T,
            'xform': np.array(d.find('Transform').props[0], float).reshape(4, 4).T,
        }
    return verts, norms, np.array(tris), bones, skin


# ------------------------------------------------------------- animation

def read_curves(path):
    """Every animated channel of a clip, as (times, values) per bone."""
    root, _ = load(str(path))
    objs = root.find('Objects')
    conn = connections(root)
    models = {name_of(m): m.props[0] for m in objs.findall('Model')}
    target = {v: k for k, v in models.items()}

    drives = {}
    for cn in objs.findall('AnimationCurveNode'):
        for pid, prop in conn.get(cn.props[0], []):
            if pid in target and prop:
                drives[cn.props[0]] = (target[pid], prop)

    out, end = {}, 0
    for cv in objs.findall('AnimationCurve'):
        for pid, prop in conn.get(cv.props[0], []):
            if pid not in drives or not prop:
                continue
            bone, which = drives[pid]
            axis = {'d|X': 0, 'd|Y': 1, 'd|Z': 2}.get(prop)
            if axis is None:
                continue
            times = np.array(cv.find('KeyTime').props[0], float)
            vals = np.array(cv.find('KeyValueFloat').props[0], float)
            end = max(end, times[-1] if len(times) else 0)
            out.setdefault(bone, {}).setdefault(which, [None, None, None])[axis] = (times, vals)
    return out, end / FBX_TIME


def sample(curves, at_seconds):
    """Local translation and rotation per bone at one instant."""
    tick = at_seconds * FBX_TIME
    pose = {}
    for bone, props in curves.items():
        slot = pose.setdefault(bone, {})
        for which, axes in props.items():
            got = [None, None, None]
            for i, tv in enumerate(axes):
                if tv is None:
                    continue
                times, vals = tv
                got[i] = float(np.interp(tick, times, vals))
            slot[which] = got
    return pose


def world_matrices(bones, pose):
    """Compose local transforms down the hierarchy, animation overriding."""
    world, local = {}, {}

    def resolve(name):
        if name in world:
            return world[name]
        b = bones[name]
        t, r = list(b['t']), list(b['r'])
        anim = pose.get(name, {})
        for i in range(3):
            if 'Lcl Translation' in anim and anim['Lcl Translation'][i] is not None:
                t[i] = anim['Lcl Translation'][i]
            if 'Lcl Rotation' in anim and anim['Lcl Rotation'][i] is not None:
                r[i] = anim['Lcl Rotation'][i]
        local[name] = trs(t, r)
        world[name] = resolve(b['parent']) @ local[name] if b['parent'] else local[name]
        return world[name]

    for n in bones:
        resolve(n)
    return world, local


# ---------------------------------------------------------------- baking

def normaliser(bones, skin, verts, norms):
    """The similarity S that takes FBX space to the renderer's.

    FBX has z up and x forward; the renderer has y up and x forward, the
    cat centred in a box two units across. Rather than transforming every
    vertex and then separately fixing up the skeleton, S is built once and
    applied in two places: the mesh ships as S·v, and each inverse bind
    ships as invBind·S⁻¹. Composing the hierarchy then needs S prepended at
    the root and nothing else, because

        (S·W) · (invBind·S⁻¹) · (S·v)  =  S · (W·invBind·v)

    — the inner S⁻¹·S cancels, and what comes out is the skinned vertex in
    the renderer's space. One matrix, no per-bone corrections, and nothing
    to keep in sync.

    S ships whole, as sixteen floats, and is applied at the root at
    runtime. It cannot instead be folded into the root bone's own local
    transform, because locals travel as a quaternion and a translation and
    S has a scale in it: a quaternion has nowhere to put a scale, so
    folding it in drops the scale silently and poses the cat at fifty times
    its size. Which it did, and the check caught it.
    """
    perm = np.zeros((4, 4))
    perm[0, 1], perm[1, 2], perm[2, 0], perm[3, 3] = -1, 1, 1, 1

    # Measured on the SIT, so the cat is framed sitting and every other
    # clip keeps the same scale rather than being refitted to its own box.
    curves, _ = read_curves(ANIM / CLIPS[0][1])
    world, _ = world_matrices(bones, sample(curves, CLIPS[0][2]))
    P = pose_verts(verts, norms, skin, world)[0] @ perm[:3, :3].T
    centre = (P.min(0) + P.max(0)) / 2
    scale = 2.0 / np.max(P.max(0) - P.min(0))

    S = np.eye(4)
    S[:3, :3] = np.eye(3) * scale
    S[:3, 3] = -centre * scale
    return S @ perm


def pose_verts(verts, norms, skin, world):
    """Pose every vertex by its bones, in FBX space."""
    acc = np.zeros((len(verts), 3))
    accn = np.zeros((len(verts), 3))
    total = np.zeros(len(verts))
    v4 = np.hstack([verts, np.ones((len(verts), 1))])
    for bone, c in skin.items():
        if bone not in world:
            continue
        m = world[bone] @ c['xform']
        sel, w = c['idx'], c['w']
        acc[sel] += w[:, None] * (v4[sel] @ m.T)[:, :3]
        accn[sel] += w[:, None] * (norms[sel] @ m[:3, :3].T)
        total[sel] += w
    live = total > 1e-6
    acc[live] /= total[live, None]
    accn[live] /= total[live, None]
    acc[~live] = verts[~live]
    accn[~live] = norms[~live]
    return acc, accn, live


def outer_shell(V, tris, dirs=240, grid=320):
    """Which triangles can be seen from outside at all.

    A model built to be looked at from the outside still carries surfaces
    that never are: the inside of the mouth, the backs of the eye sockets,
    the sheet behind the nose. Rendered as a solid they are hidden by the
    skin in front of them. Rendered as POINTS they are not — a cloud is
    porous, the shell in front covers only about half of what is behind it,
    and what comes through the gaps at the back of the skull is the inside
    of the cat's face. It reads as an x-ray, which is not the effect.

    So they are dropped here, once, rather than fought with at runtime.
    The test is direct: look at the mesh from a couple of hundred
    directions spread evenly over the sphere, and keep every triangle that
    is ever the nearest thing along some line of sight. Anything that is
    never nearest from any angle is inside.

    Centroids rather than full rasterisation — a triangle wins a cell of
    the grid if its centre is the closest centre in it. At this grid size
    most cells hold at most one, and a triangle only has to win once in two
    hundred and forty looks, so the error is one-sided and small.
    """
    C = V[tris].mean(1)
    seen = np.zeros(len(tris), bool)

    # Fibonacci sphere: even coverage without clustering at the poles.
    i = np.arange(dirs) + 0.5
    phi = np.arccos(1 - 2 * i / dirs)
    theta = np.pi * (1 + 5 ** 0.5) * i
    D = np.stack([np.cos(theta) * np.sin(phi), np.sin(theta) * np.sin(phi), np.cos(phi)], 1)

    for d in D:
        # An orthonormal frame with `d` as depth.
        up = np.array([0.0, 0.0, 1.0]) if abs(d[2]) < 0.9 else np.array([1.0, 0.0, 0.0])
        x = np.cross(d, up); x /= np.linalg.norm(x)
        y = np.cross(d, x)
        u, v, z = C @ x, C @ y, C @ d

        lo = np.array([u.min(), v.min()])
        span = max(u.max() - lo[0], v.max() - lo[1]) * 1.0001
        gu = ((u - lo[0]) / span * grid).astype(np.int32)
        gv = ((v - lo[1]) / span * grid).astype(np.int32)
        cell = gu * (grid + 1) + gv

        # Nearest centroid per cell: sort by depth, then take the first of
        # each cell — np.unique on a stably sorted array gives exactly that.
        order = np.argsort(z, kind='stable')
        _, first = np.unique(cell[order], return_index=True)
        seen[order[first]] = True

    return seen


def main():
    print('reading mesh…')
    verts, norms, tris, bones, skin = read_mesh(MESH)
    print(f'  {len(verts)} verts, {len(tris)} tris, {len(bones)} bones, {len(skin)} skinned')

    S = normaliser(bones, skin, verts, norms)
    Sinv = np.linalg.inv(S)

    # The animated set, parents first so the runtime can compose in one
    # forward pass without recursion or a sort.
    order, seen = [], set()

    def visit(n):
        if n in seen or not animated(n):
            return
        p = bones[n]['parent']
        if p:
            visit(p)
        if n not in seen:
            seen.add(n)
            order.append(n)

    for n in bones:
        visit(n)
    index = {n: i for i, n in enumerate(order)}
    print(f'  {len(order)}/{len(bones)} bones animate; the rest ride their nearest animated parent')

    # Rest locals, and the inverse binds folded through S.
    rest_t, rest_q, invbind = [], [], []
    for n in order:
        b = bones[n]
        L = trs(b['t'], b['r'])
        rest_t.append(L[:3, 3])
        rest_q.append(quat_of(L))
        ib = skin[n]['xform'] if n in skin else np.linalg.inv(world_rest(bones, n))
        invbind.append(ib @ Sinv)

    """
    Weights, with frozen bones handed up to their nearest animated parent.

    A toe is skinned to a toe bone that no longer exists at runtime. Left
    alone those vertices would fall to the origin; handed to the ankle they
    keep the shape of the foot and lose only the splay, which at this point
    density is smaller than a point.
    """
    wsum = np.zeros((len(verts), len(order)))
    for bone, c in skin.items():
        host = bone
        while host and host not in index:
            host = bones[host]['parent'] if host in bones else None
        if host in index:
            wsum[c['idx'], index[host]] += c['w']

    top = np.argsort(-wsum, axis=1)[:, :4]
    tw = np.take_along_axis(wsum, top, 1)
    tot4 = tw.sum(1, keepdims=True)
    tw = np.where(tot4 > 1e-5, tw / np.maximum(tot4, 1e-9), 0)
    print(f'  {(tot4[:, 0] > 1e-5).sum()}/{len(verts)} verts carry weight')

    # The mesh ships in its BIND pose, normalised.
    V = (np.hstack([verts, np.ones((len(verts), 1))]) @ S.T)[:, :3]
    N = norms @ S[:3, :3].T
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    """
    Positions quantise over the BIND pose's own extent, not the sit's.

    The framing is fitted to the sitting cat, because that is what the
    piece opens on — but what ships is the bind pose, a cat stretched out
    flat, and it is half as long again. Quantising that over [-1, 1] clips
    the nose and the tail tip off. The extent travels in the header, so the
    range is whatever it needs to be and the loader does not have to know
    which pose was used to frame the shot.
    """
    span = float(np.abs(V).max()) * 1.001
    assert 0.5 < span < 8, f'bind pose is a strange size ({span:.2f})'

    print('finding the outer shell…')
    keep = outer_shell(V, tris)
    inside = len(tris) - int(keep.sum())
    print(f'  dropped {inside} of {len(tris)} triangles ({inside / len(tris):.0%}) that are never visible')
    assert inside < len(tris) * 0.45, 'too much of the cat judged interior — check the test'
    tris = tris[keep]

    print('sampling clips…')
    clips = []
    for name, fname, start, stop, loop in CLIPS:
        curves, end = read_curves(ANIM / fname)
        stop = end if stop is None else stop
        frames = max(1, int(round((stop - start) * RATE)) + (0 if stop == start else 1))
        Q = np.zeros((frames, len(order), 4))
        T = np.zeros((frames, 3))
        for f in range(frames):
            t = start if frames == 1 else start + (stop - start) * f / (frames - 1)
            _, local = world_matrices(bones, sample(curves, t))
            for i, n in enumerate(order):
                L = local[n]
                if bones[n]['parent'] is None:
                    T[f] = L[:3, 3]
                Q[f, i] = quat_of(L)
            # Keep the whole clip on one side of the quaternion double
            # cover. Without this a bone can flip sign between frames and
            # the interpolation takes the long way round — a leg that
            # swings through the cat rather than under it.
            if f:
                flip = (Q[f] * Q[f - 1]).sum(1) < 0
                Q[f][flip] *= -1
        """
        Where this clip turns about.

        Not the origin: the mesh's origin is the centre of a bounding box,
        and it sits about a fifth of a body-length behind where the animal
        is actually resting. Turning there swings the cat through an arc,
        which reads as a turntable. The honest pivot is the middle of
        whatever is touching the floor, and it moves between poses — a
        sitting cat pivots on its haunches, a crouched one on all four
        feet — so each clip carries its own, measured at its first frame.
        """
        _, l0 = world_matrices(bones, sample(curves, start))
        w0, _ = world_matrices(bones, sample(curves, start))
        Pv = pose_verts(verts, norms, skin, w0)[0]
        Pv = (np.hstack([Pv, np.ones((len(Pv), 1))]) @ S.T)[:, :3]
        ylo = Pv[:, 1].min()
        low = Pv[:, 1] < ylo + 0.15 * (Pv[:, 1].max() - ylo)
        pivot = [round(float(Pv[low, 0].mean()), 5), 0.0, round(float(Pv[low, 2].mean()), 5)]
        clips.append((name, loop, (stop - start), Q, T, pivot))
        print(f'  {name:6s} {frames:4d} frames  {stop - start:5.2f}s  {"loop" if loop else "once"}')

    """
    In-place, because the cat is the whole scene.

    The sneak cycle drifts its pelvis a couple of units over four seconds —
    the pack's "-IP" clips are close to stationary but not exactly so, and
    a cat that walks slowly off the side of the frame is not what anybody
    wants.

    Each clip is flattened onto the SIT's position rather than onto zero.
    Flattening onto zero de-drifts each clip correctly and then puts them
    all in different places, because a clip's mean root position is a fact
    about that clip: the cat would jump sideways every time it stood up or
    sat down. Worse for a single-frame clip like the sit, whose mean IS its
    only value, so subtracting it deletes the pose's placement outright and
    moves the whole animal half a head.

    Vertical is left alone, since the rise and fall of the body IS the
    gait. These are FBX axes, where z is up — so the two to flatten are x
    and y.
    """
    home = clips[0][4][:, :2].mean(0)   # the sit, which everything sits on
    for name, loop, dur, Q, T, pivot in clips:
        T[:, 0] += home[0] - T[:, 0].mean()
        T[:, 1] += home[1] - T[:, 1].mean()

    print('writing…')
    buf = bytearray()
    buf += struct.pack('<4sIIIIf', b'CATS', len(V), len(tris), len(order), len(clips), span)
    buf += np.ascontiguousarray(S, '<f4').tobytes()

    for i in range(len(order)):
        p = bones[order[i]]['parent']
        buf += struct.pack('<B', 255 if p is None else index[p])
        buf += np.array(rest_t[i], '<f4').tobytes()
        buf += np.array(rest_q[i], '<f4').tobytes()
        buf += np.ascontiguousarray(invbind[i], '<f4').tobytes()

    q = np.clip(np.round(V / span * 32767), -32767, 32767).astype('<i2')
    qn = np.clip(np.round(N * 127), -127, 127).astype('<i1')
    qi = top.astype(np.uint8)
    qw = np.clip(np.round(tw * 255), 0, 255).astype(np.uint8)
    for i in range(len(V)):
        buf += q[i].tobytes() + qn[i].tobytes() + qi[i].tobytes() + qw[i].tobytes() + b'\x00'
    assert tris.max() < 65536, 'too many vertices for 16-bit indices'
    if len(buf) % 2:
        buf += b'\x00'
    buf += tris.astype('<u2').tobytes()

    for name, loop, dur, Q, T, pivot in clips:
        nb = name.encode()
        buf += struct.pack('<BBHf', len(nb), 1 if loop else 0, len(Q), dur) + nb
        if len(buf) % 2:
            buf += b'\x00'
        # Quantised to int16 over [-1, 1], which is about 1/32000 of a
        # revolution — far finer than a point is wide at any zoom here.
        buf += np.clip(np.round(Q * 32767), -32767, 32767).astype('<i2').tobytes()
        buf += np.ascontiguousarray(T, '<f4').tobytes()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(buf)

    META.write_text(json.dumps({
        'bones': order,
        'clips': [{'name': n, 'loop': l, 'seconds': round(d, 4), 'frames': len(q), 'pivot': pv}
                  for n, l, d, q, _, pv in clips],
        'rate': RATE,
    }, indent=2) + '\n')

    print(f'  {OUT.name}: {len(buf) / 1024:.0f}KB — '
          f'{len(V)} verts, {len(tris)} tris, {len(order)} bones, {len(clips)} clips')
    print(f'  bind extent {span:.3f}; position resolution {span / 32767:.2e} of a body')


def world_rest(bones, name):
    """Bind world matrix for a bone the skin never mentions."""
    m = np.eye(4)
    chain = []
    n = name
    while n:
        chain.append(n)
        n = bones[n]['parent']
    for n in reversed(chain):
        m = m @ trs(bones[n]['t'], bones[n]['r'])
    return m


if __name__ == '__main__':
    main()
