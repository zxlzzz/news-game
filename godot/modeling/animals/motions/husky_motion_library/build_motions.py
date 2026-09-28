"""Author and bake Husky clips. Blender background; source GLB is never rewritten.
All poses use rigid bone transforms; temporary analytic IK is baked, not exported.
"""
import sys,json,math,struct,argparse,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
import numpy as np
from mathutils import Matrix,Vector
import bpy
HERE=Path(__file__).resolve().parent
MODEL=HERE.parents[1]/'models/animal_husky'
sys.path.insert(0,str(MODEL))
from verify_husky import GLB
Q=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],float)

def smooth(t):t=max(0,min(1,t));return t*t*t*(t*(t*6-15)+10)
def pulse(u):return math.sin(math.pi*u)**2
def rot(axis,degrees):return np.array(Matrix.Rotation(math.radians(degrees),3,axis))

class Rig:
 def __init__(self,g):
  self.g=g;self.nodes=g.d['skins'][0]['joints'];self.names=[g.d['nodes'][i]['name'] for i in self.nodes];self.index={n:i for i,n in enumerate(self.names)}
  self.rest=np.array([Q.T@g.matrix(i) for i in self.nodes]);self.inv=np.linalg.inv(self.rest)
  self.children={i:[] for i in range(len(self.names))}
  self.parent=[]
  for i,node in enumerate(self.nodes):
   p=g.parents.get(node);j=self.nodes.index(p) if p in self.nodes else -1;self.parent.append(j)
   if j>=0:self.children[j].append(i)
  def descendants(i):return [i]+[k for j in self.children[i] for k in descendants(j)]
  self.desc=[descendants(i) for i in range(len(self.names))]
  primitive=g.d['meshes'][0]['primitives'][0];attrs=primitive['attributes']
  self.points=(Q.T@np.c_[g.accessor(attrs['POSITION']),np.ones(len(g.accessor(attrs['POSITION'])))].T).T
  self.weights=g.accessor(attrs['WEIGHTS_0']);self.joints=g.accessor(attrs['JOINTS_0']).astype(int);self.tris=g.accessor(primitive['indices']).reshape(-1,3).astype(int)
  self.soles={};self.anchors={};self.pawheads={};self.paws={}
  for leg,side,fore in [('LF',1,True),('RF',-1,True),('LH',1,False),('RH',-1,False)]:
   ids=np.where((self.points[:,0]*side>.025)&(self.points[:,2]<.003)&((self.points[:,1]<.2) if fore else (self.points[:,1]>.2)))[0]
   assert len(ids)>0;self.soles[leg]=ids;self.anchors[leg]=self.contact(self.points,leg)
   name=('FF.' if fore else 'FFB.')+('L' if side==1 else 'R');self.paws[leg]=name;self.pawheads[leg]=self.rest[self.index[name],:3,3].copy()
  self.reset()
 def reset(self):self.world=self.rest.copy();self.reach=0;self.reach_detail={}
 def contact(self,points,leg):
  p=points[self.soles[leg],:3];return np.array([p[:,0].mean(),p[:,1].mean(),p[:,2].min()])
 def skin(self):return np.einsum('nkij,nj,nk->ni',(self.world@self.inv)[self.joints],self.points,self.weights)
 def rotate(self,name,R):
  i=self.index[name];head=self.world[i,:3,3];d=np.eye(4);d[:3,:3]=R;d[:3,3]=head-R@head;self.world[self.desc[i]]=d@self.world[self.desc[i]]
 def turn(self,name,axis,angle):self.rotate(name,rot(axis,angle))
 def shift(self,delta):self.world[:,:3,3]+=delta
 def orient(self,name,R):self.rotate(name,R@np.linalg.inv(self.world[self.index[name],:3,:3]))
 def aim_vector(self,name,current,direction):
  if np.linalg.norm(direction)<1e-8:return
  q=Vector(current).normalized().rotation_difference(Vector(direction).normalized());self.rotate(name,np.array(q.to_matrix()))
 def two(self,a,b,end,target,pole):
  ia,ib,ie=[self.index[n] for n in (a,b,end)];root=self.world[ia,:3,3].copy();knee=self.world[ib,:3,3].copy();tip=self.world[ie,:3,3].copy()
  l1=np.linalg.norm(knee-root);l2=np.linalg.norm(tip-knee);delta=target-root;dist=np.linalg.norm(delta);direction=delta/max(dist,1e-10)
  length=np.clip(dist,abs(l1-l2)+1e-6,l1+l2-1e-6);self.reach=max(self.reach,abs(float(length-dist)))
  self.reach_detail[a]={'distance':float(dist),'min':float(abs(l1-l2)),'max':float(l1+l2),'root':root.tolist(),'target':target.tolist()}
  bend=np.array(pole)-direction*np.dot(pole,direction);bend/=max(np.linalg.norm(bend),1e-9)
  x=(l1*l1-l2*l2+length*length)/(2*length);y=math.sqrt(max(0,l1*l1-x*x));wanted=root+direction*x+bend*y
  self.aim_vector(a,knee-root,wanted-root)
  self.aim_vector(b,self.world[ie,:3,3]-self.world[ib,:3,3],root+direction*length-self.world[ib,:3,3])
 def leg(self,leg,target,pole_side=0,foot_pitch=0,distal_pitch=0,distal_yaw=0):
  side=leg[0];sgn=1 if side=='L' else -1;paw=self.paws[leg]
  if leg[1]=='F':self.two('FrontUpperLeg.'+side,'FrontLowerLeg.'+side,paw,target,(sgn*pole_side,1,0))
  else:
   low='BackLowerLeg.'+side;il=self.index[low];ip=self.index[paw];ih=self.index['BackLeg.'+side]
   fold=np.clip((self.rest[ih,2,3]-self.world[ih,2,3])/.28,0,1)
   R=rot('Z',distal_yaw)@rot('X',-20*fold+distal_pitch)@self.rest[il,:3,:3]
   offset=np.linalg.inv(self.rest[il])@np.r_[self.rest[ip,:3,3],1]
   hock=target-R@offset[:3]
   self.two('BackLeg.'+side,'BackUpperLeg.'+side,low,hock,(sgn*pole_side,-1,0));self.orient(low,R)
  self.orient(paw,rot('X',foot_pitch)@self.rest[self.index[paw],:3,:3])
 def planted(self,targets,pole_side=0,profiles=None):
  heads={leg:self.pawheads[leg]+p-self.anchors[leg] for leg,p in targets.items()}
  for _ in range(4):
   self.reach=0
   for leg in targets:self.leg(leg,heads[leg],pole_side,**(profiles or {}).get(leg,{}))
   actual=self.skin()
   for leg,target in targets.items():heads[leg]-=self.contact(actual,leg)-target
  return self.skin()
 def tail(self,angle,wave=0):
  for i in range(1,7):self.turn('Tail'+str(i),'Z',angle*(.40 if i==1 else .12)+wave*math.sin(i*.7))
 def neck(self,yaw=0,pitch=0,roll=0):
  for name,part in [('Neck1',.45),('Neck2',.30),('Neck3',.25)]:
   self.turn(name,'Z',yaw*part);self.turn(name,'X',pitch*part);self.turn(name,'Y',roll*part)

def base(r,name,amount,tune):
 if name=='stand':return
 p=tune['poses'][name];r.shift(np.array(p.get('shift',[0,0,0]))*amount)
 for bone,axis,angle in p.get('turns',[]):r.turn(bone,axis,angle*amount)

def state_targets(r,state,tune):
 out={k:v.copy() for k,v in r.anchors.items()}
 for leg,offset in tune['poses'].get(state,{}).get('feet',{}).items():out[leg]+=offset
 return out

def sample(r,spec,u,tune):
 r.reset();u=0.0 if spec['loop'] and u>=1 else u;t=u*spec['seconds'];w=2*math.pi*u;env=pulse(u);side=spec.get('side',1);kind=spec['kind'];state=spec.get('base','stand');contacts=list(r.anchors);targets=state_targets(r,state,tune);profiles={}
 if kind=='transition':
  finish=spec['to'];a=smooth(u);base(r,state,1-a,tune);base(r,finish,a,tune);end=state_targets(r,finish,tune)
  for leg in targets:
   # Replant changing targets on a lifted path, stagger left/right.
   start=.12 if leg[0]=='L' else .28;phase=np.clip((u-start)/.55,0,1);p=smooth(phase)
   targets[leg]=targets[leg]*(1-p)+end[leg]*p
   if np.linalg.norm(end[leg]-state_targets(r,state,tune)[leg])>.001:
    targets[leg][2]+=tune['step_lift']*math.sin(math.pi*phase)**2
    if 0<phase<1:contacts.remove(leg)
 else:base(r,state,1,tune)
 if kind=='breathe':r.turn('Torso3','X',tune['breathe_deg']*math.sin(w));r.neck(pitch=-.5*math.sin(w));r.tail(3*math.sin(w))
 elif kind=='alert':r.neck(pitch=-tune['alert_pitch']*(.85+.15*math.cos(w)));r.turn('Ear1.L','X',-8);r.turn('Ear1.R','X',-8);r.tail(3*math.sin(w*2))
 elif kind=='look':r.neck(yaw=side*tune['look_deg']*env)
 elif kind=='look_around':r.neck(yaw=tune['look_deg']*.8*math.sin(w)*env)
 elif kind=='tilt':r.neck(roll=side*tune['tilt_deg']*env,yaw=side*10*env)
 elif kind=='look_vertical':r.neck(pitch=side*tune['look_pitch']*env)
 elif kind=='ear':
  twitch=math.sin(3*math.pi*u)**2*env
  for s in (['L','R'] if side==0 else ['L' if side==1 else 'R']):r.turn('Ear1.'+s,'Y',(1 if s=='L' else -1)*tune['ear_deg']*twitch);r.turn('Ear2.'+s,'X',12*twitch)
 elif kind=='wag':r.tail(spec['amplitude']*math.sin(w*spec['cycles']),2*math.sin(w*spec['cycles']-.5));r.neck(yaw=3*math.sin(w))
 elif kind=='tail_tuck':
  for i in range(1,7):r.turn('Tail'+str(i),'X',-(tune['tuck_base_deg'] if i==1 else tune['tuck_per_bone'])*env)
  r.neck(pitch=8*env)
 elif kind=='sniff_air':r.neck(pitch=-tune['sniff_air_pitch']*env+2*math.sin(w*4)*env,yaw=side*10*env)
 elif kind=='sniff_ground':r.neck(yaw=tune['sniff_sweep']*math.sin(w),pitch=2*math.sin(w*4));r.tail(3*math.sin(w))
 elif kind=='sit_look':r.neck(yaw=tune['look_deg']*.6*math.sin(w));r.tail(4*math.sin(w*2))
 elif kind=='shake':
  oscill=math.sin(w*spec['cycles'])*env
  r.turn('Back','Y',tune['shake_body_deg']*oscill);r.turn('Torso2','Y',-tune['shake_body_deg']*oscill)
  r.neck(yaw=tune['shake_head_deg']*oscill,roll=8*math.sin(w*spec['cycles']-.4)*env)
  for s in ['L','R']:r.turn('Ear1.'+s,'Y',14*math.sin(w*spec['cycles']-.8)*env)
  r.tail(10*math.sin(w*spec['cycles']-1)*env)
 elif kind=='paw_offer':
  leg='LF' if side==1 else 'RF';targets[leg]+=np.array([side*.015,-tune['paw_forward'],tune['paw_lift']])*env
  if env>.001:contacts.remove(leg)
  r.neck(yaw=side*12*env,pitch=10*env)
 elif kind=='urinate':
  leg='LH' if side==1 else 'RH';targets[leg]+=np.array([side*tune['urinate_side'],0,tune['urinate_height']])*env
  if env>.001:contacts.remove(leg)
  r.neck(yaw=-side*15*env);r.tail(5*math.sin(w)*env)
 elif kind=='scratch':
  leg='LH' if side==1 else 'RH';e=smooth(min(u/.22,(1-u)/.22));r.neck(yaw=side*tune['scratch_yaw']*e,pitch=tune['scratch_pitch']*e,roll=-side*10*e)
  ear=r.world[r.index['Ear1.'+('L' if side==1 else 'R')],:3,3];goal=ear+np.array([side*.025,0,-.035])
  targets[leg]=(1-e)*targets[leg]+e*goal;targets[leg][2]+=tune['scratch_amplitude']*math.sin(w*spec['cycles'])*e
  profiles[leg]={'distal_pitch':-tune['scratch_distal_pitch']*e,'foot_pitch':-70*e}
  if e>.001:contacts.remove(leg)
 elif kind=='bow':base(r,'bow',env,tune);end=state_targets(r,'bow',tune)
 elif kind=='startle':r.neck(pitch=-10*env,yaw=side*8*env);r.turn('Torso3','X',5*env);r.tail(-10*env)
 elif kind=='sleep':r.turn('Neck1','X',tune['sleep_pitch']);r.turn('Head','X',-25);r.turn('Torso3','X',.6*math.sin(w))
 elif kind=='side_roll':
  angle=90*smooth(u if spec.get('to_side',True) else 1-u);contacts=[]
 elif kind=='side_breathe':r.turn('Torso3','X',.5*math.sin(w));angle=90;contacts=[]
 if kind=='bow':
  for leg in targets:
   targets[leg]=(1-env)*targets[leg]+env*end[leg]
   if leg[1]=='F' and env>.001:contacts.remove(leg);targets[leg][2]+=tune['step_lift']*.5*math.sin(w)**2
 if kind=='transition' and {state,spec['to']}=={'sit','lie'}:
  # Unequal upper/lower foreleg lengths leave an unreachable inner disk.
  # Swing the free paw around its forward rim instead of through the elbow.
  for leg in ['LF','RF']:
   if leg in contacts:continue
   upper=r.index['FrontUpperLeg.'+leg[0]];lower=r.index['FrontLowerLeg.'+leg[0]];paw=r.index[r.paws[leg]]
   minimum=np.linalg.norm(r.rest[paw,:3,3]-r.rest[lower,:3,3])-np.linalg.norm(r.rest[lower,:3,3]-r.rest[upper,:3,3])+tune['swing_reach_margin']
   delta=r.pawheads[leg]+targets[leg]-r.anchors[leg]-r.world[upper,:3,3]
   if np.linalg.norm(delta)<minimum:
    wanted=-math.sqrt(max(0,minimum*minimum-delta[0]*delta[0]-delta[2]*delta[2]));targets[leg][1]+=wanted-delta[1]
 pole=tune['hind_pole_side'] if state in ['sit','lie','sleep'] else 0
 if kind=='transition':pole=tune['hind_pole_side']*((1-smooth(u))*(state in ['sit','lie','sleep'])+smooth(u)*(spec['to'] in ['sit','lie','sleep']))
 seated=float(state=='sit')
 if kind=='transition':seated=(1-smooth(u))*float(state=='sit')+smooth(u)*float(spec['to']=='sit')
 for leg in ['LH','RH']:
  profiles.setdefault(leg,{})['distal_yaw']=(-1 if leg[0]=='L' else 1)*tune.get('sit_hock_yaw',0)*seated
 # Keep lifted hind paws outside the inner unreachable region of the folded chain.
 if tune.get('sit_hock_yaw',0) and kind=='transition':
  for leg in ['LH','RH']:
   if leg in contacts:continue
   side=leg[0];sgn=1 if side=='L' else -1
   ia,ib,il,ip=[r.index[n+'.'+side] for n in ['BackLeg','BackUpperLeg','BackLowerLeg','FFB']]
   l1=np.linalg.norm(r.rest[ib,:3,3]-r.rest[ia,:3,3]);l2=np.linalg.norm(r.rest[il,:3,3]-r.rest[ib,:3,3]);minimum=abs(l2-l1)+.008
   fold=np.clip((r.rest[ia,2,3]-r.world[ia,2,3])/(.28*1),0,1)
   R=rot('Z',profiles[leg]['distal_yaw'])@rot('X',-20*fold)@r.rest[il,:3,:3]
   offset=np.linalg.inv(r.rest[il])@np.r_[r.rest[ip,:3,3],1]
   hock=r.pawheads[leg]+targets[leg]-r.anchors[leg]-R@offset[:3];delta=hock-r.world[ia,:3,3]
   if np.linalg.norm(delta)<minimum:targets[leg][0]+=sgn*math.sqrt(max(0,minimum*minimum-delta[1]**2-delta[2]**2))-delta[0]
 points=r.planted(targets,pole,profiles)
 # Raise trunk only when a body vertex penetrates; feet are re-solved afterwards.
 for _ in range(tune['ground_iterations']):
  depth=max(0,-float(points[:,2].min())-tune['floor_tolerance'])
  if depth<tune['ground_convergence']:break
  r.shift(np.array([0,0,depth]));points=r.planted(targets,pole,profiles)
 if kind in ['side_roll','side_breathe']:
  r.turn('Body','Y',angle);r.shift(np.array([0,0,-float(r.skin()[:,2].min())]));points=r.skin()
 return points,targets,contacts

def append_clips(g,clips,path):
 d=g.d;binary=bytearray(g.binary)
 def accessor(values,typ):
  values=np.asarray(values,dtype='<f4');binary.extend(b'\0'*((-len(binary))%4));start=len(binary);binary.extend(values.tobytes());vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':values.nbytes});ai=len(d['accessors']);a={'bufferView':vi,'componentType':5126,'count':len(values),'type':typ}
  if typ=='SCALAR':a.update(min=[float(values.min())],max=[float(values.max())])
  d['accessors'].append(a);return ai
 for spec,samples in clips:
  times=accessor(np.arange(len(samples))/30,'SCALAR');channels=[];samplers=[]
  for j,node in enumerate(g.d['skins'][0]['joints']):
   for kind,typ,key in [('translation','VEC3',0),('rotation','VEC4',1)]:
    output=accessor(np.array([f[j][key] for f in samples]),typ);channels.append({'sampler':len(samplers),'target':{'node':node,'path':kind}});samplers.append({'input':times,'output':output,'interpolation':'LINEAR'})
  start,end=spec.get('base','stand'),spec.get('to',spec.get('base','stand'))
  if spec['kind']=='side_breathe':start=end='side_lie'
  elif spec['kind']=='side_roll':start,end=('lie','side_lie') if spec.get('to_side',True) else ('side_lie','lie')
  d['animations'].append({'name':spec['name'],'channels':channels,'samplers':samplers,'extras':{'loop':spec['loop'],'fps':30,'author':'News Game authored motion','base_state':start,'end_state':end}})
 d['buffers'][0]['byteLength']=len(binary);raw=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();raw+=b' '*((-len(raw))%4);binary+=b'\0'*((-len(binary))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(raw)+len(binary))+struct.pack('<II',len(raw),0x4e4f534a)+raw+struct.pack('<II',len(binary),0x004e4942)+binary)

def local_samples(r,previous):
 result=[]
 for i,m in enumerate(r.world):
  local=np.linalg.inv(r.world[r.parent[i]])@m if r.parent[i]>=0 else Q@m
  q=Matrix(local.tolist()).to_quaternion();v=np.array([q.x,q.y,q.z,q.w]);v/=np.linalg.norm(v)
  if previous and np.dot(v,previous[i][1])<0:v=-v
  result.append((local[:3,3].tolist(),v.tolist()))
 return result

def setup_render(r):
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.world=bpy.data.worlds.new('gray');s.world.color=(.68,.68,.68)
 s.render.engine='BLENDER_WORKBENCH';sh=s.display.shading;sh.light='FLAT';sh.color_type='MATERIAL';sh.show_shadows=False;sh.show_cavity=False;sh.show_specular_highlight=False;sh.background_type='WORLD';s.view_settings.view_transform='Standard'
 s.render.resolution_x=s.render.resolution_y=400;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG'
 mesh=bpy.data.meshes.new('preview');mesh.from_pydata(r.points[:,:3],[],r.tris.tolist());obj=bpy.data.objects.new('preview',mesh);s.collection.objects.link(obj);mat=bpy.data.materials.new('animal_ink');mat.diffuse_color=(0,0,0,1);mesh.materials.append(mat)
 cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));s.collection.objects.link(cam);s.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.4
 return obj,cam

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=HERE);p.add_argument('--glb',type=Path,default=HERE.parents[3]/'models/animal_husky.glb');p.add_argument('--preview',action='store_true');p.add_argument('--only',default='');p.add_argument('--preview-only',default='');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 config=json.loads((HERE/'motion_specs.json').read_text(encoding='utf-8'));source=MODEL/'animal_husky.glb';g=GLB(source);r=Rig(g);args.out.mkdir(parents=True,exist_ok=True);clips=[];report=[];contact_data={}
 preview=args.out/'frames'
 if args.preview:preview.mkdir(exist_ok=True);obj,cam=setup_render(r)
 for spec in config['clips']:
  if args.only and spec['name'] not in args.only.split(','):continue
  n=round(spec['seconds']*30)+1;frames=[];poses=[];contactmax=0;floor=0;reach=0;errors=[];centers=[];plans=[];masks=[]
  for f in range(n):
   points,targets,contacts=sample(r,spec,f/(n-1),config['tuning']);frames.append(local_samples(r,frames[-1] if frames else None));poses.append(points[:,:3].copy());centers.append(points[:,:3].mean(axis=0))
   plans.append([list(Q[:3,:3]@targets[k]) for k in ['LF','RF','LH','RH']]);masks.append([k in contacts for k in ['LF','RF','LH','RH']])
   err=max([np.linalg.norm(r.contact(points,leg)-targets[leg]) for leg in contacts] or [0]);contactmax=max(contactmax,float(err));floor=min(floor,float(points[:,2].min()));reach=max(reach,r.reach)
   if err>.004:errors.append(f)
  if spec['loop']:frames[-1]=frames[0];poses[-1]=poses[0]
  contact_data[spec['name']+'__targets']=np.array(plans,dtype=np.float32);contact_data[spec['name']+'__planted']=np.array(masks,dtype=np.uint8)
  maxstep=max(float(np.linalg.norm(b-a,axis=1).max()) for a,b in zip(poses,poses[1:]));endpoint=float(np.linalg.norm(poses[-1]-poses[0],axis=1).max())
  item={**spec,'frames':n,'fps':30,'ground_min_m':floor,'contact_max_error_m':contactmax,'unreachable_max_m':reach,'max_vertex_step_m':maxstep,'endpoint_vertex_error_m':endpoint,'contact_bad_frames':errors};report.append(item);clips.append((spec,frames));print('CLIP',spec['name'],'contact',round(contactmax,4),'floor',round(floor,4),'reach',round(reach,4),flush=True)
  if args.preview and (not args.preview_only or spec['name'] in args.preview_only.split(',')):
   for view,az,el in [('side',90,0),('game',35,38)]:
    a,e=math.radians(az),math.radians(el);allpoints=np.array(poses);target=Vector((allpoints.min(axis=(0,1))+allpoints.max(axis=(0,1)))/2);direction=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)));cam.location=target+direction*5;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    for k,f in enumerate(np.round(np.linspace(0,n-1,25)).astype(int)):
     obj.data.vertices.foreach_set('co',poses[f].ravel());obj.data.update();bpy.context.scene.render.filepath=str(preview/f"{spec['name']}__{view}__{k:02}.png");bpy.ops.render.render(write_still=True)
 (args.out/'motion_report.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'new_clip_count':len(clips),'source_clip_count':12,'clips':report},ensure_ascii=False,indent=2),encoding='utf-8')
 np.savez_compressed(args.out/'contact_plan.npz',**contact_data)
 append_clips(g,clips,args.glb)
if __name__=='__main__':main()
