/**
 * StrollTask — NavGrid 感知漫游
 *
 * N-2b：publishGoal chain。
 * grid.sampleWalkableNear 采样目标，publishGoal 驱动规划；
 * 无 grid 时退回 modeWander。
 * duration 秒后返回 'done'，Agenda 重新评估下一目标。
 *
 * J1-a blocked 回落：连续 blocked 达上限后退化 modeWander（任务继续 tick 至 duration
 * 自然结束），避免 plan 必败场景下 goal 归零无限循环。
 */

import { setWalkMode } from '../Motor.js';
import { modeWander } from '../WalkMode.js';
import { getNavGrid } from '../nav/NavGrid.js';
import { publishGoal } from '../nav/PlanService.js';

// Intent 层政策：连续 blocked 次数上限，达到后退化 wander（N-3 评审是否入 RECOVERY_RULES 表）
const STROLL_BLOCKED_LIMIT = 2;

export class StrollTask {
  /** @param {{duration?:number}} opts  duration=null → 无限期 */
  constructor({ duration = null } = {}) {
    this._duration    = duration;
    this._elapsed     = 0;
    this._done        = false;
    this._blockedRun  = 0;  // 连续 blocked 次数（arrived/timeout 归零）
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
      if (result === 'blocked') {
        this._blockedRun++;
        if (this._blockedRun >= STROLL_BLOCKED_LIMIT) {
          setWalkMode(npc, modeWander());   // 退化漫游，任务继续 tick 至 duration
          return;
        }
        this._pickNext(npc);               // 未达上限：重发一次
      } else {
        this._blockedRun = 0;              // arrived / timeout → 重置连续计数
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
    this._done       = false;
    this._blockedRun = 0;
    this._pickNext(npc);
  }
}
