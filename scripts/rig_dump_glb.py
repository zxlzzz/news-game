#!/usr/bin/env python
"""读 GLB（glTF 二进制）里的骨架与动画，不需要 Blender / three.js。

用于 anim.md 的源 rig 核查：assets/rigs/quaternius-animals/*.glb

    python scripts/rig_dump_glb.py <file.glb>                   骨架树 + 动画清单
    python scripts/rig_dump_glb.py <file.glb> --rigid           每段骨长在各动画里是否恒定
    python scripts/rig_dump_glb.py <file.glb> --stance Walk     支撑相接地分析（groundTravel 口径）

只消费 nodes / skins / animations / accessors，mesh 与贴图一律不读。
"""
import argparse
import json
import pathlib
import struct
import sys

import numpy as np

COMPONENT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

# Quaternius 四足 rig 的两条腿链。末端 FF/FFB 是 IK 控制骨，不是变形骨链的一部分，
# 但它们才是真正的接地点（见 assets/rigs/README.md）。
QUADRUPED_CHAINS = [
    ('前腿L', ['FrontShoulder.L', 'FrontUpperLeg.L', 'FrontLowerLeg.L', 'FF.L']),
    ('前腿R', ['FrontShoulder.R', 'FrontUpperLeg.R', 'FrontLowerLeg.R', 'FF.R']),
    ('后腿L', ['BackShoulder.L', 'BackLeg.L', 'BackUpperLeg.L', 'BackLowerLeg.L', 'FFB.L']),
    ('后腿R', ['BackShoulder.R', 'BackLeg.R', 'BackUpperLeg.R', 'BackLowerLeg.R', 'FFB.R']),
]
FEET = ['FF.L', 'FF.R', 'FFB.L', 'FFB.R']


# ---------- GLB 容器 ----------

def load_glb(path):
    raw = pathlib.Path(path).read_bytes()
    if raw[:4] != b'glTF':
        sys.exit(f'{path}: 不是 GLB（magic={raw[:4]!r}）')
    total = struct.unpack_from('<II', raw, 4)[1]
    gltf = binchunk = None
    off = 12
    while off < total:
        clen, ctype = struct.unpack_from('<II', raw, off)
        data = raw[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(data.decode('utf-8'))
        elif ctype == 0x004E4942:
            binchunk = data
        off += 8 + clen + ((-clen) % 4)
    return gltf, binchunk


def accessor(g, binchunk, i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n, c = a['count'], NCOMP[a['type']]
    dt = np.dtype('<' + COMPONENT[a['componentType']])
    return np.frombuffer(binchunk, dtype=dt, count=n * c, offset=off).reshape(n, c).astype(float)


# ---------- FK ----------

def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def local_matrix(node, override):
    if 'matrix' in node and not override:
        return np.array(node['matrix']).reshape(4, 4).T
    t = np.array(override.get('translation', node.get('translation', [0, 0, 0])), float)
    r = np.array(override.get('rotation', node.get('rotation', [0, 0, 0, 1])), float)
    s = np.array(override.get('scale', node.get('scale', [1, 1, 1])), float)
    M = np.eye(4)
    M[:3, :3] = quat_to_mat(r) @ np.diag(s)
    M[:3, 3] = t
    return M


def world_matrices(g, overrides=None):
    """overrides: {node_index: {path: value}}，缺省即 rest pose。"""
    overrides = overrides or {}
    nodes = g['nodes']
    out = {}

    def rec(i, parent):
        M = parent @ local_matrix(nodes[i], overrides.get(i, {}))
        out[i] = M
        for c in nodes[i].get('children', []):
            rec(c, M)

    for root in g['scenes'][g.get('scene', 0)]['nodes']:
        rec(root, np.eye(4))
    return out


class Clip:
    """把一条 animation 的 sampler 展开成可按时间求值的轨道集合。"""

    def __init__(self, g, binchunk, anim):
        self.g, self.anim = g, anim
        self.name = anim['name'].split('|')[-1]
        self.tracks = {}
        self.duration = 0.0
        for ch in anim['channels']:
            s = anim['samplers'][ch['sampler']]
            tin = accessor(g, binchunk, s['input'])[:, 0]
            tout = accessor(g, binchunk, s['output'])
            self.tracks[(ch['target']['node'], ch['target']['path'])] = (tin, tout)
            self.duration = max(self.duration, float(tin[-1]))

    def pose(self, t):
        ov = {}
        for (node, path), (tin, tout) in self.tracks.items():
            if len(tin) == 1:
                v = tout[0]
            else:
                i = int(np.searchsorted(tin, t, 'right')) - 1
                i = max(0, min(i, len(tin) - 2))
                span = max(tin[i + 1] - tin[i], 1e-9)
                a = min(max((t - tin[i]) / span, 0.0), 1.0)
                v0, v1 = tout[i], tout[i + 1]
                if path == 'rotation':
                    if np.dot(v0, v1) < 0:
                        v1 = -v1
                    v = v0 + a * (v1 - v0)
                    v = v / np.linalg.norm(v)
                else:
                    v = v0 + a * (v1 - v0)
            ov.setdefault(node, {})[path] = v
        return world_matrices(self.g, ov)

    def sample(self, joints, n):
        """→ {joint_name: (n,3) 世界坐标}"""
        acc = {k: [] for k in joints}
        for f in range(n):
            W = self.pose(self.duration * f / max(n - 1, 1))
            for name, idx in joints.items():
                acc[name].append(W[idx][:3, 3])
        return {k: np.array(v) for k, v in acc.items()}


def joint_index(g):
    nodes = g['nodes']
    return {nodes[j]['name']: j for j in g['skins'][0]['joints']}


# ---------- 三个子命令 ----------

def cmd_tree(g, binchunk, path):
    nodes, skins, anims = g.get('nodes', []), g.get('skins', []), g.get('animations', [])
    print(f'### {pathlib.Path(path).stem}  nodes={len(nodes)} skins={len(skins)} anims={len(anims)}')
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    for si, sk in enumerate(skins):
        joints = sk.get('joints', [])
        jset = set(joints)
        print(f'\nskin[{si}] joints={len(joints)}')
        W = world_matrices(g)

        def walk(i, depth):
            p = W[i][:3, 3]
            print('  ' + '  ' * depth + f'{nodes[i].get("name"):<24} '
                  f'rest=({p[0]:+.3f}, {p[1]:+.3f}, {p[2]:+.3f})')
            for c in nodes[i].get('children', []):
                if c in jset:
                    walk(c, depth + 1)

        for j in joints:
            if parent.get(j) not in jset:
                walk(j, 0)
    print('\n动画:')
    for a in anims:
        clip = Clip(g, binchunk, a)
        paths = sorted({c['target']['path'] for c in a['channels']})
        targets = {c['target']['node'] for c in a['channels']}
        print(f'  {clip.name:<24} dur={clip.duration:5.2f}s  nodes={len(targets):>3}  {",".join(paths)}')


def cmd_rigid(g, binchunk, path, n=60):
    """每段两端点的距离在整条动画里是否恒定。恒定=真骨头；伸缩=IK 目标之类的非刚性连接。"""
    joints = joint_index(g)
    segs = []
    for _, chain in QUADRUPED_CHAINS[:1] + QUADRUPED_CHAINS[2:3]:  # 左前 + 左后即可代表
        for a, b in zip(chain, chain[1:]):
            if a in joints and b in joints:
                segs.append((a, b))
    if not segs:
        sys.exit('未识别出四足腿链（这个 rig 的关节命名不同）')
    label = [f'{a.split(".")[0]}→{b.split(".")[0]}' for a, b in segs]
    print(f'{pathlib.Path(path).stem}: 各段长度 = 平均 ±(max-min)/平均')
    print(f'{"clip":<20}' + ''.join(f'{l:>28}' for l in label))
    print('-' * (20 + 28 * len(label)))
    worst = {}
    for a in g['animations']:
        clip = Clip(g, binchunk, a)
        pos = clip.sample(joints, n)
        cells = []
        for ja, jb in segs:
            d = np.linalg.norm(pos[jb] - pos[ja], axis=1)
            var = 100 * (d.max() - d.min()) / max(d.mean(), 1e-9)
            worst[(ja, jb)] = max(worst.get((ja, jb), 0.0), var)
            cells.append(f'{d.mean():.3f} ±{var:5.1f}%')
        print(f'{clip.name:<20}' + ''.join(f'{c:>28}' for c in cells))
    print('\n结论:')
    for (ja, jb), var in worst.items():
        verdict = '刚性骨' if var < 1.0 else f'非刚性，最大伸缩 {var:.0f}%'
        print(f'  {ja} → {jb:<20} {verdict}')


def cmd_stance(g, binchunk, path, animname, n=240, tol=0.01):
    """支撑相接地分析。四足要四只脚互相一致，仓库 Rule 16 只比左右，覆盖不到前后。"""
    joints = joint_index(g)
    anim = next((a for a in g['animations'] if a['name'].split('|')[-1] == animname), None)
    if anim is None:
        sys.exit(f'没有叫 {animname} 的动画')
    clip = Clip(g, binchunk, anim)
    pos = clip.sample(joints, n)
    feet = [f for f in FEET if f in pos]
    print(f'{pathlib.Path(path).stem} / {animname}  dur={clip.duration:.3f}s  采样 {n} 帧')
    travel = {}
    for f in feet:
        y, z = pos[f][:, 1], pos[f][:, 2]
        contact = y <= y.min() + tol
        total = sum(z[(i + 1) % n] - z[i] for i in range(n) if contact[i] and contact[(i + 1) % n])
        travel[f] = total
        print(f'  {f:<7} 接地 {contact.sum():>3}/{n} ({contact.sum()/n:>4.0%})  支撑相累计Δz = {total:+.4f}')
    if len(travel) == 4:
        vals = [abs(v) for v in travel.values()]
        dev = (max(vals) - min(vals)) / max(np.mean(vals), 1e-9)
        front = np.mean([abs(travel[f]) for f in ('FF.L', 'FF.R')])
        back = np.mean([abs(travel[f]) for f in ('FFB.L', 'FFB.R')])
        print(f'\n  四脚最大相对偏差 {dev:.1%}   前脚均值 {front:.3f} / 后脚均值 {back:.3f}'
              f'  前后差 {abs(front-back)/max(front,back):.1%}')
        print('  判据: >20% 即视为该 clip 有足部滑移，不能驱动距离相位（同 L-2 / Rule 16 口径）')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('glb')
    ap.add_argument('--rigid', action='store_true', help='检查每段骨长是否恒定')
    ap.add_argument('--stance', metavar='CLIP', help='对某条动画做支撑相接地分析')
    args = ap.parse_args()
    g, binchunk = load_glb(args.glb)
    if args.rigid:
        cmd_rigid(g, binchunk, args.glb)
    elif args.stance:
        cmd_stance(g, binchunk, args.glb, args.stance)
    else:
        cmd_tree(g, binchunk, args.glb)


if __name__ == '__main__':
    main()
