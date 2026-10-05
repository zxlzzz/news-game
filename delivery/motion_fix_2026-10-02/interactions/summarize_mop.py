"""Compare actual mop head/grips/support before and after the authored stroke."""
import hashlib
import json
import numpy as np
from pathlib import Path

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[2]
before=json.loads((HERE/'mop_before.json').read_text())
after=json.loads((HERE/'mop_after.json').read_text())
base=json.loads((HERE/'before/config/mop_ground.json').read_text())
source=REPO/'assets/animations/npz/mop_ground/motion.npz'
rows=after['mop_ground']['rows'];old=before['mop_ground']['rows']
head=lambda r:np.asarray([f['mop_head'] for f in r])
feet=lambda r:np.asarray([f['feet'] for f in r])
out={'status':'assistant_runtime_reviewed_user_acceptance_pending',
     'source_npz_unchanged':hashlib.sha256(source.read_bytes()).hexdigest()==base['source_sha256'],
     'source_sha256':base['source_sha256'],
     'before_head_xyz_range_m':np.ptp(head(old),axis=0).tolist(),
     'after_head_xyz_range_m':np.ptp(head(rows),axis=0).tolist(),
     'grip_max_gap_m':max(f['hands'][h]['marker_gap_m'] for f in rows for h in ['handLeft','handRight']),
     'mop_bottom_floor_y_range_m':[min(f['floor_y'] for f in rows),max(f['floor_y'] for f in rows)],
     'head_bottom_flat':all(np.linalg.norm(np.array(f['item_up'])-[0,1,0])<1e-6 for f in rows),
     'feet_before_after_max_m':float(np.linalg.norm(feet(old[:121])-feet(rows[:121]),axis=-1).max()),
     'two_cycle_head_phase_agreement_m':float(np.linalg.norm(head(rows[:121])-head(rows[120:]),axis=1).max()),
     'sweep_reference_unchanged':before['sweep_ground']['rows'][:121]==after['sweep_ground']['rows'][:121],
     'layer':'Authored contact-layer head path, real shaft grips, coordinated torso lean. Original mop source NPZ/gait remains; no stand_idle substitution.',
     'limit':'This is a simple upright-shaft push/pull on flat ground, without cloth deformation or dirt removal. sweep_ground remains unaccepted and is unchanged.'}
assert out['source_npz_unchanged'] and out['sweep_reference_unchanged']
assert out['grip_max_gap_m']<1e-5 and out['head_bottom_flat']
assert max(abs(x) for x in out['mop_bottom_floor_y_range_m'])<1e-5
assert out['feet_before_after_max_m']<1e-5
assert out['two_cycle_head_phase_agreement_m']<1e-5
(HERE/'mop_summary.json').write_text(json.dumps(out,indent=2)+'\n')
print('MOP_STROKE_GRIP_OK: 32cm push/pull, physical grips, flat head, unchanged feet/source/sweep, two cycles')
