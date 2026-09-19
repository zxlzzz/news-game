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

// Keep the real shoulder-to-elbow segment. Join the centre of the torso to the
// shoulder with a smooth outward-first curve, rather than a neck-to-elbow shortcut.
// The construction follows the torso axis in 3D, so leaning/turning are preserved.
export function armStroke(joints, ix, side, softness) {
  const root=joints[ix.Neck2],shoulder=joints[ix[side+'Arm']];
  const axis=unit(sub(joints[ix.Neck1],joints[ix.Chest]));
  const control=sub(shoulder,mul(axis,dot(sub(shoulder,root),axis)));
  const upperArm=sub(joints[ix[side+'ForeArm']],shoulder);
  const approach=sub(shoulder,mul(unit(upperArm),Math.min(norm(upperArm)*.15,.04)));
  const bridge=[];
  for(let i=0;i<=12;i++){
    const u=i/12;
    const point=add(add(mul(root,(1-u)**3),mul(control,3*u*(1-u)**2)),
      add(mul(approach,3*u*u*(1-u)),mul(shoulder,u**3)));
    bridge.push({point,t:u*.15});
  }
  const arm=limbStroke(shoulder,joints[ix[side+'ForeArm']],joints[ix[side+'Hand']],softness);
  return [...bridge,...arm.slice(1).map(s=>({point:s.point,t:.15+.85*s.t}))];
}

export function taper(t, proximal, distal) {
  const smooth=t*t*(3-2*t);
  return proximal+(distal-proximal)*smooth;
}
