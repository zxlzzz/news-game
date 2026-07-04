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
import { getPlanner } from '../nav/PathPlanner.js';

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
    if (!grid) { setWalkMode(npc, modeWander()); return; }
    for (let attempt = 0; attempt < 2; attempt++) {
      const pt = grid.sampleWalkableNear(npc, 350);
      if (!pt) break;
      const pts = getPlanner()?.plan(npc.x, npc.y, pt.x, pt.y);
      if (pts && pts.length > 0) { this._chain(npc, pts, 0); return; }
    }
    setWalkMode(npc, modeWander());
  }

  _chain(npc, pts, idx) {
    if (idx >= pts.length) { this._pickNext(npc); return; }
    const nextTarget = idx < pts.length - 1 ? pts[idx + 1] : null;
    setWalkMode(npc, modeDirect(pts[idx], (n) => this._chain(n, pts, idx + 1), 30, nextTarget));
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
