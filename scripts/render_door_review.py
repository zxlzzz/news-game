"""Offline door review animation, with fixed cameras and measured adult hip speed.
Usage: python scripts/render_door_review.py <folder>
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from review_cart_contact import map_adult
folder=Path(sys.argv[1]);p=np.load(folder/'motion.npz')['posed_joints'];meta=json.loads((folder/'meta.json').read_text(encoding='utf-8-sig'));sup=json.loads((folder/'support.json').read_text(encoding='utf-8-sig'));s,h,head,m=map_adult(p);fps=meta['fps'];speed=np.r_[0,np.linalg.norm(np.diff(h[:,[0,2]],axis=0),axis=1)*fps];angles=np.deg2rad(sup['door_angle_deg']);hinge=np.array(sup['hinge_m']);is_pull=sup.get('action','pull' if folder.name.startswith('pull') else 'push')=='pull';u=np.stack([np.cos(angles),np.zeros(len(p)),-np.sin(angles)],1)*(1 if is_pull else -1)
zmin=min(float(s[:,:,:,2].min()),-.4)-.2;zmax=max(float(s[:,:,:,2].max()),1.5)+.2;scale=min(145.,380/(zmax-zmin));xmin=min(float(s[:,:,:,0].min()),-.6)-.2;xmax=max(float(s[:,:,:,0].max()),.6)+.2;top_scale=min(140.,360/(zmax-zmin),390/(xmax-xmin));colors=['#171717']*2+['#245da1']*5+['#a73535']*5;frames=[]
for f in range(len(p)):
 im=Image.new('RGB',(900,460),'#f1f1ed');d=ImageDraw.Draw(im);d.line((450,0,450,460),fill='#ccc');d.text((10,8),f'{folder.name}  frame {f}/{len(p)-1}  {f/fps:.2f}s',fill='black');d.text((10,25),f'door {np.rad2deg(angles[f]):.1f} deg / hip speed {speed[f]:.2f} m/s (game)',fill='black');d.text((470,8),'top view / up = initial forward',fill='black')
 for row in range(2):
  def px(v):return (35+(v[2]-zmin)*scale,410-v[1]*145) if row==0 else (475+(v[0]-xmin)*top_scale,430-(v[2]-zmin)*top_scale)
  edge=hinge+u[f]
  if row==0:
   d.line((10,410,440,410),fill='#bbb');d.line([px(hinge),px(hinge+[0,2.2,0]),px(edge+[0,2.2,0]),px(edge),px(hinge)],fill='#9b8b74',width=4)
  else:
   d.line([px(hinge),px(edge)],fill='#9b8b74',width=6)
   # Door frame and a short trail reveal route shape without following the body.
   d.line([px(hinge),px(hinge+[-.45,0,0])],fill='#777',width=3);d.line([px(hinge+[1.1,0,0]),px(hinge+[1.55,0,0])],fill='#777',width=3)
   if f>1:d.line([px(v) for v in h[max(0,f-65):f+1]],fill='#b5b5b5',width=1)
  for i,seg in enumerate(s[f]):d.line([px(seg[0]),px(seg[1])],fill=colors[i],width=4)
  x,y=px(head[f]);r=m['params']['headR']*m['body_scale']*(145 if row==0 else top_scale);d.ellipse((x-r,y-r,x+r,y+r),fill='#171717')
  x,y=px(np.array(sup['handle_world_m'])[f]);d.ellipse((x-3,y-3,x+3,y+3),fill='#27824b')
 frames.append(im)
durations=[round((i+1)*100/fps)*10-round(i*100/fps)*10 for i in range(len(frames))];frames[0].save(folder/'review.gif',save_all=True,append_images=frames[1:],duration=durations,loop=0)
selected=np.linspace(0,len(frames)-1,12).round().astype(int);sheet=Image.new('RGB',(1350,920),'white')
for i,f in enumerate(selected):q=frames[f].resize((450,230));sheet.paste(q,((i%3)*450,(i//3)*230))
sheet.save(folder/'sequence.png')
print('REVIEW_GIF',len(frames),'frames',sum(durations)/1000,'seconds')
