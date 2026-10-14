"""Turn one clip's motion spec into Kimodo requests (docs/动作重做方案.md §10, the runbook).

python scripts/motion_request.py <spec.json> [<spec.json> ...] [--out C:/kimodo-trial/kimodo/tmp_pilot/requests.jsonl]

A spec (assets/motion_specs/<clip>.json) says, in the game's terms, where the drawn stick figure's hands are when:
{
  "clip": "rub_eye", "text": "<Kimodo prompt>", "duration": 2.5, "seeds": [7, 61007],
  "base": "stand",                       # assets/animations/base_poses/<base>.npz: first and last frame, and the
                                         # body every key starts from (standing, behind the counter, seated ...)
  "ends": true,                          # hold the base pose at the first and last frame (default true); "first_key":
                                         # the first key's pose instead (a loop holding something); false: free
  "object": {"type": "cafe_table", "post": "post_table"},    # optional: the figure is kept out of its meshes and
                                         # "marker" points are read from it (the stance: that post at the origin)
  "item": {"type": "held_cardboard_box", "hand": "both"},    # optional: a held thing kept off the body
  "lean": 40,                            # most forward lean (degrees) allowed to reach a point (default 40)
  "keys": [
    {"t": 0.5, "Right": {"head": [-0.06, 0.03, 0.2]}},              # offset from the figure's head centre
    {"t": [0.8, 1.6], "Right": {"marker": "table_press", "offset": [0, 0.05, 0.1]}},   # held from 0.8 s to 1.6 s
    {"t": 1.0, "Left": {"thigh": "Left", "along": 0.6, "offset": [0, 0.06, 0]}},     # on the figure's own thigh
    {"t": 1.2, "Right": {"at": [0.1, 1.0, 0.4]}, "Left": "keep"},    # a point; "keep": where the base pose has it
    {"t": 1.3, "Right": {"at": [-0.25, 0.97, 0.3], "elbow": [-0.4, 1.2, 0.0]}},   # elbow: bend towards that point
    {"t": 1.5, "Hips": {"marker": "hip_seat_front", "on": "top"}, "tilt": -20,   # hips on a point (the body moves
     "LeftFoot": {"at": [0.1, 0.08, 0.8]}}   # with them); tilt: the torso leans this far (negative: back), no
                                         # auto-lean; LeftFoot / RightFoot: the figure's ankle on a point;
                                         # "whole": true pins the key's whole pose, not only hands/feet/hips;
                                         # "Hips" / "LeftFoot" / "RightFoot": "keep" holds them where the base pose
                                         # has them (seated clips: pin both feet and the hips for the whole hold,
                                         # or Kimodo lifts the body back up to its own seat height and the feet
                                         # leave the floor, 2026-10-14)
  ]
}
All points are game metres in the stance frame (+Z where the person faces, +X their left, y up). A held key ("t":
[a, b]) is pinned on every frame from a to b: Kimodo's post-processing pulls only the pinned frames onto their
points, so pins every 0.25 s made the body jerk four times a second (2026-10-14). The figure's arm is short (grows from the neck), so a key
leans the upper body forward in 4 degree steps until every hand of that key reaches with 2 cm to spare; a point out
of reach even at the most lean stops with an error (move the post or the point).

Writes the key poses to <kimodo>/tmp_pilot/keys/<clip>.npz, the object's boxes to <kimodo>/tmp_pilot/scenes/, and
one request line per seed (name <clip>__<seed>). Then run the worker (runbook) and install the take with
scripts/motion_install.py <take> <clip> [--object <type> --post <post>].
"""
import argparse
import ast
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from figure_targets import LEG_RATIO, P as FIGURE, figure_points, lean, source_arm_for  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
KIMODO = Path(r'C:/kimodo-trial/kimodo')
INSIDE = '/workspace'  # the Kimodo folder as the container sees it
GODOT = r'D:/Godot/Godot_v4.7.2-stable_win64_console.exe'
FPS = 30
HOLD_STEP = 1.0 / FPS  # a held key is pinned on every frame (see the module notes)
MARGIN = 0.02
SCENE = {"start": 0.6, "iters": 10, "lr": 0.03, "smooth": 0.5, "tolerance": -0.005}


def skeleton():
    text = (KIMODO / 'kimodo/skeleton/definitions.py').read_text(encoding='utf-8')
    cls = next(n for n in ast.parse(text).body if isinstance(n, ast.ClassDef) and n.name == 'SOMASkeleton77')
    asg = next(n for n in cls.body if isinstance(n, ast.Assign)
               and any(getattr(t, 'id', '') == 'bone_order_names_with_parents' for t in n.targets))
    pairs = ast.literal_eval(asg.value)
    return [a for a, _ in pairs], [(a, b) for a, b in pairs if b is not None]


def export_object(kind, post, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    run = subprocess.run([GODOT, '--headless', '--path', str(ROOT / 'godot'), '-s', 'res://tools/export_scene_boxes.gd',
                          '--', kind, post, str(out)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    if run.returncode != 0 or 'SCENE_BOXES' not in run.stdout:
        sys.exit(f'export_scene_boxes {kind} {post} failed\n{run.stdout[-1500:]}\n{run.stderr[-1500:]}')
    return json.loads(out.read_text(encoding='utf-8'))


def resolve(point, fig, markers, clip):
    """A hand point of the spec -> stance-frame game metres, on the figure `fig` of the key pose."""
    if 'at' in point:
        return np.asarray(point['at'], float)
    if 'head' in point:
        return fig['head'] + np.asarray(point['head'], float)
    if 'marker' in point:
        if point['marker'] not in markers:
            sys.exit(f'{clip}: the object has no marker {point["marker"]} (has {sorted(markers)})')
        return np.asarray(markers[point['marker']], float) + np.asarray(point.get('offset', [0, 0, 0]), float)
    if 'thigh' in point:
        s = fig[point['thigh']]
        return fig['hips'] + (s['knee'] - fig['hips']) * point.get('along', 0.6) + np.asarray(point.get('offset', [0, 0, 0]), float)
    sys.exit(f'{clip}: a hand point needs at, head, marker or thigh: {point}')


def build(spec_path, names, parents, lines):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    clip = spec['clip']
    J = {n: i for i, n in enumerate(names)}
    with np.load(ROOT / 'assets/animations/base_poses' / f'{spec["base"]}.npz') as base:
        base = {k: base[k] for k in base.files}
    pos0, rot0 = base['posed_joints'][0], base['global_rot_mats'][0]
    folder = KIMODO / 'tmp_pilot'
    (folder / 'keys').mkdir(parents=True, exist_ok=True)
    base_file = folder / 'keys' / f'base_{spec["base"]}.npz'
    shutil.copy(ROOT / 'assets/animations/base_poses' / f'{spec["base"]}.npz', base_file)
    markers, scene = {}, None
    if 'object' in spec:
        o = spec['object']
        boxes_file = folder / 'scenes' / f'{o["type"]}_{o["post"]}.json'
        markers = export_object(o['type'], o['post'], boxes_file)['markers']
        scene = dict(SCENE, boxes=f'{INSIDE}/tmp_pilot/scenes/{boxes_file.name}')
    if 'item' in spec:
        it = spec['item']
        item_file = folder / 'scenes' / f'{it["type"]}.json'
        export_object(it['type'], '-', item_file)
        scene = dict(scene or SCENE, item_boxes=f'{INSIDE}/tmp_pilot/scenes/{item_file.name}', item_hand=it.get('hand', 'both'))
    if scene is not None:
        scene['rest'] = f'{INSIDE}/tmp_pilot/keys/base_stand.npz'
        shutil.copy(ROOT / 'assets/animations/base_poses/stand.npz', folder / 'keys/base_stand.npz')
        scene.update(spec.get('scene', {}))
    last = round(spec['duration'] * FPS) - 1
    # one pose per key time: lean as needed, then both arms solved onto their points
    times, poses, rots, whole, effectors = [], [], [], [], {'Left': [], 'Right': [], 'Hips': [], 'LeftFoot': [], 'RightFoot': []}
    for key in spec['keys']:
        span = key['t'] if isinstance(key['t'], list) else [key['t'], key['t']]
        steps = max(1, round((span[1] - span[0]) / HOLD_STEP))
        for t in sorted({span[0] + (span[1] - span[0]) * i / steps for i in range(steps + 1)}):
            frame = round(t * FPS)
            if not 0 < frame < last:
                sys.exit(f'{clip}: key at {t} s is not inside the clip (0..{spec["duration"]} s, first and last frame are the base)')
            start, start_rot, hips = pos0, rot0, None
            if key.get('Hips') == 'keep':
                # the hips where the base pose has them (a seated clip: on the seat, not drifting up mid-way)
                hips = pos0[J['Hips']].copy()
            elif 'Hips' in key:
                # the hips (torso stroke's lower end) on a point; "on": "top" rests the stroke on that surface
                point = key['Hips']
                target = resolve(point, figure_points(pos0, J), markers, clip)
                if point.get('on') == 'top':
                    target = target + np.array([0, FIGURE['line'] * FIGURE['torsoLine'] * 0.5 * 3.0, 0])
                hips = target / LEG_RATIO
                start = pos0 + (hips - pos0[J['Hips']])
            if 'tilt' in key:
                # a fixed torso tilt (degrees, negative leans back) instead of leaning only as far as needed
                start, start_rot = lean(start, start_rot, names, parents, key['tilt'])
            leans = [0] if 'tilt' in key else range(0, spec.get('lean', 40) + 1, 4)
            for deg in leans:
                p, r = lean(start, start_rot, names, parents, deg) if deg else (start, start_rot)
                fig = figure_points(p, J)
                solved, short = {}, None
                for side in ('Left', 'Right'):
                    point = key.get(side)
                    if point is None:
                        continue
                    target = figure_points(pos0, J)[side]['hand'] if point == 'keep' else resolve(point, fig, markers, clip)
                    toward = point.get('elbow') if isinstance(point, dict) else None
                    elbow, hand, slack = source_arm_for(p, J, side, target, toward)
                    if slack < MARGIN:
                        short = (side, target, slack)
                        break
                    solved[side] = (elbow, hand, target)
                if short is None:
                    break
            else:
                side, target, slack = short
                how = f'with the tilt {key["tilt"]}' if 'tilt' in key else f'even leaning {spec.get("lean", 40)} degrees'
                sys.exit(f'{clip}: at {t} s the {side} hand cannot reach {np.round(target, 3).tolist()} {how} '
                         f'(short by {-slack + MARGIN:.3f} m): move the post or the point')
            k = len(poses)
            before = {name: len(ks) for name, ks in effectors.items()}
            if hips is not None:
                effectors['Hips'].append({'frame': frame, 'source': f'{INSIDE}/tmp_pilot/keys/{clip}.npz', 'source_frame': k,
                                          'targets': {'Hips': np.round(hips, 4).tolist()}})
            for foot in ('LeftFoot', 'RightFoot'):
                if key.get(foot) == 'keep':  # the foot where the base pose has it (planted, it does not lift)
                    ankle = pos0[J[foot]].copy()
                    effectors[foot].append({'frame': frame, 'source': f'{INSIDE}/tmp_pilot/keys/{clip}.npz', 'source_frame': k,
                                            'targets': {foot: np.round(ankle, 4).tolist()}})
                elif foot in key:  # the figure's ankle on a point (the leg bends to it)
                    ankle = resolve(key[foot], figure_points(p, J), markers, clip) / LEG_RATIO
                    effectors[foot].append({'frame': frame, 'source': f'{INSIDE}/tmp_pilot/keys/{clip}.npz', 'source_frame': k,
                                            'targets': {foot: np.round(ankle, 4).tolist()}})
            poses.append(p)
            rots.append(r)
            times.append(t)
            for side, (elbow, hand, target) in solved.items():
                effectors[side].append({'frame': frame, 'source': f'{INSIDE}/tmp_pilot/keys/{clip}.npz', 'source_frame': k,
                                        'targets': {side + 'Hand': np.round(hand, 4).tolist(),
                                                    side + 'ForeArm': np.round(elbow, 4).tolist()}})
            if key.get('whole'):
                # the whole key pose is pinned (a still pose Kimodo must not drift from), not only its hands/feet/hips
                added = [k2 for name, ks in effectors.items() for k2 in ks[before[name]:]]
                for name in effectors:
                    del effectors[name][before[name]:]
                whole.append({'frame': frame, 'source': f'{INSIDE}/tmp_pilot/keys/{clip}.npz', 'source_frame': k,
                              'targets': {j: v for a in added for j, v in a['targets'].items()}})
            print(f'{clip} {t:.2f} s: lean {deg} deg; ' + '; '.join(
                f'{s} hand -> {np.round(np.asarray(v[2], float), 3).tolist()}' for s, v in solved.items()))
    np.savez(folder / 'keys' / f'{clip}.npz', posed_joints=np.array(poses), global_rot_mats=np.array(rots))
    for seed in spec['seeds']:
        req = {'name': f'{clip}__{seed}', 'text': spec['text'], 'duration': spec['duration'], 'seed': seed,
               'effectors': [{'joints': [s if s in ('Hips', 'LeftFoot', 'RightFoot') else s + 'Hand'], 'keyframes': ks} for s, ks in effectors.items() if ks]}
        ends = spec.get('ends', True)
        if ends == 'first_key':
            # a loop that holds something: the first key's whole pose (arms on their points) at both ends
            if whole:
                end = {n: v for n, v in whole[0].items() if n != 'frame'}
            else:
                first = [ks[0] for ks in effectors.values() if ks]
                end = {'source': first[0]['source'], 'source_frame': first[0]['source_frame'],
                       'targets': {j: t for k in first for j, t in k['targets'].items()}}
            req['keyframes'] = [dict(end, frame=0), dict(end, frame=-1)]
        elif ends:
            src = f'{INSIDE}/tmp_pilot/keys/{base_file.name}'
            req['keyframes'] = [{'frame': 0, 'source': src, 'source_frame': 0}, {'frame': -1, 'source': src, 'source_frame': 0}]
        if whole:
            req['keyframes'] = req.get('keyframes', []) + whole
        if not req['effectors']:
            del req['effectors']
        if scene is not None:
            req['scene'] = scene
        lines.append(json.dumps(req, ensure_ascii=False))


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('specs', nargs='+')
    a.add_argument('--out', default=str(KIMODO / 'tmp_pilot/requests.jsonl'))
    o = a.parse_args()
    names, parents = skeleton()
    lines = []
    for s in o.specs:
        build(s, names, parents, lines)
    Path(o.out).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(lines)} requests -> {o.out}')


if __name__ == '__main__':
    main()
