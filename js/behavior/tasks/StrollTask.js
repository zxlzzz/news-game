/**
 * StrollTask — NavGrid 感知漫游
 *
 * N-2b：publishGoal chain。
 * grid.sampleWalkableNear 采样目标，publishGoal 驱动规划；
 * 无 grid 时退回 modeWander。
 * duration 秒后返回 'done'，Agenda 重新评估下一目标。
 */

import { setWalkMode } from '../Motor.js';
import { modeWander } from '../WalkMode.js';
import { getNavGrid } from '../nav/NavGrid.js';
import { publishGoal } from '../nav/PlanService.js';

export class StrollTask {
  /** @param {{duration?:number}} opts  duration=null → 无限期 */
  constructor({ duration = null } = {}) {
    this._duration = duration;
    this._elapsed  = 0;
    this._done     = false;
  }

  onStart(npc, _runner) {
    this._pickNext(npc);
  }

  _pickNext(npc) {
    if (this._done) return;
    const grid = getNavGrid();
    if (!grid) { setWalkMode(npc, modeWander()); return; }
    const pt = grid.sampleWalkableNear(npc, 350);
    if (!pt) { setWalkMode(npc, modeWander()); return; }
    publishGoal(npc, pt, 30, (result) => {
      if (this._done) return;
      if (result === 'arrived' || result === 'blocked' || result === 'timeout') {
        this._pickNext(npc);
      }
    }, {});
  }

  tick(_npc, dt) {
    this._elapsed += dt;
    if (this._duration != null && this._elapsed >= this._duration) {
      this._done = true;
      return 'done';
    }
    return null;
  }

  onAbort(npc) {
    this._done = true;
    const mot  = npc.mem('motor');
    if (mot.goal) {
      mot.goal  = null;
      mot.path  = null;
      mot.needReplan = undefined;
    }
  }

  onInterrupt(_npc) {}

  onResume(npc) {
    this._done = false;
    this._pickNext(npc);
  }
}
