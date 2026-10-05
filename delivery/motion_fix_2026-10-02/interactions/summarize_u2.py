"""Verify and summarize actual task arms, preserved source body and track cycles."""
import sys
sys.dont_write_bytecode=True
import json
import hashlib
from pathlib import Path
import numpy as np
from source_probe import fk,metrics
from recover_sources import load

HERE=Path(__file__).resolve().parent;REPO=HERE.parents[2]
sk=json.loads((HERE/'source_probe.json').read_text())['skeleton']
names,parents=sk['names'],sk['parents'];neutral=np.array(sk['neutral'])
report={'status':'repaired_assistant_visual_reviewed_user_acceptance_pending','sources':{},'runtime':{}}
for n,side in [('assist_elder_walk','Right'),('atm_take_cash','Right'),('basketball_dribble','Left')]:
    a=load(HERE/'before'/n/'motion.npz');b=load(REPO/'assets/animations/npz'/n/'motion.npz')
    root=names.index(side+'Arm');keep=[]
    for j in range(len(names)):
        anc=j
        while anc>=0 and anc!=root:anc=parents[anc]
        if anc!=root:keep.append(j)
    _,pa=fk(a['local_rot_mats'].astype(np.float64),a['root_positions'],parents,neutral)
    _,pb=fk(b['local_rot_mats'].astype(np.float64),b['root_positions'],parents,neutral)
    preserved={k:bool(np.array_equal(a[k],b[k])) for k in a if k not in ['local_rot_mats','global_rot_mats','posed_joints']}
    bodygap=float(np.max(np.linalg.norm(pa[:,keep]-pb[:,keep],axis=-1)))
    stats=metrics(b,names,parents,neutral)
    assert all(preserved.values()) and bodygap<1e-6 and stats['fk_position_max_error_m']<2e-6
    report['sources'][n]={'before':metrics(a,names,parents,neutral),'after':stats,'unselected_body_max_gap_m':bodygap,'arrays_preserved_exactly':preserved,'sha256':hashlib.sha256((REPO/'assets/animations/npz'/n/'motion.npz').read_bytes()).hexdigest()}
a=json.loads((HERE/'u2_pose_evidence.json').read_text());b=json.loads((HERE/'u2_after_pose_evidence.json').read_text())
for n,c in b['clips'].items():
    rec={'duration':c['duration'],'source_duration':c['source_duration'],'errors':c['errors'],'hips_relative_steps':{},'contacts':{},'boundaries':[]}
    assert not c['errors']
    for side in ['Left','Right']:
        for joint in ['elbow','hand']:
            k=joint+side;values={}
            for version,data in [('before',a),('after',b)]:
                rows=data['clips'][n]['rows'];q=np.array([np.array(r['people'][0]['final'][k])-r['people'][0]['final']['hip'] for r in rows])
                steps=np.linalg.norm(np.diff(q,axis=0),axis=-1);j=int(np.argmax(steps))
                values[version]={'max_m':float(steps[j]),'times_s':[rows[j]['t'],rows[j+1]['t']]}
            rec['hips_relative_steps'][k]=values
    for hand in c['rows'][0]['people'][0]['tracks']:
        active=[r['people'][0] for r in c['rows'] if r['people'][0]['tracks'][hand]['weight']>=.9999]
        gap=max(float(np.linalg.norm(np.array(r['final'][hand])-r['tracks'][hand]['target'])) for r in active)
        assert gap<1e-5
        rec['contacts'][hand]={'full_weight_samples':len(active),'max_target_gap_m':gap}
    for edge in c['boundaries']:
        ss=edge['samples'];delta={k:float(np.linalg.norm(np.array(ss[-1]['pose'][k])-ss[0]['pose'][k])) for k in ss[0]['pose']}
        props=[{'type':p['type'],'seam_displacement_m':float(np.linalg.norm(np.array(ss[-1]['props'][j]['origin'])-ss[0]['props'][j]['origin']))} for j,p in enumerate(ss[0]['props'])]
        assert max(delta.values())<.002 and all(p['seam_displacement_m']<.002 for p in props)
        rec['boundaries'].append({'phase':edge['phase'],'interval_s':.0002,'pose_displacements_m':delta,'props':props})
    report['runtime'][n]=rec

c=b['clips']['basketball_dribble'];floor=[];peaks=[]
for edge in c['boundaries']:
    sample=edge['samples'][1];prop=sample['props'][0];phase=edge['phase']%1
    if abs((phase*4+.5)%1)<1e-6:
        floor.append({'t':sample['t'],'bottom_m':prop['bounds_min'][1]})
    elif abs((phase*4)%1)<1e-6:
        hand=np.array(sample['pose']['handRight']);top=np.array(prop['origin']);top[1]=prop['bounds_max'][1]
        peaks.append({'t':sample['t'],'hand_to_actual_ball_top_m':float(np.linalg.norm(hand-top))})
assert len(floor)==8 and max(abs(r['bottom_m']) for r in floor)<1e-6
assert len(peaks)==8 and max(r['hand_to_actual_ball_top_m'] for r in peaks)<1e-6
rows=[r for r in c['rows'] if r['t']>c['duration']]
held_keys=['head','neck','hip','shoulderLeft','elbowLeft','handLeft','kneeLeft','kneeRight','footLeft','footRight']
body_hold=max(float(np.linalg.norm(np.array(r['people'][0]['final'][k])-rows[0]['people'][0]['final'][k])) for r in rows for k in held_keys)
assert body_hold<1e-6
positions=np.array([r['people'][0]['props'][0]['origin'] for r in rows])
span=float(np.ptp(positions[:,1]));assert span>.8
report['basketball_continuous']={'floor_contacts':floor,'peaks':peaks,'held_source_body_max_gap_m':body_hold,'second_cycle_ball_y_span_m':span,'contract':'tracks_playback loop over duration; source and body/feet continue chains/once rules; noncontinuous source enters once and holds.'}
(HERE/'u2_summary.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('U2_SOURCE_CONTACT_CYCLE_OK: body preserved, contact targets, eight physical ball rebounds, source body holds, seams')
