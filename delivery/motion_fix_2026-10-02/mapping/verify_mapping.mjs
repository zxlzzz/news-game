// Compare native source frames using baseline/current pure mapping. No playback timing assumptions.
import fs from 'node:fs';import path from 'node:path';
import {createSkeletonMapper as baseline} from './baseline_mapper.mjs';
import {createSkeletonMapper as current} from '../../../sth/motion-study/skeleton-mapping.mjs';
const out=import.meta.dirname,repo=path.resolve(out,'../../..'),g=path.join(repo,'godot/npc');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const idx=read(path.join(g,'motion/index.json')),P=read(path.join(g,'skeleton-params.json'));
const rest=read(path.join(g,'motion/stand_idle.json')).frames[0],J=Object.fromEntries(idx.names.map((n,i)=>[n,i]));
const before=baseline(idx.names,rest),after=current(idx.names,rest),r=(P.thigh+P.shin)/(.528+.423);
const sub=(a,b)=>a.map((x,i)=>x-b[i]),len=a=>Math.hypot(...a),cm=(a,b)=>len(sub(a,b))*300;
const endpoints=m=>({handLeft:m.segs[3][1],handRight:m.segs[8][1],elbowLeft:m.segs[2][1],elbowRight:m.segs[7][1]});
const SJ={handLeft:'LeftHand',handRight:'RightHand',elbowLeft:'LeftForeArm',elbowRight:'RightForeArm'};
const result={clips:{},invalid:[],max_bone_error_m:0,changed_native_frames:0,source_native_frames:0,new_amplification_candidates:[]};
for(const rec of idx.clips){
 const c=read(path.join(g,`motion/${rec.id}.json`)),origin=c.frames[0][J.Hips];
 const a=c.frames.map(s=>before(s,P,origin)),b=c.frames.map(s=>after(s,P,origin));
 result.source_native_frames+=c.frames.length;
 const d={native_frames:c.frames.length,fps:c.fps,events:[],max_pose_change_cm:0,max_support_weight:0,max_paired_support_weight:0};
 for(let i=0;i<b.length;i++){
  const m=b[i];let change=0;
  d.max_support_weight=Math.max(d.max_support_weight,...m.supportHands);
  d.max_paired_support_weight=Math.max(d.max_paired_support_weight,Math.min(...m.supportHands));
  for(let k=0;k<m.segs.length;k++)for(let end=0;end<2;end++)change=Math.max(change,cm(a[i].segs[k][end],m.segs[k][end]));
  change=Math.max(change,cm(a[i].head,m.head));d.max_pose_change_cm=Math.max(d.max_pose_change_cm,change);
  if(change>1e-6)result.changed_native_frames++;
  if(!m.segs.every(s=>s.slice(0,2).every(v=>v.every(Number.isFinite)))||!m.head.every(Number.isFinite))result.invalid.push([rec.id,i]);
  for(const [seg,target] of [[0,P.torso],[1,P.neck],[2,P.upperArm],[3,P.foreArm],[4,P.thigh],[5,P.shin],[6,P.foot],[7,P.upperArm],[8,P.foreArm],[9,P.thigh],[10,P.shin],[11,P.foot]])result.max_bone_error_m=Math.max(result.max_bone_error_m,Math.abs(len(sub(m.segs[seg][0],m.segs[seg][1]))-target));
  if(i>0){
   const aa=endpoints(a[i-1]),ab=endpoints(a[i]),ba=endpoints(b[i-1]),bb=endpoints(b[i]);
   for(const point of Object.keys(aa))d.events.push({point,frame_before:i-1,frame_after:i,time_before_s:(i-1)/c.fps,time_after_s:i/c.fps,
    before_cm:cm(sub(aa[point],a[i-1].N),sub(ab[point],a[i].N)),after_cm:cm(sub(ba[point],b[i-1].N),sub(bb[point],b[i].N)),
    source_scaled_cm:cm(sub(c.frames[i-1][J[SJ[point]]],c.frames[i-1][J.Neck1]),sub(c.frames[i][J[SJ[point]]],c.frames[i][J.Neck1]))*r});
  }
 }
 d.events.sort((a,b)=>b.after_cm-a.after_cm);d.largest_steps=d.events.slice(0,8);
 result.new_amplification_candidates.push(...d.events.filter(e=>e.after_cm>12&&e.after_cm>e.before_cm+5&&e.after_cm>3*Math.max(1,e.source_scaled_cm)&&e.source_scaled_cm<8).map(e=>({clip:rec.id,...e})));
 d.confirmed_target_events=d.events.filter(e=>({phone_urgent:[3],elder_assisted_walk:[13,44],duck_cover:[48]})[rec.id]?.includes(e.frame_after));
 delete d.events;result.clips[rec.id]=d;
}
fs.writeFileSync(path.join(out,'native_comparison.json'),JSON.stringify(result,null,2));
console.log('new_amplification_candidates',JSON.stringify(result.new_amplification_candidates.slice(0,25)));
console.log(JSON.stringify({clips:Object.keys(result.clips).length,frames:result.source_native_frames,changed:result.changed_native_frames,invalid:result.invalid,max_bone_error_m:result.max_bone_error_m}));
for(const id of ['phone_urgent','elder_assisted_walk','duck_cover','handstand','cheer','cross_arms','photo_overhead'])console.log(id,JSON.stringify(result.clips[id].confirmed_target_events.length?result.clips[id].confirmed_target_events: {max_pose_change_cm:result.clips[id].max_pose_change_cm}));
