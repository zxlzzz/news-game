"""Export every Kimodo npz clip for the Godot game project (godot/); never edit NPZs.

python scripts/export-npc-motion.py --skeleton-definition C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py \
    --out godot/npc/motion
Requires numpy; the Kimodo model is not loaded.

Writes <out>/index.json (joint names, SOMA77 indices and parents, clip list) and <out>/<clip>.json
({fps, frames}; frames[f][j] = [x, y, z] of index.json names[j], metres, Y up, original SOMA coordinates).
Joints: only the 16 source joints sth/motion-study/skeleton-mapping.mjs reads.
Root: in every clip posed_joints[:, Hips] equals root_positions exactly (checked below; the export stops
otherwise), so the Hips column already carries the root displacement and no separate root array is written.
"""
import argparse
import ast
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
# Same joints, same order as the required-joint check at the top of sth/motion-study/skeleton-mapping.mjs.
MAPPING_JOINTS = ['Hips', 'Neck1', 'Head', 'HeadEnd'] + [side + part for side in ('Left', 'Right')
                  for part in ('Arm', 'ForeArm', 'Hand', 'Shin', 'Foot', 'ToeEnd')]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--skeleton-definition', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    tree = ast.parse(args.skeleton_definition.read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'SOMASkeleton77')
    assignment = next(n for n in cls.body if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == 'bone_order_names_with_parents' for t in n.targets))
    hierarchy = ast.literal_eval(assignment.value)
    names = [name for name, _ in hierarchy]
    parents = dict(hierarchy)
    indices = [names.index(n) for n in MAPPING_JOINTS]
    hips = names.index('Hips')
    folders = sorted(p for p in (ROOT / 'assets/animations/npz').iterdir() if p.is_dir())
    args.out.mkdir(parents=True, exist_ok=True)
    clips = []
    for folder in folders:
        meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8-sig'))
        with np.load(folder / 'motion.npz', allow_pickle=False) as source:
            posed = source['posed_joints']
            assert posed.shape[1:] == (len(names), 3), f'{folder.name}: posed_joints {posed.shape}'
            assert np.array_equal(posed[:, hips], source['root_positions']), \
                f'{folder.name}: posed_joints Hips differs from root_positions; root data must be exported separately'
            joints = posed[:, indices]
        assert np.isfinite(joints).all() and len(joints) > 0, folder.name
        fps = float(meta['fps'])
        assert fps > 0, f'{folder.name}: fps {fps}'
        clip = {'fps': fps, 'frames': np.round(joints.astype(float), 5).tolist()}
        (args.out / f'{folder.name}.json').write_text(json.dumps(clip, separators=(',', ':')), encoding='utf-8')
        clips.append({'id': folder.name, 'fps': fps, 'frames': len(joints)})
    index = {'names': MAPPING_JOINTS, 'soma77_index': indices,
             'soma77_parent_index': [names.index(parents[n]) if parents[n] else -1 for n in MAPPING_JOINTS],
             'units': 'metres; Y up; original SOMA coordinates; rounded to 5 decimals',
             'root': 'Hips column (identical to motion.npz root_positions)', 'clips': clips}
    (args.out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(clips)} clips, {len(MAPPING_JOINTS)} joints -> {args.out}')


if __name__ == '__main__':
    main()
