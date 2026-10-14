"""Where the source (Kimodo) arm must be so the drawn stick-figure hand lands on a target (docs/动作重做方案.md).

The figure's arm grows from the neck: upper arm along unit(source upper arm + 0.8 * shoulder vector), forearm along
unit(source forearm + 0.2 * shoulder vector) (npc-skeleton-mapping.md step 6). So a figure hand target can be turned
back exactly into a source elbow and hand: solve the figure arm (two-bone IK from the figure neck, bending like the
source arm does), then find the source upper arm / forearm of their own lengths that map onto those directions.
A target the figure arm cannot reach is reported (stand closer or lean), never silently clamped.

Positions: the stance frame (post at the origin, +Z forward); figure targets in game metres; source in Kimodo metres.
Used by the request builders that write scripts/kimodo_motion_batch.py keys ("targets": {"RightHand": ...,
"RightForeArm": ...}).
"""
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
P = json.loads((ROOT / 'godot/npc/skeleton-params.json').read_text())
SCALE = 3.0
LEG_RATIO = (P['thigh'] + P['shin']) / (0.528 + 0.423) * SCALE
UPPER = P['upperArm'] * SCALE
FORE = P['foreArm'] * SCALE


def _unit(v):
    return v / np.linalg.norm(v)


def figure_neck(src, J):
    """Figure neck (game metres) of a source pose (fixed stance frame: origin at the post)."""
    hips, neck = src[J['Hips']], src[J['Neck1']]
    return hips * LEG_RATIO + _unit(neck - hips) * (P['torso'] * SCALE)


def figure_points(src, J):
    """The drawn figure of a source pose (game metres, stance frame): hips, neck, head (centre), forward (unit),
    and per side 'Left'/'Right': elbow, hand, knee, ankle. Follows npc-skeleton-mapping.md closely enough to aim
    at (the head direction is taken along the torso)."""
    hips_s, neck_s = src[J['Hips']], src[J['Neck1']]
    up = _unit(neck_s - hips_s)
    side = src[J['LeftArm']] - src[J['RightArm']]
    side = _unit(side - up * np.dot(side, up))
    out = {'hips': hips_s * LEG_RATIO, 'neck': figure_neck(src, J), 'forward': np.cross(side, up), 'up': up}
    out['head'] = out['neck'] + up * ((P['neck'] + P['headR']) * SCALE)
    l1, l2 = P['thigh'] * SCALE, P['shin'] * SCALE
    for s in ('Left', 'Right'):
        arm, fore, hand = src[J[s + 'Arm']], src[J[s + 'ForeArm']], src[J[s + 'Hand']]
        c = arm - neck_s
        el = out['neck'] + _unit(fore - arm + c * P['clavSplit']) * UPPER
        out[s] = {'elbow': el, 'hand': el + _unit(hand - fore + c * (1 - P['clavSplit'])) * FORE}
        ankle = src[J[s + 'Foot']] * LEG_RATIO
        dv = ankle - out['hips']
        d = float(np.clip(np.linalg.norm(dv), abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4))
        axis = _unit(dv)
        pole = src[J[s + 'Shin']] - hips_s
        pole = _unit(pole - axis * np.dot(pole, axis))
        x = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
        out[s]['knee'] = out['hips'] + axis * x + pole * np.sqrt(max(0.0, l1 * l1 - x * x))
        out[s]['ankle'] = out['hips'] + axis * d
    return out


def source_arm_for(src, J, side, target, elbow_toward=None):
    """(source elbow, source hand, slack metres) so the figure hand of `side` ('Left'/'Right') lands on `target`.
    slack < 0: the figure arm is short by that much (not reachable from this torso). The elbow bends the way the
    source arm bends, or towards `elbow_toward` (a figure-space point) when given."""
    target = np.asarray(target, float)
    neck, arm, fore, hand = (src[J[n]] for n in ('Neck1', side + 'Arm', side + 'ForeArm', side + 'Hand'))
    c = arm - neck
    N = figure_neck(src, J)
    elbow_now = N + _unit(fore - arm + c * P['clavSplit']) * UPPER
    reach = target - N
    d = np.linalg.norm(reach)
    slack = UPPER + FORE - d
    d = float(np.clip(d, abs(UPPER - FORE) + 1e-6, UPPER + FORE - 1e-6))
    axis = reach / np.linalg.norm(reach)
    toward = elbow_now if elbow_toward is None else np.asarray(elbow_toward, float)
    pole = (toward - N) - axis * np.dot(toward - N, axis)
    if np.linalg.norm(pole) < 1e-8:
        pole = np.array([0.0, -1.0, 0.0]) - axis * (-axis[1])
    x = (UPPER ** 2 - FORE ** 2 + d * d) / (2 * d)
    elbow_fig = N + axis * x + _unit(pole) * np.sqrt(max(0.0, UPPER ** 2 - x * x))
    hand_fig = N + axis * d
    u1, u2 = _unit(elbow_fig - N), _unit(hand_fig - elbow_fig)

    def solve(u, shift, length):
        # |k u - shift| = length, k > 0
        b = np.dot(u, shift)
        disc = b * b - (np.dot(shift, shift) - length * length)
        if disc < 0:
            raise ValueError('no source arm maps onto that figure direction')
        return (b + np.sqrt(disc)) * u - shift

    upper = solve(u1, c * P['clavSplit'], np.linalg.norm(fore - arm))
    forearm = solve(u2, c * (1 - P['clavSplit']), np.linalg.norm(hand - fore))
    elbow_src = arm + upper
    return elbow_src, elbow_src + forearm, slack


def lean(pos, rot, names, parents, degrees):
    """The pose with everything above the hips (the Spine1 subtree) turned forward by `degrees` about the hips,
    rotations included (stance frame: facing +Z, so the axis is +X)."""
    a = np.radians(degrees)
    R = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]])
    index = {n: i for i, n in enumerate(names)}
    children = {}
    for n, p in parents:
        children.setdefault(p, []).append(n)
    sub, stack = [], ['Spine1']
    while stack:
        n = stack.pop()
        sub.append(index[n])
        stack += children.get(n, [])
    pos, rot = pos.copy(), rot.copy()
    hips = pos[index['Hips']]
    pos[sub] = hips + (pos[sub] - hips) @ R.T
    rot[sub] = R @ rot[sub]
    return pos, rot


def arm_with_lean(pos, rot, names, parents, side, target, margin=0.02, most=40):
    """Lean the torso forward (in 4 degree steps, up to `most`) until the figure arm reaches `target` with `margin`
    to spare; returns (pose, rotations, elbow, hand, degrees). Raises if even `most` degrees is not enough."""
    J = {n: i for i, n in enumerate(names)}
    for deg in range(0, most + 1, 4):
        p, r = lean(pos, rot, names, parents, deg) if deg else (pos, rot)
        e, h, slack = source_arm_for(p, J, side, target)
        if slack >= margin:
            return p, r, e, h, deg
    raise ValueError(f'{side} hand cannot reach {target} even leaning {most} degrees')


if __name__ == '__main__':
    import ast
    import sys
    src_def = Path(r'C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py').read_text(encoding='utf-8')
    cls = next(n for n in ast.parse(src_def).body if isinstance(n, ast.ClassDef) and n.name == 'SOMASkeleton77')
    asg = next(n for n in cls.body if isinstance(n, ast.Assign) and any(getattr(t, 'id', '') == 'bone_order_names_with_parents' for t in n.targets))
    names = [a for a, _ in ast.literal_eval(asg.value)]
    J = {n: i for i, n in enumerate(names)}
    npz, frame, side, x, y, z = sys.argv[1], int(sys.argv[2]), sys.argv[3], *map(float, sys.argv[4:7])
    pose = np.load(npz)['posed_joints'][frame]
    e, h, slack = source_arm_for(pose, J, side, [x, y, z])
    print(json.dumps({'elbow': e.round(4).tolist(), 'hand': h.round(4).tolist(), 'slack_m': round(float(slack), 4)}))
