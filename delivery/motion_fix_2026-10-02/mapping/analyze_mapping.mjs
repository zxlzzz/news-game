// Native frame geometry, baseline and current mapping; no time filtering.
import fs from 'node:fs';
import path from 'node:path';
const out=import.meta.dirname,repo=path.resolve(out,'../../..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const idx=read(path.join(repo,'godot/npc/motion/index.json'));
const P=read(path.join(repo,'godot/npc/skeleton-params.json'));
const rest=read(path.join(repo,'godot/npc/motion/stand_idle.json')).frames[0];
let src=fs.readFileSync(process.argv[2]||path.join(out,'baseline_mapper.mjs'),'utf8');
src=src.replace('let ud=unit(add(u,mul(c,w))),fd=unit(add(fa,mul(c,1-w)));','let ud=unit(add(u,mul(c,w))),fd=unit(add(fa,mul(c,1-w))); const rawUd=ud,rawFd=fd; let spread={};');
src=src.replace('const nu=unit(add(add(mul(hdir,Math.cos(h)),mul(fwd,cf)),mul(out,lat)));','const nu=unit(add(add(mul(hdir,Math.cos(h)),mul(fwd,cf)),mul(out,lat)));spread={a,h,cf,lat,hdir,side,out,fwd};');
src=src.replace('out[sd]={el,hand:add(el,mul(fd,P.foreArm))};','out[sd]={el,hand:add(el,mul(fd,P.foreArm)),ud,fd,rawUd,rawFd,spread};');
src=src.replace('const f={H,N,neckEnd,head,segs:[]};','const f={H,N,neckEnd,head,segs:[],trace:{}};');
src=src.replace('const f={H,N,neckEnd,head,segs:[],supportHands};','const f={H,N,neckEnd,head,segs:[],supportHands,trace:{}};');
src=src.replace('if(len(sub(t,head))<R)t=', 'const beforeHeadPush=t; if(len(sub(t,head))<R)t=');
src=src.replace('const el=arm.knee,hd=arm.end;','f.trace[sd]={wh,bend,back,pole,bend0,target:t,beforeHeadPush,direction:a,arm,N,head,F,lo,hand,palm,srcHead}; const el=arm.knee,hd=arm.end;');
const {createSkeletonMapper}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const map=createSkeletonMapper(idx.names,rest),j=idx.names.indexOf('Hips');
const result={};
for(const [cid,frames] of Object.entries({phone_urgent:[1,2,3,4],elder_assisted_walk:[11,12,13,14,42,43,44,45],duck_cover:[46,47,48,49],handstand:[0],hands_on_head:[15,16,85,86],scratch_head:[57,58],shadow_box:[18,19],wave_overhead:[66,67]})){
 const c=read(path.join(repo,`godot/npc/motion/${cid}.json`));
 result[cid]=frames.map(i=>({frame:i,time:i/c.fps,...map(c.frames[i],P,c.frames[0][j]).trace}));
}
fs.writeFileSync(path.join(out,process.argv[2]?'current_trace.json':'baseline_trace.json'),JSON.stringify(result,null,2));
const fmt=x=>Array.isArray(x)?x.map(q=>+q.toFixed(3)):typeof x==='number'?+x.toFixed(3):x;
for(const [cid,a] of Object.entries(result))for(const f of a){const sd=cid==='phone_urgent'?'Right':'Left',q=f[sd],s=q.direction.spread;console.log(cid,f.frame,JSON.stringify(Object.fromEntries(Object.entries({rawUd:q.direction.rawUd,ud:q.direction.ud,side:s.side,a:s.a*180/Math.PI,h:s.h*180/Math.PI,wh:q.wh,lo:q.lo,hand:q.hand,palm:q.palm,target:q.target}).map(([k,v])=>[k,fmt(v)]))));}
