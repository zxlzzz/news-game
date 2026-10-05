"""Read-only source/export/runtime comparison of all human clips.

Thresholds produce candidates, never automatic visual acceptance/rejection.
Native source/mapping frames and the actual runtime time spacing are kept separate.
"""
import csv, json
from pathlib import Path
import numpy as np

OUT=Path(__file__).parent
REPO=OUT.parent.parent
G=REPO/'godot/npc'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
INDEX=read(G/'motion/index.json'); J={n:i for i,n in enumerate(INDEX['names'])}
P=read(G/'skeleton-params.json'); SCALE=3.; R=(P['thigh']+P['shin'])/(.528+.423)
INTER=read(G/'interactions.json')['clips']
END=read(REPO/'assets/animations/clip_endpoints.json')['clips']
DUMP=read(OUT/'human_dump.json')
NATIVE=read(OUT/'native_mapping_metrics.json')['clips']
REST=np.array(read(G/'motion/stand_idle.json')['frames'][0])
SRC_HEAD_R=np.linalg.norm((REST[J['HeadEnd']]-REST[J['Head']])/2)
POINTS={'hip':(0,0),'neck':(0,1),'elbowLeft':(2,1),'handLeft':(3,1),'kneeLeft':(4,1),'ankleLeft':(5,1),'toeLeft':(6,1),
        'elbowRight':(7,1),'handRight':(8,1),'kneeRight':(9,1),'ankleRight':(10,1),'toeRight':(11,1)}
SRC={'hip':'Hips','neck':'Neck1','elbowLeft':'LeftForeArm','handLeft':'LeftHand','kneeLeft':'LeftShin','ankleLeft':'LeftFoot','toeLeft':'LeftToeEnd',
     'elbowRight':'RightForeArm','handRight':'RightHand','kneeRight':'RightShin','ankleRight':'RightFoot','toeRight':'RightToeEnd'}
def pose(p):
    q={k:np.array(p['segs'][i][j],float) for k,(i,j) in POINTS.items()}
    q['head']=np.array(p['head']); return q
def norm(v): return np.linalg.norm(v,axis=-1)
def unit(v): return v/np.maximum(norm(v)[...,None],1e-12)
def cm(v): return float(v)*100
def maxevent(a,b,times,name):
    delta=norm(np.diff(a,axis=0))*SCALE
    k=int(np.argmax(delta)) if len(delta) else 0
    return {'point':name,'sample_after':k+1,'t_before':float(times[k]),'t_after':float(times[k+1]),
            'delta_cm':cm(delta[k]),'velocity_m_s':float(delta[k]/(times[k+1]-times[k])),
            'comparison_cm':cm(norm(b[k+1]-b[k])*R*SCALE)}
rows=[]; detail={}; candidates=[]
for clip in [c['id'] for c in INDEX['clips']]:
    c=read(G/f'motion/{clip}.json'); exp=np.array(c['frames'],float)
    src=np.load(REPO/f'assets/animations/npz/{clip}/motion.npz')['posed_joints']
    meta=read(REPO/f'assets/animations/npz/{clip}/meta.json')
    src16=src[:,INDEX['soma77_index']]
    cfg=INTER.get(clip,{})
    repeat=bool(norm(exp[-1]-exp[-1,0]+exp[0,0]-exp[0]).max()<=.001)
    count=len(exp)-int(repeat)
    rec=DUMP[clip]
    people=[next(p for p in f['people'] if p['main']) for f in rec['frames']]
    times=np.array([f['t'] for f in rec['frames']])
    phases=np.array([p['phase'] for p in people])
    if cfg.get('playback')=='once': phases=np.minimum(phases,(count-1)/count)
    x=(phases%1)*count; lo=np.floor(x).astype(int); hi=(lo+1)%len(exp)
    sample_src=src16[lo]*(1-(x-lo))[:,None,None]+src16[hi]*(x-lo)[:,None,None]
    pre=[pose(p['pre']) for p in people]; final=[pose(p['final']) for p in people]
    pa={k:np.array([p[k] for p in pre]) for k in pre[0]}; fa={k:np.array([p[k] for p in final]) for k in final[0]}
    d={'frames_source':len(src),'frames_export':len(exp),'samples_runtime':len(times),'cycle_s':rec['cycle'],
       'dt_s':float(times[1]-times[0]),'declared_loop':meta.get('loop',END.get(clip,{}).get('loop',None)),'repeat_endpoint':repeat,
       'playback':cfg.get('playback','loop/default'),'source_nonfinite':int((~np.isfinite(src)).sum()),'events_pre':[],'events_final':[]}
    d['source_root_aligned_seam_cm']=cm(norm(src[-1]-src[-1,0]+src[0,0]-src[0]).max())
    d['export_root_aligned_seam_cm']=cm(norm(exp[-1]-exp[-1,0]+exp[0,0]-exp[0]).max())
    d['pre_final_max_change_cm']={k:cm(norm(pa[k]-fa[k]).max()*SCALE) for k in pa}
    for key in ('handLeft','handRight','elbowLeft','elbowRight','kneeLeft','kneeRight','head'):
        sname=SRC.get(key)
        source=sample_src[:,J[sname]] if sname else (sample_src[:,J['Head']]+sample_src[:,J['HeadEnd']])/2
        source=source-sample_src[:,J['Neck1']]
        d['events_pre'].append(maxevent(pa[key]-pa['neck'],source,times,key))
        d['events_final'].append(maxevent(fa[key]-fa['neck'],source,times,key))
    d['native_candidates']=[e for e in NATIVE[clip]['events'] if e['mapped_cm']>12 and e['source_scaled_cm']<8 and e['mapped_cm']>3*max(e['source_scaled_cm'],1)]
    source_steps={}
    for key,sname in SRC.items():
        q=src16[:,J[sname]]-src16[:,J['Neck1']]
        steps=norm(np.diff(q,axis=0))*R*SCALE
        source_steps[key]={'max_cm':cm(steps.max()),'frame_after':int(np.argmax(steps))+1}
    d['source_native_steps']=source_steps
    d['source_bone_length_range_cm']={}
    for side in ('Left','Right'):
        for a,b in (('Arm','ForeArm'),('ForeArm','Hand'),('Shin','Foot'),('Foot','ToeEnd')):
            l=norm(src16[:,J[side+a]]-src16[:,J[side+b]])
            d['source_bone_length_range_cm'][side+a+'-'+b]=cm(l.max()-l.min())
    d['head_relation']={}
    source_head=(sample_src[:,J['Head']]+sample_src[:,J['HeadEnd']])/2
    for side in ('Left','Right'):
        h=sample_src[:,J[side+'Hand']]; elbow=sample_src[:,J[side+'ForeArm']]
        palm=h+unit(h-elbow)*P['palm']
        touch=norm(palm-source_head)-SRC_HEAD_R<.04
        final_gap=norm(fa['hand'+side]-fa['head'])-P['headR']
        d['head_relation'][side]={'source_touch_samples':int(touch.sum()),
            'final_gap_when_source_touch_cm_max':cm(final_gap[touch].max()*SCALE) if touch.any() else None}
    details=sorted(d['events_final'],key=lambda e:e['delta_cm'],reverse=True)
    d['events_pre'].sort(key=lambda e:e['delta_cm'],reverse=True); d['events_final']=details
    detail[clip]=d
    if d['native_candidates']: candidates.append({'clip':clip,'events':d['native_candidates']})
    rows.append({'clip':clip,'source_frames':len(src),'runtime_samples':len(times),'runtime_dt_s':d['dt_s'],
                 'declared_loop':d['declared_loop'],'playback':d['playback'],'repeat_endpoint':repeat,
                 'source_max_bone_range_cm':max(d['source_bone_length_range_cm'].values()),
                 'native_mapping_candidate_count':len(d['native_candidates']),
                 'final_max_step_cm':details[0]['delta_cm'],'final_max_step_point':details[0]['point'],
                 'final_max_step_t':details[0]['t_after'],'final_source_step_cm':details[0]['comparison_cm'],
                 'max_final_pre_change_cm':max(d['pre_final_max_change_cm'].values())})
assert len(detail)==239 and set(detail)==set(DUMP)
(OUT/'human_runtime_metrics.json').write_text(json.dumps({'coverage':{'clips':len(detail),'native_source_frames':sum(r['source_frames'] for r in rows),
    'runtime_samples':sum(r['runtime_samples'] for r in rows),'interpretation':'Candidates require semantic and rendered verification.'},'clips':detail},indent=2),encoding='utf-8')
with (OUT/'human_runtime_scan.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
print('COVERAGE',len(rows),sum(r['source_frames'] for r in rows),'native source frames;',sum(r['runtime_samples'] for r in rows),'runtime samples')
print('NATIVE MAPPING CANDIDATES',len(candidates),[(c['clip'],len(c['events'])) for c in candidates])
