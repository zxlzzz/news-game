"""Source NPZ vs actual Godot pre/final at the exact runtime sample phases.
All diagrams use the actor's figure coordinates, not raw source world positions.
The NPZ transform repeats ClipPose's root progress removal and facing alignment.
"""
import json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
OUT=Path(__file__).parent; REPO=OUT.parent.parent; G=REPO/'godot/npc'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
INDEX=read(G/'motion/index.json'); J={n:i for i,n in enumerate(INDEX['names'])}; P=read(G/'skeleton-params.json')
R=(P['thigh']+P['shin'])/(.528+.423)
CFG=read(G/'interactions.json')['clips']
EDGES=[('Hips','Neck1'),('Neck1','Head'),('Head','HeadEnd')]
for sd in ('Left','Right'): EDGES.extend([('Neck1',sd+'Arm'),(sd+'Arm',sd+'ForeArm'),(sd+'ForeArm',sd+'Hand'),('Hips',sd+'Shin'),(sd+'Shin',sd+'Foot'),(sd+'Foot',sd+'ToeEnd')])
def unit(a): return a/max(np.linalg.norm(a),1e-12)
def source_frames(cid,people):
    export=np.array(read(G/f'motion/{cid}.json')['frames'])
    raw=np.load(REPO/f'assets/animations/npz/{cid}/motion.npz')['posed_joints'][:,INDEX['soma77_index']]
    chains=np.max(np.linalg.norm(export[-1]-export[-1,0]+export[0,0]-export[0],axis=1))<=.001
    count=len(export)-int(chains); origin=export[0,0]
    travel=(export[min(count,len(export)-1),0]-origin)*R; travel[1]=0
    drift=travel.copy(); fixed=CFG.get(cid,{}).get('stationary',False)
    if np.linalg.norm(travel)>=.05 and not fixed:
        angle=-np.arctan2(travel[0],travel[2])
    else:
        travel=np.zeros(3); up=unit(export[0,J['Neck1']]-origin)
        lateral=export[0,J['LeftArm']]-export[0,J['RightArm']]; lateral=unit(lateral-up*np.dot(lateral,up))
        fwd=np.cross(lateral,up); angle=-np.arctan2(fwd[0],fwd[2])
    c,s=np.cos(angle),np.sin(angle); turn=np.array([[c,0,s],[0,1,0],[-s,0,c]])
    transformed=raw.copy()*R; transformed[:,:,0]-=origin[0]*R; transformed[:,:,2]-=origin[2]*R
    progress=(drift if fixed else travel)[None,:]*(np.arange(len(raw))/count)[:,None]
    transformed-=progress[:,None,:]; transformed=transformed@turn.T
    result=[]
    for person in people:
        phase=person['phase']
        if CFG.get(cid,{}).get('playback')=='once':phase=min(phase,(count-1)/count)
        x=(phase%1)*count; i=int(np.floor(x)); j=(i+1)%len(transformed)
        result.append(transformed[i]*(1-(x-i))+transformed[j]*(x-i))
    return result
def proj(a,view): return (-a[...,0],a[...,1]) if view=='front' else (a[...,2],a[...,1])
def figdraw(ax,segs,head,view,color):
    for a,b in segs: ax.plot(*proj(np.array([a,b]),view),color=color,lw=2.2,solid_capstyle='round')
    x,y=proj(np.array(head),view);ax.add_patch(plt.Circle((x,y),P['headR'],color=color))
def draw(cid,record,indices,suffix='',ylim=(-.05,.72)):
    frames=[record['frames'][i] for i in indices]
    people=[next(p for p in f['people'] if p['main']) for f in frames]
    src=source_frames(cid,people)
    fig,axes=plt.subplots(6,len(frames),figsize=(2*len(frames),10),squeeze=False)
    for v,view in enumerate(('front','side')):
        for i,(f,p,source) in enumerate(zip(frames,people,src)):
            for st in range(3):
                ax=axes[v*3+st,i];ax.set_aspect('equal');ax.axhline(0,color='#aaa',lw=.6)
                ax.set_xlim(-.35,.35);ax.set_ylim(*ylim);ax.axis('off')
                if st==0:
                    for a,b in EDGES:ax.plot(*proj(source[[J[a],J[b]]],view),color='#258b45',lw=1.8)
                    h=(source[J['Head']]+source[J['HeadEnd']])/2;x,y=proj(h,view)
                    ax.add_patch(plt.Circle((x,y),.1*R,fill=False,color='#258b45'))
                else:
                    q=p['pre' if st==1 else 'final'];figdraw(ax,q['segs'],q['head'],view,'#777' if st==1 else 'black')
                if i==0:ax.text(-.35,.68,['source NPZ','Godot pre','Godot final'][st]+' / '+view,fontsize=8)
                if st==0:ax.set_title(f"t={f['t']:.4f}s phase={p['phase']:.3f}",fontsize=8)
    fig.suptitle(cid,fontsize=13);fig.tight_layout()
    target=OUT/f'{cid}_source_pre_final{suffix}.png';fig.savefig(target,dpi=130);plt.close(fig);return str(target)
if __name__=='__main__':
    dump=read(Path(sys.argv[1]) if len(sys.argv)>1 else OUT/'human_dump.json')
    ids=sys.argv[2:] or ['duck_cover','scratch_head','shadow_box','wave_overhead','walk_backpack_straps','elder_assisted_walk','phone_urgent','fruit_weigh']
    metrics=read(OUT/'human_runtime_metrics.json')['clips']
    for cid in ids:
        event=metrics[cid]['events_pre'][0]; mid=event['sample_after']
        picks=sorted(set(max(0,min(len(dump[cid]['frames'])-1,mid+j)) for j in (-2,-1,0,1,2)))
        print(draw(cid,dump[cid],picks))
