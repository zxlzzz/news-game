"""Read source data only; never execute an old mapper or change source samples."""
import json, hashlib
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
def read(p): return json.loads(Path(p).read_text('utf-8-sig'))
INDEX=read(HERE/'reference.json')
NAMES=INDEX['names']; J={k:i for i,k in enumerate(NAMES)}
REST=np.asarray(INDEX['neutral_source_frame'])
def unit(v): return v/np.maximum(np.linalg.norm(v,axis=-1,keepdims=True),1e-9)
def basis(s):
    y=unit(s[:,J['Neck1']]-s[:,J['Hips']]); x=s[:,J['LeftArm']]-s[:,J['RightArm']]
    x=unit(x-y*np.sum(x*y,axis=-1,keepdims=True)); return np.stack([x,y,np.cross(x,y)],-1)
def head_basis(s):
    y=unit(s[:,J['HeadEnd']]-s[:,J['Head']]); x=s[:,J['LeftEye']]-s[:,J['RightEye']]
    x=unit(x-y*np.sum(x*y,axis=-1,keepdims=True));return np.stack([x,y,np.cross(x,y)],-1)
def adapted(d):
    native=np.asarray(d['frames'],float)[:,:,0]; ids={k:i for i,k in enumerate(d['names'])};s=np.zeros((len(native),len(J),3))
    remap=dict(Hips='Hips',Neck1='Neck',Head='Head',HeadEnd='HeadTop_End',Spine1='Spine',Spine2='Spine1',Chest='Spine2')
    for sd in ['Left','Right']:
        remap.update({sd+'Arm':sd+'Arm',sd+'ForeArm':sd+'ForeArm',sd+'Hand':sd+'Hand',sd+'HandMiddle2':sd+'HandMiddle2',sd+'Leg':sd+'UpLeg',sd+'Shin':sd+'Leg',sd+'Foot':sd+'Foot',sd+'ToeEnd':sd+'Toe_End'})
    for k,v in remap.items():s[:,J[k]]=native[:,ids[v]]
    ref=head_basis(REST[None])[0]; length=np.linalg.norm(REST[J['HeadEnd']]-REST[J['Head']])
    up=unit(s[:,J['HeadEnd']]-s[:,J['Head']]);lat=s[:,J['LeftArm']]-s[:,J['RightArm']];lat=unit(lat-up*np.sum(lat*up,-1,keepdims=True))
    B=np.stack([lat,up,np.cross(lat,up)],-1);ratio=np.linalg.norm(s[:,J['HeadEnd']]-s[:,J['Head']],axis=-1)/length
    for k in ['LeftEye','RightEye','Jaw']:s[:,J[k]]=s[:,J['Head']]+np.einsum('nij,j->ni',B,ref.T@(REST[J[k]]-REST[J['Head']]))*ratio[:,None]
    return s

KIMODO=['stand_idle','walk','run','jog','pick_up','bow','sit_down','sit_bench','sit_ground','squat','squat_down','squat_watch','hands_on_head','scratch_head','rub_eye','cover_face','cross_arms','hands_on_hips','hands_in_pockets','handshake_offer','handshake_reply','rub_hands','phone_call','phone_urgent','point','look_down','look_up','stand_up','stand_up_support_back','kneel_hold','lean_railing','wipe_sweat','cheer','hands_up']
EXTRA=['cover_ears','cover_eyes','clap','point_forward','wipe_sweat_forearm']
MIXAMO=['ng_idle_offensive','ng_jog_fwd','ng_juggle_kick_L','ng_penalty_kick','ng_scissor_kick']
def cases():
    out=[]
    for k in KIMODO:out.append(dict(id=k,kind='Kimodo NPZ',path=ROOT/'assets/animations/npz'/k/'motion.npz'))
    old=read(HERE.parent/'manifest.json')['cases'];paths={r['id']:Path(r['source']) for r in old}
    for k in EXTRA:out.append(dict(id=k,kind='Kimodo source JSON',path=paths[k]))
    for k in MIXAMO:out.append(dict(id=k,kind='Mixamo FBX frames',path=HERE.parent/'v9/_raw'/f'{k}.json'))
    local=Path('C:/Users/Hsinlung/bones-seed-local')
    if (local/'metadata/selection-local.json').exists():
        selection=read(local/'metadata/selection-local.json')
        for label,prefix in [('seed_jog','jog_ff_loop'),('seed_pickup','neutral_item_pick_up'),('seed_lunge','forward_lunge_R_001__A361')]:
            key=next(k for k in selection if k.startswith(prefix));out.append(dict(id=label,kind='BONES-SEED BVH',path=local/selection[key]['metadata']['move_soma_uniform_path']))
    return out
def load(c):
    p=c['path'];kind=c['kind']; meta={}
    if kind=='Kimodo NPZ':
        meta=read(p.parent/'meta.json');s=np.load(p)['posed_joints'][:,INDEX['soma77_index']].astype(float);fps=float(meta['fps'])
    elif kind=='BONES-SEED BVH':
        from bvh_source import bvh
        s,meta,_=bvh(p);fps=meta['playback_fps']
    else:
        meta=read(p);s=adapted(meta) if kind.startswith('Mixamo') else np.asarray(meta['frames'],float);fps=float(meta['fps'])
    assert s.shape[1:]==(26,3) and np.isfinite(s).all(),p
    # A single rigid transform preserves all relative source geometry and source ground offset.
    origin=s[0,J['Hips']].copy();origin[1]=0;F=basis(s)[0];yaw=np.arctan2(F[0,2],F[2,2]);co,si=np.cos(yaw),np.sin(yaw);R=np.array([[co,0,-si],[0,1,0],[si,0,co]])
    s=(s-origin)@R.T
    return s,fps,dict(id=c['id'],kind=kind,path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),frames=len(s),fps=fps,face_landmarks='reference proxies (no observed face joints)' if kind.startswith('Mixamo') else 'source joints',text=meta.get('text',''),source_transform=dict(origin=origin.tolist(),rotation=R.tolist()))
