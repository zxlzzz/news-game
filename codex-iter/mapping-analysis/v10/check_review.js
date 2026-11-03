/* Offline execution of the actual REVIEW.html controls and six drawing surfaces.
 * A data/control check, not a browser pixel or animation-quality test.
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),root=__dirname;
let strokes=0,callbacks=0;const ids={};
function element(tag){return {tag,children:[],value:'',width:400,height:480,textContent:'',append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value&&nodes[0])this.value=nodes[0].value;for(const n of nodes)if(n.tag==='script'&&n.src){vm.runInContext(fs.readFileSync(path.join(root,n.src),'utf8'),context);if(n.onload)n.onload()}},replaceChildren(...nodes){this.children=[...nodes]},remove(){},getContext(){return {beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++},fill(){},fillRect(){},arc(){}}}}}
const context=vm.createContext({console,performance:{now:()=>0},requestAnimationFrame(){callbacks++},Set,Math,document:{getElementById(id){return ids[id]??=element(['clip','speed'].includes(id)?'select':'div')},createElement:element,body:element('body')}});context.window=context;
ids.speed=element('select');ids.speed.value='1';
const html=fs.readFileSync(path.join(root,'REVIEW.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s+src="([^"]+)")?>([\s\S]*?)<\/script>/g))vm.runInContext(match[1]?fs.readFileSync(path.join(root,match[1]),'utf8'):match[2],context,{filename:match[1]||'REVIEW-inline.js'});
const clips=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).clips;
clips.forEach((clip,i)=>{ids.clip.value=String(i);ids.clip.onchange();for(const f of [0,Math.floor(clip.frames/3),Math.floor(clip.frames*2/3),clip.frames-1]){ids.seek.value=String(f);ids.seek.oninput();if(!ids.clock.textContent.startsWith(`f${f} /`))throw Error('Wrong frame '+clip.id)}ids.prev.onclick();ids.next.onclick();ids.frameNumber.value='0';ids.frameNumber.onchange();ids.play.onclick();vm.runInContext('tick(1000)',context);ids.pause.onclick();ids.restart.onclick();ids.speed.onchange();if(ids.pages.children.length!==Math.ceil(clip.frames/8))throw Error('Missing frame pages '+clip.id);if(!ids.judgment.textContent.startsWith('R7'))throw Error('Missing R7 notes '+clip.id);for(const node of ids.pages.children)if(!fs.existsSync(path.join(root,node.href)))throw Error('Missing image '+node.href)});
if(strokes<1000||callbacks<1)throw Error('Player failed to draw');
console.log(JSON.stringify({clips:clips.length,views:3,canvasStrokes:strokes,controlsExecuted:true,currentNotes:true,browserPixelValidation:false}));
