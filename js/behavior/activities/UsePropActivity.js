import { setState }         from '../BaseStateMachine.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';

function kfJoints(kf) {
  const j = {};
  for (const k in kf) { if (k !== 'dur') j[k] = kf[k]; }
  return j;
}

let GESTURE_CLIPS = {};

export function initGestureClips(clips) {
  GESTURE_CLIPS = clips || {};
}

export class UsePropActivity extends Activity {
  constructor(id, type, npc, prop, clipName, tag) {
    super(id, type);
    this.npc  = npc;
    this.prop = prop;
    this.join(npc, 'user');
    this.occupy(prop);

    const clip   = GESTURE_CLIPS[clipName];
    this.frames  = (clip && clip.keyframes) ? clip.keyframes : [];
    this.kfIdx   = 0;
    this.kfTimer = this.frames[0] ? this.frames[0].dur : 0;
    this._tag    = tag;

    setState(npc, 'stand', 'use-prop');
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
    npc.direction  = (prop.x >= npc.x) ? 1 : -1;
    npc.mem('social').tags = [tag];

    if (this.frames[0]) {
      npc.modifiers.push({ id: '_use_prop', kind: 'held', priority: 20,
        joints: kfJoints(this.frames[0]), timer: -1 });
    }
  }

  update(dt) {
    if (!this.npc.alive) return false;
    if (this.frames.length === 0) return false;
    this.kfTimer -= dt;
    if (this.kfTimer <= 0) {
      if (++this.kfIdx >= this.frames.length) return false;
      const kf  = this.frames[this.kfIdx];
      this.kfTimer = kf.dur;
      let mod = this.npc.modifiers.find(m => m.id === '_use_prop');
      if (mod) mod.joints = kfJoints(kf);
      else this.npc.modifiers.push({ id: '_use_prop', kind: 'held', priority: 20,
        joints: kfJoints(kf), timer: -1 });
    }
    return true;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.npc.alive) {
      this.npc.modifiers = this.npc.modifiers.filter(m => m.id !== '_use_prop');
      this.npc.mem('social').tags = null;
      setState(this.npc, 'walk', 'activity-end');
    }
    super.destroy();
  }
}

// 通配符工厂：处理所有未被其他工厂注册的 prop-based activity 类型
registerActivity('*', (id, participants, props, type) => {
  const prop = props[0];
  if (!prop?.smartDef) return null;
  const gestureId  = prop.smartDef.gestureId  ?? type;
  const phaseLabel = prop.smartDef.phaseLabel ?? type;
  return new UsePropActivity(id, type, participants[0].npc, prop, gestureId, phaseLabel);
});
