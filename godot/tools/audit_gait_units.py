"""Read-only semantic gait-cycle screen; counts alternating foot phases.

Counts are a review signal, not acceptance or automatic trim boundaries.
"""
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
index = json.loads((ROOT / 'godot/npc/motion/index.json').read_text('utf-8'))
rows = []
for entry in index['clips']:
    name = entry['id']
    if not (name.startswith('walk') or name in ['run', 'jog', 'phone_walk', 'eat_walk', 'march_in_place', 'push_cart', 'push_stroller', 'push_bicycle', 'pull_suitcase', 'carry_shoulder_bag', 'carry_bucket']):
        continue
    folder = ROOT / 'assets/animations/npz' / name
    with np.load(folder / 'motion.npz') as source:
        p = source['posed_joints'].astype(float)
    meta = json.loads((folder / 'meta.json').read_text('utf-8-sig'))
    delta = p[:, 69] - p[:, 74]
    axes = [1] if name == 'march_in_place' else [0, 2]
    signal = delta[:, axes]
    _, _, vectors = np.linalg.svd(signal - signal.mean(axis=0), full_matrices=False)
    value = signal @ vectors[0]
    value -= (float(value.max()) + float(value.min())) / 2
    threshold = max(.02, (float(value.max()) - float(value.min())) * .15)
    phase = 0
    events = []
    for f, v in enumerate(value):
        new = 1 if v > threshold else -1 if v < -threshold else phase
        if new != phase:
            events.append({'frame': f, 'seconds': f / meta['fps'], 'phase': new})
            phase = new
    rows.append({'id': name, 'frames': len(p), 'duration': (len(p)-1)/meta['fps'], 'alternating_half_cycles': max(0, len(events)-1), 'approximate_cycles': max(0,len(events)-1)/2, 'events': events, 'review_only': True})
out = ROOT / 'delivery/motion_self_audit_2026-10-03/gait_units.json'
out.write_text(json.dumps(rows, indent=2), encoding='utf-8')
print(json.dumps([{k:r[k] for k in ['id','approximate_cycles']} for r in rows if r['approximate_cycles']>1.5]))
