"""Check complete door swings against actual assembled building geometry.

Export with Godot tools/export_model_geometry.gd first. This supplements the
standalone door test: recessed masonry and adjacent facade parts must also clear
the moving leaf, both handles and relief panels. Entirely buried moving parts
are checked as well as triangle crossings.
"""
import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'intersections', ROOT / 'scripts/check-model-intersections.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def rotated(part, pivot, angle):
    angle = np.deg2rad(angle)
    cs, sn = np.cos(angle), np.sin(angle)
    rotation = np.array([[cs, 0, sn], [0, 1, 0], [-sn, 0, cs]])
    points = ((part.points - pivot) @ rotation.T + pivot).astype('<f4')
    return c.Part(dict(part.meta, offset=0),
                  points.tobytes() + part.indices.astype('<i4').tobytes())


def winding(point, triangles):
    a, b, d = (triangles[:, k] - point for k in range(3))
    lengths = [np.linalg.norm(v, axis=1) for v in (a, b, d)]
    numerator = np.einsum('ij,ij->i', a, np.cross(b, d))
    denominator = (lengths[0] * lengths[1] * lengths[2]
        + np.einsum('ij,ij->i', a, b) * lengths[2]
        + np.einsum('ij,ij->i', b, d) * lengths[0]
        + np.einsum('ij,ij->i', d, a) * lengths[1])
    return abs(np.arctan2(numerator, denominator).sum() / (2 * np.pi))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--step-degrees', type=float, default=1.0)
    args = parser.parse_args()
    assert 0 < args.step_degrees <= 5, 'Use a swing step between 0 and 5 degrees'
    failures = []
    instances = 0
    for file in sorted(args.geometry.glob('*.json')):
        if '__' in file.stem:
            continue
        meta = json.loads(file.read_text())
        if not meta.get('door_joints'):
            continue
        data = file.with_suffix('.bin').read_bytes()
        parts = [c.Part(part, data) for part in meta['parts']]
        for joint in meta['door_joints']:
            prefix = joint['name'] + '/'
            moving = [part for part in parts if part.name.startswith(prefix)]
            fixed = [part for part in parts if not part.name.startswith(prefix)]
            assert moving, 'Door hinge has no moving geometry: ' + joint['name']
            spatial = c.tree([part.box for part in fixed])
            pivot = np.array(joint['pivot'])
            stop = float(joint['open_degrees'])
            angles = np.r_[np.arange(0, abs(stop), args.step_degrees), abs(stop)]
            instances += 1
            for angle in angles:
                hits = []
                for part in moving:
                    turned = rotated(part, pivot, np.sign(stop) * angle)
                    for index in spatial.intersection(tuple(turned.box)):
                        other = fixed[index]
                        hit = c.pair(turned, other)
                        # Proper crossings do not detect a moving panel whose
                        # entire surface is enclosed by another solid.
                        overlap = np.minimum(turned.box[3:], other.box[3:]) - np.maximum(turned.box[:3], other.box[:3])
                        if not hit and overlap.min() > c.TOL:
                            if winding(turned.points.mean(axis=0), other.tris) > .99:
                                hit = dict(parts=[turned.name, other.name], containment=True)
                        if hit:
                            hits.append(hit)
                if hits:
                    failures.append(dict(model=file.stem, joint=joint['name'],
                                         angle=float(angle), pairs=hits))
                    break
        print('DOOR_CLEARANCE_REVIEWED', file.stem, flush=True)
    assert instances, 'No door joints exported'
    result = dict(checked_instances=instances, step_degrees=args.step_degrees,
                  failures=failures)
    if args.output:
        args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    assert not failures, 'Door swings still intersect fixed geometry: ' + str(failures[:3])
    print('DOOR_OPENING_CLEARANCE_OK', instances, flush=True)


if __name__ == '__main__':
    main()
