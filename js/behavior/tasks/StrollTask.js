/**
 * StrollTask — 默认漫游目标
 *
 * 设置 modeWander（若当前无方向性走法），BSM 继续驱动 walk/stand/loiter 微转换。
 * duration 秒后返回 'done'，Agenda 重新评估下一目标。
 */

import { setWalkMode } from '../Motor.js';
import { modeWander }  from '../WalkMode.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class StrollTask {
  /** @param {{duration?:number}} opts  duration=null → 无限期 */
  constructor({ duration = null } = {}) {
    this._duration = duration;
    this._elapsed  = 0;
  }

  onStart(npc, _runner) {
    // 只在无方向性走法时切入漫游；direct/path_follow 让 BSM 自然完成
    if (!npc._walkMode || npc._walkMode.kind === 'wander' || npc._walkMode.kind == null) {
      setWalkMode(npc, modeWander());
    }
  }

  tick(_npc, dt) {
    this._elapsed += dt;
    if (this._duration != null && this._elapsed >= this._duration) return 'done';
    return null;
  }

  onAbort(_npc)    {}
  onInterrupt(_npc) {}
  onResume(npc)    { this.onStart(npc, null); }
}
