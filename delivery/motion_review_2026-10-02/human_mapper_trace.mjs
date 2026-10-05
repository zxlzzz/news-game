// Instrument the accepted mapper in memory; no production edits.
import fs from 'node:fs';
import path from 'node:path';
const out=import.meta.dirname,repo=path.resolve(out,'../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const idx=read(path.join(repo,'godot/npc/motion/index.json'));
const P=read(path.join(repo,'godot/npc/skeleton-params.json'));
const rest=read(path.join(repo,'godot/npc/motion/stand_idle.json')).frames[0];
let src=fs.readFileSync(path.join(repo,'sth/motion-study/skeleton-mapping.mjs'),'utf8');
src=src.replace('const f={H,N,neckEnd,head,segs:[]};','const f={H,N,neckEnd,head,segs:[],trace:{}};');
src=src.replace('out[sd]={el,hand:add(el,mul(fd,P.foreArm))};','out[sd]={el,hand:add(el,mul(fd,P.foreArm)),ud,fd,combinedUpperLength:len(add(u,mul(c,w))),combinedForeLength:len(add(fa,mul(c,1-w))),c,u,fa};');
src=src.replace('const bend=smoothstep(-m,m,overlap(arm.knee,arm.end));','const initial=arm; const bend=smoothstep(-m,m,overlap(arm.knee,arm.end));');
src=src.replace('const back=smoothstep(-m,m,overlap(arm.knee,arm.end))','const second=arm; const back=smoothstep(-m,m,overlap(arm.knee,arm.end))');
src=src.replace('const el=arm.knee,hd=arm.end;','f.trace[sd]={wh,bend,back,pole,bend0,target:t,direction:a,initial,second,final:arm,N,head}; const el=arm.knee,hd=arm.end;');
const {createSkeletonMapper}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const map=createSkeletonMapper(idx.names,rest),j=idx.names.indexOf('Hips');
const result={};
for(const [cid,frames] of Object.entries({phone_urgent:[2,3],elder_assisted_walk:[12,13,43,44],duck_cover:[47,48]})){
  const c=read(path.join(repo,`godot/npc/motion/${cid}.json`));
  result[cid]=frames.map(i=>({frame:i,time:i/c.fps,...map(c.frames[i],P,c.frames[0][j]).trace}));
}
fs.writeFileSync(path.join(out,'human_mapper_trace.json'),JSON.stringify(result,null,2));
const intervention={};
const len=a=>Math.hypot(...a),sub=(a,b)=>a.map((x,i)=>x-b[i]);
for(const [cid,frames] of Object.entries({phone_urgent:[2,3],elder_assisted_walk:[12,13,43,44],duck_cover:[47,48]})){
  const c=read(path.join(repo,`godot/npc/motion/${cid}.json`)),sd=cid==='phone_urgent'?'Right':'Left',sg=sd==='Right'?8:3;
  intervention[cid]={};
  for(const [name,params] of Object.entries({current:P,spread_disabled:{...P,minSpread:0},head_touch_disabled:{...P,headFar:-10,headTouch:-11}})){
    const a=frames.map(i=>map(c.frames[i],params,c.frames[0][j]));
    intervention[cid][name]=a.filter((_,i)=>i%2===0).map((q,i)=>len(sub(sub(a[i*2+1].segs[sg][1],a[i*2+1].N),sub(q.segs[sg][1],q.N)))*300);
  }
}
fs.writeFileSync(path.join(out,'human_mapper_intervention.json'),JSON.stringify(intervention,null,2));
console.log(JSON.stringify(intervention,null,2));
for(const [id,a] of Object.entries(result))for(const f of a)console.log(id,f.frame,JSON.stringify({L:{wh:f.Left.wh,bend:f.Left.bend,back:f.Left.back},R:{wh:f.Right.wh,bend:f.Right.bend,back:f.Right.back}}));
