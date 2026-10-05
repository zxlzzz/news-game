"""Analyze every exported pose, preserving separate mapped/final measurements.

Flags are a review queue, not acceptance decisions. Units in reports are metres.
"""
import json
import sys
from pathlib import Path
import numpy as np


def segment_distance(a, b, c, d):
    u, v, w = b-a, d-c, a-c
    aa=(u*u).sum(-1); bb=(u*v).sum(-1); cc=(v*v).sum(-1)
    dd=(u*w).sum(-1); ee=(v*w).sum(-1)
    den=aa*cc-bb*bb
    s=np.divide(bb*ee-cc*dd,den,out=np.zeros_like(den),where=den>1e-12)
    t=np.divide(aa*ee-bb*dd,den,out=np.zeros_like(den),where=den>1e-12)
    inside=(s>=0)&(s<=1)&(t>=0)&(t<=1)&(den>1e-12)
    best=np.where(inside,np.linalg.norm(w+s[...,None]*u-t[...,None]*v,axis=-1),np.inf)
    for q,x,y in [(a,c,d),(b,c,d),(c,a,b),(d,a,b)]:
        z=y-x; n=(z*z).sum(-1)
        r=np.clip(np.divide(((q-x)*z).sum(-1),n,out=np.zeros_like(n),where=n>1e-12),0,1)
        best=np.minimum(best,np.linalg.norm(q-x-r[...,None]*z,axis=-1))
    return best


def measure(p, times):
    seg=p[:,:72].reshape(-1,12,2,3); head=p[:,72:75]
    metrics={}
    a=seg[:,[3,8],0]; b=seg[:,[3,8],1]; h=head[:,None,:]
    z=b-a; n=(z*z).sum(-1)
    w=np.clip(((h-a)*z).sum(-1)/np.maximum(n,1e-12),0,1)
    gap=np.linalg.norm(h-a-w[...,None]*z,axis=-1)-.0775
    worst=gap.min(-1); i=int(worst.argmin())
    metrics['head']={'min_gap_m':float(worst[i]*3),'time_s':float(times[i]),'frames_overlap_10mm':int((worst*3<-.01).sum()),'side':int(gap[i].argmin())}
    lengths=np.linalg.norm(seg[:,:,1]-seg[:,:,0],axis=-1)
    expected=np.array([.18,.015,.096,.124,.12,.13,.05,.096,.124,.12,.13,.05])
    rel=lengths/expected-1
    metrics['lengths']={str(j):{'min_ratio':float((rel[:,j]+1).min()),'max_ratio':float((rel[:,j]+1).max())} for j in [2,3,4,5,7,8,9,10]}
    dt=np.diff(times); vel=np.linalg.norm(np.diff(seg,axis=0),axis=-1)*3/dt[:,None,None]
    metrics['jumps']={}
    for name,j in [('left_elbow',2),('right_elbow',7),('left_knee',4),('right_knee',9),('left_wrist',3),('right_wrist',8)]:
        v=vel[:,j,1];i=int(v.argmax());metrics['jumps'][name]={'max_speed_m_s':float(v[i]),'time_s':[float(times[i]),float(times[i+1])],'step_m':float(v[i]*dt[i])}
    legs=segment_distance(seg[:,5,0],seg[:,5,1],seg[:,10,0],seg[:,10,1])*3-.105
    i=int(legs.argmin());metrics['shins']={'min_gap_m':float(legs[i]),'time_s':float(times[i]),'frames_overlap_10mm':int((legs<-.01).sum())}
    torso=seg[:,0]; gaps=[]
    for j in [3,8]:gaps.append(segment_distance(seg[:,j,0],seg[:,j,1],torso[:,0],torso[:,1])*3-(.0175+.020125)*3)
    gaps=np.minimum(*gaps);i=int(gaps.argmin());metrics['torso']={'min_gap_m':float(gaps[i]),'time_s':float(times[i]),'frames_overlap_20mm':int((gaps<-.02).sum())}
    frozen=np.linalg.norm(np.diff(p,axis=0).reshape(-1,28,3),axis=-1).max(-1)*3<.00001
    longest=run=0.
    for k,state in enumerate(frozen):
        run=run+dt[k] if state else 0.;longest=max(longest,run)
    metrics['frozen']={'intervals':int(frozen.sum()),'longest_s':float(longest)}
    return metrics


def main():
    folder=Path(sys.argv[1]); index=json.loads((folder/'index.json').read_text());result=[]
    for entry in index:
        times=np.array(entry['times']);n=len(entry['persons']);data=np.fromfile(folder/(entry['id']+'.bin'),dtype='<f4').reshape(len(times),n,180).astype(float)
        row={'id':entry['id'],'cycle':entry['cycle'],'frames':len(times),'people':[]}
        for j,person in enumerate(entry['persons']):
            row['people'].append(dict(id=person['id'],base=person['base'],manual=person['manual'],mapped=measure(data[:,j,:84],times),final=measure(data[:,j,84:168],times)))
        result.append(row)
    (folder.parent/'complete_metrics.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print('Entries',len(result),'timeline points',sum(x['frames'] for x in result))
    for key in ['head','torso','shins']:
        flagged=[x for x in result if any(p['final'][key]['min_gap_m']<(-.01 if key!='torso' else -.02) for p in x['people'])]
        print(key,len(flagged),','.join(x['id'] for x in flagged))
    shortened=[x['id'] for x in result if any(v['min_ratio']<.95 for p in x['people'] for v in p['final']['lengths'].values())]
    print('limb shortened >5%',len(shortened),','.join(shortened))
    sudden=[x['id'] for x in result if any(v['max_speed_m_s']>6 for p in x['people'] for v in p['final']['jumps'].values())]
    print('joint speed >6m/s review queue',len(sudden),','.join(sudden))


if __name__=='__main__':main()
