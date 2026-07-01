/**
 * StrollTask — NavGrid 感知漫游
 *
 * 用 grid.sampleWalkableNear 采样目标（70% cost-1, 30% cost-3），
 * 逐点 modeDirect 驱动；无 grid 时退回 modeWander。
 * duration 秒后返回 'done'，Agenda 重新评估下一目标。
 */

import { setWalkMode } from '../Motor.js';
import { modeWander, modeDirect } from '../WalkMode.js';
import { getNavGrid } from '../nav/NavGrid.js';

export class StrollTask {
  /** @param {{duration?:number}} opts  duration=null → 无限期 */
  constructor({ duration = null } = {}) {
    this._duration = duration;
    this._elapsed  = 0;
  }

  onStart(npc, _runner) {
    this._pickNext(npc);
  }

  _pickNext(npc) {
    const grid = getNavGrid();
    if (!grid) {
      setWalkMode(npc, modeWander());
      return;
    }
    const pt = grid.sampleWalkableNear(npc, 350);
    if (!pt) {
      setWalkMode(npc, modeWander());
      return;
    }
    setWalkMode(npc, modeDirect(pt, (n) => this._pickNext(n), 30));
  }

  tick(_npc, dt) {
    this._elapsed += dt;
    if (this._duration != null && this._elapsed >= this._duration) return 'done';
    return null;
  }

  onAbort(npc)      { setWalkMode(npc, null); }
  onInterrupt(_npc) {}
  onResume(npc)     { this._pickNext(npc); }
}
