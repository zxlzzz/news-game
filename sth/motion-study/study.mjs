import {createRig, DEFAULTS, add, sub, mul, norm, unit, mix} from './retarget.mjs';
const $ = id => document.getElementById(id);
try {
  const response = await fetch('./motions.json');
  if (!response.ok) throw new Error(`动作数据加载失败：${response.status}`);
  const data = await response.json(), rig = createRig(data);
  const params = {...DEFAULTS};
  let current = 'stand_idle', elapsed = 0, playing = true, previous;
  for (const [id, clip] of Object.entries(data.clips)) $('clip').add(new Option(clip.label, id));
  for (const [key, label, min, max, step] of [
    ['torso','躯干',.7,1.2,.01],
    ['arm','臂长',.75,1.2,.01],['leg','腿长',.85,1.2,.01],['head','头半径',.09,.17,.005]]) {
    const row = document.createElement('label');
    row.append(label);
    const input = Object.assign(document.createElement('input'), {type:'range', min, max, step, value:params[key], id:key});
    const output = Object.assign(document.createElement('output'), {value:params[key].toFixed(2), htmlFor:key});
    input.oninput = () => {params[key] = +input.value; output.value = params[key].toFixed(2); draw();};
    row.append(input, output); $('params').append(row);
  }
  const canvases = ['legacy','structure','styled'].map($);
  const number = id => +$(id).value;
  const clip = () => data.clips[current];
  function pause(value) {playing=value; $('play').textContent=playing?'暂停':'播放';}
  function setClip(value) {current=value; elapsed=0; $('clip').value=value; $('frame').max=clip().frames.length-1; $('duration').textContent=((clip().frames.length-1)/clip().fps).toFixed(2)+' s';draw();}
  $('clip').onchange=()=>setClip($('clip').value);
  $('play').onclick=()=>{if(elapsed>=(clip().frames.length-1)/clip().fps)elapsed=0;pause(!playing);};
  $('frame').oninput=()=>{pause(false);elapsed=number('frame')/clip().fps;draw();};
  for(const id of ['yaw','pitch','small','joints','contact']) $(id).oninput=draw;
  for(const [id,yaw,pitch] of [['front',0,0],['side',90,0],['oblique',-35,15]]) $(id).onclick=()=>{$('yaw').value=yaw;$('pitch').value=pitch;draw();};
  $('reset').onclick=()=>{for(const [k,v] of Object.entries(DEFAULTS)){params[k]=v;if($(k)){$(k).value=v;$(k).dispatchEvent(new Event('input'));}}draw();};
  function sample() {
    const f=Math.min(elapsed*clip().fps,clip().frames.length-1), a=Math.floor(f), b=Math.min(a+1,clip().frames.length-1);
    return clip().frames[a].map((p,i)=>mix(p,clip().frames[b][i],f-a));
  }
  function paint(canvas, points, mode, root) {
    const width=canvas.clientWidth,height=canvas.clientHeight,dpr=window.devicePixelRatio||1;
    if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
    const g=canvas.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,width,height);
    const scale=$('small').checked?42:Math.min((height-60)/1.95,(width-45)/2.4);
    const yaw=number('yaw')*Math.PI/180,pitch=number('pitch')*Math.PI/180;
    const project=p=>{
      const x=p[0]-root[0],z=p[2]-root[2],xx=x*Math.cos(yaw)+z*Math.sin(yaw),zz=-x*Math.sin(yaw)+z*Math.cos(yaw);
      return [width/2+xx*scale,height-36-(p[1]*Math.cos(pitch)-zz*Math.sin(pitch))*scale,zz*Math.cos(pitch)+p[1]*Math.sin(pitch)];
    };
    g.strokeStyle='#e0e3d8';g.lineWidth=1;
    for(let n=-2;n<=2;n++)for(const pair of [[[n*.4,0,-.8],[n*.4,0,.8]],[[-.8,0,n*.4],[.8,0,n*.4]]]){
      const [a,b]=pair.map(p=>project(add(p,[root[0],0,root[2]])));g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();
    }
    const radius=mode===2?params.head:.13, center=rig.headCenter(points,radius,mode===0);
    const head=project(center), items=[];
    // All columns retain the same 11-point silhouette; other joints only drive it.
    for(const [an,bn] of rig.direct){
      let a=points[rig.ix[an]],b=points[rig.ix[bn]];
      if(bn==='HeadEnd'||bn==='Head')b=sub(center,mul(unit(sub(center,a)),radius));
      const pa=project(a),pb=project(b);
      const body=an==='Hips'&&bn==='Neck2';
      const lower=/Hand$|Foot$/.test(bn);
      const width=mode===0?3.5:body?4.2:lower?2.8:3.5;
      items.push({z:(pa[2]+pb[2])/2,pa,pb,width});
    }
    items.push({z:head[2],head});items.sort((a,b)=>a.z-b.z);
    for(const item of items){
      if(item.head){g.fillStyle='#252d29';g.beginPath();g.arc(head[0],head[1],radius*scale,0,2*Math.PI);g.fill();continue;}
      const {pa,pb,width}=item;
      g.strokeStyle='#252d29';g.lineWidth=$('small').checked?width*(1.8/3.5):width;g.lineCap='round';g.lineJoin='round';
      g.beginPath();g.moveTo(pa[0],pa[1]);g.lineTo(pb[0],pb[1]);g.stroke();
    }
    if($('joints').checked){g.fillStyle='#b66a43';for(const n of new Set(rig.direct.flat())){const [x,y]=project(points[rig.ix[n]]);g.beginPath();g.arc(x,y,2.5,0,2*Math.PI);g.fill();}}
    g.fillStyle='#778175';g.font='12px system-ui';g.textAlign='center';g.fillText($('small').checked?'约 75 px 人高':'同一米制比例',width/2,height-10);
  }
  function draw(){
    const source=sample(), target=rig.retarget(source,params,$('contact').checked);
    paint(canvases[0],source,0,source[0]);paint(canvases[1],source,1,source[0]);paint(canvases[2],target.joints,2,source[0]);
    $('time').textContent=elapsed.toFixed(2)+' s';$('frame').value=Math.round(elapsed*clip().fps);
    const error=Math.max(target.maxFootError,target.maxHandError);
    $('status').textContent=`${clip().label} · ${Math.round(elapsed*clip().fps)+1} / ${clip().frames.length} 帧`+(error>.001?` · 当前比例有 ${(error*100).toFixed(1)} cm 落点无法够到`:'');
  }
  new ResizeObserver(draw).observe(document.querySelector('.panels'));
  setClip(current);
  function tick(t){if(previous!==undefined&&playing){elapsed+=Math.min((t-previous)/1000,.1)*number('speed');const end=(clip().frames.length-1)/clip().fps;if(elapsed>=end){elapsed=end;pause(false);}}previous=t;draw();requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
  // Inspection hook for repeatable browser QA; shares the displayed code path.
  window.motionStudy={data,rig,params,setClip,seek(f){pause(false);elapsed=f/clip().fps;draw();},draw};
}catch(e){$('error').textContent=e.message;console.error(e);}
