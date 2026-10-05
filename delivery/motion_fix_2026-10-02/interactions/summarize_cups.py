"""Summarize actual sleeve/lip geometry through two playback durations."""
import hashlib
import json
import numpy as np
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
actual = json.loads((HERE/'cup_after.json').read_text())
out = {'status':'assistant_runtime_reviewed_user_acceptance_pending', 'clips':{},
       'geometry': {'grip_sleeve_m':[-.049,-.015,0], 'rear_lid_lip_m':[0,.0885,-.057],
                    'head_radius_m':.18, 'mouth_head_offset_m':[0,-.055,.171391]},
       'limit':'The stylized head has no anatomical mouth landmark; the lower-front head-disc edge is the explicit visual sip target. Fingers/liquid/lid opening are not animated.'}
for name, lo, hi in [('drink',.36,.8), ('walk_drink',.30,.50)]:
    v=actual[name]
    rows=v['rows']
    sip=[r for r in rows if lo<=r['phase']<=hi]
    native=np.array([r['hand'] for r in rows[:121]])
    head=np.array([r['head'] for r in rows[:121]])
    metric={'duration_s':v['duration'],'source_chains':v['chains'],
            'source_sha256':hashlib.sha256((REPO/'assets/animations/npz'/name/'motion.npz').read_bytes()).hexdigest(),
            'maximum_sleeve_grip_gap_m':max(r['grip_error_m'] for r in rows),
            'maximum_sip_lip_target_gap_m':max(r['lip_mouth_error_m'] for r in sip),
            'lowered_cup_up_start':rows[0]['up'],'lowered_cup_up_end':rows[120]['up'],
            'sip_tilt_deg':65,
            'maximum_120_step_hand_head_relative_m':float(np.linalg.norm(np.diff(native-head,axis=0),axis=1).max())}
    if name=='drink':
        metric['after_duration_holds_final_pose']=all(np.linalg.norm(np.array(r['hand'])-rows[120]['hand'])<1e-6 for r in rows[120:])
        assert metric['after_duration_holds_final_pose']
    else:
        metric['two_cycle_relative_hand_phase_agreement_m']=max(float(np.linalg.norm((np.array(rows[i]['hand'])-rows[i]['head'])-(np.array(rows[i+120]['hand'])-rows[i+120]['head']))) for i in range(121))
        assert metric['two_cycle_relative_hand_phase_agreement_m']<1e-5
    assert metric['maximum_sleeve_grip_gap_m']<1e-5
    assert metric['maximum_sip_lip_target_gap_m']<1e-5
    assert np.linalg.norm(np.array(rows[0]['up'])-[0,1,0])<1e-6
    assert np.linalg.norm(np.array(rows[120]['up'])-[0,1,0])<1e-6
    out['clips'][name]=metric
(HERE/'cup_summary.json').write_text(json.dumps(out,indent=2)+'\n')
print('CUP_GRIP_PLAYBACK_OK: two clips, physical sleeve/lip contacts, upright lowering, once/loop')
