import {createSkeletonMapper} from './skeleton-mapping.mjs';
const [DATA, proportions] = await Promise.all(['./motions.json','./skeleton-params.json'].map(async url=>{
  const response=await fetch(url);
  if(!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}));
const DEF={...proportions,yaw:-8,pitch:0};
const mapFrame=createSkeletonMapper(DATA.names,DATA.clips.stand_idle.frames[0]);
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const SPEC=[
['头和躯干'],['headR','头半径',.05,.3,.005,'m'],['neck','脖子长',0,.2,.005,'m'],['torso','躯干长',.08,.65,.005,'m'],
['四肢'],['clavSplit','肩分给大臂',0,1,.05,'%'],['minSpread','举手最小张角',0,80,1,'°'],['upperArm','上臂',.04,.4,.001,'m'],['foreArm','前臂',.04,.4,.001,'m'],['thigh','大腿',.05,.7,.005,'m'],['shin','小腿',.05,.6,.005,'m'],['foot','脚长',0,.3,.005,'m'],
['线条'],['line','线宽',.005,.12,.001,'m'],['torsoLine','躯干线宽倍数',.5,2,.05,'×'],
['自由视角'],['yaw','朝向',-180,180,1,'°'],['pitch','俯视',0,60,1,'°']];
const SRC={thigh:.528,shin:.423,groundAnkle:.07};
const J=Object.fromEntries(DATA.names.map((n,i)=>[n,i]));
const $=id=>document.getElementById(id);
const P={...DEF};
let clipId='wave_both_overhead',el=0,playing=true,prev,ORIGIN=[0,0,0];
function frameAt(){const c=DATA.clips[clipId],fl=Math.min(el*c.fps,c.frames.length-1),a=Math.floor(fl),b=Math.min(a+1,c.frames.length-1);
  return c.frames[a].map((p,i)=>mix(p,c.frames[b][i],fl-a));}
const standH=()=>(P.thigh+P.shin)/(SRC.thigh+SRC.shin)*SRC.groundAnkle+P.shin+P.thigh+P.torso+P.neck+2*P.headR;
function paint(cv,f,root,yawDeg,pitchDeg){
  const w=cv.clientWidth,h=cv.clientHeight,dpr=devicePixelRatio||1;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const css=getComputedStyle(document.documentElement),ink=css.getPropertyValue('--ink').trim(),grid=css.getPropertyValue('--grid').trim();
  const H0=standH()+.25,sc=Math.min((h-40)/H0,(w-30)/(H0*1.05)),yw=yawDeg*Math.PI/180,pt=pitchDeg*Math.PI/180;
  const pr=p=>{const x=p[0]-root[0],z=p[2]-root[2],xx=x*Math.cos(yw)+z*Math.sin(yw),zz=-x*Math.sin(yw)+z*Math.cos(yw);
    return [w/2+xx*sc,h-24-(p[1]*Math.cos(pt)-zz*Math.sin(pt))*sc,zz*Math.cos(pt)+p[1]*Math.sin(pt)];};
  g.strokeStyle=grid;g.lineWidth=1;
  const gs=.4*standH()/1.8,gx=Math.round(root[0]/gs)*gs,gz=Math.round(root[2]/gs)*gs;
  for(let n=-3;n<=3;n++)for(const [a,b] of [[[gx+n*gs,0,gz-3*gs],[gx+n*gs,0,gz+3*gs]],[[gx-3*gs,0,gz+n*gs],[gx+3*gs,0,gz+n*gs]]]){
    const A=pr(a),B=pr(b);g.beginPath();g.moveTo(A[0],A[1]);g.lineTo(B[0],B[1]);g.stroke();}
  const items=f.segs.map(([a,b,k])=>{const A=pr(a),B=pr(b);return {z:(A[2]+B[2])/2,A,B,k};});
  const hp=pr(f.head);items.push({z:hp[2],head:hp});
  items.sort((a,b)=>a.z-b.z);
  g.strokeStyle=ink;g.fillStyle=ink;g.lineCap='round';g.lineJoin='round';
  for(const it of items){
    if(it.head){g.beginPath();g.arc(it.head[0],it.head[1],P.headR*sc,0,Math.PI*2);g.fill();continue;}
    g.lineWidth=P.line*it.k*sc;g.beginPath();g.moveTo(it.A[0],it.A[1]);g.lineTo(it.B[0],it.B[1]);g.stroke();}
}
function draw(){
  const s=frameAt(),f=mapFrame(s,P,ORIGIN),c=DATA.clips[clipId];
  paint($('c0'),f,f.H,0,0);paint($('c1'),f,f.H,P.yaw,P.pitch);
  const fi=Math.round(el*c.fps);$('t').textContent=el.toFixed(2)+' s';$('frame').value=fi;$('fn').textContent=`${fi+1} / ${c.frames.length} 帧`;
}
function writeOut(){const o={};for(const k in DEF)o[k]=+P[k].toFixed(k==='yaw'||k==='pitch'||k==='minSpread'?0:3);
  const hgt=standH();$('heads').textContent=`站立身高 ${hgt.toFixed(2)} m，约 ${(hgt/(2*P.headR)).toFixed(1)} 个头高（正常成人约 7.5）`;
  $('out').value=JSON.stringify({params:o,站立身高约_m:+hgt.toFixed(2),头身比:+(hgt/(2*P.headR)).toFixed(1),当前动作:clipId,当前帧:Math.round(el*DATA.clips[clipId].fps)},null,2);}
// UI
for(const [id,c] of Object.entries(DATA.clips))$('clip').add(new Option(c.label,id));
$('clip').value=clipId;
for(const sp of SPEC){
  if(sp.length===1){const d=document.createElement('div');d.className='group';d.textContent=sp[0];$('sliders').append(d);continue;}
  const [k,lab,mn,mx,st,u]=sp,l=document.createElement('label');
  const i=Object.assign(document.createElement('input'),{type:'range',min:mn,max:mx,step:st,value:P[k],id:'p_'+k});
  const o=document.createElement('output');const fmt=()=>o.textContent=(u==='m'?(+P[k]).toFixed(3):u==='×'?(+P[k]).toFixed(2)+'×':u==='%'?Math.round(P[k]*100)+'%':Math.round(P[k])+'°');
  i.oninput=()=>{P[k]=+i.value;fmt();writeOut();draw();};fmt();
  l.append(lab,i,o);$('sliders').append(l);
}
function setClip(id){clipId=id;el=0;const c=DATA.clips[id];ORIGIN=c.frames[0][J.Hips];$('frame').max=c.frames.length-1;writeOut();draw();}
function pause(v){playing=v;$('play').textContent=v?'暂停':'播放';}
$('clip').onchange=()=>setClip($('clip').value);
$('play').onclick=()=>{const c=DATA.clips[clipId];if(el>=(c.frames.length-1)/c.fps)el=0;pause(!playing);};
$('frame').oninput=()=>{pause(false);el=+$('frame').value/DATA.clips[clipId].fps;writeOut();draw();};
$('reset').onclick=()=>{Object.assign(P,DEF);for(const k in DEF){const i=$('p_'+k);if(i){i.value=P[k];i.dispatchEvent(new Event('input'));}}};
$('copy').onclick=async()=>{writeOut();try{await navigator.clipboard.writeText($('out').value);$('msg').textContent='已复制';}catch(e){$('out').select();$('msg').textContent='自动复制失败，已选中，手动复制';}};
new ResizeObserver(draw).observe(document.querySelector('.views'));
setClip(clipId);
function tick(t){if(prev!==undefined&&playing){const c=DATA.clips[clipId],end=(c.frames.length-1)/c.fps;el+=Math.min((t-prev)/1000,.1)*+$('speed').value;
  if(el>=end){if($('loop').checked)el=0;else{el=end;pause(false);}}writeOut();}prev=t;draw();requestAnimationFrame(tick);}
requestAnimationFrame(tick);

window.motionStudy={data:DATA,params:P,setClip,seek(frame){pause(false);el=frame/DATA.clips[clipId].fps;draw();},draw};
