// Read-only scan of every native exported frame through the current shared mapper.
// It ranks changes for review; it does not declare motion quality from thresholds.
import fs from 'node:fs';
import path from 'node:path';
import {createSkeletonMapper} from '../../sth/motion-study/skeleton-mapping.mjs';
const repo = path.resolve(import.meta.dirname, '../..');
const dir = path.join(repo, 'godot/npc');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const index = read(path.join(dir, 'motion/index.json'));
const P = read(path.join(dir, 'skeleton-params.json'));
const rest = read(path.join(dir, 'motion/stand_idle.json')).frames[0];
const map = createSkeletonMapper(index.names, rest);
const J = Object.fromEntries(index.names.map((n,i)=>[n,i]));
const scale=3, r=(P.thigh+P.shin)/(.528+.423);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dist=(a,b)=>Math.hypot(...sub(a,b));
const points=m=>({head:m.head,neck:m.N,hip:m.H,elbowLeft:m.segs[2][1],handLeft:m.segs[3][1],
  kneeLeft:m.segs[4][1],ankleLeft:m.segs[5][1],toeLeft:m.segs[6][1],
  elbowRight:m.segs[7][1],handRight:m.segs[8][1],kneeRight:m.segs[9][1],ankleRight:m.segs[10][1],toeRight:m.segs[11][1]});
const SRC={head:null,neck:'Neck1',hip:'Hips',elbowLeft:'LeftForeArm',handLeft:'LeftHand',kneeLeft:'LeftShin',ankleLeft:'LeftFoot',toeLeft:'LeftToeEnd',
  elbowRight:'RightForeArm',handRight:'RightHand',kneeRight:'RightShin',ankleRight:'RightFoot',toeRight:'RightToeEnd'};
const result={parameters:P,body_scale:scale,clips:{}};
for(const rec of index.clips){
  const d=read(path.join(dir,`motion/${rec.id}.json`));
  const fr=d.frames, origin=fr[0][J.Hips], out=fr.map(f=>points(map(f,P,origin)));
  const stats={frames:fr.length,fps:d.fps,events:[],max_step:{}};
  for(const key of Object.keys(out[0])){
    const events=[];
    for(let i=1;i<out.length;i++){
      const anchor=key==='hip'?'hip':'neck';
      const a=sub(out[i-1][key],out[i-1][anchor]),b=sub(out[i][key],out[i][anchor]);
      const cm=dist(a,b)*scale*100;
      const sj=SRC[key];
      const src_cm=sj?dist(sub(fr[i-1][J[sj]],fr[i-1][J.Neck1]),sub(fr[i][J[sj]],fr[i][J.Neck1]))*r*scale*100:0;
      events.push({point:key,frame:i,time:i/d.fps,mapped_cm:cm,source_scaled_cm:src_cm,
        before:out[i-1][key],after:out[i][key],neck_before:out[i-1].neck,neck_after:out[i].neck});
    }
    events.sort((a,b)=>b.mapped_cm-a.mapped_cm);
    stats.max_step[key]=events[0]?.mapped_cm??0;
    if(key.startsWith('hand')||key.startsWith('elbow')) stats.events.push(...events.slice(0,6));
  }
  stats.events.sort((a,b)=>b.mapped_cm-a.mapped_cm);
  stats.events=stats.events.slice(0,16);
  result.clips[rec.id]=stats;
}
const out=path.join(import.meta.dirname,'native_mapping_metrics.json');
fs.writeFileSync(out,JSON.stringify(result,null,2));
console.log(`NATIVE_MAPPING_SCAN ${Object.keys(result.clips).length} clips`);
const top=Object.entries(result.clips).flatMap(([clip,s])=>s.events.map(e=>({clip,...e}))).sort((a,b)=>b.mapped_cm-a.mapped_cm).slice(0,30);
console.log(JSON.stringify(top.map(({clip,point,frame,time,mapped_cm,source_scaled_cm})=>({clip,point,frame,time,mapped_cm,source_scaled_cm})),null,2));
