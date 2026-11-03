"""Sweep actual exported meshes about each window leaf's real hinge axis."""
import argparse
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('intersections', ROOT / 'scripts/check-model-intersections.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def rotated(part, pivot, axis, angle):
    """Rodrigues rotation in the world coordinates of exported triangles."""
    axis = np.asarray(axis, dtype=float)
    assert np.isfinite(axis).all() and np.linalg.norm(axis) > 0, 'Invalid window hinge axis'
    axis = axis / np.linalg.norm(axis)
    angle = np.deg2rad(angle)
    cs, sn = np.cos(angle), np.sin(angle)
    x, y, z = axis
    skew = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
    rotation = cs * np.eye(3) + (1 - cs) * np.outer(axis, axis) + sn * skew
    # Rigid transforms preserve the surface/strut classification. Avoid an SVD
    # per angle, while rebuilding both triangle and plane caches for the pose.
    turned = object.__new__(c.Part)
    turned.meta, turned.name, turned.slot = part.meta, part.name, part.slot
    turned.points = (part.points - pivot) @ rotation.T + pivot
    turned.indices = part.indices
    turned.tris = turned.points[turned.indices]
    turned.box = np.r_[turned.points.min(0), turned.points.max(0)]
    turned._tree = turned._planes = None
    turned.axis = rotation @ part.axis
    turned.axis_min = float((turned.points @ turned.axis).min())
    turned.axis_size, turned.strut = part.axis_size, part.strut
    return turned


def samples(end, step):
    assert step > 0 and end >= 0
    values = list(np.arange(step, end + 1e-8, step))
    if end > 0:
        values.append(float(end))
    return sorted(set(values))


def record(scope, file, joints, angle, hits, **extra):
    return dict(scope=scope, model=file.stem,
                windows=sorted({j['window'] for j in joints}),
                joints=[j['name'] for j in joints], angle=float(angle), pairs=hits, **extra)


def inspect_model(file, args, limits, failures, totals):
    meta = json.loads(file.read_text())
    if not meta.get('joints'):
        return
    data = file.with_suffix('.bin').read_bytes()
    parts = [c.Part(p, data) for p in meta['parts']]
    joints = meta['joints']
    windows = defaultdict(list)
    owners = {}
    for index, joint in enumerate(joints):
        # Do not silently interpret an old Y-axis-only export.
        assert 'axis' in joint and 'open_degrees' in joint, ('Re-export per-joint axes', file, joint['name'])
        joint['window'] = joint.get('window', joint['name'].rsplit('/', 1)[0])
        joint['joint_name'] = joint.get('joint_name', joint['name'].rsplit('/', 1)[-1])
        joint['pivot_array'] = np.asarray(joint['pivot'], dtype=float)
        joint['axis_array'] = np.asarray(joint['axis'], dtype=float)
        joint['end'] = float(joint['open_degrees'])
        assert np.isfinite(joint['end']), ('Invalid angle', file, joint['name'])
        assert np.isfinite(joint['axis_array']).all() and np.linalg.norm(joint['axis_array']) > 0, ('Invalid axis', file, joint['name'])
        joint['members'] = [i for i, p in enumerate(parts) if p.name.startswith(joint['name'] + '/')]
        assert joint['members'], ('Window joint has no mesh', file, joint['name'])
        windows[joint['window']].append(index)
        for i in joint['members']:
            assert i not in owners, ('Nested/ambiguous window joints', file, parts[i].name)
            owners[i] = index
        limits[joint['model']][joint['joint_name']] = min(
            limits[joint['model']].get(joint['joint_name'], float('inf')), abs(joint['end']))
    totals['checked_instances'] += len(windows)
    totals['checked_joints'] += len(joints)
    closed_tree = c.tree([p.box for p in parts])

    def lower_stop(joint_indices, angles):
        for ji in joint_indices:
            j = joints[ji]
            value = max(0.0, abs(angles[ji]) - args.stop_margin)
            limits[j['model']][j['joint_name']] = min(limits[j['model']][j['joint_name']], value)

    # Once per model: welded members of the same moving leaf are excluded.
    closed_hits, seen, closed_involved = [], set(), set()
    for i, ji in owners.items():
        for k in closed_tree.intersection(tuple(parts[i].box)):
            if owners.get(k) == ji:
                continue
            key = tuple(sorted((i, k)))
            if key in seen:
                continue
            seen.add(key)
            hit = c.pair(parts[i], parts[k])
            if hit:
                closed_hits.append(hit)
                closed_involved.add(ji)
                if k in owners:
                    closed_involved.add(owners[k])
    if closed_hits:
        failures.append(record('closed', file, [joints[ji] for ji in sorted(closed_involved)], 0, closed_hits))
        print('WINDOW_CLOSED_OBSTRUCTION', file.stem, len(closed_hits), flush=True)
    totals['closed_models'] += 1
    if args.closed_only:
        return

    # Every leaf can open independently while siblings and other windows close.
    for ji, joint in enumerate(joints):
        stop, sign = abs(joint['end']), np.sign(joint['end'])
        for amount in samples(stop, args.step_degrees):
            hits = []
            for i in joint['members']:
                turned = rotated(parts[i], joint['pivot_array'], joint['axis_array'], sign * amount)
                for k in closed_tree.intersection(tuple(turned.box)):
                    if owners.get(k) == ji:
                        continue
                    hit = c.pair(turned, parts[k])
                    if hit:
                        hits.append(hit)
            totals['individual_angle_samples'] += 1
            if hits:
                failures.append(record('individual_joint', file, [joint], sign * amount, hits))
                lower_stop([ji], {ji: sign * amount})
                break
        if (ji + 1) % 50 == 0:
            print('WINDOW_JOINTS_REVIEWED', file.stem, ji + 1, len(joints), flush=True)

    # Siblings share the runtime ratio, even with different signed end angles.
    for window, group in windows.items():
        if len(group) < 2:
            continue
        max_end = max(abs(joints[ji]['end']) for ji in group)
        if max_end == 0:
            continue
        for amount in samples(max_end, args.step_degrees):
            phase = amount / max_end
            angles = {ji: joints[ji]['end'] * phase for ji in group}
            moved = [(i, ji, rotated(parts[i], joints[ji]['pivot_array'], joints[ji]['axis_array'], angles[ji]))
                     for ji in group for i in joints[ji]['members']]
            spatial = c.tree([p.box for _, _, p in moved])
            hits, involved = [], set()
            for mi, (_, ji, part) in enumerate(moved):
                for mk in spatial.intersection(tuple(part.box)):
                    if mk <= mi or moved[mk][1] == ji:
                        continue
                    hit = c.pair(part, moved[mk][2])
                    if hit:
                        hits.append(hit)
                        involved.update([ji, moved[mk][1]])
            totals['sibling_phase_samples'] += 1
            if hits:
                failures.append(record('sibling_synchronous', file, [joints[ji] for ji in sorted(involved)],
                                       amount, hits, phase=phase,
                                       signed_joint_angles={joints[ji]['name']: angles[ji] for ji in sorted(involved)}))
                lower_stop(involved, angles)
                break

    # All building windows open together at key five-degree phases. Include
    # every fixed wall, frame, sill and other assembled component in the test.
    if file.stem.startswith('building_') and len(windows) > 1:
        max_end = max(abs(j['end']) for j in joints)
        if max_end:
            for amount in samples(max_end, args.global_step_degrees):
                phase = amount / max_end
                angles = {ji: j['end'] * phase for ji, j in enumerate(joints)}
                pose = list(parts)
                for i, ji in owners.items():
                    j = joints[ji]
                    pose[i] = rotated(parts[i], j['pivot_array'], j['axis_array'], angles[ji])
                spatial = c.tree([p.box for p in pose])
                hits, involved = [], set()
                for i, ji in owners.items():
                    for k in spatial.intersection(tuple(pose[i].box)):
                        ki = owners.get(k)
                        if ki is not None and (k <= i or joints[ki]['window'] == joints[ji]['window']):
                            continue
                        hit = c.pair(pose[i], pose[k])
                        if hit:
                            hits.append(hit)
                            involved.add(ji)
                            if ki is not None:
                                involved.add(ki)
                totals['building_phase_samples'] += 1
                if hits:
                    failures.append(record('building_synchronous', file, [joints[ji] for ji in sorted(involved)],
                                           amount, hits, phase=phase,
                                           signed_joint_angles={joints[ji]['name']: angles[ji] for ji in sorted(involved)}))
                    lower_stop(involved, angles)
                    break
    print('WINDOW_CLEARANCE_REVIEWED', file.stem, 'windows', len(windows), 'joints', len(joints), flush=True)


def empty_totals():
    return dict(checked_instances=0, checked_joints=0, closed_models=0,
                individual_angle_samples=0, sibling_phase_samples=0, building_phase_samples=0)


def inspect_file(task):
    # Each process owns its triangle/plane caches and spatial trees. Only plain
    # measurement results return to the parent, which alone can write stops.
    file, args = task
    limits, failures, totals = defaultdict(dict), [], empty_totals()
    inspect_model(file, args, limits, failures, totals)
    return dict(limits), failures, totals


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--set-stops', action='store_true')
    parser.add_argument('--closed-only', action='store_true')
    parser.add_argument('--geometry', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--step-degrees', type=float, default=1.0)
    parser.add_argument('--global-step-degrees', type=float, default=5.0)
    parser.add_argument('--stop-margin', type=float, default=1.0)
    parser.add_argument('--workers', type=int, default=1,
                        help='Independent file sweep processes; defaults to the serial path')
    args = parser.parse_args()
    assert args.step_degrees > 0 and args.global_step_degrees > 0 and args.stop_margin >= 0
    assert args.workers >= 1, 'Workers must be positive'
    assert not (args.closed_only and args.set_stops), 'Closed obstructions cannot be fixed by opening limits'
    failures, limits = [], defaultdict(dict)
    totals = empty_totals()
    files = [p for p in sorted(args.geometry.glob('*.json')) if '__' not in p.stem
             and (p.stem.startswith('window_') or p.stem.startswith('building_'))]
    assert files, 'No window geometry inputs'
    if args.workers == 1:
        for file in files:
            inspect_model(file, args, limits, failures, totals)
    else:
        with ProcessPoolExecutor(max_workers=min(args.workers, len(files))) as pool:
            # map retains input order, so reports remain deterministic even
            # when the per-file progress lines arrive in a different order.
            for file_limits, file_failures, file_totals in pool.map(inspect_file, ((file, args) for file in files)):
                failures.extend(file_failures)
                for name, joints in file_limits.items():
                    for joint_name, value in joints.items():
                        limits[name][joint_name] = min(limits[name].get(joint_name, float('inf')), value)
                for key, value in file_totals.items():
                    totals[key] += value
    assert totals['checked_joints'] > 0, 'No exported window joints'
    result = dict(**totals, step_degrees=args.step_degrees,
                  global_step_degrees=args.global_step_degrees, joint_limits=dict(limits), failures=failures,
                  scope=['closed moving/fixed and sibling leaves', 'individual joints with other leaves closed',
                         'same-window synchronous leaves', 'building synchronous windows and fixed geometry'])
    if args.output:
        args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    if args.set_stops:
        assert not any(f['scope'] == 'closed' for f in failures), 'Repair closed geometry before deriving stops'
        assert all(value >= 1 for values in limits.values() for value in values.values()), 'A joint has no usable opening'
        path = ROOT / 'godot/modeling/window-installation.json'
        installation = json.loads(path.read_text())
        for name, values in limits.items():
            assert name in installation, ('Unknown window installation', name)
            installation[name].setdefault('joint_limits', {}).update(values)
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            stream.write((json.dumps(installation, indent=2) + '\n').replace('\n', '\r\n').encode())
            pending = stream.name
        os.replace(pending, path)
        print('WINDOW_JOINT_STOPS_SET', sum(len(v) for v in limits.values()), 'rebuild and re-export before validating', flush=True)
    else:
        if failures:
            print('WINDOW_CLEARANCE_FAILURES', len(failures),
                  json.dumps([{k: f[k] for k in ('scope', 'model', 'windows', 'joints', 'angle')} for f in failures]), flush=True)
        assert not failures, 'Window opening meshes still intersect'
        print('WINDOW_OPENING_CLEARANCE_OK', totals['checked_instances'], 'windows', totals['checked_joints'], 'joints', flush=True)


if __name__ == '__main__':
    main()
