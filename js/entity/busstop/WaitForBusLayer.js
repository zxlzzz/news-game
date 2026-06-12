/**
 * WaitForBusLayer — 公交站乘客行为管理
 *
 * 职责：
 *   1. 周期扫描自由 NPC，小概率触发"等车"意图
 *   2. 管理等车 NPC 的状态（stand/loiter 交替模拟无聊等待）
 *   3. 响应公交到站，驱动 boarding 流程（走向车门 → 上车消失）
 */

import { setState } from '../../behavior/Motor.js';
import { planCrossing } from '../../behavior/WalkMode.js';
import { SIDEWALK_FAR_Y, BIKE_LANE_FAR_TOP, PARK_TOP, FAR_Y, NEAR_Y } from '../../core/Layout.js';

function _needsCrossing(y1, y2) {
  return (y1 < FAR_Y && y2 >= NEAR_Y) || (y1 >= NEAR_Y && y2 < FAR_Y);
}

const WAIT_ZONES = [
  { stopDir: +1, xRange: [380, 620],  yRange: [SIDEWALK_FAR_Y - 20, BIKE_LANE_FAR_TOP] },
  { stopDir: -1, xRange: [1380, 1620], yRange: [PARK_TOP, PARK_TOP + 25] },
];

const WAIT_STATES = new Set(['walk', 'stand', 'loiter']);
const MAX_WAIT_TIME = 120;
const SCAN_INTERVAL = 0.5;

export class WaitForBusLayer {
  constructor(busStops) {
    this._stops = busStops;
    this._scanTimer = 0;

    for (const stop of busStops) {
      stop.onBoarding = (bus, s) => this._startBoarding(bus, s);
    }
  }

  update(npcs, dt) {
    this._scanTimer -= dt;
    if (this._scanTimer <= 0) {
      this._scanTimer = SCAN_INTERVAL;
      this._scanForWaiters(npcs);
    }
  }

  tickWaiter(npc, dt) {
    if (npc._boardingBus && npc.state === 'walk') {
      this._releaseWaiter(npc);
      return;
    }

    npc._waitTimer = (npc._waitTimer || 0) + dt;

    if (npc._waitTimer > MAX_WAIT_TIME) {
      this._releaseWaiter(npc);
      setState(npc, 'walk', 'wait_timeout');
      return;
    }

    if (npc.state === 'stand' && npc._waitTimer > (npc._nextFidget || 10)) {
      npc._nextFidget = npc._waitTimer + 10 + Math.random() * 10;
      setState(npc, 'loiter', 'wait_fidget');
      npc.stateDur = 4 + Math.random() * 4;
    } else if (npc.state === 'loiter' && npc.stateTimer >= npc.stateDur) {
      setState(npc, 'stand', 'wait_resume');
      npc.stateDur = Infinity;
    }
  }

  _scanForWaiters(npcs) {
    for (const npc of npcs) {
      if (!npc.alive || npc._activity || npc._departing) continue;
      if (npc._waitingBusStop || npc._boardingBus) continue;
      if (!WAIT_STATES.has(npc.state)) continue;

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

  addWaiterDirect(npc, stop) {
    this._addWaiter(npc, stop);
  }

  _addWaiter(npc, stop) {
    npc._waitingBusStop = stop;
    npc._waitTimer = 0;
    npc._nextFidget = 10 + Math.random() * 10;
    stop._waiters.push(npc);
    setState(npc, 'stand', 'wait_bus');
    npc.stateDur = Infinity;
  }

  _releaseWaiter(npc) {
    const stop = npc._waitingBusStop;
    if (stop) {
      stop._waiters = stop._waiters.filter(n => n !== npc);
      stop._boardingQueue = stop._boardingQueue.filter(n => n !== npc);
    }
    npc._waitingBusStop = null;
    npc._waitTimer = 0;
    npc._boardingBus = null;
  }

  _startBoarding(bus, stop) {
    const waiters = [...stop._waiters];
    stop._waiters = [];

    const doorX = bus.x - bus.direction * bus._dims().L * bus.scale * 0.52;
    const doorY = stop.direction > 0 ? BIKE_LANE_FAR_TOP : PARK_TOP;

    for (const npc of waiters) {
      npc._boardingBus = bus;
      stop._boardingQueue.push(npc);
      npc._waitingBusStop = stop;

      const routeToDoor = (n) => {
        n._routeTarget = {
          x: doorX, y: doorY,
          abandonAfter: 15,
          onArrive: (n2) => {
            n2.alive = false;
            stop._boardingQueue = stop._boardingQueue.filter(x => x !== n2);
          },
        };
        setState(n, 'routing', 'boarding');
      };

      if (_needsCrossing(npc.y, doorY)) {
        setState(npc, 'walk', 'boarding_cross');
        planCrossing(npc, doorY, npc._profile, routeToDoor);
      } else {
        routeToDoor(npc);
      }
    }
  }
}
