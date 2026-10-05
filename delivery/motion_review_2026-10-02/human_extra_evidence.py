"""Reusable extra evidence from existing source and parent-provided Godot records."""
import json
import numpy as np
from human_compare import OUT, REPO, INDEX, J, R, read, draw

dump=read(OUT/'human_dump.json')
draw('handstand',dump['handstand'],[0,40,80],'_support',(-.18,.90))
draw('vending_collect',dump['vending_collect'],list(range(75,81)),'_source_event')
findings={}
for cid, frames in [('handstand',[0]),('walk_backpack_straps',[7,8,9,10,11]),('fruit_weigh',[106,107,108,109,110,111]),('vending_collect',[97,98,99,100,101,102])]:
    raw=np.load(REPO/f'assets/animations/npz/{cid}/motion.npz')['posed_joints'][:,INDEX['soma77_index']]
    findings[cid]={}
    for i in frames:
        row={'source_frame':i,'source_time_s':i/30}
        for name in ('LeftHand','RightHand','LeftForeArm','RightForeArm'):
            row[name+'_height_m']=float(raw[i,J[name],1])
            if i>0:
                delta=(raw[i,J[name]]-raw[i,J['Neck1']])-(raw[i-1,J[name]]-raw[i-1,J['Neck1']])
                row[name+'_neck_relative_step_scaled_cm']=float(np.linalg.norm(delta)*R*3*100)
        findings[cid][str(i)]=row
(OUT/'human_extra_numbers.json').write_text(json.dumps(findings,indent=2),encoding='utf-8')
print(json.dumps(findings,indent=2))
