"""Export every Kimodo npz clip for the Godot game project (godot/); never edit NPZs.

python scripts/export-npc-motion.py --skeleton-definition C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py \
    --out godot/npc/motion
Requires numpy; the Kimodo model is not loaded.

Writes <out>/index.json (joint names, SOMA77 indices and parents, clip list) and <out>/<clip>.json
({fps, frames}; frames[f][j] = [x, y, z] of index.json names[j], metres, Y up, original SOMA coordinates).
Joints: only the 16 source joints sth/motion-study/skeleton-mapping.mjs reads.
Root: in every clip posed_joints[:, Hips] equals root_positions exactly (checked below; the export stops
otherwise), so the Hips column already carries the root displacement and no separate root array is written.
Loops (design_route_npc_motion_supply.md §5 item 4): clips with "loop": true in
assets/animations/clip_endpoints.json get their seam closed here. The difference between the last and the first
frame (every joint, after taking out the root's horizontal travel) is spread linearly over the clip, so the last
frame repeats the first and the root's horizontal path is untouched. The export stops instead when that
difference exceeds SEAM_MAX_M or when a different set of feet is on the ground at the two ends (checked only
when there is a seam to close: a clip whose last frame already repeats the first is left as is).
"""
import argparse
import ast
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ENDPOINTS = ROOT / 'assets/animations/clip_endpoints.json'
# Largest seam the linear spread may close (metres, any joint).
SEAM_MAX_M = 0.15
# A seam this small is already closed: left as is (same tolerance as godot/npc/clip_pose.gd REPEAT_TOLERANCE).
SEAM_NONE_M = 0.001
# Same joints, same order as the required-joint check at the top of sth/motion-study/skeleton-mapping.mjs.
MAPPING_JOINTS = ['Hips', 'Neck1', 'Head', 'HeadEnd'] + [side + part for side in ('Left', 'Right')
                  for part in ('Arm', 'ForeArm', 'Hand', 'Shin', 'Foot', 'ToeEnd')]


def close_seam(name, joints, contacts):
    """joints (frames, 16, 3) with Hips first; contacts (frames, 6): left foot columns 0-2, right 3-5.
    Returns the corrected joints and the seam that was closed (metres)."""
    travel = joints[-1, 0] - joints[0, 0]
    travel[1] = 0.0
    diff = joints[-1] - travel - joints[0]
    seam = float(np.linalg.norm(diff, axis=1).max())
    if seam <= SEAM_NONE_M:
        return joints, seam  # already closed (a repeated end frame); contact labels can differ on equal poses
    feet = lambda c: (bool(c[:3].any()), bool(c[3:].any()))
    if feet(contacts[0]) != feet(contacts[-1]):
        raise SystemExit(f'{name}: loop ends with different feet on the ground '
                         f'(left, right: first {feet(contacts[0])}, last {feet(contacts[-1])}); not fixable by spreading')
    if seam > SEAM_MAX_M:
        raise SystemExit(f'{name}: loop seam {seam * 100:.1f} cm is over {SEAM_MAX_M * 100:.0f} cm; not fixable by spreading')
    weight = np.linspace(0.0, 1.0, len(joints))[:, None, None]
    return joints - weight * diff[None], seam


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
    loops = {k for k, v in json.loads(ENDPOINTS.read_text(encoding='utf-8'))['clips'].items() if v['loop']}
    folders = sorted(p for p in (ROOT / 'assets/animations/npz').iterdir() if p.is_dir())
    assert loops <= {p.name for p in folders}, f'{ENDPOINTS.name}: loops without a clip {loops - {p.name for p in folders}}'
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
            contacts = source['foot_contacts']
        assert np.isfinite(joints).all() and len(joints) > 0, folder.name
        seam = None
        if folder.name in loops:
            joints, seam = close_seam(folder.name, joints.astype(float), contacts)
        fps = float(meta['fps'])
        assert fps > 0, f'{folder.name}: fps {fps}'
        clip = {'fps': fps, 'frames': np.round(joints.astype(float), 5).tolist()}
        (args.out / f'{folder.name}.json').write_text(json.dumps(clip, separators=(',', ':')), encoding='utf-8')
        clips.append({'id': folder.name, 'fps': fps, 'frames': len(joints)})
        if seam is not None:
            clips[-1].update(loop=True, seam_closed_m=round(seam, 5))
    index = {'names': MAPPING_JOINTS, 'soma77_index': indices,
             'soma77_parent_index': [names.index(parents[n]) if parents[n] else -1 for n in MAPPING_JOINTS],
             'units': 'metres; Y up; original SOMA coordinates; rounded to 5 decimals',
             'root': 'Hips column (identical to motion.npz root_positions)', 'clips': clips}
    (args.out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(clips)} clips, {len(MAPPING_JOINTS)} joints -> {args.out}')


if __name__ == '__main__':
    main()
