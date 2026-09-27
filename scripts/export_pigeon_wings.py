"""Wing shapes of the procedural pigeon (godot/npc/procedural_pigeon.gd), taken from the public-domain
pigeon rig assets/rigs/pigeon/bird.blend (source and licence: assets/rigs/README.md).

    python scripts/export_pigeon_wings.py [--scale 1.25] [--out godot/npc/pigeon-wings.json]

Needs Blender's Python module (pip install bpy; its wheels exist for Python 3.11 only).

The rig's clips stand still (the body never leaves the origin), so only the wing is taken from them;
the body, legs and head are computed in Godot. Each wing pose is 9 points of the left wing, in the
body's own frame: x to the bird's left, y up, z forward, relative to the midpoint of the two shoulder
joints, in metres after --scale (the rig bird is about 0.26 m beak to tail; a rock pigeon about 0.32).
The body frame's forward axis is the back line: tail base (DEF-spine tail) -> lower neck
(DEF-spine.006 head); up is the rig's up made square to it. procedural_pigeon.gd builds the same
frame from its own tail-base and neck points, so the wing sits on the body at any pitch.

Points, in order: shoulder, elbow, wrist, hand tip (the three wing bones), then the tips of the four
feather groups from the outermost primaries inwards, then where the innermost group meets the body.
The right wing is the mirror (x negated).
Poses: fold (Standing Idle, frame 1), glide (Gliding, frame 1), flap (Flapping, one wing beat;
its last frame repeats the first and is dropped).
"""
import argparse
import json
import pathlib

import bpy
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
BLEND = ROOT / 'assets/rigs/pigeon/bird.blend'
POINTS = [('DEF-Wing.L', 0), ('DEF-Wing.001.L', 0), ('DEF-Wing.002.L', 0), ('DEF-Wing.002.L', 1),
          ('DEF-w_feather.001.L', 1), ('DEF-w_feather.002.L', 1), ('DEF-w_feather.003.L', 1),
          ('DEF-w_feather.004.L', 1), ('DEF-w_feather.004.L', 0)]


def frame_points(rig, scale):
    M = rig.matrix_world
    pb = rig.pose.bones
    end = lambda name, i: M @ (pb[name].tail if i else pb[name].head)
    origin = (end('DEF-Wing.L', 0) + end('DEF-Wing.R', 0)) / 2
    fwd = (end('DEF-spine.006', 0) - end('DEF-spine', 1)).normalized()
    up = (Vector((0, 0, 1)) - fwd * fwd.z).normalized()
    left = up.cross(fwd).normalized()  # bird faces fwd with up above: its left
    out = []
    for name, i in POINTS:
        q = end(name, i) - origin
        out.append([round(q.dot(left) * scale, 4), round(q.dot(up) * scale, 4), round(q.dot(fwd) * scale, 4)])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scale', type=float, default=1.25)
    ap.add_argument('--out', default=str(ROOT / 'godot/npc/pigeon-wings.json'))
    a = ap.parse_args()
    bpy.ops.wm.open_mainfile(filepath=str(BLEND))
    scene = bpy.context.scene
    rig = bpy.data.objects['rig']

    def take(action_name, frames):
        act = bpy.data.actions[action_name]
        rig.animation_data.action = act
        if hasattr(rig.animation_data, 'action_slot') and act.slots:
            rig.animation_data.action_slot = act.slots[0]
        res = []
        for f in frames:
            scene.frame_set(f)
            res.append(frame_points(rig, a.scale))
        return res

    flap = bpy.data.actions['Flapping']
    f0, f1 = int(flap.frame_range[0]), int(flap.frame_range[1])
    beat = take('Flapping', range(f0, f1 + 1))
    # the clip's last frame repeats the first for the wing bones; one feather group (the third) is
    # about 1.7 cm off in the source, which the loop simply jumps over
    gap = max(abs(x - y) for q, r in zip(beat[0][:4], beat[-1][:4]) for x, y in zip(q, r))
    assert gap < 0.002, f'Flapping: wing bones end {gap} m from where they start, no longer one repeated beat'
    data = {
        '_source': 'scripts/export_pigeon_wings.py from assets/rigs/pigeon/bird.blend (public domain); '
                   'regenerate with that script, do not edit by hand',
        '_points': 'shoulder, elbow, wrist, hand tip, feather tips outermost..innermost, innermost root; '
                   'left wing, body frame x left / y up / z forward, metres from the shoulder midpoint',
        'scale': a.scale,
        'flapFps': scene.render.fps,
        'fold': take('Standing Idle', [1])[0],
        'glide': take('Gliding', [1])[0],
        'flap': beat[:-1],
    }
    pose = lambda pts: '[' + ', '.join(json.dumps(q) for q in pts) + ']'
    lines = ['{'] + [f'  {json.dumps(k)}: {json.dumps(data[k], ensure_ascii=False)},' for k in ('_source', '_points', 'scale', 'flapFps')]
    lines += [f'  "fold": {pose(data["fold"])},', f'  "glide": {pose(data["glide"])},', '  "flap": [']
    lines += ['    ' + pose(f) + (',' if i < len(data['flap']) - 1 else '') for i, f in enumerate(data['flap'])]
    lines += ['  ]', '}']
    pathlib.Path(a.out).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(a.out, len(data['flap']), 'flap frames')


if __name__ == '__main__':
    main()
