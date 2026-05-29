/**
 * BusStop — 公交站 Smart Object
 *
 * 公交车进入探测范围后 VehicleStateMachine 调用 arrive(bus) 触发停站；
 * waitTime 毫秒后 depart() 自动释放，公交车进入 accelerating 状态。
 */
export class BusStop {
  constructor(cfg) {
    this.x         = cfg.x;
    this.direction = cfg.direction;          // +1 或 -1，只响应对应方向的公交
    // 停站时长 ms：可给固定 waitTime，或给区间 waitRange=[min,max]（每次靠站随机）
    this.waitTime  = cfg.waitTime ?? 4000;
    this.waitRange = cfg.waitRange ?? null;
    this._occupant = null;
    this._timer    = 0;
  }

  /** 本次停站时长（有区间则随机取） */
  _rollWait() {
    if (this.waitRange) {
      const [a, b] = this.waitRange;
      return a + Math.random() * (b - a);
    }
    return this.waitTime;
  }

  /** 公交车到站时由 VehicleStateMachine 调用 */
  arrive(bus) {
    if (this._occupant) return false;   // 已有车停靠
    this._occupant = bus;
    this._timer    = this._rollWait();
    bus.doorOpen   = true;
    return true;
  }

  /** 每帧由 TrafficManager 调用（delta ms） */
  update(delta) {
    if (!this._occupant) return;
    this._timer -= delta;
    if (this._timer <= 0) this.depart();
  }

  /** 时间到或强制离站 */
  depart() {
    if (!this._occupant) return;
    this._occupant.doorOpen      = false;
    this._occupant._busStopDone  = true;   // 通知状态机可以走了
    this._occupant = null;
    this._timer    = 0;
  }
}
