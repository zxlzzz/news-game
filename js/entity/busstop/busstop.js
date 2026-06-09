/**
 * BusStop — 公交站 Smart Object
 *
 * 独占写入权：_occupant 由 arrive/depart 负责写入；
 *   _waiters / _boardingQueue 由 WaitForBusLayer 负责管理。
 * VehicleStateMachine 调用 arrive(bus) 触发停站；
 * 所有 boarding NPC 上完（或 8s 超时）后 depart() 释放，公交车进入 accelerating。
 * 无等车乘客时按 waitRange 计时正常发车。
 */
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
