"""Independent whole-mesh verification of native runtime transforms."""
import json
import sys
import hashlib
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'godot/modeling/animals/animal_tools'))
from skin_sampler import GLB, mesh_data, skin


def main(folder, labels=None):
    folder = Path(folder)
    dump = json.loads((folder / 'runtime.json').read_text())
    assert dump['inputs_before'] == dump['inputs_after'], 'Runtime inputs changed while recording'
    suffix = '_selected' if labels else ''
    manifest_path = folder / ('validation' + suffix + '.json')
    verifier_inputs = {}
    for path in [Path(__file__), folder / 'runtime.json', folder / 'settings.json',
                 ROOT / 'godot/npc/animal-models.json', ROOT / 'godot/npc/animal-behaviour.json']:
        if path.exists():
            verifier_inputs[str(path.resolve())] = hashlib.sha256(path.read_bytes()).hexdigest()
    assert verifier_inputs[str((ROOT / 'godot/npc/animal-models.json').resolve())] == dump['inputs_after']['res://npc/animal-models.json'], 'Leg configuration changed since recording'
    # Replace an earlier success marker before assertions run, so a failed rerun
    # cannot leave an old validation file looking like the new batch succeeded.
    manifest_path.write_text(json.dumps({'completed': False, 'verifier_inputs': verifier_inputs}, indent=2) + '\n')
    fps = dump['fps']
    config = json.loads((ROOT / 'godot/npc/animal-models.json').read_text())
    contact_tolerance = json.loads((ROOT / 'godot/npc/animal-behaviour.json').read_text())['checks']['paw']
    result = {}
    failures = []
    for breed, record in dump['breeds'].items():
        path = ROOT / 'godot/models' / ('animal_' + breed + '.glb')
        expected = dump['inputs_after']['res://models/animal_' + breed + '.glb']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == expected, (breed, 'GLB changed since the runtime recording')
        g = GLB(path)
        data = mesh_data(g)
        nodes = {n['name']: i for i, n in enumerate(g.d['nodes'])}
        indices = {name: i for i, name in enumerate(record['names'])}
        rest = np.array([g.matrix(i) for i in range(len(g.d['nodes']))])
        points, weights, joint_ids, joints, inverse = data
        features = np.zeros((len(points), len(joints), 4))
        for slot in range(weights.shape[1]):
            local = (inverse[joint_ids[:, slot]] @ points[..., None])[..., 0]
            features[np.arange(len(points)), joint_ids[:, slot]] += local * weights[:, slot, None]
        tree = cKDTree(features.reshape(len(points), -1))
        joint_names = {g.d['nodes'][node]['name']: j for j, node in enumerate(joints)}
        sole_indices = {}
        for key, vertices in record['soles'].items():
            feature = np.zeros((len(vertices), len(joints), 4))
            for i, vertex in enumerate(vertices):
                for bone, local, weight in vertex:
                    feature[i, joint_names[record['names'][bone]]] += np.r_[local, 1] * weight
            distance, vertex_ids = tree.query(feature.reshape(len(vertices), -1))
            # Godot packs imported skin weights at 16-bit precision. This is an
            # identity match tolerance for that import, not a ground/contact tolerance.
            assert distance.max() < 2 / 65535, (breed, key, 'sole vertices do not match the actual GLB', distance.max())
            sole_indices[key] = vertex_ids
        result[breed] = {'gait': record['gait']['gaits'], 'drop': record['drop'], 'scenarios': {}}
        for scenario in record['scenarios']:
            if labels and scenario['label'] not in labels:
                continue
            states = scenario['states']
            verifier_inputs[str(Path(scenario['file']).resolve())] = hashlib.sha256(Path(scenario['file']).read_bytes()).hexdigest()
            raw = np.fromfile(scenario['file'], dtype='<f4').reshape(len(states), len(record['names']), 4, 3)
            transforms = np.tile(np.eye(4), (len(states), len(record['names']), 1, 1))
            transforms[..., :3, :3] = raw[..., :3, :].transpose(0, 1, 3, 2)
            transforms[..., :3, 3] = raw[..., 3, :]
            world = np.tile(rest, (len(states), 1, 1, 1))
            for name, i in indices.items():
                world[:, nodes[name]] = transforms[:, i]
            xyz = skin(data, world)
            height = xyz[..., 1].min(axis=1)
            feet = {}
            worst_length = 0.
            body = []
            for key, chain in config['breeds'][breed]['legs'].items():
                ids = [nodes[name] for name in chain]
                for parent, child in zip(ids, ids[1:]):
                    nominal = np.linalg.norm(rest[parent, :3, 3] - rest[child, :3, 3])
                    current = np.linalg.norm(world[:, parent, :3, 3] - world[:, child, :3, 3], axis=1)
                    worst_length = max(worst_length, float(abs(current - nominal).max()))
                sole_vertices = xyz[:, sole_indices[key]]
                sole = sole_vertices.mean(axis=1)
                sole[:, 1] = sole_vertices[:, :, 1].min(axis=1)
                target = np.array([s['feet'][key]['point'] for s in states])
                walking = np.array([s['phase'] == 'walk' for s in states])
                active = np.array([s['phase'] == 'walk' or
                                   (s['phase'] == 'return' and key in s.get('return_contacts', [])) for s in states])
                planted = active & np.array([not s['feet'][key]['swing'] for s in states])
                airborne = active & ~planted
                rest_skin = skin(data, rest[None])[0, sole_indices[key]]
                centre = rest_skin.mean(axis=0)
                centre[1] = 0
                sole_local = np.linalg.inv(rest[ids[-1]]) @ np.r_[centre, 1]
                anchor = (world[:, ids[-1]] @ sole_local)[:, :3]
                free_error = anchor - target
                errors = np.linalg.norm(free_error, axis=1)
                worst_free = np.argmax(np.where(airborne, errors, -1))
                stride_window = np.arange(len(states)) >= int(3 * fps)
                stride_window &= walking
                local = sole - world[:, ids[0], :3, 3]
                speed = np.linalg.norm(np.diff(sole, axis=0), axis=1) * fps
                both = planted[1:] & planted[:-1]
                feet[key] = {'planted_sole_target_max_error_m': float(np.linalg.norm(sole - target, axis=1)[planted].max()) if planted.any() else None,
                             'planted_sole_speed_max_mps': float(speed[both].max()) if both.any() else None,
                             'free_anchor_max_error_m': float(errors[airborne].max()) if airborne.any() else None,
                             'free_skin_sole_max_error_m': float(np.linalg.norm(sole - target, axis=1)[airborne].max()) if airborne.any() else None,
                             'free_skin_lift_max_m': float(sole[airborne, 1].max()) if airborne.any() else None,
                             'planted_frames': int(planted.sum()), 'free_frames': int(airborne.sum()),
                             'free_anchor_xz_max_error_m': float(np.linalg.norm(free_error[:, [0, 2]], axis=1)[airborne].max()) if airborne.any() else None,
                             'worst_free_anchor': {'frame': int(worst_free), 'state': states[worst_free], 'delta': free_error[worst_free].tolist(), 'skin_sole_y': float(sole[worst_free, 1])} if airborne.any() else None,
                             'paw_sweep_m': np.ptp(local[stride_window], axis=0).tolist() if stride_window.any() else None}
                true_error = np.linalg.norm(sole - target, axis=1)
                if active.any():
                    worst = int(np.argmax(np.where(active, true_error, -1)))
                    feet[key]['worst_skin_contact'] = {'frame': worst, 'time': worst / fps,
                        'sole': sole[worst].tolist(), 'target': target[worst].tolist(), 'state': states[worst]}
                    if true_error[worst] > contact_tolerance:
                        failures.append({'breed': breed, 'scenario': scenario['label'], 'paw': key,
                            'error_m': float(true_error[worst]), 'tolerance_m': contact_tolerance,
                            'frame': worst, 'time': worst / fps})
                body.append(np.ptp(world[stride_window, ids[0], :3, 3], axis=0)[1] if stride_window.any() else 0)
            phases = np.unwrap(np.array([s['cycle'] for s in states]) * 2 * np.pi) / (2 * np.pi)
            settled = np.arange(len(states)) >= int(3 * fps)
            start = int(3 * fps)
            frequency = (phases[-1] - phases[start]) / ((len(states) - start - 1) / fps) if len(states) > start + 1 else 0
            summary = {'frames': len(states), 'fps': fps, 'mesh_floor_min_m': float(height.min()),
                       'mesh_penetrating_frames_below_0_1mm': int((height < -.0001).sum()),
                       'worst_leg_length_change_m': worst_length, 'feet': feet,
                       'girdle_y_sweep_m': body, 'cycle_frequency_hz': float(frequency),
                       'actual_speed_mean_mps': float(np.mean([s['speed'] for i, s in enumerate(states) if settled[i]])),
                       'fastest_bone': scenario['fastest'],
                       'phases': list(dict.fromkeys(s['phase'] for s in states)),
                       'clips': list(dict.fromkeys(s['clip'] for s in states if s['clip']))}
            result[breed]['scenarios'][scenario['label']] = summary
            print(breed, scenario['label'], 'floor_mm', round(height.min() * 1000, 4), 'bone_mm', round(worst_length * 1000, 4),
                  'Hz', round(frequency, 3), 'planted_paw_mm', [round(v['planted_sole_target_max_error_m'] * 1000, 4) if v['planted_sole_target_max_error_m'] is not None else None for v in feet.values()])
            assert height.min() >= -.00001, (breed, scenario['label'], 'whole mesh penetrates floor', height.min())
            assert worst_length < .00003, (breed, scenario['label'], 'anatomical leg length changed', worst_length)
    (folder / ('verification' + suffix + '.json')).write_text(json.dumps(result, indent=2) + '\n')
    manifest_path.write_text(json.dumps({'completed': not failures, 'exit_code': 0 if not failures else 1, 'failures': failures,
        'verifier_inputs': verifier_inputs, 'criteria': {'whole_raw_mesh_floor_m': .00001,
            'leg_length_change_m': .00003, 'skin_sole_plan_m': contact_tolerance,
            'sole_plan_mask': 'walk or return phase with paw in return_contacts; planted and airborne',
            'rigid_anchor': 'diagnostic only'},
        'inputs': dump['inputs_after'], 'contact_tolerance_m': contact_tolerance,
        'scenarios': sum(len(b['scenarios']) for b in result.values()),
        'frames': sum(s['frames'] for b in result.values() for s in b['scenarios'].values())}, indent=2) + '\n')
    assert not failures, failures


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent,
         sys.argv[2].split(',') if len(sys.argv) > 2 else None)
