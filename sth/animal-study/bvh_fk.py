"""Minimal BVH reader + forward kinematics -> world joint positions (T, J, 3)."""
import re
import numpy as np


def _rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    n = a.shape[0]
    R = np.zeros((n, 3, 3))
    if axis == 'X':
        R[:, 0, 0] = 1; R[:, 1, 1] = c; R[:, 1, 2] = -s; R[:, 2, 1] = s; R[:, 2, 2] = c
    elif axis == 'Y':
        R[:, 1, 1] = 1; R[:, 0, 0] = c; R[:, 0, 2] = s; R[:, 2, 0] = -s; R[:, 2, 2] = c
    else:
        R[:, 2, 2] = 1; R[:, 0, 0] = c; R[:, 0, 1] = -s; R[:, 1, 0] = s; R[:, 1, 1] = c
    return R


def load(path):
    text = open(path).read()
    head, motion = text.split('MOTION')
    toks = head.split()
    names, parents, offsets, channels = [], [], [], []
    stack, i, pending_end = [], 0, False
    while i < len(toks):
        t = toks[i]
        if t in ('ROOT', 'JOINT'):
            names.append(toks[i + 1]); parents.append(stack[-1] if stack else -1)
            offsets.append(None); channels.append([]); i += 2; continue
        if t == 'End':
            pending_end = True; i += 2; continue
        if t == '{':
            stack.append(-2 if pending_end else len(names) - 1); i += 1; continue
        if t == '}':
            v = stack.pop(); pending_end = False if v == -2 else pending_end; i += 1; continue
        if t == 'OFFSET':
            off = [float(x) for x in toks[i + 1:i + 4]]
            if stack and stack[-1] != -2:
                offsets[stack[-1]] = off
            i += 4; continue
        if t == 'CHANNELS':
            n = int(toks[i + 1]); channels[stack[-1]] = toks[i + 2:i + 2 + n]; i += 2 + n; continue
        i += 1
    # a stack entry of -2 is an End Site; its children never register, parents of real joints must skip it
    parents = [p if p != -2 else -1 for p in parents]
    lines = motion.strip().splitlines()
    ft = float(lines[1].split(':')[1])
    data = np.array([[float(x) for x in l.split()] for l in lines[2:] if l.strip()])
    T, J = data.shape[0], len(names)
    pos = np.zeros((T, J, 3)); rot = np.zeros((T, J, 3, 3)); col = 0
    for j in range(J):
        R = np.tile(np.eye(3), (T, 1, 1)); tr = np.array(offsets[j])[None].repeat(T, 0)
        for ch in channels[j]:
            v = data[:, col]; col += 1
            if ch.endswith('position'):
                tr = tr.copy(); tr[:, 'XYZ'.index(ch[0])] = v
            else:
                R = R @ _rot(ch[0], v)
        p = parents[j]
        if p < 0:
            rot[:, j] = R; pos[:, j] = tr
        else:
            rot[:, j] = rot[:, p] @ R
            pos[:, j] = pos[:, p] + np.einsum('tij,tj->ti', rot[:, p], tr)
    return names, parents, pos, 1.0 / ft
