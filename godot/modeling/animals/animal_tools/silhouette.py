"""Authorized silhouette adjustment: broaden limbs without altering bones/topology/weights."""
import json
from pathlib import Path
import numpy as np

SETTINGS={
 'cat':{'leg_width':1.85,'paw_width':1.45,'upper_width':1.25},
 'husky':{'leg_width':1.35,'paw_width':1.20,'upper_width':1.16},
 'shibainu':{'leg_width':1.40,'paw_width':1.22,'upper_width':1.18},
}
def apply(obj,rig,species,out):
 cfg=SETTINGS[species]
 if species=='cat':chains=[['Bone.017','Bone.018','Bone.019'],['Bone.014','Bone.015','Bone.016'],['Bone.008','Bone.009','Bone.010'],['Bone.011','Bone.012','Bone.013']]
 else:chains=[[a+'.'+side for a in names] for names in [['FrontUpperLeg','FrontLowerLeg','FF'],['BackLeg','BackUpperLeg','BackLowerLeg','FFB']] for side in ['L','R']]
 positions=np.array([v.co[:] for v in obj.data.vertices]);result=positions.copy();groups={g.index:g.name for g in obj.vertex_groups}
 for i,v in enumerate(obj.data.vertices):
  weights={groups[g.group]:g.weight for g in v.groups};scores=[sum(weights.get(n,0) for n in chain) for chain in chains];j=int(np.argmax(scores));weight=scores[j]
  if weight<.02:continue
  chain=chains[j];points=np.array([rig.data.bones[n].head_local[:] for n in chain]+[rig.data.bones[chain[-1]].tail_local[:]])
  # The centreline follows the existing joint bends. Keep the vertical coordinate unchanged.
  candidates=[]
  for a,b in zip(points,points[1:]):
   d=b-a;t=np.clip(np.dot(positions[i]-a,d)/np.dot(d,d),0,1);q=a+t*d;candidates.append((np.linalg.norm(positions[i]-q),q))
  center=min(candidates,key=lambda pair:pair[0])[1];hip=points[0,2];height=positions[i,2]/hip
  fade=np.clip((1.05-height)/.40,0,1);fade=fade*fade*(3-2*fade)
  foot_zone=np.clip((points[-2,2]+hip*.10-positions[i,2])/(hip*.10),0,1)
  upper=np.clip((height-.45)/.45,0,1);factor=cfg['leg_width']*(1-upper)+cfg['upper_width']*upper;factor=factor*(1-foot_zone)+cfg['paw_width']*foot_zone
  amount=(factor-1)*min(weight,1)*fade
  result[i,:2]=positions[i,:2]+(positions[i,:2]-center[:2])*amount
 for v,co in zip(obj.data.vertices,result):v.co=co
 obj.data.update();delta=np.linalg.norm(result-positions,axis=1)
 report={'authorization':'2026-09-28 user approved fuller cat and dog silhouettes','settings':cfg,'modified_vertices':int((delta>1e-8).sum()),'max_vertex_offset_m':float(delta.max()),'topology_bones_weights_unchanged':True,'vertical_coordinates_unchanged':True}
 (Path(out)/'silhouette_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');return report
