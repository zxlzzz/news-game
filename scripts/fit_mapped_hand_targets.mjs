// Usage: node scripts/fit_mapped_hand_targets.mjs input.json output.json
// Input: names, rest, frames, params, scale, targets[T][left/right]; null leaves a side free.
// Fits source arm lengths and mapped wrists for conditioning only. Output is reference joint arrays.
// Prepare sparse conditioning references; never edit a delivered/generated NPZ.
import fs from 'node:fs';
import {createSkeletonMapper} from '../sth/motion-study/skeleton-mapping.mjs';
const d=JSON.parse(fs.readFileSync(process.argv[2],'utf8')), map=createSkeletonMapper(d.names,d.rest), J=Object.fromEntries(d.names.map((n,i)=>[n,i]));
const origin=[d.frames[0][0][0],0,d.frames[0][0][2]], norm=a=>Math.hypot(...a),sub=(a,b)=>a.map((v,i)=>v-b[i]);let worst=0,boneWorst=0;
function solve(A,b){A=A.map((r,i)=>[...r,b[i]]);for(let k=0;k<b.length;k++){let r=k;for(let j=k+1;j<b.length;j++)if(Math.abs(A[j][k])>Math.abs(A[r][k]))r=j;[A[k],A[r]]=[A[r],A[k]];const v=A[k][k]||1e-12;for(let j=k;j<=b.length;j++)A[k][j]/=v;for(let i=0;i<b.length;i++)if(i!==k){const v=A[i][k];for(let j=k;j<=b.length;j++)A[i][j]-=v*A[k][j];}}return A.map(r=>r[b.length]);}
for(let f=0;f<d.frames.length;f++)for(let side=0;side<2;side++){
 const target=d.targets[f][side];if(!target)continue;const sd=['Left','Right'][side],p=d.frames[f],a=J[sd+'Arm'],e=J[sd+'ForeArm'],h=J[sd+'Hand'];const oldE=[...p[e]],oldH=[...p[h]],base=[...oldE,...oldH],L1=norm(sub(oldE,p[a])),L2=norm(sub(oldH,oldE));let x=[...base];
 function residual(z){p[e]=z.slice(0,3);p[h]=z.slice(3);const hand=map(p,d.params,origin).segs[side?8:3][1].map((v,i)=>(v-origin[i])*d.scale);return [...sub(hand,target),3*(norm(sub(p[e],p[a]))-L1),3*(norm(sub(p[h],p[e]))-L2),...z.map((v,i)=>(v-base[i])*.0005)];}
 for(let it=0;it<65;it++){const r=residual(x),cost=r.reduce((s,v)=>s+v*v,0);if(cost<1e-12)break;const eps=1e-4,cols=x.map((_,i)=>{const y=[...x];y[i]+=eps;return residual(y).map((v,j)=>(v-r[j])/eps)});const A=cols.map((v,i)=>cols.map((w,j)=>v.reduce((s,t,k)=>s+t*w[k],0)+(i===j?1e-6:0))),b=cols.map(v=>-v.reduce((s,t,k)=>s+t*r[k],0));let step=solve(A,b),size=norm(step);if(size>.15)step=step.map(v=>v*.15/size);let factor=1;for(;factor>.01;factor*=.5){const y=x.map((v,i)=>v+factor*step[i]),rr=residual(y);if(rr.reduce((s,v)=>s+v*v,0)<cost){x=y;break;}}if(factor<=.01)break;}
 const rr=residual(x);worst=Math.max(worst,norm(rr.slice(0,3)));boneWorst=Math.max(boneWorst,...rr.slice(3,5).map(v=>Math.abs(v/3)));const delta=sub(p[h],oldH);for(const [name,i] of Object.entries(J))if(name.startsWith(sd+'Hand')&&i!==h)p[i]=p[i].map((v,j)=>v+delta[j]);
}
fs.writeFileSync(process.argv[3],JSON.stringify(d.frames));console.log(JSON.stringify({target_fit_max_m:worst,bone_length_max_error_m:boneWorst}));
