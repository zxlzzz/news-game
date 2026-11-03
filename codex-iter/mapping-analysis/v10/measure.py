"""Independent same-form measurements. No optimizer objectives or acceptance limits."""
import numpy as np
from sources import J,basis,head_basis,unit
def norm(x):return np.linalg.norm(x,axis=-1)
def distance_segment(p,a,b):
    v=b-a;t=np.clip(np.sum((p-a)*v,-1)/np.maximum(np.sum(v*v,-1),1e-12),0,1)
    return norm(p-a-t[...,None]*v)
def flex(a,b,c):
    u=b-a;v=c-b;return np.degrees(np.arctan2(norm(np.cross(u,v)),np.sum(u*v,-1)))
def measurements(s,q,fps,P,axes):
    n=len(s);L=P['lengths'];sr_leg=np.mean([norm(s[:,J[sd+'Shin']]-s[:,J[sd+'Leg']])+norm(s[:,J[sd+'Foot']]-s[:,J[sd+'Shin']]) for sd in ['Left','Right']],axis=0)
    sr_arm=np.mean([norm(s[:,J[sd+'ForeArm']]-s[:,J[sd+'Arm']])+norm(s[:,J[sd+'Hand']]-s[:,J[sd+'ForeArm']]) for sd in ['Left','Right']],axis=0)
    sr_head=norm(s[:,J['HeadEnd']]-s[:,J['Head']])/2;sc=(s[:,J['Head']]+s[:,J['HeadEnd']])/2
    sp=np.stack([(s[:,J[sd+'Hand']]+s[:,J[sd+'HandMiddle2']])/2 for sd in ['Left','Right']],1)
    tp=q[:,[5,10]];out={}
    def compare(name,src,dst,description):
        out[name]=dict(source=np.asarray(src).tolist(),target=np.asarray(dst).tolist(),difference=np.asarray(dst-src).tolist(),measurement=description)
    for sd,root,k,e,sh,el,wr in [('Left',0,6,7,'LeftLeg','LeftShin','LeftFoot'),('Right',0,11,12,'RightLeg','RightShin','RightFoot'),('Left',1,4,5,'LeftArm','LeftForeArm','LeftHand'),('Right',1,9,10,'RightArm','RightForeArm','RightHand')]:
        end=s[:,J[wr]]
        compare(sh,flex(s[:,J[sh]],s[:,J[el]],end),flex(q[:,root],q[:,k],q[:,e]),'degrees between true anatomical shoulder->elbow->wrist or hip->knee->ankle directions; no pelvis-centre or palm proxy')
    compare('foot_ground',s[:,[J['LeftFoot'],J['LeftToeEnd'],J['RightFoot'],J['RightToeEnd']],1]/sr_leg[:,None],(q[:,[7,8,12,13],1]-P['line_radius'])/(L['thigh']+L['shin']),'endpoint centre height above inferred floor (target subtracts stroke radius), divided by leg length')
    compare('pelvis_ground',s[:,J['Hips'],1]/sr_leg,q[:,0,1]/(L['thigh']+L['shin']),'pelvis centre height / leg length; no observed chair surface')
    compare('hand_ground',sp[:,:,1]/sr_leg[:,None],(tp[:,:,1]-P['line_radius'])/(L['thigh']+L['shin']),'hand representative height above inferred plane, subtract target stroke radius; divide by leg length')
    compare('knee_ground',s[:,[J['LeftShin'],J['RightShin']],1]/sr_leg[:,None],(q[:,[6,11],1]-P['line_radius'])/(L['thigh']+L['shin']),'knee height above inferred plane, subtract target stroke radius; divide by leg length')
    compare('hand_pair',norm(sp[:,0]-sp[:,1])/sr_arm,norm(tp[:,0]-tp[:,1])/(L['upper_arm']+L['forearm']),'distance between palm centres / arm length')
    for j,sd in enumerate(['Left','Right']):
        compare(sd+'_hand_head',norm(sp[:,j]-sc)/sr_head,norm(tp[:,j]-q[:,3])/L['head_radius'],'palm-to-head-centre distance / head radius (same formula, not a skin-contact assertion)')
        sa=s[:,J['RightArm' if j==0 else 'LeftArm']];sb=s[:,J['RightForeArm' if j==0 else 'LeftForeArm']];te=q[:,9 if j==0 else 4]
        compare(sd+'_hand_other_arm',distance_segment(sp[:,j],sa,sb)/sr_arm,distance_segment(tp[:,j],q[:,1],te)/(L['upper_arm']+L['forearm']),'palm-to-opposite-upper-arm segment distance / arm length')
        compare(sd+'_hand_thigh',distance_segment(sp[:,j],s[:,J[sd+'Leg']],s[:,J[sd+'Shin']])/sr_leg,distance_segment(tp[:,j],q[:,0],q[:,6 if j==0 else 11])/(L['thigh']+L['shin']),'palm-to-own-thigh segment distance / leg length')
        compare(sd+'_hand_torso',distance_segment(sp[:,j],s[:,J['Hips']],s[:,J['Neck1']])/norm(s[:,J['Neck1']]-s[:,J['Hips']]),distance_segment(tp[:,j],q[:,0],q[:,1])/norm(q[:,1]-q[:,0]),'palm-to-torso segment distance / torso length')
    src_motion=np.concatenate([sp/sr_arm[:,None,None],s[:,[J['LeftFoot'],J['RightFoot']]]/sr_leg[:,None,None]],1)
    dst_motion=np.concatenate([tp/(L['upper_arm']+L['forearm']),q[:,[7,12]]/(L['thigh']+L['shin'])],1)
    compare('endpoint_speed',norm(np.diff(src_motion,axis=0))*fps,norm(np.diff(dst_motion,axis=0))*fps,'normalized endpoint travel per second; entry i is transition i -> i+1')
    score=np.max(np.abs(norm(np.diff(dst_motion,n=2,axis=0))-norm(np.diff(src_motion,n=2,axis=0))),axis=-1)
    out['inspect_acceleration_frames']=(np.argsort(score)[-5:]+1).tolist() if n>2 else []
    return out

if __name__=='__main__':
    import json
    from sources import HERE,read
    P=read(HERE/'params.json')
    for row in read(HERE/'manifest.json')['clips']:
        folder=HERE/'clips'/row['id'];z=np.load(folder/'comparison.npz')
        result=measurements(z['source'],z['target'],float(z['fps']),P,z['head_axes'])
        (folder/'relations.json').write_text(json.dumps(result,separators=(',',':')),'utf-8')
    print('Same-form relational measurements updated; no acceptance thresholds.')
