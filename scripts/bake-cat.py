#!/usr/bin/env python3
"""
Bake the rigged cat into a point cloud the browser can load in one fetch.

Everything expensive happens here, once, at build time:

  · read the FBX mesh, skeleton and skin
  · read one frame of a sitting animation and pose the cat into it
  · sample the POSED surface to points, with normals
  · keep skin weights only for the bones that still move at runtime
  · write it all as a compact binary

The last two are what make the runtime cheap. Baking the sit means the cat
arrives sitting and eighty of its hundred-odd bones never need to exist in
the browser; keeping weights only for the head, ears, one foreleg and the
tail means the shader needs about twenty matrices rather than a bone
texture. Points that no moving bone touches are frozen into the geometry
and cost nothing but their own drawing.

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
# Sitting_00 is a held, upright sit — head rise stays at 20.5 for its whole
# length, which is what a static idle looks like in the numbers. Sitting_02
# is a grooming loop: sampled at four seconds it gives a cat mid-lick, head
# down and a paw up, which is a lovely pose and the wrong one to be born in.
ANIM = ROOT / 'docs/resources/Cat/Animations/Sitting_00-IP.fbx'
OUT = ROOT / 'public/cat-cloud.bin'
META = ROOT / 'src/experiments/skittish/cat-rig.json'

POINTS = 120000
POSE_AT = float(__import__('os').environ.get('POSE_AT', 2.0))
FBX_TIME = 46186158000  # FBX's internal ticks per second

# The only bones that move once the sit is baked in. Everything else is
# frozen, which is most of the animal: four legs, the spine, all the toes.
MOVING = (
    'RigSpine4', 'RigNeck1', 'RigNeck2', 'RigNeck3', 'RigNeck4', 'RigHead',
    'RigLEar1', 'RigLEar2', 'RigREar1', 'RigREar2',
    'RigLFLeg1', 'RigLFLeg2', 'RigLFLeg3', 'RigLFLegAnkle',
    'RigTail1', 'RigTail2', 'RigTail3', 'RigTail4', 'RigTail5',
    'RigTail6', 'RigTail7',
)


# --------------------------------------------------------------- matrices

def euler_xyz(rx, ry, rz):
    """FBX default rotation order is XYZ, in degrees."""
    x, y, z = math.radians(rx), math.radians(ry), math.radians(rz)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    rxm = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    rym = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rzm = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rzm @ rym @ rxm


def trs(t, r, s=(1, 1, 1)):
    m = np.eye(4)
    m[:3, :3] = euler_xyz(*r) @ np.diag(s)
    m[:3, 3] = t
    return m


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

            # Getting this wrong applies the inverse bind twice and the cat
            # arrives as a flattened knot, which is precisely what it did. 
            'link': np.array(d.find('TransformLink').props[0], float).reshape(4, 4).T,
            'xform': np.array(d.find('Transform').props[0], float).reshape(4, 4).T,
        }
    return verts, norms, np.array(tris), bones, skin


# ------------------------------------------------------------- animation

def read_pose(path, at_seconds):
    """Local translation and rotation per bone, sampled at one instant."""
    root, _ = load(str(path))
    objs = root.find('Objects')
    ids, conn = by_id(root), connections(root)
    models = {name_of(m): m.props[0] for m in objs.findall('Model')}
    target = {v: k for k, v in models.items()}

    # curve node id -> (bone, which property)
    drives = {}
    for cn in objs.findall('AnimationCurveNode'):
        for pid, prop in conn.get(cn.props[0], []):
            if pid in target and prop:
                drives[cn.props[0]] = (target[pid], prop)

    # curve -> (curve node, which channel)
    out = {}
    tick = int(at_seconds * FBX_TIME)
    for cv in objs.findall('AnimationCurve'):
        for pid, prop in conn.get(cv.props[0], []):
            if pid not in drives or not prop:
                continue
            bone, which = drives[pid]
            axis = {'d|X': 0, 'd|Y': 1, 'd|Z': 2}.get(prop)
            if axis is None:
                continue
            times = cv.find('KeyTime').props[0]
            vals = cv.find('KeyValueFloat').props[0]
            i = np.searchsorted(times, tick)
            if i <= 0:
                v = vals[0]
            elif i >= len(times):
                v = vals[-1]
            else:
                f = (tick - times[i - 1]) / max(1, times[i] - times[i - 1])
                v = vals[i - 1] + (vals[i] - vals[i - 1]) * f
            slot = out.setdefault(bone, {})
            slot.setdefault(which, [None, None, None])[axis] = v
    return out


def world_matrices(bones, pose):
    """Compose local transforms down the hierarchy, animation overriding."""
    world, order = {}, []

    def resolve(name):
        if name in world:
            return world[name]
        b = bones[name]
        t = list(b['t'])
        r = list(b['r'])
        anim = pose.get(name, {})
        for i in range(3):
            if 'Lcl Translation' in anim and anim['Lcl Translation'][i] is not None:
                t[i] = anim['Lcl Translation'][i]
            if 'Lcl Rotation' in anim and anim['Lcl Rotation'][i] is not None:
                r[i] = anim['Lcl Rotation'][i]
        local = trs(t, r)
        world[name] = resolve(b['parent']) @ local if b['parent'] else local
        order.append(name)
        return world[name]

    for n in bones:
        resolve(n)
    return world


# ---------------------------------------------------------------- baking

def main():
    print('reading mesh…')
    verts, norms, tris, bones, skin = read_mesh(MESH)
    print(f'  {len(verts)} verts, {len(tris)} tris, {len(bones)} bones, {len(skin)} skinned')

    print(f'reading pose at {POSE_AT}s…')
    pose = {} if __import__('os').environ.get('BIND') else read_pose(ANIM, POSE_AT)
    print(f'  {len(pose)} bones animated')
    world = world_matrices(bones, pose)

    # Skin every vertex into the sitting pose.
    print('skinning…')
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
    print(f'  {int(live.sum())}/{len(verts)} verts had weights')

    # Per-vertex influence from the MOVING set only, relative to the sit.
    moving = [b for b in MOVING if b in world]
    mindex = {b: i for i, b in enumerate(moving)}
    wsum = np.zeros((len(verts), len(moving)))
    for bone, c in skin.items():
        if bone in mindex:
            wsum[c['idx'], mindex[bone]] += c['w']
    # Descendants of a moving bone inherit it, or the tail tip would stay
    # put while its root swung.
    for name, b in bones.items():
        p = b['parent']
        chain = []
        while p and p not in mindex:
            chain.append(p)
            p = bones[p]['parent'] if p in bones else None
        if p in mindex and name in skin:
            wsum[skin[name]['idx'], mindex[p]] += skin[name]['w']

    P = np.stack([-acc[:, 1], acc[:, 2], acc[:, 0]], 1)
    N = np.stack([-accn[:, 1], accn[:, 2], accn[:, 0]], 1)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    centre = (P.min(0) + P.max(0)) / 2
    scale = 2.0 / np.max(P.max(0) - P.min(0))
    P = (P - centre) * scale

    print(f'sampling {POINTS} points…')
    a, b, c3 = P[tris[:, 0]], P[tris[:, 1]], P[tris[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c3 - a), axis=1)
    cum = np.cumsum(area)
    rng = np.random.default_rng(11)
    pick = np.searchsorted(cum, rng.random(POINTS) * cum[-1])
    u, v = rng.random(POINTS), rng.random(POINTS)
    sw = u + v > 1
    u[sw], v[sw] = 1 - u[sw], 1 - v[sw]
    bary = np.stack([1 - u - v, u, v], 1)

    pts = (P[tris[pick]] * bary[:, :, None]).sum(1)
    nrm = (N[tris[pick]] * bary[:, :, None]).sum(1)
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    wts = (wsum[tris[pick]] * bary[:, :, None]).sum(1)

    top = np.argsort(-wts, axis=1)[:, :4]
    tw = np.take_along_axis(wts, top, 1)
    s = tw.sum(1, keepdims=True)
    tw = np.where(s > 1e-5, tw / np.maximum(s, 1e-9), 0)

    print('writing…')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    buf = bytearray()
    buf += struct.pack('<4sIII', b'CAT1', POINTS, len(moving), 0)
    for i in range(POINTS):
        buf += struct.pack('<3f', *pts[i])
        buf += struct.pack('<3b', *np.clip(nrm[i] * 127, -127, 127).astype(np.int8))
        buf += struct.pack('<4B', *top[i].astype(np.uint8))
        buf += struct.pack('<4B', *np.clip(tw[i] * 255, 0, 255).astype(np.uint8))
        buf += b'\x00'
    OUT.write_bytes(buf)

    joints = []
    for i, name in enumerate(moving):
        p = bones[name]['parent']
        while p and p not in mindex:
            p = bones[p]['parent'] if p in bones else None
        wp = world[name][:3, 3]
        at = ((np.array([-wp[1], wp[2], wp[0]]) - centre) * scale).tolist()
        joints.append({'name': name, 'at': [round(x, 5) for x in at],
                       'parent': mindex[p] if p in mindex else -1})
    META.write_text(json.dumps({'joints': joints, 'points': POINTS}, indent=2) + '\n')

    moved = (tw.sum(1) > 0.01).sum()
    print(f'  {OUT.name}: {len(buf) / 1e6:.2f}MB, {POINTS} points, {len(moving)} joints')
    print(f'  {moved} points ({moved / POINTS:.0%}) are influenced by a moving bone')


if __name__ == '__main__':
    main()
