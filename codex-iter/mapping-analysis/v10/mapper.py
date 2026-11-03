"""V10: simultaneous, continuous relational fitting with elastic line lengths.

Only source coordinates, sample rate and one global parameter set enter map_motion.
There are no action identifiers, contact states, IK branches or pose-mode switches.
"""
import numpy as np
import torch
from scipy.spatial.transform import Rotation
from scipy.interpolate import PchipInterpolator, CubicHermiteSpline
from scipy.optimize import minimize
from sources import J, REST, basis, head_basis, unit
torch.set_num_threads(4)
DTYPE=torch.float64
EDGES=[(0,1),(1,2),(2,3),(1,4),(4,5),(0,6),(6,7),(7,8),(1,9),(9,10),(0,11),(11,12),(12,13)]
LIMBS=[(1,4,5,'LeftArm','LeftForeArm','LeftHand'),(1,9,10,'RightArm','RightForeArm','RightHand'),(0,6,7,'LeftLeg','LeftShin','LeftFoot'),(0,11,12,'RightLeg','RightShin','RightFoot')]
def tensor(x):return torch.tensor(np.asarray(x).tolist(),dtype=DTYPE)
def length(x):return torch.sqrt(torch.sum(x*x,dim=-1)+1e-12)
def units(x):return x/length(x)[...,None]
def sq(x):return (x*x).sum()

def torso_direction(s,k):
    """Hips->neck direction with its FORWARD sagittal lean scaled by k.
    The straight torso line stands in for a curled spine, so a forward bend
    reads as more tipped over than the source; scale that lean like head pitch.
    Backward and sideways lean are untouched. Past horizontal (face-down) the
    scaling fades out between 90 and 120 degrees so a lying body stays lying."""
    up=np.array([0.,1.,0.]);v=unit(s[:,J['Neck1']]-s[:,J['Hips']])
    lat=s[:,J['LeftLeg']]-s[:,J['RightLeg']];lat=unit(lat-up*np.sum(lat*up,-1,keepdims=True));fwd=np.cross(lat,up)
    side=np.sum(v*lat,-1,keepdims=True);sag=v-side*lat;size=np.linalg.norm(sag,axis=-1,keepdims=True)
    phi=np.arctan2(np.sum(sag*fwd,-1),np.sum(sag*up,-1))
    fade=np.clip((np.radians(120)-phi)/np.radians(30),0,1)
    new=phi-(1-k)*np.maximum(phi,0)*fade
    sag=size*(np.cos(new)[:,None]*up+np.sin(new)[:,None]*fwd)
    return unit(sag+side*lat)

def extract(s,fps,P):
    F=basis(s);SF=head_basis(s);refF=basis(REST[None])[0];refH=head_basis(REST[None])[0]
    relative=np.einsum('nji,njk->nik',F,SF)@((refF.T@refH).T)
    # Anatomical sagittal pitch is measured from the head-up axis in the torso
    # frame, relative to neutral. Scaling a rotation-vector component does NOT
    # scale that angle when yaw/roll coexist. Rotate its sagittal component only.
    pitch=np.unwrap(np.arctan2(relative[:,2,1],relative[:,1,1]))
    correction=np.zeros((len(s),3));correction[:,0]=(P['head_pitch']-1)*pitch
    HF=F@Rotation.from_rotvec(correction).as_matrix()@relative
    n=len(s);L=P['lengths'];source_leg=np.mean([np.linalg.norm(s[:,J[sd+'Shin']]-s[:,J[sd+'Leg']],axis=-1)+np.linalg.norm(s[:,J[sd+'Foot']]-s[:,J[sd+'Shin']],axis=-1) for sd in ['Left','Right']])
    scale=(L['thigh']+L['shin'])/source_leg
    feet=s[:,[J['LeftFoot'],J['LeftToeEnd'],J['RightFoot'],J['RightToeEnd']]]
    # The lower envelope is measured from native data, including nonzero source offsets.
    # A robust low quantile avoids assigning a single noisy minimum to the whole clip.
    floor=float(np.quantile(feet[:,:,1],.02))
    centered=s.copy();centered[:,:,1]-=floor
    H=centered[:,J['Hips']]*scale
    # Drawn torso line: hips->neck with forward lean scaled (torso_lean; 1 = unchanged).
    # F stays the anatomical body frame for every other relation.
    TD=torso_direction(s,P.get('torso_lean',1.0))
    q=np.zeros((n,14,3));q[:,0]=H;q[:,1]=H+TD*L['torso'];q[:,2]=q[:,1]+TD*L['neck'];q[:,3]=q[:,2]+HF[:,:,1]*L['head_radius']
    preferred=np.tile([L['torso'],L['neck'],L['head_radius'],L['upper_arm'],L['forearm'],L['thigh'],L['shin'],L['foot'],L['upper_arm'],L['forearm'],L['thigh'],L['shin'],L['foot']],(n,1))
    dirs=[];relations=[]
    for li,(root,k,e,a,b,c) in enumerate(LIMBS):
        sd='Left' if li%2==0 else 'Right';end=s[:,J[c]]
        upper=s[:,J[b]]-s[:,J[a]];lower=end-s[:,J[b]]
        # Width comes FROM the nominal total, not on top of that total.
        # Fold its 8:2 vectors into both bones, then fit ONE rigid rotation of
        # the true bone pair. Width cannot manufacture an elbow/knee angle.
        spread=(s[:,J[a]]-s[:,J['Neck1' if li<2 else 'Hips']])*scale
        ei=(3 if li==0 else 8 if li==1 else 5 if li==2 else 10)
        u=unit(upper);v=unit(lower)
        original=np.stack([u*preferred[:,ei,None],v*preferred[:,ei+1,None]],1)
        share=np.array([P['width_share'],1-P['width_share']])[None,:]
        budget=np.linalg.norm(spread,axis=-1)[:,None]*share
        nominal=preferred[:,ei:ei+2]
        assert np.all(nominal>budget),'Source width exceeds nominal limb budget'
        folded=np.stack([u,v],1)*(nominal-budget)[:,:,None]+spread[:,None]*share[:,:,None]
        covariance=np.einsum('nki,nkj->nij',folded,original)
        U,_,Vh=np.linalg.svd(covariance);proper=np.tile(np.eye(3),(n,1,1));proper[:,2,2]=np.linalg.det(U@Vh)
        rotation=U@proper@Vh
        u=np.einsum('nij,nj->ni',rotation,u);v=np.einsum('nij,nj->ni',rotation,v)
        # Fit directions only. Every centreline segment still totals its params length.
        q[:,k]=q[:,root]+u*preferred[:,ei,None];q[:,e]=q[:,k]+v*preferred[:,ei+1,None]
        dirs.append(np.stack([u,v],1));relations.append(np.concatenate([np.sum(u*v,-1,keepdims=True),np.einsum('nji,nj->ni',F,np.cross(u,v))],-1))
    for sd,a,t in [('Left',7,8),('Right',12,13)]:q[:,t]=q[:,a]+unit(s[:,J[sd+'ToeEnd']]-s[:,J[sd+'Foot']])*L['foot']
    # Source-only contact charts. Every relation stays active with a continuous weight.
    palms=np.stack([(s[:,J[sd+'Hand']]+s[:,J[sd+'HandMiddle2']])/2 for sd in ['Left','Right']],1)
    elbows=s[:,[J['LeftForeArm'],J['RightForeArm']]]
    hc=(s[:,J['Head']]+s[:,J['HeadEnd']])/2;rh=np.linalg.norm(s[:,J['HeadEnd']]-s[:,J['Head']],axis=-1)/2
    eye=(s[:,J['LeftEye']]+s[:,J['RightEye']])/2;front=np.maximum(rh,np.abs(np.sum((eye-hc)*SF[:,:,2],-1)))
    radii=np.stack([rh,rh,front],-1)
    arm=np.mean([np.linalg.norm(s[:,J[sd+'ForeArm']]-s[:,J[sd+'Arm']],axis=-1)+np.linalg.norm(palms[:,j]-s[:,J[sd+'ForeArm']],axis=-1) for j,sd in enumerate(['Left','Right'])],axis=0)
    head=[];body=[];opposite=[]
    width=np.linalg.norm(s[:,J['LeftArm']]-s[:,J['RightArm']],axis=-1)
    hipwidth=np.linalg.norm(s[:,J['LeftLeg']]-s[:,J['RightLeg']],axis=-1)
    # Samples along the forearm make wiping with the forearm representable too.
    for side in range(2):
        sd='Left' if side==0 else 'Right';wrist=s[:,J[sd+'Hand']];finger=s[:,J[sd+'HandMiddle2']]
        ft=np.linspace(0,1,13);ht=np.linspace(0,1,9)[1:]
        probes=np.concatenate([elbows[:,side,None]+ft[None,:,None]*(wrist-elbows[:,side])[:,None],wrist[:,None]+ht[None,:,None]*(finger-wrist)[:,None]],axis=1)
        beta=np.r_[ft,np.ones(len(ht))]
        loc=np.einsum('nji,nkj->nki',SF,probes-hc[:,None])/radii[:,None]
        signed=(np.linalg.norm(loc,axis=-1)-1)*rh[:,None]
        cell=np.linalg.norm(finger-wrist,axis=-1)/8
        mix=np.exp(-(signed-signed.min(-1,keepdims=True))/np.maximum(cell[:,None],1e-9));mix/=mix.sum(-1,keepdims=True)
        # One closest-region relation, not a demand that a straight forearm follow a sphere.
        local=np.sum(loc*mix[:,:,None],axis=1);gap=np.sum(np.maximum(0,signed)*mix,axis=1)
        t=mix@beta;band=arm*.18;weight=(band/(band+gap))**4
        # Anatomical latitude, not radial enlargement of a skull-axis ellipsoid.
        # Eye/jaw heights are observed in each source; the same chart is used for all poses.
        eye_y=np.einsum('ni,ni->n',eye-hc,SF[:,:,1])/rh
        jaw_y=np.einsum('ni,ni->n',s[:,J['Jaw']]-hc,SF[:,:,1])/rh
        chin_y=jaw_y-np.linalg.norm(eye-s[:,J['Jaw']],axis=-1)/rh
        latitude=np.empty(n)
        for i in range(n):
            anchors=np.array([chin_y[i],jaw_y[i],eye_y[i],1.])
            assert np.all(np.diff(anchors)>0),('Invalid source face chart',i,anchors)
            # Project to the anatomical surface, whose chin/crown extent differs
            # from the skull-bone ellipsoid. Radial departure is clearance,
            # not a sweep through facial latitudes; the chin remains reachable.
            middle=(anchors[0]+1)/2;extent=(1-anchors[0])/2
            normal=unit(np.array([local[i,0],(local[i,1]-middle)/extent,local[i,2]]))
            surface_y=middle+normal[1]*extent
            # Interpolate angular latitude with zero slope at the poles. The
            # old sqrt(1-y*y) chart had an infinite derivative at the chin.
            angles=np.arcsin([-1.,-.35,.1,1.]);curve=PchipInterpolator(anchors,angles)
            slopes=curve.derivative()(anchors);slopes[[0,-1]]=0
            latitude[i]=CubicHermiteSpline(anchors,angles,slopes)(np.clip(surface_y,anchors[0],1.))
        horizontal=unit(local[:,[0,2]]);radius=np.cos(latitude)
        mapped=np.stack([horizontal[:,0]*radius,np.sin(latitude),horizontal[:,1]*radius],-1)
        target=mapped*(P['lengths']['head_radius']+P['line_radius']+gap*scale)[:,None]
        head.append((side,t,target,weight))
        pt=palms[:,side]
        # Closest torso and both thighs. Source projected coordinates are anatomical charts.
        for ar,br,at,bt,ra,rb in [('Hips','Neck1',0,1,hipwidth*.5,width*.28),('LeftLeg','LeftShin',0,6,hipwidth*.28,hipwidth*.19),('RightLeg','RightShin',0,11,hipwidth*.28,hipwidth*.19)]:
            a=s[:,J[ar]];v=s[:,J[br]]-a;along=np.clip(np.sum((pt-a)*v,-1)/np.sum(v*v,-1),0,1)
            delta=pt-a-along[:,None]*v;radius=ra*(1-along)+rb*along;gap=np.maximum(0,np.linalg.norm(delta,axis=-1)-radius)
            # Neck radius tapers rather than turning the entire shoulder span into a collision capsule.
            if at==0 and bt==1:
                radius*=1-.8*along**4;gap=np.maximum(0,np.linalg.norm(delta,axis=-1)-radius)
            thickness=P['line_radius']*(1+P['torso_line_factor'] if bt==1 else 2)
            offset=unit(delta)*(thickness+gap*scale)[:,None]
            weight=np.exp(-(gap/(arm*.25))**2)
            # Partition competing surface charts by source clearance. A hand at the ear
            # must not simultaneously be pulled toward the neighbouring neck capsule.
            headlocal=np.einsum('nji,nj->ni',SF,pt-hc)/radii
            headgap=np.maximum(0,np.linalg.norm(headlocal,axis=-1)-1)*rh
            weight*=np.exp(-np.maximum(0,gap-headgap)/(arm*.10))
            body.append((side,at,bt,along,offset,weight))
        other=1-side; a=s[:,J['RightArm' if side==0 else 'LeftArm']];b=elbows[:,other];v=b-a
        along=np.clip(np.sum((pt-a)*v,-1)/np.sum(v*v,-1),0,1);delta=pt-a-along[:,None]*v;gap=np.linalg.norm(delta,axis=-1)
        opposite.append((side,other,along,delta*scale,np.exp(-(gap/(arm*.22))**2)))
    pair_delta=(palms[:,0]-palms[:,1])*scale;pairweight=np.exp(-(np.linalg.norm(palms[:,0]-palms[:,1],axis=-1)/(arm*.5))**2)
    footgoal=centered[:,[J['LeftFoot'],J['LeftToeEnd'],J['RightFoot'],J['RightToeEnd']]]*scale
    footgoal[:,:,1]+=P['line_radius']
    # Initialize body height from the legs and source-relative foot support.
    # There is no source pelvis/torso-height target to stretch the legs against.
    q[:,:,1]+=np.mean(footgoal[:,:,1]-q[:,[7,8,12,13],1],axis=1)[:,None]
    support_ids=[4,5,6,9,10,11]
    source_support=np.stack([elbows[:,0],palms[:,0],s[:,J['LeftShin']],elbows[:,1],palms[:,1],s[:,J['RightShin']]],1)
    source_support[:,:,1]-=floor
    support_band=source_leg*.12
    support_weight=(support_band/(support_band+np.maximum(0,source_support[:,:,1])))**4
    support_goal=source_support*scale;support_goal[:,:,1]+=P['line_radius']
    # Temporal transport uses observed anatomical motion, including the directed
    # shoulder/hip displacement. A constructed chain is not independent evidence
    # for endpoint acceleration and must not supply its own temporal reference.
    motion_reference=q.copy()
    for li,(root,k,e,a,b,c) in enumerate(LIMBS):
        sd='Left' if li%2==0 else 'Right'
        end=(centered[:,J[c]]+centered[:,J[sd+'HandMiddle2']])/2 if li<2 else centered[:,J[c]]
        motion_reference[:,k]=centered[:,J[b]]*scale
        motion_reference[:,e]=end*scale
    motion_reference[:,[8,13]]=centered[:,[J['LeftToeEnd'],J['RightToeEnd']]]*scale
    # Seat/body support cannot be observed as furniture from joint-only files.
    # Preserve horizontal root travel and foot relations; leg geometry determines height.
    return dict(TD=TD,base=q,motion_reference=motion_reference,preferred=preferred,F=F,HF=HF,dirs=np.stack(dirs,1),relations=np.stack(relations,1),head=head,body=body,opposite=opposite,pair_delta=pair_delta,pairweight=pairweight,footgoal=footgoal,support_ids=support_ids,support_goal=support_goal,support_weight=support_weight,floor=floor,scale=scale)

def map_motion(s,fps,P):
    r=extract(s,fps,P);w=P['weights'];L=P['lengths'];n=len(s);base=tensor(r['base']);raw=base[:,0].clone().requires_grad_(True)
    F=tensor(r['F']);TD=tensor(r['TD']);HF=tensor(r['HF']);pref=tensor(r['preferred']);direction=tensor(r['dirs']);relations=tensor(r['relations']);footgoal=tensor(r['footgoal']);pair=tensor(r['pair_delta']);pw=tensor(r['pairweight'])
    rotations=torch.zeros((n,4,3),dtype=DTYPE,requires_grad=True)
    extensions=torch.zeros((n,len(EDGES)),dtype=DTYPE,requires_grad=True)
    foot_rotations=torch.zeros((n,2,3),dtype=DTYPE,requires_grad=True)
    foot_directions=tensor(unit(r['base'][:,[8,13]]-r['base'][:,[7,12]]))
    heads=[(side,tensor(t)[:,None],tensor(dst),tensor(weight)) for side,t,dst,weight in r['head']]
    bodies=[(side,a,b,tensor(t),tensor(off),tensor(weight)) for side,a,b,t,off,weight in r['body']]
    opp=[(side,other,tensor(t),tensor(off),tensor(weight)) for side,other,t,off,weight in r['opposite']]
    support_goal=tensor(r['support_goal']);support_weight=tensor(r['support_weight'])
    motion_reference=tensor(r['motion_reference'])
    dt=fps/30.;R=L['head_radius'];line=P['line_radius'];leg=L['thigh']+L['shin'];arm=L['upper_arm']+L['forearm'];ei=[a for a,b in EDGES];ej=[b for a,b in EDGES]
    def posed():
        # All line lengths have the SAME small relative bound around params.
        sizes=pref*(1+extensions)
        H=raw;N=H+TD*sizes[:,0,None]
        neck=N+TD*sizes[:,1,None]
        head=neck+HF[:,:,1]*R
        points=[H,N,neck,head,*[base[:,k] for k in range(4,14)]]
        for li,(root,k,e,*_) in enumerate(LIMBS):
            # One quaternion rotates BOTH source directions. Independent
            # bounded relative length adjustments reconcile nearby relations.
            rv=rotations[:,li,None];v=direction[:,li]
            cv=torch.cross(rv.expand_as(v),v,dim=-1)
            rotated=v+2/(1+(rv*rv).sum(-1,keepdim=True))*(cv+torch.cross(rv.expand_as(v),cv,dim=-1))
            ix=[3,8,5,10][li]
            points[k]=points[root]+rotated[:,0]*sizes[:,ix,None]
            points[e]=points[k]+rotated[:,1]*sizes[:,ix+1,None]
        rv=foot_rotations;v=foot_directions;cv=torch.cross(rv,v,dim=-1)
        feet=v+2/(1+(rv*rv).sum(-1,keepdim=True))*(cv+torch.cross(rv,cv,dim=-1))
        for side,(ankle,toe,ix) in enumerate([(7,8,7),(12,13,12)]):
            points[toe]=points[ankle]+feet[:,side]*sizes[:,ix,None]
        return torch.stack(points,1)
    def objective():
        q=posed()
        bones=q[:,ej]-q[:,ei];lens=length(bones);total=w['length']*sq((lens-pref)/pref)
        total+=w['root']*sq((q[:,0,[0,2]]-base[:,0,[0,2]])/leg)
        total+=w['torso']*sq(units(q[:,1]-q[:,0])-TD)
        total+=w['torso']*sq(units(q[:,2]-q[:,1])-TD)
        total+=w['torso']*sq((q[:,3]-q[:,2])/R-HF[:,:,1])
        for li,(root,k,e,*_) in enumerate(LIMBS):
            u=units(q[:,k]-q[:,root]);v=units(q[:,e]-q[:,k])
            rel=torch.cat([(u*v).sum(-1,keepdim=True),torch.einsum('nji,nj->ni',F,torch.cross(u,v,dim=-1))],-1)
            total+=w['joint_relation']*sq(rel-relations[:,li])
            total+=w['direction']*(sq(u-direction[:,li,0])+sq(v-direction[:,li,1]))
        # Horizontal foot location preserves stance and travel; vertical distance preserves support.
        feet=q[:,[7,8,12,13]];delta=(feet-footgoal)/leg
        # Ankles carry the planted-foot relation (strong); toes only orient the
        # fixed-length foot, so a strong toe pull would tip the foot off the floor.
        total+=w.get('ankle_support',w['support'])*sq(delta[:,[0,2]][:,:,[0,2]])+w['support']*sq(delta[:,[1,3]][:,:,[0,2]])+w['ground']*sq(delta[:,:,1])
        total+=w['ground']*sq(torch.relu(line-feet[:,:,1])/leg)
        support=(q[:,r['support_ids']]-support_goal)/leg*torch.sqrt(support_weight[:,:,None])
        total+=w['ground']*sq(support[:,:,1])+w['support']*sq(support[:,:,[0,2]])
        # The same physical half-space applies to every visible line and to the round head.
        visible=[0,1,2,4,5,6,7,8,9,10,11,12,13]
        radii=tensor([line*P['torso_line_factor'] if k in [0,1,2] else line for k in visible])
        total+=w['nonpenetration']*sq(torch.relu(radii-q[:,visible,1])/leg)
        total+=w['nonpenetration']*sq(torch.relu(R-q[:,3,1])/leg)
        for side,t,dst,weight in heads:
            e,h=(4,5) if side==0 else (9,10);pt=q[:,e]*(1-t)+q[:,h]*t
            goal=q[:,3]+torch.einsum('nij,nj->ni',HF,dst)
            total+=w['head_contact']*sq((pt-goal)/arm*torch.sqrt(weight[:,None]))
        for side,a,b,t,off,weight in bodies:
            h=5 if side==0 else 10;goal=q[:,a]*(1-t[:,None])+q[:,b]*t[:,None]+off
            total+=w['body_contact']*sq((q[:,h]-goal)/arm*torch.sqrt(weight[:,None]))
        for side,other,t,off,weight in opp:
            h=5 if side==0 else 10;e=9 if other==1 else 4
            goal=q[:,1]*(1-t[:,None])+q[:,e]*t[:,None]+off
            total+=w['body_contact']*sq((q[:,h]-goal)/arm*torch.sqrt(weight[:,None]))
        total+=w['pair_contact']*sq((q[:,5]-q[:,10]-pair)/arm*torch.sqrt(pw[:,None]))
        # Penalize actual line/head intersection continuously, without selecting alternative poses.
        for a,b in [(1,4),(4,5),(1,9),(9,10)]:
            v=q[:,b]-q[:,a];t=torch.clamp(((q[:,3]-q[:,a])*v).sum(-1)/(v*v).sum(-1).clamp_min(1e-9),0,1)
            dist=length(q[:,a]+t[:,None]*v-q[:,3]);total+=w['collision']*sq(torch.relu(R+line-dist)/arm)
        correction=(q-motion_reference)/leg
        if n>1:total+=w['temporal_velocity']*sq(torch.diff(correction,dim=0)*dt)
        if n>2:total+=w['temporal_acceleration']*sq(torch.diff(correction,n=2,dim=0)*dt*dt)
        return total/n
    # Explicit bounds keep a saturated length free to move BACK into the box.
    # tanh bounds can strand neighbouring frames on opposite saturated sides,
    # manufacturing a hand jerk despite smooth goals and an acceleration cost.
    variables=[raw,rotations,extensions,foot_rotations]
    counts=[v.numel() for v in variables];starts=np.r_[0,np.cumsum(counts)]
    x0=np.concatenate([np.asarray(v.detach().tolist()).ravel() for v in variables])
    limits=np.full((len(x0),2),[-np.inf,np.inf]);cap=P['max_length_adjustment']
    limits[starts[2]:starts[3]]=[-cap,cap]
    def assign(x):
        with torch.no_grad():
            for i,v in enumerate(variables):v.copy_(tensor(x[starts[i]:starts[i+1]].reshape(tuple(v.shape))))
    def evaluate(x):
        assign(x)
        for v in variables:v.grad=None
        loss=objective();loss.backward()
        gradient=np.concatenate([np.asarray(v.grad.tolist()).ravel() for v in variables])
        return float(loss.detach()),gradient
    initial=float(objective().detach())
    solved=minimize(evaluate,x0,jac=True,method='L-BFGS-B',bounds=limits,options=dict(maxiter=P['iterations'],maxcor=12,ftol=1e-10,gtol=1e-7,maxls=40,maxfun=P['iterations']*3))
    assign(solved.x)
    result=np.asarray(posed().detach().tolist());assert np.isfinite(result).all()
    return result,dict(source_floor=r['floor'],scale=r['scale'],initial_loss=initial,final_loss=float(objective().detach()),evaluations=int(solved.nfev),configured_iterations=P['iterations'],iterations_taken=int(solved.nit),solver='L-BFGS-B explicit relative bounds',solver_success=bool(solved.success),solver_message=str(solved.message)),r
