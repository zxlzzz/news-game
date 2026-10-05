// Accepted NPC mapping: metres, Y up; no DOM, playback state or resource writes.
// names: source joint names; restFrame: stand_idle frame 0.
// mapFrame(sourceFrame, params, clipOrigin) -> {H,N,neckEnd,head,segs}.
// segs: [start, end, lineWidthMultiplier]. Projection is the renderer's job.
export function createSkeletonMapper(names, restFrame) {
  const J=Object.fromEntries(names.map((name,i)=>[name,i]));
  for (const name of ['Hips','Neck1','Head','HeadEnd', ...['Left','Right'].flatMap(s=>['Arm','ForeArm','Hand','Shin','Foot','ToeEnd'].map(n=>s+n))]) {
    if (!(name in J)) throw new Error(`Missing source joint: ${name}`);
  }
  const SRC={thigh:.528,shin:.423}; // source standing leg lengths, metres
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>mul(a,1/Math.max(len(a),1e-9));
const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
function ik(root,l1,l2,target,kneeHint){ // two-bone, cosine rule; bend side from source knee
  const aim=sub(target,root),d=Math.min(Math.max(len(aim),Math.abs(l1-l2)+1e-6),l1+l2-1e-6),ax=unit(aim);
  let b=sub(kneeHint,mul(ax,dot(kneeHint,ax)));
  if(len(b)<1e-6)b=sub([0,0,1],mul(ax,ax[2]));
  const x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x));
  return {knee:add(root,add(mul(ax,x),mul(unit(b),h))),end:add(root,mul(ax,d))};
}
function clearArm(N,head,arm,P,outward){
  const radius=P.headR+P.line/2,e=sub(arm.knee,N),h=sub(arm.end,N),centre=sub(head,N),ab=sub(h,e);
  const t=Math.max(0,Math.min(1,dot(sub(centre,e),ab)/Math.max(dot(ab,ab),1e-12))),closest=add(e,mul(ab,t));
  if(segDist(e,h,centre)>=radius-1e-9)return arm;
  let axis=cross(centre,closest);if(len(axis)<1e-9)axis=cross(centre,outward);axis=unit(axis);
  const clearance=angle=>segDist(rotAxis(e,axis,angle),rotAxis(h,axis,angle),centre)-radius;
  let lo=0,hi=Math.PI;
  for(let i=1;i<=64;i++){const angle=Math.PI*i/64;if(clearance(angle)>=-1e-9){hi=angle;lo=Math.PI*(i-1)/64;break;}}
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(clearance(mid)>=-1e-9)hi=mid;else lo=mid;}
  return {knee:add(N,rotAxis(e,axis,hi)),end:add(N,rotAxis(h,axis,hi))};
}

// Head direction: source Neck1 -> head centre, expressed in the torso's own frame, with the rest-pose
// forward lean removed (at rest the source neck leans ~17deg forward, which reads as a hunch on a stick figure).
function torsoFrame(s){const g=n=>s[J[n]],up=unit(sub(g('Neck1'),g('Hips')));
  let lat=sub(g('LeftArm'),g('RightArm'));lat=unit(sub(lat,mul(up,dot(lat,up))));
  const fw=[lat[1]*up[2]-lat[2]*up[1],lat[2]*up[0]-lat[0]*up[2],lat[0]*up[1]-lat[1]*up[0]];return [lat,up,fw];}
const headVec=s=>sub(mix(s[J.Head],s[J.HeadEnd],.5),s[J.Neck1]);
const toLocal=(v,F)=>F.map(a=>dot(v,a)),toWorld=(l,F)=>add(add(mul(F[0],l[0]),mul(F[1],l[1])),mul(F[2],l[2]));
const REST=unit(toLocal(headVec(restFrame),torsoFrame(restFrame)));
function rotTo(a,b,v){ // rotate v by the rotation taking unit a onto unit b (Rodrigues)
  const k=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sn=len(k),cs=dot(a,b);if(sn<1e-9)return v;
  const u=mul(k,1/sn),th=Math.atan2(sn,cs),kv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  return add(add(mul(v,Math.cos(th)),mul(kv,Math.sin(th))),mul(u,dot(u,v)*(1-Math.cos(th))));}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rotAxis(v,u,th){const kv=cross(u,v);return add(add(mul(v,Math.cos(th)),mul(kv,Math.sin(th))),mul(u,dot(u,v)*(1-Math.cos(th))));}
function headDir(s,P){const F=torsoFrame(s),l=unit(toLocal(headVec(s),F));
  return unit(toWorld(rotTo(REST,[0,1,0],l),F));}
const smoothstep=(e0,e1,x)=>{const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));return t*t*(3-2*t);};
const segDist=(a,b,p)=>{const ab=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),ab)/Math.max(dot(ab,ab),1e-12)));return len(sub(add(a,mul(ab,t)),p));};
// Arms by segment direction: elbow and hand relative to N, per side.
function armsByDirection(s,P,hdir,side){const g=n=>s[J[n]],out={};
  for(const sd of['Left','Right']){
    // No drawn shoulder: the source clavicle (Neck1->Arm) is split between upper arm (clavSplit) and forearm (1-clavSplit).
    const c=sub(g(sd+'Arm'),g('Neck1')),u=sub(g(sd+'ForeArm'),g(sd+'Arm')),fa=sub(g(sd+'Hand'),g(sd+'ForeArm'));
    const w=P.clavSplit;
    let ud=unit(add(u,mul(c,w))),fd=unit(add(fa,mul(c,1-w)));
    // Keep raised arms out of the head: the upper arm may not come closer than minSpread to the head axis.
    // Angles below minSpread+20deg are eased outward (smooth); the push is sideways, forearm rotates with the upper arm.
    if(P.minSpread>0){
      const th=P.minSpread*Math.PI/180,th2=th+20*Math.PI/180,a=Math.acos(Math.max(-1,Math.min(1,dot(ud,hdir))));
      if(a<th2){
        const q=a/th2,h=(2*q**3-3*q*q+1)*th+(-2*q**3+3*q*q)*th2+(q**3-q*q)*th2;
        // push sideways only: keep the arm's forward/back component, grow its outward component
        const out=unit(sub(mul(side,sd==='Left'?1:-1),mul(hdir,dot(side,hdir)*(sd==='Left'?1:-1)))),fwd=cross(hdir,out);
        const cf=dot(ud,fwd),lat=Math.sqrt(Math.max(0,Math.sin(h)**2-cf*cf));
        let nu=unit(add(add(mul(hdir,Math.cos(h)),mul(fwd,cf)),mul(out,lat)));
        // An inward arm cannot switch to the outward azimuth at a=th2: that
        // reflects it even when h-a is almost zero. Turn its azimuth through
        // the same transition band, on the cone (never through the head).
        // Fully raised arms retain the accepted minSpread direction exactly.
        if(a>th&&dot(ud,out)<0){
          const from=unit(sub(ud,mul(hdir,dot(ud,hdir)))),to=unit(sub(nu,mul(hdir,dot(nu,hdir))));
          const az=Math.atan2(dot(hdir,cross(from,to)),dot(from,to));
          const around=rotAxis(from,hdir,az*smoothstep(th2,th,a));
          nu=add(mul(hdir,Math.cos(h)),mul(around,Math.sin(h)));
        }
        const k=cross(ud,nu),sn=len(k);
        if(sn>1e-9){const ang=Math.atan2(sn,dot(ud,nu));fd=rotAxis(fd,mul(k,1/sn),ang);}
        ud=nu;
      }
    }
    const el=mul(ud,P.upperArm);
    out[sd]={el,hand:add(el,mul(fd,P.foreArm))};
  }
  return out;}
// Hand height landmarks along the torso axis, calibrated on the rest frame so standing arms are unchanged:
// source [rest hand, Hips, Neck1, head centre, HeadEnd] -> figure [rest hand, H, N, head centre, head top].
const restHead=mix(restFrame[J.Head],restFrame[J.HeadEnd],.5);
const SRC_HEAD_R=len(sub(restFrame[J.HeadEnd],restHead)); // source head radius, metres
function handHeights(P){const s=restFrame,F=torsoFrame(s),n1=s[J.Neck1],up=v=>dot(sub(v,n1),F[1]);
  const arms=armsByDirection(s,P,headDir(s,P),F[0]),out={};
  for(const sd of['Left','Right'])out[sd]={src:[up(s[J[sd+'Hand']]),up(s[J.Hips]),0,up(restHead),up(s[J.HeadEnd])],
    fig:[dot(arms[sd].hand,F[1]),-P.torso,0,P.neck+P.headR,P.neck+2*P.headR]};
  return out;}
function heightOf(L,v){const x=L.src,y=L.fig,n=x.length; // piecewise linear, end pieces extended
  let i=1;while(i<n-1&&v>x[i])i++;
  return y[i-1]+(v-x[i-1])*(y[i]-y[i-1])/(x[i]-x[i-1]);}
function mapFrame(s,P,origin){ // s: source frame indexed by names -> drawn figure
  const g=n=>s[J[n]];
  const hs=g('Hips');
  const r=(P.thigh+P.shin)/(SRC.thigh+SRC.shin),o=origin;
  const S=p=>[o[0]+(p[0]-o[0])*r,p[1]*r,o[2]+(p[2]-o[2])*r]; // whole walk scaled with leg length
  let H=S(hs);
  // lower hips if an ankle target is out of reach
  let drop=0;const reach=P.thigh+P.shin-1e-4;
  for(const sd of['Left','Right']){const o=sub(H,S(g(sd+'Foot'))),h2=o[0]**2+o[2]**2;
    if(o[1]>0&&len(o)>reach&&h2<reach*reach)drop=Math.max(drop,o[1]-Math.sqrt(reach*reach-h2));}
  H=[H[0],H[1]-drop,H[2]];
  const F=torsoFrame(s),supportHands=[],supportTargets={};
  let N=add(H,mul(F[1],P.torso)),lift=0;
  for(const sd of['Left','Right']){
    const hand=g(sd+'Hand'),fore=sub(hand,g(sd+'ForeArm'));
    const palm=add(hand,mul(unit(fore),P.palm));
    // Inverted, floor-reaching palms support the body. This is source
    // geometry, not a clip name or a temporal filter. Upright poses are 0.
    const support=smoothstep(P.headFar,P.headTouch,palm[1])*smoothstep(0,-1,F[1][1]);
    supportHands.push(support);
    const target=S(hand);target[1]=P.line/2;supportTargets[sd]=target;
    const upper=sub(g(sd+'ForeArm'),g(sd+'Arm'));
    const extension=len(add(upper,fore))/Math.max(len(upper)+len(fore),1e-9);
    const reach=(P.upperArm+P.foreArm)*extension;
    const delta=sub(target,N),horizontal=delta[0]**2+delta[2]**2;
    lift=Math.max(lift,target[1]+Math.sqrt(Math.max(0,reach*reach-horizontal))-N[1]);
  }
  // Preserve the source's arm extension and let the palms carry the body;
  // merely clamping wrists would leave an inverted head on the floor.
  lift*=Math.min(...supportHands);
  H=add(H,[0,lift,0]);N=add(N,[0,lift,0]);
  const hd=headDir(s,P),hdir=hd,side=F[0];
  const neckEnd=add(N,mul(hd,P.neck)),head=add(neckEnd,mul(hd,P.headR));
  const f={H,N,neckEnd,head,segs:[],supportHands};
  f.segs.push([H,N,P.torsoLine],[N,neckEnd,P.torsoLine]);
  // Hands: start from the direction rule, then keep two relations the figure's proportions lose
  // (short upper arm, long forearm, big head): the hand's height along the torso, by landmarks; and a hand
  // touching the head stays on the head (the source palm is mapped relative to the head centre).
  const arms=armsByDirection(s,P,hdir,side),heights=handHeights(P);
  const srcHead=mix(g('Head'),g('HeadEnd'),.5),R=P.headR+P.line/2;
  for(const sd of['Left','Right']){
    const a=arms[sd],hand=g(sd+'Hand');
    const lo=toLocal(a.hand,F);lo[1]=heightOf(heights[sd],dot(sub(hand,g('Neck1')),F[1]));
    let t=add(N,toWorld(lo,F));
    const palm=add(hand,mul(unit(sub(hand,g(sd+'ForeArm'))),P.palm));
    const gap=len(sub(palm,srcHead))-SRC_HEAD_R;
    // Head radius belongs to the figure; the surface gap belongs to the
    // moving hand and uses limb scale. Scaling the whole offset by the big
    // head ratio amplified approach/release motion and the proximity blend.
    const headTarget=add(head,mul(unit(sub(palm,srcHead)),R+Math.max(0,gap)*r));
    // If proportions put the hand near the figure head, carry over the
    // source's surface clearance too. Correct only the excess mismatch:
    // a remote source hand's clearance permits its ordinary direction pose.
    const excess=Math.max(0,1-Math.max(0,gap)*r/Math.max(len(sub(headTarget,t)),1e-9));
    const near=smoothstep(2*R,R,len(sub(t,head)))*excess;
    const wh=Math.max(smoothstep(P.headFar,P.headTouch,gap),near);
    t=mix(t,headTarget,wh);
    if(len(sub(t,head))<R)t=add(head,mul(unit(sub(t,head)),R));
    // the arm may not cross the head disc: as it starts to, bend the elbow outward, and if that is not
    // enough (a raised straight arm) blend back to the direction rule, which spreads raised arms (minSpread).
    // Both blends follow the overlap depth, so the arm never jumps between frames.
    const overlap=(e,h)=>R-segDist(e,h,head),m=P.headR*.25;
    const outward=unit(sub(mul(side,sd==='Left'?1:-1),mul(hdir,dot(side,hdir)*(sd==='Left'?1:-1))));
    // elbow side: the direction rule's elbow, steadied by the source's own bend for near-straight arms
    const sa=g(sd+'Arm'),sh=sub(hand,sa),bend0=sub(sub(g(sd+'ForeArm'),sa),mul(sh,dot(sub(g(sd+'ForeArm'),sa),sh)/Math.max(dot(sh,sh),1e-12)));
    const pole=add(a.el,mul(unit(bend0),P.upperArm*.1));
    t=mix(t,supportTargets[sd],supportHands[sd==='Left'?0:1]);
    let arm=ik(N,P.upperArm,P.foreArm,t,pole);
    const bend=smoothstep(-m,m,overlap(arm.knee,arm.end));
    arm=ik(N,P.upperArm,P.foreArm,t,mix(unit(pole),outward,bend));
    const back=smoothstep(-m,m,overlap(arm.knee,arm.end))*(1-smoothstep(.3,.7,wh))*(1-supportHands[sd==='Left'?0:1]);
    arm=ik(N,P.upperArm,P.foreArm,mix(arm.end,add(N,a.hand),back),sub(mix(arm.knee,add(N,a.el),back),N));
    arm=clearArm(N,head,arm,P,outward);
    const el=arm.knee,hd=arm.end;
    const ankle=add(S(g(sd+'Foot')),[0,lift,0]);
    const {knee,end}=ik(H,P.thigh,P.shin,ankle,sub(g(sd+'Shin'),hs));
    const toe=add(end,mul(unit(sub(g(sd+'ToeEnd'),g(sd+'Foot'))),P.foot));
    f.segs.push([N,el,1],[el,hd,1],[H,knee,1],[knee,end,1]);
    if(P.foot>0)f.segs.push([end,toe,1]);
  }
  return f;
}

  return mapFrame;
}
