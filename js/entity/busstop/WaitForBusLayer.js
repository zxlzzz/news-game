/**
 * WaitForBusLayer — 公交站乘客行为管理
 *
 * 职责：
 *   1. 周期扫描自由 NPC（仅 wander 模式），小概率触发 WaitBusTask
 *   2. 响应公交到站，驱动 boarding 流程（走向车门 → 上车消失）
 *
 * 等待行为由 WaitBusTask 全权驱动（stand/loiter 交替 + 超时自退，单人 ChainTask，
 * Patch C）；本层 update() 仅做扫描，不再 tick 单个等待者——tick 由
 * BehaviorManager 每帧 `ag.runner?.tick(npc, dt)` 驱动（同所有 Task 一致）。
 */

import { setState, setWalkMode } from '../../behavior/Motor.js';
import { modeWander }            from '../../behavior/WalkMode.js';
import { GotoTask }     from '../../behavior/tasks/GotoTask.js';
import { WaitBusTask }  from '../../behavior/tasks/WaitBusTask.js';
import { SIDEWALK_FAR_Y, BIKE_LANE_FAR_TOP, PARK_TOP } from '../../core/Layout.js';
import { despawnNpc } from '../../npc/despawn.js';

// 等候区半宽：候车区中心 = busStop.x（scene.json#layout.busStops，唯一坐标真相），
// 不再另存一份独立的 xRange 字面量，避免与站台实际位置脱节。
const WAIT_ZONE_HALF_WIDTH = 120;

/** y 方向仍按 direction 走（远侧人行道/近侧公园缘的车道几何不同），非按站点各自配置 */
function _waitZoneYRange(direction) {
  return direction > 0
    ? [SIDEWALK_FAR_Y - 20, BIKE_LANE_FAR_TOP]
    : [PARK_TOP, PARK_TOP + 25];
}

function _buildWaitZones(busStops) {
  return busStops.map(stop => ({
    stopDir: stop.direction,
    xRange: [stop.x - WAIT_ZONE_HALF_WIDTH, stop.x + WAIT_ZONE_HALF_WIDTH],
    yRange: _waitZoneYRange(stop.direction),
  }));
}

const WAIT_STATES   = new Set(['walk', 'stand', 'loiter']);
const SCAN_INTERVAL = 0.5;

export class WaitForBusLayer {
  constructor(busStops, entities) {
    this._stops       = busStops;
    this._entities    = entities ?? [];
    this._scanTimer   = 0;
    this._waitZones   = _buildWaitZones(busStops);

    for (const stop of busStops) {
      stop.onBoarding = (bus, s) => this._startBoarding(bus, s);
    }
  }

  // update() 仅做扫描；等待者 tick 由 TaskRunner → WaitBusTask.tick() 驱动
  update(npcs, dt) {
    this._scanTimer -= dt;
    if (this._scanTimer <= 0) {
      this._scanTimer = SCAN_INTERVAL;
      this._scanForWaiters(npcs);
    }
  }

  /** ExitSceneTask 直接入队（NPC 已在等候区内） */
  addWaiterDirect(npc, stop) {
    this._addWaiter(npc, stop);
  }

  /** NPC 是否已在对应等候区内 */
  isInWaitZone(npc, stop) {
    const z = this._waitZones.find(z => z.stopDir === stop.direction);
    if (!z) return false;
    return npc.x >= z.xRange[0] && npc.x <= z.xRange[1]
        && npc.y >= z.yRange[0] && npc.y <= z.yRange[1];
  }

  /** 等候区中心坐标（ExitSceneTask 路由目标） */
  waitZoneTarget(stop) {
    const z = this._waitZones.find(z => z.stopDir === stop.direction);
    if (!z) return null;
    return {
      x: (z.xRange[0] + z.xRange[1]) / 2,
      y: (z.yRange[0] + z.yRange[1]) / 2,
    };
  }

  _scanForWaiters(npcs) {
    for (const npc of npcs) {
      if (!npc.alive || npc.mem('social').activity || npc.mem('agenda').departing) continue;
      if (npc.mem('social').waitingBusStop || npc.mem('social').boardingBus) continue;
      if (!WAIT_STATES.has(npc.state)) continue;

      // 排除非 wander 模式或有 goal 的 NPC
      const mot      = npc.mem('motor');
      const modeKind = mot.walkMode?.kind;
      if ((modeKind && modeKind !== 'wander') || mot.goal) continue;

      for (const zone of this._waitZones) {
        if (npc.x < zone.xRange[0] || npc.x > zone.xRange[1]) continue;
        if (npc.y < zone.yRange[0] || npc.y > zone.yRange[1]) continue;

        const stop = this._stops.find(s => s.direction === zone.stopDir);
        if (!stop || stop._waiters.length >= stop.maxWaiters) continue;

        if (Math.random() > 0.003) continue;

        this._addWaiter(npc, stop);
        break;
      }
    }
  }

  /** 顶替 npc 当前 runner.primary（若有）——TaskRunner.setPrimary 自动调旧 task 的 onAbort。 */
  _addWaiter(npc, stop) {
    npc.mem('agenda').runner.setPrimary(new WaitBusTask(stop), npc);
  }

  _startBoarding(bus, stop) {
    const waiters = [...stop._waiters];
    stop._waiters = [];

    const doorX = bus.x - bus.direction * bus._dims().L * bus.scale * 0.52;
    const doorY = stop.direction > 0 ? BIKE_LANE_FAR_TOP : PARK_TOP;
    const entities = this._entities;

    for (const npc of waiters) {
      // 防止寿命计时在 boarding 路由期间重复触发离场
      npc.mem('agenda').departing = true;
      npc.mem('social').boardingBus = bus;
      stop._boardingQueue.push(npc);
      npc.mem('social').waitingBusStop = stop;

      setState(npc, 'walk', 'boarding');
      // runner.setPrimary 顶替当前的 WaitBusTask（自动调其 onAbort；onAbort 见
      // WaitBusTask.js 头注释，靠 boardingBus 已置位判断"这是上车顶替，不做
      // 恢复漫游那套清理"）。GotoTask 取代原来手搓的 publishGoal——同 Patch H
      // 的既有做法，顺带保证走门这段也占着 runner.primary，Agenda 不会半路
      // 插一脚选别的目标。
      npc.mem('agenda').runner.setPrimary(new GotoTask({ x: doorX, y: doorY }, { timeout: 15 }), npc, (result) => {
        stop._boardingQueue = stop._boardingQueue.filter(x => x !== npc);
        if (result === 'done') {
          despawnNpc(npc, 'boarding-arrive', { entities });
        } else {
          // timeout / blocked: 未到车门，恢复日常漫游。
          // 禁止原地 despawn——未到车门凭空消失违反出口语义
          npc.mem('agenda').departing = false;
          npc.mem('social').boardingBus = null;
          npc.mem('social').waitingBusStop = null;
          setWalkMode(npc, modeWander());
        }
      });
    }
  }
}
