"""Independent GLB checks. Run with Python 3 + numpy; does not use Blender/report.
Usage: python verify_husky.py [animal_husky.glb]
"""
import json, struct, sys, hashlib
from pathlib import Path
import numpy as np

EXPECTED={'Attack':37,'Death':33,'Eating':81,'Gallop':18,'Gallop_Jump':29,
          'Idle':101,'Idle_2':101,'Idle_2_HeadLow':121,'Idle_HitReact_Left':21,
          'Idle_HitReact_Right':21,'Jump_ToIdle':41,'Walk':33}

class GLB:
 def __init__(self,path):
  self.raw=Path(path).read_bytes();magic,version,length=struct.unpack_from('<III',self.raw)
  assert magic==0x46546c67 and version==2 and length==len(self.raw)
  size,kind=struct.unpack_from('<II',self.raw,12);assert kind==0x4e4f534a
  self.d=json.loads(self.raw[20:20+size]);size2,kind2=struct.unpack_from('<II',self.raw,20+size)
  assert kind2==0x004e4942;self.binary=self.raw[28+size:28+size+size2]
  self.parents={c:i for i,n in enumerate(self.d['nodes']) for c in n.get('children',[])};self.world={}
 def accessor(self,i):
  a=self.d['accessors'][i];v=self.d['bufferViews'][a['bufferView']]
  dtype={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
  width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype(dtype)
  x=np.ndarray((a['count'],width),dtype=dt,buffer=self.binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*width),dt.itemsize)).copy()
  if a.get('normalized'):x=x.astype(float)/np.iinfo(dt).max
  return x
 def matrix(self,i):
  if i in self.world:return self.world[i]
  n=self.d['nodes'][i]
  if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
  else:
   x,y,z,w=n.get('rotation',[0,0,0,1]);q=np.array([x,y,z,w]);x,y,z,w=q/np.linalg.norm(q)
   m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
  if i in self.parents:m=self.matrix(self.parents[i])@m
  self.world[i]=m;return m

def verify(path,profile):
 global EXPECTED
 EXPECTED=profile["actions"]
 g=GLB(path);d=g.d;nodes=d['nodes'];skin=d['skins'][0];joints=skin['joints'];byname={n['name']:i for i,n in enumerate(nodes)}
 assert len(d['skins'])==1 and len(joints)==profile["bone_count"]
 assert not any(n['name'].startswith(('IK','PoleTarget')) for n in nodes)
 maxscale=max(max(abs(np.array(n.get('scale',[1,1,1]))-1)) for n in nodes)
 assert maxscale<2e-6
 bones=[];metaerror=0
 for i in joints:
  n=nodes[i];m=g.matrix(i);head=m[:3,3];tail=(m@np.array([0,n['extras']['length_m'],0,1]))[:3]
  metaerror=max(metaerror,float(np.max(np.abs(head-n['extras']['head_game_m']))),float(np.max(np.abs(tail-n['extras']['tail_game_m']))))
  parent=g.parents.get(i);bones.append({'name':n['name'],'parent':nodes[parent]['name'] if parent in joints else None,'head':head.tolist(),'tail':tail.tolist(),'length':float(np.linalg.norm(tail-head))})
 assert metaerror<5e-6
 for paw,last in profile['reparent'].items():assert g.parents[byname[paw]]==byname[last]
 assert len(d['meshes'])==1 and len(d['materials'])==1 and d['materials'][0]['name']=='animal_ink'
 assert d['materials'][0]['pbrMetallicRoughness']['baseColorFactor']==[0,0,0,1]
 assert not d.get('textures') and not d.get('images')
 primitive=d['meshes'][0]['primitives'];assert len(primitive)==1;p=primitive[0];a=p['attributes']
 assert not any(k.startswith(('COLOR','TEXCOORD')) for k in a)
 assert 'WEIGHTS_1' not in a and 'JOINTS_1' not in a
 positions=g.accessor(a['POSITION']);weights=g.accessor(a['WEIGHTS_0']);indices=g.accessor(a['JOINTS_0']).astype(int)
 assert np.all(weights>=0) and np.max(np.abs(weights.sum(axis=1)-1))<2e-6
 assert np.all((weights>0).sum(axis=1)>=1) and np.all((weights>0).sum(axis=1)<=4)
 assert indices.min()>=0 and indices.max()<len(joints)
 meshnode=next(i for i,n in enumerate(nodes) if 'mesh' in n);M=g.matrix(meshnode)
 pos=(M@np.c_[positions,np.ones(len(positions))].T).T[:,:3]
 invbind=g.accessor(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 binderror=max(float(np.max(np.abs(g.matrix(j)@ib-M))) for j,ib in zip(joints,invbind));assert binderror<5e-6
 feet={}
 pawpos=np.array([g.matrix(byname[n])[:3,3] for n in profile['paws']])
 nearest=np.argmin(np.linalg.norm(pos[:,None,[0,2]]-pawpos[None,:,[0,2]],axis=2),axis=1)
 for j,leg in enumerate(['LF','RF','LH','RH']):
  feet[leg]=float(pos[nearest==j,1].min());assert abs(feet[leg])<1e-5,(leg,feet[leg])
 shoulder=np.mean([g.matrix(byname[n])[:3,3] for n in profile['front_roots']],axis=0)
 assert max(abs(shoulder[[0,2]]))<5e-6
 tris=g.accessor(p['indices']).reshape(-1,3).astype(int);heights=[]
 # Vertical ray through front shoulder midpoint, intersect actual exported triangles.
 for tri in pos[tris]:
  mat=np.column_stack([tri[1,[0,2]]-tri[0,[0,2]],tri[2,[0,2]]-tri[0,[0,2]]])
  if abs(np.linalg.det(mat))<1e-12:continue
  uv=np.linalg.solve(mat,-tri[0,[0,2]])
  if min(uv)>=-1e-7 and uv.sum()<=1+1e-7:heights.append(float(tri[0,1]+uv[0]*(tri[1,1]-tri[0,1])+uv[1]*(tri[2,1]-tri[0,1])))
 shoulderheight=max(heights);assert abs(shoulderheight-profile["shoulder_height"])<1e-5
 animations=[]
 for animation in d['animations']:
  times=np.unique(np.concatenate([g.accessor(s['input']).ravel() for s in animation['samplers']]))
  assert len(times)==EXPECTED[animation['name']]
  assert np.max(np.abs(np.diff(times)-1/profile["fps"]))<1e-5
  assert all(c['target']['node'] in joints for c in animation['channels'])
  for channel in animation['channels']:
   values=g.accessor(animation['samplers'][channel['sampler']]['output'])
   if channel['target']['path']=='scale':assert np.all(values==1)
   if channel['target']['path']=='rotation':assert np.max(np.abs(np.linalg.norm(values,axis=1)-1))<2e-6
  animations.append({'name':animation['name'],'frames':len(times),'fps':profile['fps'],'duration_s':float(times[-1]-times[0]),'channels':len(animation['channels'])})
 assert {a['name'] for a in animations}==set(EXPECTED)
 lo=pos.min(axis=0);hi=pos.max(axis=0)
 result={'status':'PASS','sha256':hashlib.sha256(g.raw).hexdigest(),'node_count':len(nodes),'skin_bones':len(joints),'max_static_scale_deviation':float(maxscale),'bone_metadata_max_error_m':metaerror,'inverse_bind_max_error':binderror,'export_vertices':len(pos),'unique_positions':len(np.unique(positions,axis=0)),'triangles':len(tris),'unbound_vertices':0,'max_influences':int((weights>0).sum(axis=1).max()),'weight_sum_max_error':float(np.max(np.abs(weights.sum(axis=1)-1))),'materials':['animal_ink'],'foot_floor_y_m':feet,'bounds_min':lo.tolist(),'bounds_max':hi.tolist(),'width_m':float(hi[0]-lo[0]),'full_length_m':float(hi[2]-lo[2]),'total_height_m':float(hi[1]-lo[1]),'shoulder_height_m':shoulderheight,'shoulder_to_hip_m':float(abs(shoulder[2]-np.mean([g.matrix(byname[n])[2,3] for n in profile['hind_roots']]))),'bones':bones,'animations':animations}
 Path(path).with_name('verify_report.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps(result,indent=2));return result

