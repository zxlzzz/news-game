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

import { triggerDeparture, restoreDepartureBounds } from '../BaseStateMachine.js';
import { setState } from '../Motor.js';
import { publishGoal } from '../nav/PlanService.js';
import { NEAR_Y }   from '../../core/Layout.js';

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
        if (busLay.isInWaitZone(npc, stop)) {
          // 已在等候区：直接入队（sc.waitingBusStop 立即生效，tick 不会 abort）
          busLay.addWaiterDirect(npc, stop);
          return;
        }
        // 不在等候区：路由过去；pendingBusWait 防止 tick 提前 abort
        const target = busLay.waitZoneTarget(stop);
        if (target) {
          ag.pendingBusWait = true;
          publishGoal(npc, target, 30, (result) => {
            npc.mem('agenda').pendingBusWait = false;
            if (result === 'arrived' && stop._waiters.length < (stop.maxWaiters ?? 8)) {
              busLay.addWaiterDirect(npc, stop);
            }
          }, {});
          setState(npc, 'walk', 'to_bus_zone');
          return;
        }
      }
      // 候车人满或无有效区域 → 降级边缘出口
    }

    // ── 楼门出口 ───────────────────────────────────────────────────────────────
    if (bias === 'building' && exitReg) {
      ag.preferExitType = 'building';
      triggerDeparture(npc, exitReg);
      return;
    }

    // ── 默认边缘出口 ──────────────────────────────────────────────────────────
    if (exitReg) {
      ag.preferExitType = 'edge';
      triggerDeparture(npc, exitReg);
    }
  }

  tick(npc, _dt) {
    if (!npc.alive) return 'done';
    const ag  = npc.mem('agenda');
    const sc  = npc.mem('social');
    const mot = npc.mem('motor');
    // 正在路由到等候区：若路由意外中断则 abort
    if (ag.pendingBusWait) {
      if (!sc.waitingBusStop && !mot.goal) {
        ag.pendingBusWait = false;
        return 'abort';
      }
      return null;
    }
    if (!ag.departing && !sc.waitingBusStop && !ag.pendingDeparture) return 'abort';
    return null;
  }

  onAbort(npc) { restoreDepartureBounds(npc); }
  onInterrupt(_npc) {}
  onResume(_npc) {}
}
