// Visual paths only: preserve hands/feet and motion data; soften a small area
// around a hinge instead of displaying additional anatomical joints.
import {add, sub, mul, mix, norm} from './retarget.mjs';

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

export function taper(t, proximal, distal) {
  const smooth=t*t*(3-2*t);
  return proximal+(distal-proximal)*smooth;
}
