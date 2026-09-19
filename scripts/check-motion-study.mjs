// Real-asset checks for the isolated retargeter. No game/renderer is loaded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRig, DEFAULTS, norm, sub, mix} from '../sth/motion-study/retarget.mjs';
import {displayJoints, limbStroke} from '../sth/motion-study/strokes.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../sth/motion-study/motions.json',import.meta.url),'utf8'));
const rig=createRig(data);
let frames=0, boneError=0, floorError=0, footError=0, headError=0;
for(const clip of Object.values(data.clips))for(const source of clip.frames){
  const {joints:q,maxFootError,maxHandError}=rig.retarget(source,DEFAULTS,true);
  assert(q.flat().every(Number.isFinite));
  const display=displayJoints(q,rig.ix);
  assert.deepEqual(display[rig.ix.Neck2],mix(q[rig.ix.Neck1],q[rig.ix.Chest],.2));
  for(let i=0;i<q.length;i++)if(i!==rig.ix.Neck2)assert.deepEqual(display[i],q[i],'Display mapping moved a motion endpoint');
  for(let i=1;i<q.length;i++){
    boneError=Math.max(boneError,Math.abs(norm(sub(q[i],q[data.parents[i]]))-rig.lengths[i]*rig.factor(data.names[i],DEFAULTS)));
  }
  floorError=Math.max(floorError,Math.abs(Math.min(...rig.feet.map(i=>q[i][1]))-Math.min(...rig.feet.map(i=>source[i][1]))));
  footError=Math.max(footError,maxFootError);
  headError=Math.max(headError,maxHandError);
  for(const side of ['Left','Right']){
    const i=rig.ix[side+'Foot'];
    assert(Math.hypot(q[i][0]-source[i][0],q[i][2]-source[i][2])<1e-5,'Ankle trajectory changed');
    for(const [a,b,c] of [['Neck2',side+'ForeArm',side+'Hand'],['Hips',side+'Shin',side+'Foot']]){
      const start=display[rig.ix[a]],hinge=display[rig.ix[b]],end=display[rig.ix[c]];
      for(const softness of [0,.7,1]){
        const path=limbStroke(start,hinge,end,softness);
        assert(path.every(s=>s.point.every(Number.isFinite)));
        assert.deepEqual(path[0].point,start,'Drawing moved limb root');
        assert.deepEqual(path.at(-1).point,end,'Drawing moved hand/foot endpoint');
      }
    }
  }
  frames++;
}
assert(boneError<1e-6,'Target bone length changed');
assert(floorError<1e-5,'Source ground clearance changed');
assert(footError<1e-5,'Unreachable foot goal in default profile');
assert(headError<1e-5,'Unreachable head-contact goal in default profile');
// Identity proportions must reproduce source geometry, apart from source bone
// length noise and the explicitly optional head correction.
const identity={torso:1,shoulder:1,hip:1,arm:1,leg:1,head:.13};
const reference=data.clips.stand_idle.frames[0], identical=rig.retarget(reference,identity,false).joints;
assert(Math.max(...reference.map((p,i)=>norm(sub(p,identical[i]))))<1e-4);
console.log(JSON.stringify({clips:Object.keys(data.clips).length,frames,boneError,floorError,footError,headError}));
