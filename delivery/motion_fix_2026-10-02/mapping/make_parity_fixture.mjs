// Expected pure-mapping coordinates for actual GDScript parity checks.
import fs from 'node:fs';import path from 'node:path';
import {createSkeletonMapper} from '../../../sth/motion-study/skeleton-mapping.mjs';
const out=import.meta.dirname,g=path.resolve(out,'../../../godot/npc'),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const idx=read(path.join(g,'motion/index.json')),P=read(path.join(g,'skeleton-params.json'));
const map=createSkeletonMapper(idx.names,read(path.join(g,'motion/stand_idle.json')).frames[0]),H=idx.names.indexOf('Hips');
const extra={phone_urgent:[0,1,2,3,4],elder_assisted_walk:[12,13,43,44,45],duck_cover:[46,47,48,49],handstand:[0,20,40,60],hands_on_head:[15,16,85,86],scratch_head:[57,58],shadow_box:[18,19],wave_overhead:[66,67]};
const cases=[];
for(const c of idx.clips){const data=read(path.join(g,'motion',c.id+'.json'));
 for(const frame of new Set([0,Math.floor(data.frames.length/2),data.frames.length-1,...extra[c.id]||[]])){
  if(frame>=data.frames.length)continue;
  cases.push({clip:c.id,frame,mapped:map(data.frames[frame],P,data.frames[0][H])});
 }
}
fs.writeFileSync(path.join(out,'parity_fixture.json'),JSON.stringify({params:P,cases}));
console.log('PARITY_FIXTURE',cases.length,'native frames in',idx.clips.length,'clips');
