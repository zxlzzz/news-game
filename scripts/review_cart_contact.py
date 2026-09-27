"""Measure cart grips against the accepted adult mapping, without editing the NPZ.

python scripts/review_cart_contact.py <candidate-folder> --model baby_stroller
Writes a contact report and front/side sheet beside the candidate folder.
Cart orientation and floor height stay fixed; one X/Z offset is fitted to the clip.
This checks contact only, not motion semantics or loop quality.
"""
import argparse
import hashlib
import json
import struct
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from review_godot_motion import ROOT, hierarchy


def glb_grips(path):
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or total != len(raw):
        raise ValueError(f'Invalid GLB: {path}')
    size, kind = struct.unpack_from('<I4s', raw, 12)
    if kind != b'JSON':
        raise ValueError('GLB has no leading JSON chunk')
    doc = json.loads(raw[20:20 + size])
    found = {}

    def visit(index, parent):
        node = doc['nodes'][index]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            rotation = np.array([
                [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
            ])
            local = np.eye(4)
            local[:3, :3] = rotation @ np.diag(node.get('scale', [1, 1, 1]))
            local[:3, 3] = node.get('translation', [0, 0, 0])
        world = parent @ local
        name = node.get('name')
        if name in ('grip_left', 'grip_right'):
            if name in found:
                raise ValueError(f'Duplicate grip: {name}')
            found[name] = world[:3, 3]
        for child in node.get('children', []):
            visit(child, world)

    for index in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(index, np.eye(4))
    if set(found) != {'grip_left', 'grip_right'}:
        raise ValueError(f'Missing grips: {path}')
    return np.stack([found['grip_left'], found['grip_right']])


def map_adult(points):
    names = [name for name, _ in hierarchy()]
    rest = np.load(ROOT / 'assets/animations/npz/stand_idle/motion.npz', allow_pickle=False)['posed_joints'][0]
    params = json.loads((ROOT / 'godot/npc/skeleton-params.json').read_text())
    scale = json.loads((ROOT / 'godot/npc/body-types.json').read_text())['adult']['scale']
    module = ROOT / 'sth/motion-study/skeleton-mapping.mjs'
    program = """import fs from 'node:fs';
import {createSkeletonMapper} from %s;
const d=JSON.parse(fs.readFileSync(0,'utf8'));
const m=createSkeletonMapper(d.names,d.rest), o=[d.frames[0][0][0],0,d.frames[0][0][2]];
console.log(JSON.stringify(d.frames.map(f=>m(f,d.params,o))));
""" % json.dumps(module.as_uri())
    payload = dict(names=names, rest=rest.tolist(), frames=points.tolist(), params=params)
    result = subprocess.run(['node', '--input-type=module', '-e', program],
                            input=json.dumps(payload), capture_output=True, text=True, check=True)
    mapped = json.loads(result.stdout)
    origin = points[0, 0] * [1, 0, 1]
    # The mapper's segment entries contain a line-width multiplier after the two points.
    segments = np.array([[s[:2] for s in f['segs']] for f in mapped], dtype=float)
    segments = (segments - origin) * scale
    hips = (np.array([f['H'] for f in mapped]) - origin) * scale
    heads = (np.array([f['head'] for f in mapped]) - origin) * scale
    return segments, hips, heads, dict(params=params, body_scale=scale,
        mapper_sha256=hashlib.sha256(module.read_bytes()).hexdigest())


def review(folder, model):
    model_path = ROOT / 'godot/models' / (model + '.glb')
    grips = glb_grips(model_path)
    with np.load(folder / 'motion.npz', allow_pickle=False) as archive:
        points = archive['posed_joints']
    if not np.isfinite(points).all():
        raise ValueError('Non-finite source joints')
    meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8-sig'))
    segments, hips, heads, mapping = map_adult(points)
    hands = segments[:, [3, 8], 1]
    travel = hips * [1, 0, 1]
    offset = np.mean(hands - travel[:, None] - grips, axis=(0, 1)) * [1, 0, 1]
    targets = travel[:, None] + offset + grips
    errors = np.linalg.norm(hands - targets, axis=2)
    report = dict(model=model, model_sha256=hashlib.sha256(model_path.read_bytes()).hexdigest(),
        mapping=mapping, grips_local_m=grips.tolist(), cart_offset_from_hips_xz_m=offset.tolist(),
        placement='One constant X/Z offset fitted across the whole clip; Y=0 and orientation fixed.',
        frames=len(points), tolerance_m=0.05,
        hand_error_max_m=errors.max(axis=0).tolist(), hand_error_mean_m=errors.mean(axis=0).tolist(),
        violating_frames=int((errors > 0.05).any(axis=1).sum()),
        contact_pass=bool((errors <= 0.05).all()),
        worst_frame=int(np.argmax(errors.max(axis=1))),
        mean_mapped_horizontal_speed_mps=float(np.linalg.norm(np.diff(travel, axis=0), axis=1).mean()*meta['fps']))
    prefix = folder.parent / (folder.name + '_cart')
    prefix.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    frames = np.linspace(0, len(points)-1, 7).round().astype(int)
    frames[3] = report['worst_frame']
    canvas = Image.new('RGB', (1680, 750), '#f1f1ed')
    pen = ImageDraw.Draw(canvas)
    pen.text((12, 10), f'{folder.name} / adult mapping / {model} grip targets / green crosses = grips', fill='black')
    for col, fi in enumerate(frames):
        for row, axis in enumerate((0, 2)):
            cx, base = col*240+100, 355+row*350
            def px(point):
                q = point - travel[fi]
                return cx+q[axis]*150, base-q[1]*150
            pen.line((col*240, base, col*240+239, base), fill='#bbbbbb')
            for si, (a, b) in enumerate(segments[fi]):
                color = '#235da1' if 2 <= si < 7 else '#a73535' if si >= 7 else '#171717'
                pen.line([px(a), px(b)], fill=color, width=4)
            x, y = px(heads[fi]); radius = mapping['params']['headR'] * mapping['body_scale'] * 150
            pen.ellipse((x-radius, y-radius, x+radius, y+radius), fill='#171717')
            pen.line([px(t) for t in targets[fi]], fill='#36915c', width=3)
            for hand, target in zip(hands[fi], targets[fi]):
                x, y = px(target)
                pen.line((x-5, y, x+5, y), fill='#187738', width=2)
                pen.line((x, y-5, x, y+5), fill='#187738', width=2)
                pen.line([px(hand), px(target)], fill='#ed981d', width=2)
            label = f'frame {fi} / {"front" if axis == 0 else "side"}\nL {errors[fi,0]*100:.1f} cm  R {errors[fi,1]*100:.1f} cm'
            pen.text((col*240+8, 40+row*350), label, fill='black')
    canvas.save(prefix.with_suffix('.png'))
    print(json.dumps({k: v for k, v in report.items() if k != 'mapping'}, indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--model', choices=['baby_stroller', 'shopping_cart'], required=True)
    args = parser.parse_args()
    review(args.folder, args.model)
