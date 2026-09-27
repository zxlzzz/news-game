"""Recheck rigid cane contact from delivered per-frame rotations; never edits NPZ.
Usage: python scripts/review_cane_contact.py <motion-folder>
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'scripts')
from review_cart_contact import map_adult
from audit_delivery_motions import measure
folder=Path(sys.argv[1])
with np.load(folder/'motion.npz') as a:p=a['posed_joints']
s,h,head,m=map_adult(p);hand=s[:,8,1]
support=json.loads((folder/'support.json').read_text())
q=np.array(support['rotation_xyzw']);v=np.array(support['tip_local_m']);xyz=q[:,:3];offset=v+2*np.cross(xyz,np.cross(xyz,v)+q[:,3,None]*v)
tip=hand+offset;mask=np.array(support['contact'],dtype=bool)
# Append another playback cycle to check the support interval crossing the seam.
delta=(p[-1,0]-p[0,0])*.25/.951*3
extended=np.concatenate([tip[:-1],tip[:-1]+delta]);extended_mask=np.tile(mask[:-1],2)
contact_indices=np.flatnonzero(extended_mask);runs=np.split(contact_indices,np.where(np.diff(contact_indices)>1)[0]+1)
slip=max(float(np.ptp(extended[r,2])) for r in runs if len(r))
report=dict(mapping=m,tip_length_max_error_m=float(np.abs(np.linalg.norm(offset,axis=1)-.82).max()),
    tip_contact_height_max_m=float(np.abs(tip[mask,1]).max()),tip_all_frames_min_y_m=float(tip[:,1].min()),
    contact_fore_aft_slip_max_m=slip,left_toe_contact_height_max_m=float(np.abs(s[mask,6,1,1]).max()),
    contact_frames=int(mask.sum()),full_frame_count=len(p),audit=measure(folder))
report['contact_pass']=bool(report['tip_contact_height_max_m']<=.02 and slip<=.03 and report['left_toe_contact_height_max_m']<=.02)
(folder/'contact_check.json').write_text(json.dumps(report,indent=2))
canvas=Image.new('RGB',(1680,750),'#f1f1ed');pen=ImageDraw.Draw(canvas)
pen.text((10,10),'walk_cane / right-hand cane (green) + adult mapping / front and side',fill='black')
for col,fi in enumerate(np.linspace(0,len(p)-1,7).round().astype(int)):
    for row,axis in enumerate([0,2]):
        cx,base=col*240+105,350+row*350
        def px(q):q=q-h[fi]*[1,0,1];return cx+q[axis]*150,base-q[1]*150
        pen.line((col*240,base,col*240+239,base),fill='#bbb')
        for si,(a,c) in enumerate(s[fi]):pen.line([px(a),px(c)],fill='#235da1' if 2<=si<7 else '#a73535' if si>=7 else '#171717',width=4)
        x,y=px(head[fi]);pen.ellipse((x-27,y-27,x+27,y+27),fill='#171717')
        pen.line([px(hand[fi]),px(tip[fi])],fill='#27824b',width=4);x,y=px(hand[fi]);pen.line((x-7,y,x+7,y),fill='#27824b',width=4)
        pen.text((col*240+8,40+row*350),f'frame {fi} / {"planted" if mask[fi] else "swing"}\ntip height {tip[fi,1]*100:.1f} cm',fill='black')
canvas.save(folder/'preview.png');print(json.dumps(report,indent=2))
