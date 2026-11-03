import os
os.environ['PYTHONDONTWRITEBYTECODE']='1'
import argparse,json,time
import numpy as np
from sources import HERE,read,cases,load,J
from mapper import map_motion,LIMBS
from measure import measurements
def flex(a,b,c):
    u=b-a;v=c-b
    return np.degrees(np.arctan2(np.linalg.norm(np.cross(u,v),axis=-1),np.sum(u*v,-1)))
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--only',nargs='*');a=ap.parse_args();P=read(HERE/'params.json');out=[]
    for c in cases():
        if a.only and c['id'] not in a.only:continue
        start=time.monotonic();s,fps,info=load(c);q,diag,r=map_motion(s,fps,P);folder=HERE/'clips'/c['id'];folder.mkdir(parents=True,exist_ok=True)
        # Display both on the same inferred plane; source samples only receive a rigid translation.
        display=s.copy();display[:,:,1]-=diag['source_floor']
        np.savez_compressed(folder/'comparison.npz',source=display,target=q,base=r['base'],fps=fps,head_axes=r['HF'])
        checks=measurements(display,q,fps,P,r['HF'])
        (folder/'relations.json').write_text(json.dumps(checks,separators=(',',':')),'utf-8')
        info.update(diag);info['seconds']=round(time.monotonic()-start,2);out.append(info)
        (folder/'source-info.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),'utf-8')
        print('MAPPED',c['id'],len(s),info['seconds'],'floor',round(diag['source_floor'],4),'loss',round(diag['final_loss'],3),flush=True)
    old=read(HERE/'manifest.json')['clips'] if (HERE/'manifest.json').exists() else [];byid={x['id']:x for x in old};byid.update({x['id']:x for x in out})
    (HERE/'manifest.json').write_text(json.dumps(dict(clips=list(byid.values()),params=P),ensure_ascii=False,indent=2),'utf-8')
if __name__=='__main__':main()
