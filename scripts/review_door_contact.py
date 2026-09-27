"""Check a delivered door motion against support.json and render its fixed door.
Usage: python scripts/review_door_contact.py <motion-folder>
Coordinates use the accepted adult mapping; NPZ is never modified.
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
sys.path.insert(0,'scripts')
from review_cart_contact import map_adult
folder=Path(sys.argv[1]);name=folder.name;sup=json.loads((folder/'support.json').read_text());p=np.load(folder/'motion.npz')['posed_joints'];s,h,heads,m=map_adult(p)
angles=np.deg2rad(sup['door_angle_deg']);hinge=np.array(sup['hinge_m']);u=np.stack([-np.cos(angles),np.zeros(len(p)),np.sin(angles)],1);n=np.stack([-np.sin(angles),np.zeros(len(p)),-np.cos(angles)],1)
if name.startswith('pull'):u=-u
points=np.concatenate([s.reshape(len(p),-1,3),heads[:,None]],axis=1);q=points-hinge;along=np.einsum('tni,ti->tn',q,u);normal=np.einsum('tni,ti->tn',q,n);inside=(along>=0)&(along<=1)&(points[:,:,1]>=0)&(points[:,:,1]<=2.2);bad=inside&(abs(normal)<.05)
frames=sup['contact'];hand=8 if sup['hand']=='Right' else 3;err=np.linalg.norm(s[frames,hand,1]-np.array(sup['handle_world_m'])[frames],axis=1)
# Clip each line to the finite door rectangle, then measure exact minimum
# distance to its midplane. Endpoints alone miss a forearm crossing the leaf.
line_min=float('inf');line_bad=[]
for f in range(len(p)):
 for seg in s[f]:
  a,b=seg-hinge;du=np.array([a@u[f],b@u[f]]);yy=seg[:,1];nn=np.array([a@n[f],b@n[f]]);lo,hi=0.,1.
  for values,lower,upper in [(du,0.,1.),(yy,0.,2.2)]:
   v,dv=values[0],values[1]-values[0]
   if abs(dv)<1e-12:
    if not lower<=v<=upper:hi=-1.;break
   else:
    t0,t1=sorted([(lower-v)/dv,(upper-v)/dv]);lo=max(lo,t0);hi=min(hi,t1)
  if lo>hi:continue
  v0=nn[0]+lo*(nn[1]-nn[0]);v1=nn[0]+hi*(nn[1]-nn[0]);dist=0. if v0*v1<=0 else min(abs(v0),abs(v1));line_min=min(line_min,dist)
  if dist<.025:line_bad.append(f)

r=dict(name=name,mapping=m,hand_error_max_m=float(err.max()),hand_bad_frames=[int(frames[i]) for i in np.where(err>.05)[0]],door_clearance_min_m=float(abs(normal)[inside].min()),door_bad_frames=np.where(bad.any(axis=1))[0].tolist(),hips_end=h[-1].tolist(),bone_plane_clearance_min_m=line_min,bone_slab_crossing_frames=sorted(set(line_bad)),contact_pass=bool(err.max()<=.05 and not bad.any() and not line_bad));(folder/'contact_check.json').write_text(json.dumps(r,indent=2));print(json.dumps({k:v for k,v in r.items() if k!='mapping'}))
im=Image.new('RGB',(1680,730),'#f1f1ed');d=ImageDraw.Draw(im);d.text((10,5),name+' / fixed door frame / front + top',fill='black')
for col,f in enumerate([0,30,50,70,90,115,len(p)-1]):
 for row in range(2):
  cx=col*240+140;cy=335 if row==0 else 650
  def px(v):return (cx+v[0]*80,cy-(v[1] if row==0 else v[2])*80)
  d.text((col*240+5,30+row*360),f'frame {f} / angle {np.rad2deg(angles[f]):.0f}',fill='black')
  edge=hinge+u[f]
  if row==0:
   d.line([px(hinge),px(hinge+[0,2.2,0]),px(edge+[0,2.2,0]),px(edge),px(hinge)],fill='#9b8b74',width=4)
  else:d.line([px(hinge),px(edge)],fill='#9b8b74',width=7)
  for i,seg in enumerate(s[f]):d.line([px(seg[0]),px(seg[1])],fill='#245da1' if 2<=i<7 else '#a73535' if i>=7 else '#171717',width=3)
  x,y=px(heads[f]);rr=16 if row==0 else 6;d.ellipse((x-rr,y-rr,x+rr,y+rr),fill='#171717')
  x,y=px(np.array(sup['handle_world_m'])[f]);d.ellipse((x-3,y-3,x+3,y+3),fill='green')
im.save(folder/'preview.png')
