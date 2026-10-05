"""Read full SOMA source/FK consistency, including archived effector targets.

No production writes. Uses the existing Kimodo skeleton asset and local torch only
to load its tensor; no inference/dependency installation is performed.
"""
import ast
import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
KIMODO = Path('C:/kimodo-trial/kimodo/kimodo')
IDS = ['walk_backpack_straps', 'fruit_weigh', 'vending_collect', 'hang_laundry', 'elder_assisted_walk', 'phone_urgent']


def skeleton():
    import torch
    module = ast.parse((KIMODO / 'skeleton/definitions.py').read_text())
    cls = next(x for x in module.body if isinstance(x, ast.ClassDef) and x.name == 'SOMASkeleton77')
    pairs = ast.literal_eval(next(x.value for x in cls.body if isinstance(x, ast.Assign)
                                  and any(isinstance(t, ast.Name) and t.id == 'bone_order_names_with_parents' for t in x.targets)))
    names = [n for n, _ in pairs]
    parents = [-1 if p is None else names.index(p) for _, p in pairs]
    neutral = np.array(torch.load(KIMODO / 'assets/skeletons/somaskel77/joints.p', weights_only=True).squeeze().tolist())
    return names, parents, neutral


def fk(local, root, parents, neutral):
    rotations = np.empty_like(local)
    joints = np.empty((len(local), len(parents), 3), dtype=local.dtype)
    rotations[:, 0] = local[:, 0]
    joints[:, 0] = root
    for i, p in enumerate(parents[1:], 1):
        rotations[:, i] = rotations[:, p] @ local[:, i]
        joints[:, i] = joints[:, p] + np.einsum('tij,j->ti', rotations[:, p], neutral[i] - neutral[p])
    return rotations, joints


def metrics(data, names, parents, neutral):
    p = data['posed_joints']
    l = data['local_rot_mats']
    g, reconstructed = fk(l, data['root_positions'], parents, neutral)
    lengths = np.array([np.linalg.norm(p[:, i] - p[:, k], axis=-1) for i, k in enumerate(parents) if k >= 0])
    error = np.linalg.norm(p - reconstructed, axis=-1)
    r_error = np.linalg.norm(g - data['global_rot_mats'], axis=(-1, -2))
    orthogonal = np.linalg.norm(np.swapaxes(l, -1, -2) @ l - np.eye(3), axis=(-1, -2))
    out = {'frames': len(p), 'max_bone_length_range_m': float(np.ptp(lengths, axis=1).max()),
           'fk_position_max_error_m': float(error.max()), 'fk_rotation_max_error': float(r_error.max()),
           'local_rotation_orthogonality_max_error': float(orthogonal.max()), 'hands': {}}
    for name in ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand']:
        i = names.index(name)
        q = p[:, i] - p[:, 0]
        steps = np.linalg.norm(np.diff(q, axis=0), axis=-1)
        j = int(np.argmax(steps))
        out['hands'][name] = {'max_hip_relative_step_m': float(steps[j]), 'frames': [j, j+1],
                              'max_fk_error_m': float(error[:, i].max()),
                              'fk_max_step_m': float(np.linalg.norm(np.diff(reconstructed[:, i]-reconstructed[:, 0], axis=0), axis=-1).max())}
    return out


def main():
    names, parents, neutral = skeleton()
    output = {'skeleton': {'names': names, 'parents': parents, 'neutral': neutral.tolist()}, 'clips': {}}
    for name in IDS:
        folder = REPO / 'assets/animations/npz' / name
        meta = json.loads((folder / 'meta.json').read_text())
        with np.load(folder / 'motion.npz', allow_pickle=False) as a:
            data = {k: a[k] for k in a.files}
        rec = {'source': metrics(data, names, parents, neutral), 'targets': {}}
        for eff in meta.get('effectors', []):
            for key in eff.get('keyframes', [])[:1]:
                original = key['source'].split('/')[-1]
                path = REPO / 'assets/animations/generation_inputs' / original
                with np.load(path, allow_pickle=False) as a:
                    target = {k: a[k] for k in a.files}
                rec['targets'][original] = metrics(target, names, parents, neutral)
        output['clips'][name] = rec
        print(name, json.dumps(rec['source']))
    (HERE / 'source_probe.json').write_text(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
