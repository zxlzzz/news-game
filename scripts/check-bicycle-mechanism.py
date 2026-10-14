"""Sweep upright bicycle moving components against fixed meshes at 24 crank phases.

This checks the existing wheel/crank rotations and counter-level pedals only.
Intentional chain/gear mating faces are excluded; rider and visual quality are outside scope.
Usage: python -B scripts/check-bicycle-mechanism.py <bicycle.glb> --output <report.json>
"""
from pathlib import Path
import argparse
import hashlib
import json,importlib.util,numpy as np
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('model',type=Path,help='Upright bicycle GLB with the existing wheel/crank/pedal nodes')
parser.add_argument('--output',required=True,type=Path,help='JSON result path; its parent directory must exist')
args=parser.parse_args()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
model=module('model_check',ROOT/'godot/modeling/check_model.py');c=module('intersections',ROOT/'scripts/check-model-intersections.py')
doc,data=model.read_glb(args.model)
base=[]
def walk(index,parent,path='',motion=None):
 node=doc['nodes'][index];name=node['name'];motion=name if name in ('wheel_front','wheel_rear','crank_set') else motion
 local=np.array(model.node_matrix(node)).reshape(4,4,order='F');world=parent@local;path=path+'/'+name
 if 'mesh' in node:
  for surface,prim in enumerate(doc['meshes'][node['mesh']]['primitives']):
   verts=np.array(model.accessor(doc,data,prim['attributes']['POSITION']));indices=np.array(model.accessor(doc,data,prim['indices']),dtype=np.int32)
   points=verts@world[:3,:3].T+world[:3,3];slot=doc['materials'][prim['material']]['name']
   base.append((index,path,motion,verts,indices,slot,points,surface))
 for child in node.get('children',[]):walk(child,world,path,motion)
for idx in doc['scenes'][doc.get('scene',0)]['nodes']:walk(idx,np.eye(4))
def part(record,points):
 index,name,motion,verts,indices,slot,_,surface=record
 blob=np.asarray(points,dtype='<f4').tobytes()+np.asarray(indices,dtype='<i4').tobytes()
 return c.Part(dict(name=name,slot=slot,surface=surface,offset=0,vertices=len(points),indices=len(indices)),blob)
fixed=[part(r,r[6]) for r in base if r[2] is None]
parents={j:i for i,n in enumerate(doc['nodes']) for j in n.get('children',[])}
def rot(a):
 co,si=np.cos(a),np.sin(a);return np.array([[1,0,0,0],[0,co,-si,0],[0,si,co,0],[0,0,0,1]])
def worlds(angle):
 result={}
 def world(index):
  if index in result:return result[index]
  n=doc['nodes'][index];local=np.array(model.node_matrix(n)).reshape(4,4,order='F')
  if n['name'] in ('wheel_front','wheel_rear','crank_set'):local=local@rot(angle)
  elif n['name'] in ('pedal_left','pedal_right'):local=local@rot(-angle)
  result[index]=(world(parents[index]) if index in parents else np.eye(4))@local;return result[index]
 for i in range(len(doc['nodes'])):world(i)
 return result
checks=0;failed=[]
for deg in range(0,360,15):
 ws=worlds(np.deg2rad(deg));moving=[]
 for r in base:
  if r[2] is None:continue
  w=ws[r[0]];pts=r[3]@w[:3,:3].T+w[:3,3];moving.append(part(r,pts))
 for left in moving:
  for right in fixed:
   if right.name.rsplit('/',1)[-1]=='chain' and left.name.rsplit('/',1)[-1] in ('chainring','rear_sprocket'):continue
   checks+=1;hit=c.pair(left,right)
   if hit:failed.append(dict(degrees=deg,left=left.name,right=right.name,hit=hit))
 print('BICYCLE_MECHANISM_PHASE',deg,'failures',len(failed),flush=True)
report={'model':str(args.model.resolve()),'actual_glb_sha256':hashlib.sha256(args.model.read_bytes()).hexdigest(),'inputs_sha256':{str(path.relative_to(ROOT)):hashlib.sha256(path.read_bytes()).hexdigest() for path in [Path(__file__).resolve(),ROOT/'godot/modeling/check_model.py',ROOT/'scripts/check-model-intersections.py']},'phases':list(range(0,360,15)),'checked_pairs':checks,'failures':failed,'scope':'Upright bicycle GLB moving-versus-fixed mesh intersections at the existing wheel/crank and counter-level pedal axes. Driven chain/gear mating faces excluded; rider and visual quality not included.'}
args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
assert not failed,json.dumps(failed[:10],indent=2)
print('BICYCLE_MECHANISM_SWEEP_OK',len(report['phases']),'phases;',checks,'pairs',flush=True)
