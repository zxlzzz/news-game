"""Read-only source and accepted-stick-mapping review for Kimodo candidates.

python scripts/review_godot_motion.py <candidate dir> --prop none|bench|chess|counter --hands
Uses the existing JS mapper unchanged; does not export to the game or mutate motion data.
"""
import argparse
import ast
import json
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
DEFINITIONS=Path('C:/kimodo-trial/kimodo/kimodo/skeleton/definitions.py')


def hierarchy():
    tree=ast.parse(DEFINITIONS.read_text(encoding='utf-8'))
    cls=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='SOMASkeleton77')
    entry=next(n for n in cls.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='bone_order_names_with_parents' for t in n.targets))
    return ast.literal_eval(entry.value)


def review(folder,prop='none',hands=False,frame_indices=None,animate=False):
    tree=hierarchy(); names=[n for n,_ in tree]; idx={n:i for i,n in enumerate(names)}
    p=np.load(folder/'motion.npz',allow_pickle=False)['posed_joints']
    meta=json.loads((folder/'meta.json').read_text(encoding='utf-8-sig'))
    rest=np.load(ROOT/'assets/animations/npz/stand_idle/motion.npz',allow_pickle=False)['posed_joints'][0]
    payload=dict(names=names,rest=rest.tolist(),frames=p.tolist(),params=json.loads((ROOT/'godot/npc/skeleton-params.json').read_text()))
    module=(ROOT/'sth/motion-study/skeleton-mapping.mjs').as_uri()
    program="""import fs from 'node:fs';
import {createSkeletonMapper} from %s;
const d=JSON.parse(fs.readFileSync(0,'utf8')); const m=createSkeletonMapper(d.names,d.rest);
const origin=[d.frames[0][0][0],0,d.frames[0][0][2]];
console.log(JSON.stringify(d.frames.map(f=>m(f,d.params,origin))));"""%json.dumps(module)
    mapped=json.loads(subprocess.run(['node','--input-type=module','-e',program],input=json.dumps(payload),text=True,capture_output=True,check=True).stdout)
    origin=np.array([p[0,0,0],0,p[0,0,2]])
    def point(v): return (np.array(v)-origin)*3
    hips=np.array([point(f['H']) for f in mapped])
    lhand=np.array([point(f['segs'][3][1]) for f in mapped])
    rhand=np.array([point(f['segs'][8][1]) for f in mapped])
    feet=np.array([[point(f['segs'][6][1]),point(f['segs'][11][1])] for f in mapped])
    relative=p-p[:,0:1,:]*[1,0,1]
    delta=relative[-1]-relative[0]
    metrics=dict(frames=len(p),fps=meta['fps'],source_root_delta_m=(p[-1,0]-p[0,0]).tolist(),
        mapped_hip_y_minmax=[float(hips[:,1].min()),float(hips[:,1].max())],
        mapped_toe_y_minmax=[float(feet[:,:,1].min()),float(feet[:,:,1].max())],
        mapped_left_hand_y_minmax=[float(lhand[:,1].min()),float(lhand[:,1].max())],
        mapped_right_hand_y_minmax=[float(rhand[:,1].min()),float(rhand[:,1].max())],
        endpoint_root_aligned_max_joint_m=float(np.linalg.norm(delta,axis=-1).max()),
        endpoint_root_aligned_mean_joint_m=float(np.linalg.norm(delta,axis=-1).mean()))
    velocity=np.diff(p,axis=0)*meta['fps']
    metrics['root_velocity_start_mps']=velocity[0,0].tolist()
    metrics['root_velocity_end_mps']=velocity[-1,0].tolist()
    metrics['seam_velocity_max_joint_delta_mps']=float(np.linalg.norm(velocity[0]-velocity[-1],axis=-1).max())
    metrics['root_forward_step_min_m']=float(np.diff(p[:,0,2]).min())
    metrics['max_joint_step_m']=float(np.linalg.norm(np.diff(p,axis=0),axis=-1).max())
    width,height=1680,1140 if hands else 820
    im=Image.new('RGB',(width,height),'#f1f1ed'); draw=ImageDraw.Draw(im)
    draw.text((12,8),folder.name+' / accepted mapping x3 / props in metres / source full skeleton below',fill='black')
    frames=np.array(frame_indices) if frame_indices is not None else np.linspace(0,len(p)-1,7).round().astype(int)
    if len(frames)!=7 or min(frames)<0 or max(frames)>=len(p):
        raise ValueError('Review requires seven valid frame indices')
    metrics['sampled_contacts']=[dict(frame=int(i),hip=hips[i].tolist(),
        left_hand=lhand[i].tolist(),right_hand=rhand[i].tolist(),toes=feet[i].tolist(),
        source_right_hand=p[i,idx['RightHand']].tolist()) for i in frames]
    def rectangle(cx,base,axis,lo,hi,color):
        draw.rectangle((cx+lo[axis]*125,base-hi[1]*125,cx+hi[axis]*125,base-lo[1]*125),fill=color,outline='#999999',width=1)
    for col,fi in enumerate(frames):
        f=mapped[fi]; cx=120+col*240
        for row,axis in enumerate((0,2)):
            base=285+row*275
            draw.text((col*240+8,40+row*275),f'{fi/meta["fps"]:.2f}s '+('front' if axis==0 else 'side'),fill='black')
            if prop in ('bench','chess'):
                rectangle(cx,base,axis,[-.9,.375,-.22],[.9,.45,.22],'#c7c7c7')
                if prop=='bench': rectangle(cx,base,axis,[-.9,.57,-.258],[.9,.95,-.188],'#d0d0d0')
            if prop=='chess': rectangle(cx,base,axis,[-.425,.68,.415],[.425,.75,1.265],'#c7c7c7')
            if prop=='counter': rectangle(cx,base,axis,[-1.35,.8,.415],[1.35,.9,1.065],'#c7c7c7')
            follow=hips[fi]*[1,0,1] if prop=='none' else np.zeros(3)
            def pixel(v):
                q=point(v)-follow
                return (cx+q[axis]*125,base-q[1]*125)
            draw.line((col*240,base,col*240+240,base),fill='#bbbbbb')
            for si,(a,b,_) in enumerate(f['segs']):
                color='#235da1' if 2<=si<7 else '#a73535' if si>=7 else '#171717'
                draw.line([pixel(a),pixel(b)],fill=color,width=4)
            x,y=pixel(f['head']); rr=22.5
            draw.ellipse((x-rr,y-rr,x+rr,y+rr),fill='#171717')
        # Source skeleton side view follows the source hips; includes all fingers.
        q=p[fi]-p[fi,0]*[1,0,1]
        for name,parent in tree:
            if not parent: continue
            a,b=q[idx[name]],q[idx[parent]]
            draw.line([(cx+a[2]*90,800-a[1]*90),(cx+b[2]*90,800-b[1]*90)],fill='#a73535' if name.startswith('Right') else '#235da1',width=2)
        if hands:
            mid=(p[fi,idx['LeftHand']]+p[fi,idx['RightHand']])/2
            q=p[fi]-mid
            draw.text((col*240+8,835),'hands / top view',fill='black')
            hand_ids=[idx[n] for n,_ in tree if 'Hand' in n]
            extent=np.abs(q[hand_ids]).max(axis=0)
            hand_scale=min(380,108/max(extent[0],.001),125/max(extent[2],.001))
            for name,parent in tree:
                if not parent or 'Hand' not in name: continue
                a,b=q[idx[name]],q[idx[parent]]
                draw.line([(cx+a[0]*hand_scale,990-a[2]*hand_scale),(cx+b[0]*hand_scale,990-b[2]*hand_scale)],fill='#a73535' if name.startswith('Right') else '#235da1',width=2)
    suffix='_focus' if frame_indices is not None else ''
    im.save(folder.parent/(folder.name+'_mapped'+suffix+'.png'))
    if animate:
        # Read-only data preview: follow the hips; omit the duplicate endpoint.
        animation=[]
        for fi,f in enumerate(mapped[:-1]):
            canvas=Image.new('RGB',(640,420),'#f1f1ed'); pen=ImageDraw.Draw(canvas)
            pen.text((12,10),folder.name+' / mapping preview / front + side',fill='black')
            for axis,cx in [(0,160),(2,480)]:
                follow=hips[fi]*[1,0,1]
                def px(v):
                    q=point(v)-follow
                    return cx+q[axis]*170,370-q[1]*170
                pen.line((cx-155,370,cx+155,370),fill='#bbbbbb')
                for si,(a,b,_) in enumerate(f['segs']):
                    pen.line([px(a),px(b)],fill='#235da1' if 2<=si<7 else '#a73535' if si>=7 else '#171717',width=5)
                x,y=px(f['head']); radius=30.6
                pen.ellipse((x-radius,y-radius,x+radius,y+radius),fill='#171717')
            animation.append(canvas)
        durations=[round((i+1)*100/meta['fps'])*10-round(i*100/meta['fps'])*10 for i in range(len(animation))]
        animation[0].save(folder.parent/(folder.name+'_mapped.gif'),save_all=True,append_images=animation[1:],duration=durations,loop=0)
    (folder.parent/(folder.name+'_mapped'+suffix+'_metrics.json')).write_text(json.dumps(metrics,indent=2))
    print(json.dumps(metrics))


if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('folder',type=Path); ap.add_argument('--prop',default='none',choices=['none','bench','chess','counter']); ap.add_argument('--hands',action='store_true')
    ap.add_argument('--frames',nargs=7,type=int)
    ap.add_argument('--animate',action='store_true')
    args=ap.parse_args(); review(args.folder,args.prop,args.hands,args.frames,args.animate)
