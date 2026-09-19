// Visual paths only: preserve hands/feet and motion data; soften a small area
// around a hinge instead of displaying additional anatomical joints.
import {add, sub, mul, mix, norm, unit, dot} from './retarget.mjs';

// The drawn arm junction must sit below the head, not at the anatomical upper
// neck hidden inside its disc. Place the fork just below Neck1, not at Chest
// (too low) or the moving shoulder midpoint (rises inside the head on arm lifts).
// Leave the motion/IK skeleton untouched and retain one central junction.
export function displayJoints(joints, ix) {
  const display=joints.map(p=>[...p]);
  display[ix.Neck2]=mix(joints[ix.Neck1],joints[ix.Chest],.2);
  return display;
}

export function limbStroke(a, hinge, end, softness) {
  const l1 = norm(sub(hinge,a)), l2 = norm(sub(end,hinge));
  const trim = Math.min(l1*.22,l2*.22,.075) * Math.max(0,Math.min(1,softness));
  if(trim<1e-8)return [{point:a,t:0},{point:hinge,t:.5},{point:end,t:1}];
  const entry=mix(hinge,a,trim/Math.max(l1,1e-8));
  const exit=mix(hinge,end,trim/Math.max(l2,1e-8));
  const samples=[{point:a,t:0},{point:entry,t:.5*(1-trim/l1)}];
  for(let i=1;i<=8;i++){
    const u=i/8;
    const point=add(add(mul(entry,(1-u)**2),mul(hinge,2*u*(1-u))),mul(exit,u*u));
    samples.push({point,t:.5*(1-trim/l1)*(1-u)+(.5+.5*trim/l2)*u});
  }
  samples.push({point:end,t:1});
  return samples;
}

// Retain the shoulder as a guide, rounding INSIDE the two incident segments.
// Unlike a cubic forced through the shoulder, this cannot overshoot upward and
// create a hooked shoulder cap. Hands stay at the retargeted wrist endpoint.
export function armStroke(joints, ix, side, softness) {
  const root=joints[ix.Neck2], shoulder=joints[ix[side+'Arm']];
  const elbow=joints[ix[side+'ForeArm']], hand=joints[ix[side+'Hand']];
  const incoming=norm(sub(shoulder,root)), outgoing=norm(sub(elbow,shoulder));
  const trim=Math.min(incoming*.3,outgoing*.18,.055)*Math.max(0,Math.min(1,softness));
  const axis=unit(sub(joints[ix.Neck1],joints[ix.Chest]));
  const control=sub(shoulder,mul(axis,dot(sub(shoulder,root),axis)));
  const exit=mix(shoulder,elbow,trim/Math.max(outgoing,1e-8));
  const bridge=[{point:root,t:0}];
  for(let i=1;i<=12;i++){
    const u=i/12;
    bridge.push({point:add(add(mul(root,(1-u)**3),mul(control,3*u*(1-u)**2)),
      add(mul(shoulder,3*u*u*(1-u)),mul(exit,u**3))),t:.15*u});
  }
  const arm=limbStroke(exit,elbow,hand,softness);
  return [...bridge,...arm.slice(1).map(s=>({point:s.point,t:.15+.85*s.t}))];
}

export function taper(t, proximal, distal) {
  const smooth=t*t*(3-2*t);
  return proximal+(distal-proximal)*smooth;
}
