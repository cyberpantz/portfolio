#!/usr/bin/env python3
"""
A reader for binary FBX, enough of it to get geometry and a skeleton out.

FBX is a tree of records. Each record is a length-prefixed name, a list of
typed properties, and nested records, terminated by a null record. Arrays of
numbers may be zlib-compressed, which is where most of the file goes.

Written rather than installed because the alternatives are the proprietary
SDK, a native library that needs building, or asking for a re-export. It is
about a hundred lines and it does not change.
"""
import struct
import zlib
from collections import defaultdict


class Node:
    __slots__ = ('name', 'props', 'kids')

    def __init__(self, name, props, kids):
        self.name, self.props, self.kids = name, props, kids

    def find(self, name):
        for k in self.kids:
            if k.name == name:
                return k
        return None

    def findall(self, name):
        return [k for k in self.kids if k.name == name]

    def __repr__(self):
        return f'<{self.name} props={len(self.props)} kids={len(self.kids)}>'


def _array(buf, off, kind, size):
    n, enc, clen = struct.unpack_from('<III', buf, off)
    off += 12
    raw = buf[off:off + clen]
    off += clen
    if enc == 1:
        raw = zlib.decompress(raw)
    return list(struct.unpack(f'<{n}{kind}', raw[: n * size])), off


def _props(buf, off, count):
    out = []
    for _ in range(count):
        t = chr(buf[off]); off += 1
        if t == 'Y': v = struct.unpack_from('<h', buf, off)[0]; off += 2
        elif t == 'C': v = bool(buf[off]); off += 1
        elif t == 'I': v = struct.unpack_from('<i', buf, off)[0]; off += 4
        elif t == 'F': v = struct.unpack_from('<f', buf, off)[0]; off += 4
        elif t == 'D': v = struct.unpack_from('<d', buf, off)[0]; off += 8
        elif t == 'L': v = struct.unpack_from('<q', buf, off)[0]; off += 8
        elif t in 'fdlib':
            kind = {'f': 'f', 'd': 'd', 'l': 'q', 'i': 'i', 'b': 'B'}[t]
            size = {'f': 4, 'd': 8, 'l': 8, 'i': 4, 'b': 1}[t]
            v, off = _array(buf, off, kind, size)
        elif t in 'SR':
            ln = struct.unpack_from('<I', buf, off)[0]; off += 4
            v = buf[off:off + ln]; off += ln
            if t == 'S':
                v = v.decode('utf-8', 'replace')
        else:
            raise ValueError(f'unknown FBX property type {t!r}')
        out.append(v)
    return out, off


def _record(buf, off, wide):
    if wide:
        end, nprops, plen = struct.unpack_from('<QQQ', buf, off); off += 24
    else:
        end, nprops, plen = struct.unpack_from('<III', buf, off); off += 12
    nlen = buf[off]; off += 1
    if end == 0:
        return None, off
    name = buf[off:off + nlen].decode('utf-8', 'replace'); off += nlen
    props, off = _props(buf, off, nprops)
    kids = []
    while off < end:
        kid, off = _record(buf, off, wide)
        if kid is None:
            break
        kids.append(kid)
    return Node(name, props, kids), end


def load(path):
    buf = open(path, 'rb').read()
    if buf[:20] != b'Kaydara FBX Binary  ':
        raise ValueError('not a binary FBX')
    version = struct.unpack_from('<I', buf, 23)[0]
    off = 27
    wide = version >= 7500
    root = []
    while off < len(buf) - 160:
        node, off = _record(buf, off, wide)
        if node is None:
            break
        root.append(node)
    return Node('root', [], root), version


def connections(root):
    """
    child id -> [(parent id, property or None)].

    FBX links objects two ways: OO for "this belongs to that", and OP for
    "this drives that property of that". Animation needs the second — a
    curve node is attached to a model's Lcl Rotation, and without the
    property name there is no way to know which channel it drives.
    """
    out = defaultdict(list)
    c = root.find('Connections')
    if c:
        for k in c.kids:
            if k.name != 'C' or len(k.props) < 3:
                continue
            prop = k.props[3] if len(k.props) > 3 and isinstance(k.props[3], str) else None
            out[k.props[1]].append((k.props[2], prop))
    return out


def by_id(root):
    """Every object that has an id, keyed by it."""
    out = {}
    objs = root.find('Objects')
    if objs:
        for x in objs.kids:
            if x.props and isinstance(x.props[0], int):
                out[x.props[0]] = x
    return out


def name_of(node):
    """FBX packs name and class into one string separated by a null."""
    if len(node.props) > 1 and isinstance(node.props[1], str):
        return node.props[1].split('\x00')[0]
    return ''


def prop70(node, key, default=None):
    """Read one Properties70 entry, returning its value list."""
    p = node.find('Properties70')
    if not p:
        return default
    for k in p.kids:
        if k.props and k.props[0] == key:
            return list(k.props[4:])
    return default


if __name__ == '__main__':
    import sys
    r, v = load(sys.argv[1])
    print(f'FBX {v}')
    for k in r.kids:
        print(' ', k.name, len(k.kids))
    objs = r.find('Objects')
    if objs:
        kinds = defaultdict(int)
        for k in objs.kids:
            kinds[k.name] += 1
        print('Objects:', dict(kinds))
