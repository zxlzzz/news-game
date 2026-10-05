"""Author and bake shared animal clips. Blender background; source GLB is never rewritten.
All poses use rigid bone transforms; temporary analytic IK is baked, not exported.
"""
import sys,json,math,struct,argparse,hashlib
from pathlib import Path
sys.dont_write_bytecode=True
import numpy as np
from mathutils import Matrix,Vector
import bpy
HERE=None;MODEL=None;PROFILE=None
from glb import GLB
Q=np.array([[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]],float)

def smooth(t):t=max(0,min(1,t));return t*t*t*(t*(t*6-15)+10)
def pulse(u):return math.sin(math.pi*u)**2
def rot(axis,degrees):return np.array(Matrix.Rotation(math.radians(degrees),3,axis))

def curve(keys,u):
 """Explicit pose-time organization, with smooth velocities at each authored beat."""
 for (a,x),(b,y) in zip(keys,keys[1:]):
  if u<=b:return x+(y-x)*smooth((u-a)/(b-a))
 return keys[-1][1]

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
  pawpositions=np.array([self.rest[self.index[n],:3,3] for n in PROFILE['paws']])
  nearest=np.argmin(np.linalg.norm(self.points[:,None,:2]-pawpositions[None,:,:2],axis=2),axis=1)
  for j,leg in enumerate(['LF','RF','LH','RH']):
   ids=np.where((nearest==j)&(self.points[:,2]<.003))[0]
   assert len(ids)>0;self.soles[leg]=ids;self.anchors[leg]=self.contact(self.points,leg)
   name=PROFILE['paws'][j];self.paws[leg]=name;self.pawheads[leg]=self.rest[self.index[name],:3,3].copy()
  self.tail_names=[n for n in self.names if n.startswith("Tail")] if PROFILE["species"]!="cat" else ["Bone.004","Bone.005","Bone.006","Bone.007"]
  trunk={PROFILE.get('aliases',{}).get(n,n) for n in PROFILE.get('body_support_bones',['Body','Back','Torso','Torso2','Torso3'])}
  primary=np.array(self.names)[self.joints[np.arange(len(self.points)),np.argmax(self.weights,axis=1)]]
  self.body_ids=np.where(np.isin(primary,list(trunk))&(self.points[:,2]>=PROFILE.get('body_support_min_height_m',0)))[0]
  mid=float(np.median(self.points[self.body_ids,1]));self.body_front=self.body_ids[self.points[self.body_ids,1]<mid];self.body_back=self.body_ids[self.points[self.body_ids,1]>=mid]
  self.reset()
 def reset(self):self.world=self.rest.copy();self.reach=0;self.reach_detail={}
 def contact(self,points,leg):
  p=points[self.soles[leg],:3];return np.array([p[:,0].mean(),p[:,1].mean(),p[:,2].min()])
 def skin(self):return np.einsum('nkij,nj,nk->ni',(self.world@self.inv)[self.joints],self.points,self.weights)
 def rotate(self,name,R):
  i=self.index[name];head=self.world[i,:3,3];d=np.eye(4);d[:3,:3]=R;d[:3,3]=head-R@head;self.world[self.desc[i]]=d@self.world[self.desc[i]]
 def turn(self,name,axis,angle):
  mapped=PROFILE.get('aliases',{}).get(name,name)
  if mapped is not None:self.rotate(mapped,rot(axis,angle))
 def shift(self,delta):self.world[:,:3,3]+=delta
 def rigid_about(self,R,pivot):
  d=np.eye(4);d[:3,:3]=R;d[:3,3]=pivot-R@pivot;self.world=d@self.world
 def spine_roll(self,name,degrees):
  mapped=PROFILE.get('aliases',{}).get(name,name)
  if mapped is None:return
  i=self.index[mapped];axis=self.world[i,:3,:3]@np.linalg.inv(self.rest[i,:3,:3])@np.array([0,1,0])
  self.rotate(mapped,np.array(Matrix.Rotation(math.radians(degrees),3,Vector(axis))))
 def orient(self,name,R):self.rotate(name,R@np.linalg.inv(self.world[self.index[name],:3,:3]))
 def aim_vector(self,name,current,direction):
  if np.linalg.norm(direction)<1e-8:return
  q=Vector(current).normalized().rotation_difference(Vector(direction).normalized());self.rotate(name,np.array(q.to_matrix()))
 def two(self,a,b,end,target,pole,transport_plane=True):
  ia,ib,ie=[self.index[n] for n in (a,b,end)];root=self.world[ia,:3,3].copy();knee=self.world[ib,:3,3].copy();tip=self.world[ie,:3,3].copy()
  l1=np.linalg.norm(knee-root);l2=np.linalg.norm(tip-knee);delta=target-root;dist=np.linalg.norm(delta);direction=delta/max(dist,1e-10)
  length=np.clip(dist,abs(l1-l2)+1e-6,l1+l2-1e-6);self.reach=max(self.reach,abs(float(length-dist)))
  self.reach_detail[a]={'distance':float(dist),'min':float(abs(l1-l2)),'max':float(l1+l2),'root':root.tolist(),'target':target.tolist()}
  # Transport the authored rest-plane to the target direction. Projecting a fixed
  # world pole directly onto a nearly horizontal limb flips the knee as target and
  # shoulder cross equal height (notably during lying/side preparation).
  restdir=self.rest[ie,:3,3]-self.rest[ia,:3,3];restdir/=np.linalg.norm(restdir)
  restpole=np.array(pole)-restdir*np.dot(pole,restdir)
  # First swing in the anatomical sagittal plane, then move laterally. A single
  # 3-D shortest rotation has its own antipodal flip when a folded hind target
  # passes opposite the standing chain; this two-plane transport has no such flip.
  if transport_plane:
   sagittal=rot('X',math.degrees(math.atan2(direction[2],direction[1])-math.atan2(restdir[2],restdir[1])))
   transport=Vector(sagittal@restdir).rotation_difference(Vector(direction))
   bend=np.array(transport@Vector(sagittal@restpole))
  else:
   # Hind knees retain the authored outward/upward sitting plane. Their lateral
   # pole avoids the foreleg's vertical-plane singularity; transporting the
   # foreleg rule here turns the deep seated knee beneath the support surface.
   bend=np.array(pole)-direction*np.dot(pole,direction)
  bend/=max(np.linalg.norm(bend),1e-9)
  x=(l1*l1-l2*l2+length*length)/(2*length);y=math.sqrt(max(0,l1*l1-x*x));wanted=root+direction*x+bend*y
  self.aim_vector(a,knee-root,wanted-root)
  self.aim_vector(b,self.world[ie,:3,3]-self.world[ib,:3,3],root+direction*length-self.world[ib,:3,3])
 def leg(self,leg,target,pole_side=0,pole_up=0,foot_pitch=0,distal_pitch=0,distal_yaw=0,sit_fold=0):
  side=leg[0];sgn=1 if side=='L' else -1;paw=self.paws[leg]
  if PROFILE['species']=='cat':
   a,b=PROFILE['chains'][leg];ia,ib,ip=[self.index[n] for n in [a,b,paw]]
   delta=self.rest[ip,:3,3]-self.rest[ia,:3,3];bend=self.rest[ib,:3,3]-self.rest[ia,:3,3];bend-=delta*np.dot(bend,delta)/np.dot(delta,delta);bend/=max(np.linalg.norm(bend),1e-9);bend[0]+=sgn*pole_side
   if leg[1]=='H' and sit_fold:
    bend=(1-sit_fold)*bend+sit_fold*np.array([sgn*.45,-.15,1.0])
   self.two(a,b,paw,target,bend,leg[1]=='F');self.orient(paw,rot('X',foot_pitch)@self.rest[ip,:3,:3]);return
  if leg[1]=='F':self.two('FrontUpperLeg.'+side,'FrontLowerLeg.'+side,paw,target,(sgn*pole_side,1,0))
  else:
   low='BackLowerLeg.'+side;il=self.index[low];ip=self.index[paw];ih=self.index['BackLeg.'+side]
   fold=np.clip((self.rest[ih,2,3]-self.world[ih,2,3])/(.28*PROFILE["shoulder_height"]/.55),0,1)
   R=rot('Z',distal_yaw)@rot('X',-20*fold+distal_pitch)@self.rest[il,:3,:3]
   offset=np.linalg.inv(self.rest[il])@np.r_[self.rest[ip,:3,3],1]
   hock=target-R@offset[:3]
   self.two('BackLeg.'+side,'BackUpperLeg.'+side,low,hock,(sgn*pole_side,-1,pole_up),False);self.orient(low,R)
  self.orient(paw,rot('X',foot_pitch)@self.rest[self.index[paw],:3,:3])
 def planted(self,targets,pole_side=0,profiles=None):
  heads={leg:self.target_head(leg,p,(profiles or {}).get(leg,{}).get('foot_pitch',0)) for leg,p in targets.items()}
  for _ in range(4):
   self.reach=0
   for leg in targets:
    values=dict((profiles or {}).get(leg,{}));preferred=values.pop('pole_side',pole_side)
    self.leg(leg,heads[leg],preferred,**values)
   actual=self.skin()
   for leg,target in targets.items():heads[leg]-=self.contact(actual,leg)-target
  return self.skin()
 def target_head(self,leg,target,foot_pitch=0):
  sole=(rot('X',foot_pitch)@(self.points[self.soles[leg],:3]-self.pawheads[leg]).T).T
  offset=np.array([sole[:,0].mean(),sole[:,1].mean(),sole[:,2].min()])
  return target-offset
 def tail(self,angle,wave=0):
  for i,name in enumerate(self.tail_names):self.turn(name,'Z',angle*(.40 if i==0 else .60/max(1,len(self.tail_names)-1))+wave*math.sin((i+1)*.7))
 def neck(self,yaw=0,pitch=0,roll=0):
  pairs=[('Neck1',1)] if PROFILE['species']=='cat' else [('Neck1',.45),('Neck2',.30),('Neck3',.25)]
  for name,part in pairs:self.turn(name,'Z',yaw*part);self.turn(name,'X',pitch*part);self.turn(name,'Y',roll*part)


def base(r,name,amount,tune):
 p=tune['poses'][name];r.shift(np.array(p.get('shift',[0,0,0]))*amount)
 for bone,axis,angle in p.get('turns',[]):r.turn(bone,axis,angle*amount)

def state_targets(r,state,tune):
 out={k:v.copy() for k,v in r.anchors.items()}
 for leg,offset in tune['poses'].get(state,{}).get('feet',{}).items():out[leg]+=offset
 return out

def state_profiles(state,tune):
 # Interpolate the effective authored reference, not an absent-key zero.
 # A missing lateral pole in a seated endpoint still means the seated default.
 pole=tune['hind_pole_side'] if state in ['sit','lie','sleep'] else 0
 return {leg:{'pole_side':pole,**tune['poses'].get(state,{}).get('legs',{}).get(leg,{})} for leg in ['LF','RF','LH','RH']}

def grounded(r,targets,pole,profiles,tune):
 points=r.planted(targets,pole,profiles)
 for _ in range(tune['ground_iterations']):
  depth=max(0,-float(points[:,2].min())-tune['floor_tolerance'])
  if depth<tune['ground_convergence']:break
  r.shift(np.array([0,0,depth]));points=r.planted(targets,pole,profiles)
 return points

def side_pose(r,spec,u,tune):
 """Transfer support from paws to flank while folding limbs, then settle both trunk ends.
 A reverse transition samples the same articulated path, so hold boundaries match exactly.
 """
 cfg=tune['side_pose'];phase=(u if spec.get('to_side',True) else 1-u) if spec['kind']=='side_roll' else 1.0
 q=curve(cfg['roll_curve'],phase);gather=curve(cfg['gather_curve'],phase)
 base(r,'lie',1,tune);targets=state_targets(r,'lie',tune)
 profiles=state_profiles('lie',tune);grounded(r,targets,tune['hind_pole_side'],profiles,tune)
 # Gather the lower pair close to the flank and raise the upper pair before rolling.
 # A wide seated knee pole would otherwise put the hind shin below the body.
 compact={leg:target+np.array(cfg['feet'][leg])*(gather if leg[0]=='L' else q) for leg,target in targets.items()}
 for leg,values in cfg.get('legs',{}).items():
  initial=profiles.setdefault(leg,{})
  for key,value in values.items():initial[key]=(1-gather)*initial.get(key,0)+gather*value
 # Legs and neck articulate before the flank takes support. Upper and lower limbs
 # have separate folds; neither the head nor all four paws rigidly follows the roll.
 for name,axis,angle in cfg['folds']:r.turn(name,axis,angle*gather)
 r.neck(pitch=cfg['neck_pitch']*gather,roll=cfg['neck_roll']*q)
 r.turn('Head','Z',cfg['head_yaw']*gather)
 grounded(r,compact,(1-gather)*tune['hind_pole_side']+gather*cfg['hind_pole_side'],profiles,tune)
 pivot=r.world[r.index[PROFILE.get('aliases',{}).get('Back','Back')],:3,3].copy()
 r.rigid_about(rot('Y',cfg['roll_deg']*q),pivot)
 # With skin rather than bone origins, settle chest and hip on the same support plane.
 # The amount tends to zero at the entry endpoint; the original lie pose is retained.
 for _ in range(cfg['settle_iterations']):
  points=r.skin();front=points[r.body_front];back=points[r.body_back]
  dz=float(front[:,2].min()-back[:,2].min());dy=float(back[:,1].mean()-front[:,1].mean())
  r.rigid_about(rot('X',math.degrees(math.atan2(dz,max(abs(dy),1e-6)))*q),pivot)
 points=r.skin();depth=-float(points[:,2].min());r.shift(np.array([0,0,max(0,depth)+min(0,depth)*q]));points=r.skin()
 # Near the start, the lower pair continues to carry weight. Later, skin support
 # is the flank; the foot plan records the real sole trajectories rather than a fiction.
 actual={leg:r.contact(points,leg) for leg in r.anchors}
 # Touching/sliding soles are not planted constraints. The upper pair stays
 # planted through preparation, then releases when the roll transfers weight.
 contacts=[leg for leg in actual if q==0 and (gather==0 or leg[0]=='R') and actual[leg][2]<tune['ground_convergence']]
 if spec['kind']=='side_breathe':
  r.turn('Torso3','X',tune['side_breathe_deg']*math.sin(2*math.pi*u));points=r.skin()
  depth=max(0,-float(points[:,2].min()));r.shift(np.array([0,0,depth]));points=r.skin();actual={leg:r.contact(points,leg) for leg in r.anchors};contacts=[]
 return points,actual,contacts

def sample(r,spec,u,tune):
 r.reset();u=0.0 if spec['loop'] and u>=1 else u;t=u*spec['seconds'];w=2*math.pi*u;env=pulse(u);side=spec.get('side',1);kind=spec['kind'];state=spec.get('base','stand');contacts=list(r.anchors);targets=state_targets(r,state,tune);profiles=state_profiles(state,tune)
 if kind in ['side_roll','side_breathe']:return side_pose(r,spec,u,tune)
 if kind=='transition':
  finish=spec['to'];a=smooth(u);base(r,state,1-a,tune);base(r,finish,a,tune);end=state_targets(r,finish,tune)
  begin_profiles=profiles;finish_profiles=state_profiles(finish,tune);profiles={}
  for leg in set(begin_profiles)|set(finish_profiles):
   bp,ep=begin_profiles.get(leg,{}),finish_profiles.get(leg,{})
   profiles[leg]={key:(1-a)*bp.get(key,0)+a*ep.get(key,0) for key in set(bp)|set(ep)}
  for leg in targets:
   # Replant changing targets on a lifted path, stagger left/right.
   start=.12 if leg[0]=='L' else .28;phase=np.clip((u-start)/.55,0,1);p=smooth(phase)
   targets[leg]=targets[leg]*(1-p)+end[leg]*p
   if np.linalg.norm(end[leg]-state_targets(r,state,tune)[leg])>.001:
    targets[leg][2]+=tune['step_lift']*math.sin(math.pi*phase)**2
    if 0<phase<1:contacts.remove(leg)
 else:base(r,state,1,tune)
 if kind=='knead':
  for leg,phase in [('LF',0),('RF',math.pi)]:
   lift=max(0,math.sin(w*spec.get('cycles',2)+phase))**2*.015
   targets[leg][2]+=lift
   if lift>1e-7:contacts.remove(leg)
  r.neck(pitch=3*math.sin(w*spec.get('cycles',1)))
 elif kind=='tail_flick':
  for j,name in enumerate(r.tail_names[-2:]):r.turn(name,'Z',(12 if j==0 else 25)*math.sin(w*2)*env)
 elif kind=='breathe':r.turn('Torso3','X',tune['breathe_deg']*math.sin(w));r.neck(pitch=-.5*math.sin(w));r.tail(3*math.sin(w))
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
  for i,name in enumerate(r.tail_names):r.turn(name,'X',-(tune['tuck_base_deg'] if i==0 else tune['tuck_per_bone'])*env)
  r.neck(pitch=8*env)
 elif kind=='sniff_air':r.neck(pitch=-tune['sniff_air_pitch']*env+2*math.sin(w*4)*env,yaw=side*10*env)
 elif kind=='sniff_ground':r.neck(yaw=tune['sniff_sweep']*math.sin(w),pitch=2*math.sin(w*4));r.tail(3*math.sin(w))
 elif kind=='sit_look':r.neck(yaw=tune['look_deg']*.6*math.sin(w));r.tail(4*math.sin(w*2))
 elif kind in ['shake','head_shake']:
  cfg=tune['shake'];phase=2*math.pi*spec['frequency_hz']*t;e=curve(cfg['envelope'],u)
  if kind=='shake':
   r.shift(np.array([0,0,-cfg['crouch_m']*e]))
   for bone,angle,lag in cfg['spine']:r.spine_roll(bone,angle*math.sin(phase-lag)*e)
  r.neck(roll=cfg['head_deg']*math.sin(phase-cfg['head_lag'])*e)
  for s in ['L','R']:r.turn('Ear1.'+s,'Y',cfg['ear_deg']*math.sin(phase-cfg['ear_lag'])*e)
  if kind=='shake':r.tail(cfg['tail_deg']*math.sin(phase-cfg['tail_lag'])*e)
 elif kind=='paw_offer':
  leg='LF' if side==1 else 'RF';targets[leg]+=np.array([side*.015,-tune['paw_forward'],tune['paw_lift']])*env
  if env>.001:contacts.remove(leg)
  r.neck(yaw=side*12*env,pitch=10*env)
 elif kind=='urinate':
  leg='LH' if side==1 else 'RH';targets[leg]+=np.array([side*tune['urinate_side'],0,tune['urinate_height']])*env
  if env>.001:contacts.remove(leg)
  r.neck(yaw=-side*15*env);r.tail(5*math.sin(w)*env)
 elif kind=='scratch':
  leg='LH' if side==1 else 'RH';e=smooth(min(u/.22,(1-u)/.22));r.turn('Torso2','X',tune['scratch_torso']*e);r.neck(yaw=side*tune['scratch_yaw']*e,pitch=tune['scratch_pitch']*e,roll=-side*10*e)
  ear=r.world[r.index['Ear1.'+('L' if side==1 else 'R')],:3,3];goal=ear+np.array([side*.025,0,-.035])
  targets[leg]=(1-e)*targets[leg]+e*goal;targets[leg][0]+=side*tune['scratch_arc']*math.sin(math.pi*e);targets[leg][2]+=tune['scratch_amplitude']*math.sin(w*spec['cycles'])*e
  profiles[leg]={'distal_pitch':-tune['scratch_distal_pitch']*e,'foot_pitch':-70*e}
  if e>.001:contacts.remove(leg)
 elif kind in ['bow','stretch']:
  cfg=tune[kind];amount=curve(cfg['body_curve'],u);base(r,cfg['pose'],amount,tune);end=state_targets(r,cfg['pose'],tune)
  r.neck(pitch=cfg['neck_pitch']*amount);r.tail(cfg['tail_deg']*amount,cfg['tail_wave']*math.sin(w*cfg['tail_cycles'])*amount)
  for leg in ['LF','RF']:
   reach=curve(cfg['paw_curve'],u);targets[leg]=(1-reach)*targets[leg]+reach*end[leg]
   lift=tune['step_lift']*curve(cfg['lift_curve'],u);targets[leg][2]+=lift
   if lift>1e-7:contacts.remove(leg)
 elif kind=='startle':
  cfg=tune['startle'];crouch=curve(cfg['crouch_curve'],u);recoil=curve(cfg['recoil_curve'],u)
  r.shift(np.array([0,cfg['recoil_m']*recoil,-cfg['crouch_m']*crouch]));r.neck(pitch=cfg['head_pitch']*recoil,yaw=side*cfg['head_yaw']*recoil);r.tail(cfg['tail_deg']*crouch)
  for leg in ['LF','RF']:
   lift=cfg['front_lift_m']*curve(cfg['lift_curve'],u);targets[leg][2]+=lift
   if lift>1e-7:contacts.remove(leg)
 elif kind=='arch':
  r.turn('Torso3','X',tune['arch_breathe_deg']*math.sin(w))
 elif kind=='sleep':r.turn('Neck1','X',tune['sleep_pitch']);r.turn('Head','X',-25);r.turn('Torso3','X',.6*math.sin(w))
 if PROFILE['species']!='cat' and kind=='transition':
  # Unequal upper/lower foreleg lengths leave an unreachable inner disk.
  # Swing the free paw around its forward rim instead of through the elbow.
  for leg in ['LF','RF']:
   if leg in contacts:continue
   upper=r.index['FrontUpperLeg.'+leg[0]];lower=r.index['FrontLowerLeg.'+leg[0]];paw=r.index[r.paws[leg]]
   minimum=np.linalg.norm(r.rest[paw,:3,3]-r.rest[lower,:3,3])-np.linalg.norm(r.rest[lower,:3,3]-r.rest[upper,:3,3])+tune['swing_reach_margin']
   delta=r.target_head(leg,targets[leg],profiles.get(leg,{}).get('foot_pitch',0))-r.world[upper,:3,3]
   if np.linalg.norm(delta)<minimum:
    wanted=-math.sqrt(max(0,minimum*minimum-delta[0]*delta[0]-delta[2]*delta[2]));targets[leg][1]+=wanted-delta[1]
 pole=tune['hind_pole_side'] if state in ['sit','lie','sleep'] else 0
 if kind=='transition':pole=tune['hind_pole_side']*((1-smooth(u))*(state in ['sit','lie','sleep'])+smooth(u)*(spec['to'] in ['sit','lie','sleep']))
 seated=float(state=='sit')
 if kind=='transition':seated=(1-smooth(u))*float(state=='sit')+smooth(u)*float(spec['to']=='sit')
 for leg in ['LH','RH']:
  profiles.setdefault(leg,{})['distal_yaw']=(-1 if leg[0]=='L' else 1)*tune.get('sit_hock_yaw',0)*seated
  if PROFILE['species']=='cat' and tune.get('cat_seated_hind_pole',False):profiles[leg]['sit_fold']=seated
 # Keep lifted hind paws outside the inner unreachable region of the folded chain.
 if tune.get('sit_hock_yaw',0) and kind=='transition':
  for leg in ['LH','RH']:
   if leg in contacts:continue
   side=leg[0];sgn=1 if side=='L' else -1
   ia,ib,il,ip=[r.index[n+'.'+side] for n in ['BackLeg','BackUpperLeg','BackLowerLeg','FFB']]
   l1=np.linalg.norm(r.rest[ib,:3,3]-r.rest[ia,:3,3]);l2=np.linalg.norm(r.rest[il,:3,3]-r.rest[ib,:3,3]);minimum=abs(l2-l1)+tune['hind_swing_reach_margin_m']
   fold=np.clip((r.rest[ia,2,3]-r.world[ia,2,3])/(.28*PROFILE['shoulder_height']/.55),0,1)
   R=rot('Z',profiles[leg]['distal_yaw'])@rot('X',-20*fold)@r.rest[il,:3,:3]
   offset=np.linalg.inv(r.rest[il])@np.r_[r.rest[ip,:3,3],1]
   hock=r.target_head(leg,targets[leg],profiles.get(leg,{}).get('foot_pitch',0))-R@offset[:3];delta=hock-r.world[ia,:3,3]
   if np.linalg.norm(delta)<minimum:targets[leg][0]+=sgn*math.sqrt(max(0,minimum*minimum-delta[1]**2-delta[2]**2))-delta[0]
 points=r.planted(targets,pole,profiles)
 # Raise trunk only when a body vertex penetrates; feet are re-solved afterwards.
 for _ in range(tune['ground_iterations']):
  depth=max(0,-float(points[:,2].min())-tune['floor_tolerance'])
  if depth<tune['ground_convergence']:break
  r.shift(np.array([0,0,depth]))
  if kind=='scratch':targets['LH' if side==1 else 'RH'][2]+=depth
  points=r.planted(targets,pole,profiles)
 return points,targets,contacts

def append_clips(g,clips,path):
 d=g.d;binary=bytearray(g.binary)
 def accessor(values,typ):
  values=np.asarray(values,dtype='<f4');binary.extend(b'\0'*((-len(binary))%4));start=len(binary);binary.extend(values.tobytes());vi=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':values.nbytes});ai=len(d['accessors']);a={'bufferView':vi,'componentType':5126,'count':len(values),'type':typ}
  if typ=='SCALAR':a.update(min=[float(values.min())],max=[float(values.max())])
  d['accessors'].append(a);return ai
 for spec,samples in clips:
  fps=spec.get('fps',30);times=accessor(np.arange(len(samples))/fps,'SCALAR');channels=[];samplers=[]
  for j,node in enumerate(g.d['skins'][0]['joints']):
   for kind,typ,key in [('translation','VEC3',0),('rotation','VEC4',1)]:
    output=accessor(np.array([f[j][key] for f in samples]),typ);channels.append({'sampler':len(samplers),'target':{'node':node,'path':kind}});samplers.append({'input':times,'output':output,'interpolation':'LINEAR'})
  start,end=spec.get('base','stand'),spec.get('to',spec.get('base','stand'))
  if spec['kind']=='side_breathe':start=end='side_lie'
  elif spec['kind']=='side_roll':start,end=('lie','side_lie') if spec.get('to_side',True) else ('side_lie','lie')
  d['animations'].append({'name':spec['name'],'channels':channels,'samplers':samplers,'extras':{'loop':spec['loop'],'fps':fps,'author':'News Game authored motion','base_state':start,'end_state':end}})
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
 cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));s.collection.objects.link(cam);s.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=1.4*PROFILE['shoulder_height']/.55
 return obj,cam

def main(folder,profile,glb):
 global HERE,MODEL,PROFILE
 HERE=Path(folder);PROFILE=json.loads(Path(profile).read_text(encoding='utf-8'));MODEL=Path(profile).parent
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=HERE);p.add_argument('--glb',type=Path,default=Path(glb));p.add_argument('--preview',action='store_true');p.add_argument('--only',default='');p.add_argument('--preview-only',default='');args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
 config=json.loads((HERE/'motion_specs.json').read_text(encoding='utf-8'));source=MODEL/(PROFILE['name']+'.glb');g=GLB(source);r=Rig(g);args.out.mkdir(parents=True,exist_ok=True);clips=[];report=[];contact_data={}
 preview=args.out/'frames'
 if args.preview:preview.mkdir(exist_ok=True);obj,cam=setup_render(r)
 for spec in config['clips']:
  if args.only and spec['name'] not in args.only.split(','):continue
  fps=spec.get('fps',config['fps']);n=round(spec['seconds']*fps)+1;frames=[];poses=[];contactmax=0;floor=0;reach=0;errors=[];centers=[];plans=[];masks=[]
  for f in range(n):
   points,targets,contacts=sample(r,spec,f/(n-1),config['tuning']);frames.append(local_samples(r,frames[-1] if frames else None));poses.append(points[:,:3].copy());centers.append(points[:,:3].mean(axis=0))
   plans.append([list(Q[:3,:3]@targets[k]) for k in ['LF','RF','LH','RH']]);masks.append([k in contacts for k in ['LF','RF','LH','RH']])
   err=max([np.linalg.norm(r.contact(points,leg)-targets[leg]) for leg in contacts] or [0]);contactmax=max(contactmax,float(err));floor=min(floor,float(points[:,2].min()));reach=max(reach,r.reach)
   if err>.004:errors.append(f)
  if spec['loop']:frames[-1]=frames[0];poses[-1]=poses[0]
  contact_data[spec['name']+'__targets']=np.array(plans,dtype=np.float32);contact_data[spec['name']+'__planted']=np.array(masks,dtype=np.uint8)
  maxstep=max(float(np.linalg.norm(b-a,axis=1).max()) for a,b in zip(poses,poses[1:]));endpoint=float(np.linalg.norm(poses[-1]-poses[0],axis=1).max())
  item={**spec,'frames':n,'fps':fps,'ground_min_m':floor,'contact_max_error_m':contactmax,'unreachable_max_m':reach,'max_vertex_step_m':maxstep,'endpoint_vertex_error_m':endpoint,'contact_bad_frames':errors};report.append(item);clips.append(({**spec,'fps':fps},frames));print('CLIP',spec['name'],'contact',round(contactmax,4),'floor',round(floor,4),'reach',round(reach,4),flush=True)
  if args.preview and (not args.preview_only or spec['name'] in args.preview_only.split(',')):
   for view,az,el in [('side',90,0),('game',35,38)]:
    a,e=math.radians(az),math.radians(el);allpoints=np.array(poses);target=Vector((allpoints.min(axis=(0,1))+allpoints.max(axis=(0,1)))/2);direction=Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)));cam.location=target+direction*5;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    screen_right=np.array([math.cos(a),math.sin(a),0]);screen_up=np.array([-math.sin(a)*math.sin(e),math.cos(a)*math.sin(e),math.cos(e)]);cam.data.ortho_scale=max(1.4*PROFILE['shoulder_height']/.55,float(np.ptp(allpoints@screen_right)),float(np.ptp(allpoints@screen_up)))*1.08
    for k,f in enumerate(np.round(np.linspace(0,n-1,25)).astype(int)):
     obj.data.vertices.foreach_set('co',poses[f].ravel());obj.data.update();bpy.context.scene.render.filepath=str(preview/f"{spec['name']}__{view}__{k:02}.png");bpy.ops.render.render(write_still=True)
 (args.out/'motion_report.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'new_clip_count':len(clips),'source_clip_count':len(PROFILE['actions']),'clips':report},ensure_ascii=False,indent=2),encoding='utf-8')
 np.savez_compressed(args.out/'contact_plan.npz',**contact_data)
 append_clips(g,clips,args.glb)
