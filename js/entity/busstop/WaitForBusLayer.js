/**
 * WaitForBusLayer — 公交站乘客行为管理
 *
 * 职责：
 *   1. 周期扫描自由 NPC（仅 wander 模式），小概率触发 WaitBusActivity
 *   2. 响应公交到站，驱动 boarding 流程（走向车门 → 上车消失）
 *
 * 等待行为由 WaitBusActivity 全权驱动（stand/loiter 交替 + 超时自退）；
 * 本层 update() 仅做扫描，不再 tick 单个等待者。
 */

import { setState }    from '../../behavior/Motor.js';
import { planCrossing } from '../../behavior/WalkMode.js';
import { WaitBusActivity } from '../../behavior/activities/WaitBusActivity.js';
import { SIDEWALK_FAR_Y, BIKE_LANE_FAR_TOP, PARK_TOP, FAR_Y, NEAR_Y } from '../../core/Layout.js';
import { despawnNpc } from '../../npc/despawn.js';

function _needsCrossing(y1, y2) {
  return (y1 < FAR_Y && y2 >= NEAR_Y) || (y1 >= NEAR_Y && y2 < FAR_Y);
}

const WAIT_ZONES = [
  { stopDir: +1, xRange: [380, 620],  yRange: [SIDEWALK_FAR_Y - 20, BIKE_LANE_FAR_TOP] },
  { stopDir: -1, xRange: [1380, 1620], yRange: [PARK_TOP, PARK_TOP + 25] },
];

const WAIT_STATES   = new Set(['walk', 'stand', 'loiter']);
const SCAN_INTERVAL = 0.5;

export class WaitForBusLayer {
  constructor(busStops, entities, socialLayer) {
    this._stops       = busStops;
    this._entities    = entities ?? [];
    this._socialLayer = socialLayer ?? null;
    this._scanTimer   = 0;

    for (const stop of busStops) {
      stop.onBoarding = (bus, s) => this._startBoarding(bus, s);
    }
  }

  // update() 仅做扫描；等待者 tick 由 SocialLayer → WaitBusActivity.update() 驱动
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
    const z = WAIT_ZONES.find(z => z.stopDir === stop.direction);
    if (!z) return false;
    return npc.x >= z.xRange[0] && npc.x <= z.xRange[1]
        && npc.y >= z.yRange[0] && npc.y <= z.yRange[1];
  }

  /** 等候区中心坐标（ExitSceneTask 路由目标） */
  waitZoneTarget(stop) {
    const z = WAIT_ZONES.find(z => z.stopDir === stop.direction);
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

      // 排除非 wander 模式（direct/path_follow/crossing）的 NPC
      const modeKind = npc.mem('motor').walkMode?.kind;
      if (modeKind && modeKind !== 'wander') continue;

      for (const zone of WAIT_ZONES) {
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

  _addWaiter(npc, stop) {
    const sl  = this._socialLayer;
    const id  = sl ? sl._idSeq++ : Math.random();
    const act = new WaitBusActivity(id, npc, stop);
    if (sl) sl.activities.push(act);
  }

  _startBoarding(bus, stop) {
    const waiters = [...stop._waiters];
    stop._waiters = [];

    const doorX = bus.x - bus.direction * bus._dims().L * bus.scale * 0.52;
    const doorY = stop.direction > 0 ? BIKE_LANE_FAR_TOP : PARK_TOP;

    for (const npc of waiters) {
      // 防止寿命计时在 boarding 路由期间重复触发离场
      npc.mem('agenda').departing = true;
      npc.mem('social').boardingBus = bus;
      stop._boardingQueue.push(npc);
      npc.mem('social').waitingBusStop = stop;

      // 同步销毁 WaitBusActivity（boarding 路径）；SocialLayer 下帧再调 destroy() 时
      // _destroyed 守卫保证幂等
      const act = npc.mem('social').activity;
      if (act) { act.interrupt('boarding'); act.destroy(); }

      const routeToDoor = (n) => {
        const entities = this._entities;
        n.mem('motor').routeTarget = {
          x: doorX, y: doorY,
          abandonAfter: 15,
          onArrive: (n2) => {
            stop._boardingQueue = stop._boardingQueue.filter(x => x !== n2);
            despawnNpc(n2, 'boarding-arrive', { entities });
          },
        };
        setState(n, 'routing', 'boarding');
      };

      if (_needsCrossing(npc.y, doorY)) {
        setState(npc, 'walk', 'boarding_cross');
        planCrossing(npc, doorY, npc.mem('agenda').profile, routeToDoor);
      } else {
        routeToDoor(npc);
      }
    }
  }
}
