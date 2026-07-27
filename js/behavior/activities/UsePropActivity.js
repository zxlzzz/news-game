import { setState }         from '../Motor.js';
import { Activity }         from './Activity.js';
import { registerActivity } from '../ActivityRegistry.js';
import { ClipPlayer }       from '../ClipPlayer.js';

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
    this._tag = tag;

    setState(npc, 'stand', 'use-prop');
    npc.modifiers  = npc.modifiers.filter(m => m.kind === 'trait');
    npc.direction  = (prop.x >= npc.x) ? 1 : -1;
    npc.mem('social').tags = [tag];

    this._player = new ClipPlayer(npc, '_use_prop');
    this._player.play(GESTURE_CLIPS[clipName]);
  }

  update(dt) {
    if (!this.npc.alive) return false;
    this._player.update(dt);
    return !this._player.done;
  }

  interrupt(reason) { super.interrupt(reason); }

  destroy() {
    if (this.npc.alive) {
      this._player.clear();
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
