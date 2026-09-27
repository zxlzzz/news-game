"""Offline adult-mapping stair contact check and preview; never changes motion data.

Usage: python scripts/review_stairs_contact.py <folder>
Requires support.json describing the staircase and each foot's settled/transition/swing
frames. Phase labels must describe this clip's actual landing schedule; do not inherit
onset frames from a rejected generation. Record any phase revision in support.json.
Reports vertical movement, posture and contact error; penetration covers every frame.
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from review_cart_contact import map_adult
from review_godot_motion import ROOT

def review(folder):
 cfg=json.loads((folder/'support.json').read_text(encoding='utf-8-sig'))
 meta=json.loads((folder/'meta.json').read_text(encoding='utf-8-sig'))
 p=np.load(folder/'motion.npz',allow_pickle=False)['posed_joints'];n=len(p);fps=meta['fps']
 segments,hips,heads,mapping=map_adult(p)
 k=(mapping['params']['thigh']+mapping['params']['shin'])/.951*mapping['body_scale']
 # Stair origin is explicit in mapped clip coordinates; never fit height to a candidate.
 origin=np.array(cfg['stair_origin_in_clip_m']);segments-=origin;hips-=origin;heads-=origin
 depth=cfg['step_depth_m'];height=cfg['step_height_m'];intercept=cfg['surface_intercept_m']
 def tread(q):return np.floor(q[...,2]/depth).astype(int)
 def surface(q):return intercept-tread(q)*height
 joints=np.concatenate([segments.reshape(n,-1,3),hips[:,None],heads[:,None]],axis=1)
 clear=joints[...,1]-surface(joints)
 report=dict(mapping=mapping,frames=n,stair=cfg,npz_sha256=hashlib.sha256((folder/'motion.npz').read_bytes()).hexdigest(),
  all_joint_surface_min_m=float(clear.min()),penetration_frames=np.flatnonzero(clear.min(axis=1)<-.02).tolist(),feet={})
 rest=np.load(ROOT/'assets/animations/npz/stand_idle/motion.npz')['posed_joints'][0:1]
 restsegments,*_=map_adult(rest)
 for side,idx in [('left',6),('right',11)]:
  ankle=segments[:,idx,0];toe=segments[:,idx,1];offset=float(restsegments[0,idx,0,1]-restsegments[0,idx,1,1])
  heel=ankle-[0,offset,0];phases=np.array(cfg['feet'][side]['phases']);target=np.array(cfg['feet'][side]['tread_indices'])
  target_height=intercept-target*height;te=toe[:,1]-target_height;he=heel[:,1]-target_height
  foot=dict(virtual_heel_offset_m=offset,phases={},toe_y_m=toe[:,1].tolist(),heel_y_m=heel[:,1].tolist(),
   ankle_z_m=ankle[:,2].tolist(),toe_z_m=toe[:,2].tolist())
  for phase,limit in [('settled',.02),('transition',.04)]:
   frames=np.flatnonzero(phases==phase);errors=abs(te[frames]);bad=errors>limit
   if phase=='settled':bad|=(abs(he[frames])>.02)|(abs(te[frames]-he[frames])>.02)|(tread(toe[frames])!=target[frames])|(tread(heel[frames])!=target[frames])
   adjacent=frames[np.isin(frames+1,frames)]
   foot['phases'][phase]=dict(frames=frames.tolist(),toe_error_max_m=float(errors.max()) if len(frames) else None,
    heel_error_max_m=float(abs(he[frames]).max()) if len(frames) else None,
    heel_toe_height_difference_max_m=float(abs(te[frames]-he[frames]).max()) if len(frames) else None,
    toe_error_range_m=[float(te[frames].min()),float(te[frames].max())] if len(frames) else [],
    heel_error_range_m=[float(he[frames].min()),float(he[frames].max())] if len(frames) else [],
    same_target_tread=bool(np.all((tread(toe[frames])==target[frames])&(tread(heel[frames])==target[frames]))),
    max_toe_vertical_step_m=float(np.abs(np.diff(toe[:,1]))[adjacent].max()) if len(adjacent) else None,
    failed_frames=frames[bad].tolist())
  report['feet'][side]=foot
 # Posture is measured on the same adult mapping as contact, not the source rig.
 # A landing is the first frame within 2 cm of the next tread after the swing;
 # inspect across the loop seam using the known complete XYZ displacement.
 knee_angles={}
 landings=[]
 for side,idx in [('left',4),('right',9)]:
  thigh=segments[:,idx,1]-segments[:,idx,0];shin=segments[:,idx+1,1]-segments[:,idx+1,0]
  cosine=np.sum(thigh*shin,axis=1)/(np.linalg.norm(thigh,axis=1)*np.linalg.norm(shin,axis=1))
  angles=np.degrees(np.arccos(np.clip(cosine,-1,1)));knee_angles[side]=angles
  foot=report['feet'][side];toe=np.array(foot['toe_y_m']);target=np.array(cfg['feet'][side]['tread_indices'])
  phases=np.array(cfg['feet'][side]['phases']);error=toe-(intercept-target*height)
  cycle=n-1
  # Arm a new contact only after an airborne phase. Starting the traversal in
  # mid-swing makes seam-spanning landings identical to interior landings.
  swing=np.flatnonzero(phases[:cycle]=='swing')
  if not len(swing):raise ValueError(f'{side}: no swing phase; cannot identify landings')
  armed=False
  for t in range(int(swing[0]),int(swing[0])+cycle):
   f=t%cycle
   if phases[f]=='swing':armed=True
   elif armed and abs(error[f])<=.02:
    landings.append(dict(side=side,frame=f,knee_flexion_deg=float(angles[f]),toe_error_m=float(error[f])))
    armed=False
 straightest=np.minimum(knee_angles['left'][:n-1],knee_angles['right'][:n-1])
 median=float(np.median(straightest))
 posture_pass=len(landings)==2 and all(x['knee_flexion_deg']<=25 for x in landings) and median<=30
 report['posture']=dict(definition='0 degrees = straight; actual mapped thigh/shin vectors',
  landing_definition='First non-swing frame within 2 cm of target tread after swing, evaluated cyclically; duplicate endpoint excluded',
  landing_limit_deg=25,landings=sorted(landings,key=lambda x:x['frame']),
  straighter_leg_median_deg=median,straighter_leg_median_limit_deg=30,
  knee_flexion_deg={s:a.tolist() for s,a in knee_angles.items()},passed=posture_pass)
 report['passed']=posture_pass and not report['penetration_frames'] and all(not ph['failed_frames'] for f in report['feet'].values() for ph in f['phases'].values())
 (folder/'contact_check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 # Static sheet and a repeated-cycle side view, with the measured virtual heels.
 def draw_frame(frame,shift=np.zeros(3),size=(720,640)):
  im=Image.new('RGB',size,'#f1f0eb');d=ImageDraw.Draw(im);scale=size[1]*.35
  center=hips[frame]+shift
  def xy(q):return (size[0]*.45+(q[2]-center[2])*scale,size[1]*.60-(q[1]-center[1]+.1)*scale)
  first=int(np.floor((center[2]-2)/depth));last=int(np.ceil((center[2]+2)/depth))
  for stair in range(first,last):
   h=intercept-stair*height
   a=xy(np.array([0,h,stair*depth]));b=xy(np.array([0,h,(stair+1)*depth]));c=xy(np.array([0,h-height,(stair+1)*depth]))
   d.line([a,b,c],fill='#8b8a83',width=3)
  for i,seg in enumerate(segments[frame]+shift):
   col='#2774ac' if i in [4,5,6] else '#b64c42' if i in [9,10,11] else '#252525'
   d.line([xy(seg[0]),xy(seg[1])],fill=col,width=6)
  x,y=xy(heads[frame]+shift);r=mapping['params']['headR']*mapping['body_scale']*scale
  d.ellipse([x-r,y-r,x+r,y+r],fill='#252525')
  for side,idx in [('left',6),('right',11)]:
   off=report['feet'][side]['virtual_heel_offset_m'];h=segments[frame,idx,0]+shift-[0,off,0];x,y=xy(h)
   d.ellipse([x-3,y-3,x+3,y+3],outline='#137b39',width=2)
  d.text((10,10),f"Frame {frame}/{n-1} | {frame/fps:.2f}s",fill='#222222')
  d.text((10,28),'Blue L / Red R / Green heel',fill='#222222')
  d.text((10,46),f"L: {cfg['feet']['left']['phases'][frame]}   R: {cfg['feet']['right']['phases'][frame]}",fill='#222222')
  d.text((10,64),f"Knee L {knee_angles['left'][frame]:.1f} deg / R {knee_angles['right'][frame]:.1f} deg",fill='#222222')
  return im
 frames=np.linspace(0,n-1,8).round().astype(int);sheet=Image.new('RGB',(1440,640),'white')
 for i,f in enumerate(frames):sheet.paste(draw_frame(f,size=(360,320)),((i%4)*360,(i//4)*320))
 sheet.save(folder/'preview.png')
 # Consecutive foot close-ups expose the airborne/contact phase boundary.
 detail=Image.new('RGB',(7*300,len(landings)*300),'white')
 for row,landing in enumerate(sorted(landings,key=lambda x:x['frame'])):
  side=landing['side'];idx=6 if side=='left' else 11
  start=max(0,min(landing['frame']-3,n-7))
  for col,f in enumerate(range(start,min(start+7,n))):
   tile=Image.new('RGB',(300,300),'#f1f0eb');d=ImageDraw.Draw(tile)
   ankle,toe=segments[f,idx];target=cfg['feet'][side]['tread_indices'][landing['frame']];h=intercept-target*height
   def foot_xy(q):return (150+(q[2]-toe[2])*520,235-(q[1]-h)*520)
   for stair in range(target-2,target+3):
    y=intercept-stair*height
    d.line([foot_xy([0,y,stair*depth]),foot_xy([0,y,(stair+1)*depth]),foot_xy([0,y-height,(stair+1)*depth])],fill='#8b8a83',width=3)
   for seg in segments[f,idx-1:idx+1]:d.line([foot_xy(seg[0]),foot_xy(seg[1])],fill='#2774ac' if side=='left' else '#b64c42',width=5)
   heel=ankle-[0,report['feet'][side]['virtual_heel_offset_m'],0];x,y=foot_xy(heel)
   d.ellipse([x-4,y-4,x+4,y+4],outline='#137b39',width=2)
   d.text((10,10),f"{side} frame {f}: {cfg['feet'][side]['phases'][f]}",fill='#222222')
   d.text((10,30),f"Toe above target: {(toe[1]-h)*1000:.1f} mm",fill='#222222')
   d.text((10,50),f"Knee: {knee_angles[side][f]:.1f} deg",fill='#222222')
   detail.paste(tile,(col*300,row*300))
 detail.save(folder/'landing_detail.png')
 gif=[draw_frame(f) for f in range(0,n-1,2)]
 gif[0].save(folder/'review.gif',save_all=True,append_images=gif[1:],duration=round(2000/fps),loop=0)
 print(json.dumps(dict(passed=report['passed'],penetration=report['all_joint_surface_min_m'],
  landings=report['posture']['landings'],straighter_leg_median_deg=median,
  feet={s:f['phases'] for s,f in report['feet'].items()})))
 return report

if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('folder',type=Path);args=ap.parse_args();result=review(args.folder)
 raise SystemExit(0 if result['passed'] else 1)
