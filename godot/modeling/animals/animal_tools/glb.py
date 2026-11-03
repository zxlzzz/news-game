import json,struct
from pathlib import Path
import numpy as np

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

