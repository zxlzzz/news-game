/**
 * ExitSceneTask — 驱动 NPC 按 exitBias 离场
 *
 * exitBias（spawn 时由 Director 赋值，存于 npc.mem('agenda').exitBias）：
 *   'building' → 就近楼门消失
 *   'bus'      → 加入等车队列，公交到站后上车消失
 *   'edge'     → 步行出画（默认）
 *
 * NPC 上需提前注入（由 Director.installRefs / BM.register 完成）：
 *   npc.mem('agenda').exitRegistry      ExitRegistry 实例
 *   npc.mem('agenda').waitForBusLayer   WaitForBusLayer 实例（可空）
 *   npc.mem('agenda').busStops          BusStop 数组（可空）
 */

import { triggerDeparture } from '../BaseStateMachine.js';
import { NEAR_Y }           from '../../core/Layout.js';

export class ExitSceneTask {
  onStart(npc, _runner) {
    if (npc.mem('agenda').departing) return;   // lifespan 路径已触发，仅做占位
    this._driveExit(npc);
  }

  _driveExit(npc) {
    const ag     = npc.mem('agenda');
    const bias   = ag.exitBias ?? 'edge';
    const exitReg = ag.exitRegistry;
    const busLay  = ag.waitForBusLayer;

    // ── 公交出口 ───────────────────────────────────────────────────────────────
    if (bias === 'bus' && busLay) {
      const stops  = ag.busStops ?? [];
      const isNear = npc.y >= NEAR_Y;
      const stop   = stops.find(s => (s.direction < 0) === isNear) ?? stops[0];
      if (stop && stop._waiters.length < (stop.maxWaiters ?? 8)) {
        busLay.addWaiterDirect(npc, stop);
        return;
      }
      // 候车人满 → 降级边缘出口
    }

    // ── 楼门出口 ───────────────────────────────────────────────────────────────
    if (bias === 'building' && exitReg) {
      const bExit = exitReg.findExit(npc, 'building');
      if (bExit) {
        ag.preferExitType = 'building';
        triggerDeparture(npc, exitReg);
        return;
      }
      // 无匹配建筑出口 → 降级边缘出口
    }

    // ── 默认边缘出口 ──────────────────────────────────────────────────────────
    if (exitReg) {
      ag.preferExitType = 'edge';
      triggerDeparture(npc, exitReg);
    }
  }

  tick(npc, _dt) {
    return npc.alive ? null : 'done';
  }

  onAbort(_npc) {}
  onInterrupt(_npc) {}
  onResume(_npc) {}
}
