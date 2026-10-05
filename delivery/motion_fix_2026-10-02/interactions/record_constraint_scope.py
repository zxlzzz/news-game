"""Record requested full-body/EE scope; full77 FK mismatch is not EE invalidity."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
IDS = ['walk_backpack_straps', 'fruit_weigh', 'vending_collect', 'hang_laundry', 'elder_assisted_walk', 'phone_urgent']
out = {'implementation': {
    'worker': 'scripts/kimodo_motion_batch.py',
    'kimodo': 'C:/kimodo-trial/kimodo/kimodo/constraints.py',
    'fullbody': 'SOMA30 positions, root XZ/Y and heading; update_constraints explicitly ignores supplied global rotations.',
    'hand_end_effector': 'Expanded Hand + MiddleEnd positions and Hand global rotation; parent arm rotations are not constrained by this set.',
    'causality_limit': 'The original requests contain no serialized final correction masks. No controlled regeneration isolates target geometry/reachability, sparse body keys or generator solution. Full77 FK disagreement alone is not proof of an illegal EE target.'}, 'clips': {}}
for name in IDS:
    meta = json.loads((HERE / 'before' / name / 'meta.json').read_text(encoding='utf-8'))
    keys = meta.get('keyframes', [])
    out['clips'][name] = {'fullbody_frames': [k['frame'] for k in keys],
        'fullbody_sources': sorted({k['source'] for k in keys}),
        'effectors': [{'joints': e['joints'], 'frames': [k['frame'] for k in e['keyframes']],
                       'sources': sorted({k['source'] for k in e['keyframes']})} for e in meta.get('effectors', [])],
        'original_serialized_constraint_targets': 'constraint_targets' in meta}
(HERE / 'constraint_scope.json').write_text(json.dumps(out, indent=2)+'\n', encoding='utf-8')
