import {readFileSync} from 'node:fs';
import {createSkeletonMapper as NewM} from 'file:///C:/Users/Hsinlung/Desktop/news-game/sth/motion-study/skeleton-mapping.mjs';
import {createSkeletonMapper as OldM} from './old-mapping.mjs';
const G='C:/Users/Hsinlung/Desktop/news-game/godot/';
const rj=p=>JSON.parse(readFileSync(G+p,'utf8'));
const index=rj('npc/motion/index.json'), P=rj('npc/skeleton-params.json');
const rest=rj('npc/motion/stand_idle.json').frames[0];
const nm=NewM(index.names,rest), om=OldM(index.names,rest);
const hips=index.names.indexOf('Hips');
const d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const rows=[];
for(const c of index.clips){const fr=rj(`npc/motion/${c.id}.json`).frames,o=fr[0][hips];
  let jn=0,jo=0,prevN=null,prevO=null;
  for(const f of fr){const a=nm(f,P,o),b=om(f,P,o);
    const hn=[a.segs[3][1],a.segs[8][1],a.segs[2][1],a.segs[7][1]],ho=[b.segs[3][1],b.segs[8][1],b.segs[2][1],b.segs[7][1]];
    if(prevN){for(let i=0;i<4;i++){jn=Math.max(jn,d(hn[i],prevN[i]));jo=Math.max(jo,d(ho[i],prevO[i]));}}
    prevN=hn;prevO=ho;}
  rows.push([c.id,jn*3,jo*3]);}
rows.sort((a,b)=>(b[1]-b[2])-(a[1]-a[2]));
for(const r of rows.slice(0,25))console.log(r[0],r[1].toFixed(3),r[2].toFixed(3));
