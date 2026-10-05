"""Read-only inventory, source clip, skin/contact and runtime audit. Only writes here."""
import base64
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation, Slerp

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'godot/modeling/animals/models/animal_husky'))
from verify_husky import GLB


class Gltf(GLB):
    def __init__(self, path):
        self.d = json.loads(Path(path).read_text())
        self.binary = base64.b64decode(self.d['buffers'][0]['uri'].split(',')[1])
        self.parents = {c: i for i, n in enumerate(self.d['nodes']) for c in n.get('children', [])}
        self.world = {}


def local_matrix(trans, quat, scale=None):
    trans, quat = np.asarray(trans), np.asarray(quat)
    m = np.zeros((*trans.shape[:-1], 4, 4))
    m[..., 3, 3] = 1
    m[..., :3, 3] = trans
    m[..., :3, :3] = Rotation.from_quat(quat.reshape(-1, 4)).as_matrix().reshape(*trans.shape[:-1], 3, 3)
    if scale is not None:
        m[..., :3, :3] *= np.asarray(scale)[..., None, :]
    return m


def sample(g, animation, times):
    d = g.d
    count = len(d['nodes'])
    translation = np.tile([n.get('translation', [0, 0, 0]) for n in d['nodes']], (len(times), 1, 1)).astype(float)
    quaternion = np.tile([n.get('rotation', [0, 0, 0, 1]) for n in d['nodes']], (len(times), 1, 1)).astype(float)
    scales = np.tile([n.get('scale', [1, 1, 1]) for n in d['nodes']], (len(times), 1, 1)).astype(float)
    for channel in animation['channels']:
        sp = animation['samplers'][channel['sampler']]
        keys = g.accessor(sp['input']).ravel()
        values = g.accessor(sp['output']).astype(float)
        ts = np.clip(times, keys[0], keys[-1])
        node = channel['target']['node']
        path = channel['target']['path']
        if path == 'rotation':
            quaternion[:, node] = Slerp(keys, Rotation.from_quat(values))(ts).as_quat() if len(keys) > 1 else values[0]
        else:
            target = translation if path == 'translation' else scales
            target[:, node] = np.stack([np.interp(ts, keys, values[:, j]) for j in range(3)], axis=-1)
    local = local_matrix(translation, quaternion, scales)
    world = np.zeros_like(local)
    done = set()

    def fill(i):
        if i in done:
            return
        if 'matrix' in d['nodes'][i]:
            local[:, i] = np.array(d['nodes'][i]['matrix']).reshape(4, 4).T
        if i in g.parents:
            fill(g.parents[i])
            world[:, i] = world[:, g.parents[i]] @ local[:, i]
        else:
            world[:, i] = local[:, i]
        done.add(i)

    for i in range(count):
        fill(i)
    return world


def skin(g, world):
    d = g.d
    attrs = d['meshes'][0]['primitives'][0]['attributes']
    pos = g.accessor(attrs['POSITION'])
    points = np.c_[pos, np.ones(len(pos))]
    weights = g.accessor(attrs['WEIGHTS_0'])
    ji = g.accessor(attrs['JOINTS_0']).astype(int)
    joints = d['skins'][0]['joints']
    ib = g.accessor(d['skins'][0]['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    xyz = np.empty((len(world), len(pos), 3))
    for start in range(0, len(world), 8):
        deform = world[start:start + 8, joints] @ ib
        xyz[start:start + 8] = np.einsum('fnkij,nj,nk->fni', deform[:, ji], points, weights)[..., :3]
    return xyz


def tmat(value):
    m = np.eye(4)
    m[:3, :3] = np.asarray(value[:3]).T
    m[:3, 3] = value[3]
    return m


def public_name(name):
    return name.removesuffix('_Loop')


def main():
    cfg = json.loads((ROOT / 'godot/npc/animal-models.json').read_text(encoding='utf-8'))
    runtime = json.loads((OUT / 'runtime_dump.json').read_text(encoding='utf-8'))
    result = {'coverage': {}, 'breeds': {}, 'pigeon': runtime['pigeon']}
    for breed, params in cfg['breeds'].items():
        g = GLB(ROOT / 'godot/models' / ('animal_' + breed + '.glb'))
        base = ROOT / 'godot/modeling/animals'
        lib = base / 'motions' / (breed + '_motion_library')
        plan = np.load(lib / 'contact_plan.npz')
        specs = json.loads((lib / 'motion_specs.json').read_text(encoding='utf-8'))
        converted = GLB(base / 'models' / ('animal_' + breed) / ('animal_' + breed + '.glb'))
        report = json.loads((base / 'models' / ('animal_' + breed) / 'conversion_report.json').read_text(encoding='utf-8'))
        nodes = g.d['nodes']
        index = {n['name']: i for i, n in enumerate(nodes)}
        joints = g.d['skins'][0]['joints']
        attrs = g.d['meshes'][0]['primitives'][0]['attributes']
        pos = g.accessor(attrs['POSITION'])
        paws = [params['legs'][leg][-1] for leg in ['LF', 'RF', 'LH', 'RH']]
        pawpos = np.array([g.matrix(index[name])[:3, 3] for name in paws])
        nearest = np.argmin(np.linalg.norm(pos[:, None, [0, 2]] - pawpos[None, :, [0, 2]], axis=2), axis=1)
        soles = [np.where((nearest == j) & (pos[:, 1] < .003))[0] for j in range(4)]
        if breed == 'husky':
            soles = [np.where((pos[:, 0] * (1 if leg[0] == 'L' else -1) > .025)
                              & (pos[:, 1] < .003) & ((pos[:, 2] > -.2) if leg[1] == 'F' else (pos[:, 2] < -.2)))[0]
                     for leg in ['LF', 'RF', 'LH', 'RH']]
        byname = {public_name(a['name']): a for a in g.d['animations']}
        endpoint = {}
        clips = {}
        for a in g.d['animations']:
            keys = g.accessor(a['samplers'][0]['input']).ravel()
            times = np.linspace(float(keys[0]), float(keys[-1]), round(float(keys[-1] - keys[0]) * 60) + 1)
            world = sample(g, a, times)
            xyz = skin(g, world)
            name = public_name(a['name'])
            contact = np.stack([np.c_[xyz[:, ids, 0].mean(axis=1), xyz[:, ids, 1].min(axis=1), xyz[:, ids, 2].mean(axis=1)] for ids in soles], axis=1)
            record = {'duration': float(keys[-1] - keys[0]), 'floor_min': float(xyz[:, :, 1].min()),
                      'endpoint_vertex_gap': float(np.linalg.norm(xyz[-1] - xyz[0], axis=-1).max()),
                      'vertex_step_max_60fps': float(np.linalg.norm(np.diff(xyz, axis=0), axis=-1).max()),
                      'paw_z_sweep': np.ptp(world[:, [index[p] for p in paws], 2, 3], axis=0).tolist(),
                      'extras': a.get('extras', {})}
            if a['name'].startswith('NG_'):
                targets = plan[a['name'] + '__targets']
                masks = plan[a['name'] + '__planted'].astype(bool)
                wanted = np.stack([np.interp(times, keys, targets[:, j, k]) for j in range(4) for k in range(3)], axis=-1).reshape(-1, 4, 3)
                mask_keys = np.minimum(np.searchsorted(keys, times, side='right') - 1, len(keys) - 1)
                active = masks[mask_keys] & masks[np.minimum(mask_keys + 1, len(keys) - 1)]
                err = np.linalg.norm(contact - wanted, axis=-1)
                record['contact_plan_max_error'] = float(err[active].max()) if active.any() else None
                record['contact_plan_active_fraction'] = active.mean(axis=0).tolist()
                record['all_paws_unplanted_fraction'] = float((~active.any(axis=1)).mean())
            clips[name] = record
            endpoint[name] = (xyz[0], xyz[-1])
        seams = []
        used = set()
        for action in cfg['species'][params['species']]:
            data = cfg['actions'][action]
            seq = data.get('in', []) + ([data['hold']] if 'hold' in data else []) + data.get('out', [])
            used.update(seq)
            for start, end in zip(seq, seq[1:]):
                gap = np.linalg.norm(endpoint[start][1] - endpoint[end][0], axis=-1)
                seams.append({'action': action, 'from': start, 'to': end, 'vertex_gap_max': float(gap.max())})
        rt = runtime['breeds'][breed]
        runtime_metrics = {}
        for action, scenario in rt['actions'].items():
            frames = scenario['frames']
            minfloor = math.inf
            max_floor_at = None
            for fr in frames:
                world = np.array([g.matrix(i) for i in range(len(nodes))])[None, ...]
                root = tmat(fr['root'])
                for name, value in zip(rt['names'], fr['globals']):
                    world[0, index[name]] = root @ tmat(value)
                xyz = skin(g, world)[0]
                depth = float(xyz[:, 1].min())
                if depth < minfloor:
                    minfloor, max_floor_at = depth, fr['t']
            runtime_metrics[action] = {'floor_min_sampled': minfloor, 'floor_min_at': max_floor_at,
                                       'transitions': scenario['transitions'], 'fastest_bone': scenario['fastest_bone']}
        gait = {}
        for speed, data in rt['gaits'].items():
            if not data['gait_frames']:
                continue
            pp = np.array([[f['paws'][leg] for leg in ['LF', 'RF', 'LH', 'RH']] for f in data['gait_frames']])
            gait[speed] = {'paw_z_sweep': np.ptp(pp[:, :, 2], axis=0).tolist(),
                           'paw_lift_range': np.ptp(pp[:, :, 1], axis=0).tolist(),
                           'phase_cycles_per_s': float(np.unwrap(np.array([f['phase'] for f in data['gait_frames']]) * 2 * np.pi)[-1]
                                                     - np.unwrap(np.array([f['phase'] for f in data['gait_frames']]) * 2 * np.pi)[0])
                                                 / (2 * np.pi * (data['gait_frames'][-1]['t'] - data['gait_frames'][0]['t'])),
                           'fastest_bone': data['fastest_bone']}
        original = {}
        if breed in ['husky', 'shibainu']:
            source = Gltf(Path('D:/Godot/assets/quaternius-ultimate-animals/glTF') / ('Husky.gltf' if breed == 'husky' else 'ShibaInu.gltf'))
            source_idx = {n['name']: i for i, n in enumerate(source.d['nodes'])}
            common = [n for n in index if n in source_idx and index[n] in joints]
            a = np.array([source.matrix(source_idx[n])[:3, 3] for n in common])
            b = np.array([converted.matrix(index[n])[:3, 3] for n in common])
            ac, bc = a - a.mean(axis=0), b - b.mean(axis=0)
            u, sv, vh = np.linalg.svd(ac.T @ bc)
            rot = u @ vh
            scale = sv.sum() / (ac * ac).sum()
            shift = b.mean(axis=0) - a.mean(axis=0) @ rot * scale
            source_anim = {a['name']: a for a in source.d['animations']}
            for anim in converted.d['animations']:
                nm = anim['name']
                srcnm = {'Idle_HitReact_Left': 'Idle_HitReact1', 'Idle_HitReact_Right': 'Idle_HitReact2'}.get(nm, nm)
                if srcnm not in source_anim:
                    continue
                keys = converted.accessor(anim['samplers'][0]['input']).ravel()
                times = np.linspace(0, keys[-1], round(float(keys[-1]) * 60) + 1)
                cw = sample(converted, anim, times)
                sw = sample(source, source_anim[srcnm], times)
                a = sw[:, [source_idx[n] for n in common], :3, 3] @ rot * scale + shift
                b = cw[:, [index[n] for n in common], :3, 3]
                errs = np.linalg.norm(a - b, axis=-1)
                original[nm] = {'normalized_joint_error_max': float(errs.max()), 'normalized_joint_error_rms': float(np.sqrt((errs * errs).mean()))}
        result['breeds'][breed] = {'model_silhouette': report.get('silhouette'), 'conversion_source_actions': report['actions'],
                                  'source_clip_prefix_unchanged': g.d['animations'][:len(converted.d['animations'])] == converted.d['animations'],
                                  'source_clip_values_unchanged': all(np.array_equal(g.accessor(s[field]), converted.accessor(s[field]))
                                                                    for a in converted.d['animations'] for s in a['samplers']
                                                                    for field in ['input', 'output']),
                                  'drop': rt['drop'], 'clips': clips, 'all_action_seams': seams, 'used_clips': sorted(used),
                                  'unused_clips': sorted(set(clips) - used - {rt['walk_clip'], rt['stand_clip']}),
                                  'runtime_actions': runtime_metrics, 'gait': gait, 'original_gltf_comparison': original}
        result['coverage'][breed] = {'all_resource_clips': len(clips), 'authored_clips': sum(n.startswith('NG_') for n in clips),
                                     'runtime_actions_60fps': len(cfg['species'][params['species']]),
                                     'runtime_gait_requested_speeds': [0.15, 0.35, 0.7, 1.3], 'runtime_turn': True,
                                     'short_requests': ['sit', 'sleep'], 'original_source_joint_comparison': len(original)}
        print('ANALYZED', breed, 'clips', len(clips), 'actions', len(cfg['species'][params['species']]), flush=True)
    (OUT / 'analysis.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
