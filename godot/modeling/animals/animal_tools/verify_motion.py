"""Independent verification of the exported GLB, including actual skin deformation.
Python + numpy. Does not import the authoring solver or use Blender.
"""
import sys,json,hashlib,argparse
from pathlib import Path
import numpy as np
sys.dont_write_bytecode=True
HERE=None;MODEL=None;PROFILE=None
from glb import GLB

def matrices(t,q):
 q=q/np.linalg.norm(q,axis=-1,keepdims=True);x,y,z,w=[q[...,i] for i in range(4)]
 m=np.zeros((*q.shape[:-1],4,4));m[...,3,3]=1;m[...,:3,3]=t
 m[...,0,0]=1-2*(y*y+z*z);m[...,0,1]=2*(x*y-z*w);m[...,0,2]=2*(x*z+y*w)
 m[...,1,0]=2*(x*y+z*w);m[...,1,1]=1-2*(x*x+z*z);m[...,1,2]=2*(y*z-x*w)
 m[...,2,0]=2*(x*z-y*w);m[...,2,1]=2*(y*z+x*w);m[...,2,2]=1-2*(x*x+y*y)
 return m

def verify(path,profile,folder):
 global HERE,MODEL,PROFILE
 HERE=Path(folder);MODEL=Path(profile).parent;PROFILE=json.loads(Path(profile).read_text(encoding="utf-8"));count=len(PROFILE["actions"])
 g=GLB(path);source=GLB(MODEL/(PROFILE['name']+'.glb'));d=g.d
 for section in ['nodes','skins','meshes','materials']:assert d[section]==source.d[section],section+' changed'
 assert g.binary[:len(source.binary)]==source.binary,'Original mesh/weights/animation buffers changed'
 assert d['animations'][:count]==source.d['animations']
 assert all(n.get('scale',[1,1,1])==[1,1,1] for n in d['nodes'])
 config=json.loads((HERE/'motion_specs.json').read_text(encoding='utf-8'));specs={s['name']:s for s in config['clips']};plan=np.load(HERE/'contact_plan.npz')
 assert {a['name'] for a in d['animations'][count:]}==set(specs)
 joints=d['skins'][0]['joints'];parents=[joints.index(g.parents[i]) if g.parents.get(i) in joints else -1 for i in joints];names=[d['nodes'][i]['name'] for i in joints]
 ib=g.accessor(d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 attrs=d['meshes'][0]['primitives'][0]['attributes'];pos=g.accessor(attrs['POSITION']);points=np.c_[pos,np.ones(len(pos))];weights=g.accessor(attrs['WEIGHTS_0']);ji=g.accessor(attrs['JOINTS_0']).astype(int)
 soles={}
 pawpos=np.array([g.matrix(next(i for i,n in enumerate(d['nodes']) if n['name']==name))[:3,3] for name in PROFILE['paws']])
 nearest=np.argmin(np.linalg.norm(pos[:,None,[0,2]]-pawpos[None,:,[0,2]],axis=2),axis=1)
 for j,leg in enumerate(['LF','RF','LH','RH']):soles[leg]=np.where((nearest==j)&(pos[:,1]<.003))[0]
 result=[];endpoints={};relation_samples={}
 for a in d['animations'][count:]:
  spec=specs[a['name']];fps=spec.get('fps',config['fps']);times=g.accessor(a['samplers'][0]['input']).ravel();n=len(times);assert n==round(spec['seconds']*fps)+1
  assert np.max(abs(np.diff(times)-1/fps))<1e-5
  translation=np.tile(np.array([d['nodes'][i].get('translation',[0,0,0]) for i in joints]),(n,1,1));quaternion=np.tile(np.array([d['nodes'][i].get('rotation',[0,0,0,1]) for i in joints]),(n,1,1))
  for channel in a['channels']:
   target=channel['target'];sampler=a['samplers'][channel['sampler']];assert sampler['interpolation']=='LINEAR';assert np.array_equal(g.accessor(sampler['input']).ravel(),times)
   values=g.accessor(sampler['output']);assert np.isfinite(values).all();j=joints.index(target['node'])
   if target['path']=='translation':translation[:,j]=values
   elif target['path']=='rotation':quaternion[:,j]=values
   else:raise AssertionError('Unexpected transform channel')
  assert np.max(abs(np.linalg.norm(quaternion,axis=2)-1))<1e-6
  rest_lengths=np.linalg.norm(np.array([d['nodes'][i].get('translation',[0,0,0]) for i in joints]),axis=1)
  attached=np.array(parents)>=0;bone_error=float(np.max(abs(np.linalg.norm(translation[:,attached],axis=2)-rest_lengths[attached])))
  assert bone_error<2e-6,(a['name'],'bone length changed',bone_error)
  # Also evaluate halfway between baked keys, where playback uses TRS interpolation.
  keyframes=n;tt=np.empty((2*n-1,*translation.shape[1:]));qq=np.empty((2*n-1,*quaternion.shape[1:]));tt[::2]=translation;qq[::2]=quaternion;tt[1::2]=(translation[:-1]+translation[1:])/2
  midpoint=quaternion[:-1]+quaternion[1:];qq[1::2]=midpoint/np.linalg.norm(midpoint,axis=2,keepdims=True);translation,quaternion=tt,qq;n=len(tt)
  local=matrices(translation,quaternion);world=np.zeros_like(local);done=set()
  def fill(j):
   if j in done:return
   parent=parents[j]
   if parent>=0:fill(parent);world[:,j]=world[:,parent]@local[:,j]
   else:world[:,j]=g.matrix(g.parents[joints[j]])@local[:,j]
   done.add(j)
  for j in range(len(joints)):fill(j)
  assert np.max(abs(np.linalg.det(world[...,:3,:3])-1))<1e-6
  xyz=np.empty((n,len(pos),3))
  for start in range(0,n,8):
   deform=world[start:start+8]@ib;xyz[start:start+8]=np.einsum('fnkij,nj,nk->fni',deform[:,ji],points,weights)[...,:3]
  contact=np.array([[np.c_[xyz[:,ids,0].mean(axis=1),xyz[:,ids,1].min(axis=1),xyz[:,ids,2].mean(axis=1)]] for ids in soles.values()])[:,0].transpose(1,0,2)
  targets=plan[a['name']+'__targets'];flags=plan[a['name']+'__planted'].astype(bool);wanted=np.empty((n,4,3));wanted[::2]=targets;wanted[1::2]=(targets[:-1]+targets[1:])/2;mask=np.empty((n,4),bool);mask[::2]=flags;mask[1::2]=flags[:-1]&flags[1:];errors=np.linalg.norm(contact-wanted,axis=-1)
  planted_error=float(errors[mask].max()) if np.any(mask) else 0
  floor=float(xyz[:,:,1].min());step=float(np.linalg.norm(np.diff(xyz,axis=0),axis=2).max());gap=float(np.linalg.norm(xyz[-1]-xyz[0],axis=1).max())
  assert planted_error<.002,(a['name'],'planted paw error',planted_error)
  tracked_error=float(errors[::2].max())
  assert tracked_error<.002,(a['name'],'airborne paw trajectory',tracked_error)
  assert floor>-.002,(a['name'],'floor',floor)
  assert step<.10,(a['name'],'frame jump',step)
  if spec['loop']:assert gap<1e-6,(a['name'],'loop seam',gap)
  step60=float(np.linalg.norm(np.diff(xyz[::max(1,round(fps*2/60))],axis=0),axis=2).max())
  result.append({'name':a['name'],'frames':keyframes,'fps':fps,'evaluated_fps':fps*2,'evaluated_samples':n,'loop':spec['loop'],'bone_length_error_m':bone_error,'planted_paw_error_m':planted_error,'tracked_paw_keyframe_error_m':tracked_error,'floor_min_m':floor,'largest_vertex_step_at_60fps_m':step60,'first_last_vertex_difference_m':gap})
  endpoints[a['name']]=(xyz[0],xyz[-1]);relation_samples[a['name']]=xyz[np.round(np.array([.2,.5,.8])*(n-1)).astype(int)].copy();print('PASS',a['name'],keyframes,'keys /',n,'evaluated samples','contact_mm',round(planted_error*1000,3),'floor_mm',round(floor*1000,3),flush=True)
 pairs=[('Sit_Down','Sit_Idle'),('Sit_Idle','Sit_Get_Up'),('Sit_Get_Up','Stand_Breathe'),('Lie_Down','Lie_Idle'),('Lie_Idle','Lie_Get_Up'),('Lie_Get_Up','Stand_Breathe'),('Sniff_Ground_Enter','Sniff_Ground_Loop'),('Sniff_Ground_Loop','Sniff_Ground_Exit'),('Sleep_Enter','Sleep_Breathe'),('Sleep_Breathe','Sleep_Wake'),('Sleep_Wake','Lie_Idle'),('Side_Lie_Enter','Side_Lie_Breathe'),('Side_Lie_Breathe','Side_Lie_Exit'),('Side_Lie_Exit','Lie_Idle'),('Sit_To_Lie','Lie_Idle'),('Lie_To_Sit','Sit_Idle')]
 boundaries=[]
 pairs += [('Threat_Arch_Enter','Threat_Arch'),('Threat_Arch','Threat_Arch_Exit'),('Threat_Arch_Exit','Stand_Breathe')]
 for start,end in pairs:
  if 'NG_'+start not in endpoints or 'NG_'+end not in endpoints:continue
  error=float(np.linalg.norm(endpoints['NG_'+start][1]-endpoints['NG_'+end][0],axis=1).max());assert error<.001,(start,end,error);boundaries.append({'from':'NG_'+start,'to':'NG_'+end,'max_vertex_gap_m':error})
 relations=[]
 # These pairs have different purposes. A copied motion at a different duration
 # can pass contact and seam checks while silently bypassing its authored pose.
 for left,right in [('NG_Play_Bow','NG_Stretch_Front'),('NG_Lie_Idle','NG_Sleep_Breathe')]:
  if left not in relation_samples or right not in relation_samples:continue
  delta=np.linalg.norm(relation_samples[left]-relation_samples[right],axis=-1);largest=float(delta.max())
  assert largest>.001,(left,right,'indistinguishable normalized-phase skin poses',largest)
  relations.append({'left':left,'right':right,'normalized_phases':[.2,.5,.8],'largest_vertex_difference_m':largest,'rms_vertex_difference_m':float(np.sqrt(np.mean(delta**2)))})
 output={'status':'PASS','source_static_data_and_original_clips_unchanged':True,'new_clips':len(result),'total_clips':len(d['animations']),'sha256':hashlib.sha256(g.raw).hexdigest(),'clips':result,'transition_boundaries':boundaries,'distinct_motion_relations':relations}
 (HERE/'verify_report.json').write_text(json.dumps(output,indent=2),encoding='utf-8');print('MOTION_LIBRARY_OK',len(result));return output

