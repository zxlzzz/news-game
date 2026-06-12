/**
 * BusStop — 公交站 Smart Object
 *
 * 独占写入权：_occupant 由 arrive/depart 负责写入；
 *   _waiters / _boardingQueue 由 WaitForBusLayer 负责管理。
 * VehicleStateMachine 调用 arrive(bus) 触发停站；
 * 所有 boarding NPC 上完（或 8s 超时）后 depart() 释放，公交车进入 accelerating。
 * 无等车乘客时按 waitRange 计时正常发车。
 */
import { PropEntity } from '../../core/PropEntity.js';
import {
  FAR_Y, NEAR_Y,
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
  depthScale,
} from '../../core/Layout.js';

export class BusStop {
  constructor(cfg) {
    this.x         = cfg.x;
    this.direction = cfg.direction;
    this.waitTime  = cfg.waitTime ?? 4000;
    this.waitRange = cfg.waitRange ?? null;
    this._occupant = null;
    this._timer    = 0;

    this._waiters       = [];
    this._boardingQueue = [];
    this._boardingTimer = 0;
    this.maxWaiters     = cfg.maxWaiters ?? 8;
  }

  _rollWait() {
    if (this.waitRange) {
      const a = Math.min(this.waitRange[0], this.waitRange[1]);
      const b = Math.max(this.waitRange[0], this.waitRange[1]);
      return a + Math.random() * (b - a);
    }
    return this.waitTime;
  }

  arrive(bus) {
    if (this._occupant) return false;
    this._occupant = bus;
    bus.doorOpen   = true;
    this._boardingTimer = 0;

    // Director 钩子：先下客再上客
    if (this.onArrival) this.onArrival(bus, this);

    if (this._waiters.length > 0) {
      this._timer = Infinity;
      if (this.onBoarding) this.onBoarding(bus, this);
    } else {
      this._timer = this._rollWait();
    }
    return true;
  }

  update(delta) {
    if (!this._occupant) return;

    this._boardingTimer += delta;

    if (this._boardingQueue.length > 0) {
      if (this._boardingTimer >= 8000) this.depart();
      return;
    }

    if (this._timer === Infinity) {
      this.depart();
      return;
    }

    this._timer -= delta;
    if (this._timer <= 0) this.depart();
  }

  depart() {
    if (!this._occupant) return;
    this._occupant.doorOpen        = false;
    this._occupant._busStopDone    = true;
    this._occupant._busStopCooldown = 2500;
    this._occupant = null;
    this._timer    = 0;
    this._boardingQueue = [];
    this._boardingTimer = 0;
  }
}

/** 一次性创建整个公交站：顶棚 PropEntity + 长椅 PropEntity */
export function spawnBusStop(em, stop) {
  const far           = stop.direction > 0;
  const anchorY       = far ? FAR_Y : NEAR_Y;
  const roofTopY      = far ? BIKE_LANE_FAR_TOP - 30 : BIKE_LANE_NEAR_BOTTOM - 65;
  const pillarBottomY = far ? FAR_Y - stop.bayD - 2  : BIKE_LANE_NEAR_BOTTOM - 5;

  const roof = em.add(new PropEntity({
    propType: 'busstop-roof',
    x: stop.x, y: anchorY,
    roofW: stop.roofW, roofH: stop.roofH,
    roofTopY, pillarOffset: stop.pillarOffset, pillarBottomY,
    dir: stop.direction,
    width: stop.roofW, height: far ? anchorY - roofTopY : pillarBottomY - anchorY,
    _sortY: pillarBottomY,
    tags: [],
  }));
  roof.scale = depthScale(anchorY);

  if (stop.bench) {
    const bx = stop.x + stop.bench.dx;
    const by = anchorY + stop.bench.dy;
    const bench = em.add(new PropEntity({
      propType: 'busstop-bench',
      x: bx, y: by,
      width: stop.bench.width,
      height: 12,
      facing: stop.bench.facing ?? 'down',
      tags: ['seatable', 'busstop'],
    }));
    bench.scale = depthScale(by);
  }
}
