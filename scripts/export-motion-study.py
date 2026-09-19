"""Export selected SOMA joints for the isolated browser study; never edit NPZs.

python scripts/export-motion-study.py --skeleton-definition C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py
Requires numpy; the Kimodo model is not loaded.
"""
import argparse
import ast
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CLIPS = {
    'stand_idle': '自然站立', 'phone_walk': '边走边看手机',
    'scratch_head': '挠头', 'squat_watch': '低蹲观看', 'bow': '鞠躬',
    'wave_both_overhead': '双手挥动',
}
KEEP = ['Hips', 'Spine1', 'Spine2', 'Chest', 'Neck1', 'Neck2', 'Head', 'HeadEnd',
        'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
        'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
        'LeftLeg', 'LeftShin', 'LeftFoot', 'LeftToeBase', 'LeftToeEnd',
        'RightLeg', 'RightShin', 'RightFoot', 'RightToeBase', 'RightToeEnd']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skeleton-definition', type=Path, required=True)
    args = parser.parse_args()
    tree = ast.parse(args.skeleton_definition.read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'SOMASkeleton77')
    assignment = next(n for n in cls.body if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == 'bone_order_names_with_parents' for t in n.targets))
    hierarchy = ast.literal_eval(assignment.value)
    names = [name for name, _ in hierarchy]
    parents = dict(hierarchy)
    indices = [names.index(n) for n in KEEP]
    output = {'names': KEEP, 'parents': [KEEP.index(parents[n]) if parents[n] else -1 for n in KEEP],
              'units': 'metres; Y up; original SOMA coordinates', 'clips': {}}
    for name, label in CLIPS.items():
        folder = ROOT / 'assets/animations/npz' / name
        meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8-sig'))
        with np.load(folder / 'motion.npz', allow_pickle=False) as source:
            joints = source['posed_joints'][:, indices]
            assert np.isfinite(joints).all() and joints.shape[1:] == (len(KEEP), 3)
            output['clips'][name] = {'label': label, 'fps': meta['fps'],
                'frames': np.round(joints.astype(float), 5).tolist(),
                'contacts': source['foot_contacts'].astype(int).tolist()}
    target = ROOT / 'sth/motion-study/motions.json'
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(CLIPS)} clips, {len(KEEP)} joints, {target.stat().st_size} bytes: {target}')


if __name__ == '__main__':
    main()
