/**
 * VehicleStateMachine — 单辆机动车行为状态机
 *
 * 5 个状态：
 *   cruising     — 以 targetSpeed 正常行驶
 *   decelerating — 前方有障碍，减速至低速（不完全停止，避免过早停车）
 *   stopped      — 完全停止（公交停站 / 跟车贴近）
 *   accelerating — 障碍消除后加速恢复
 *   braking      — 紧急制动（预留，现在等同于极速停止）
 *
 * 转换优先级（高优先级先检查）：
 *   10 — 跟车
 *   30 — 公交站（仅 bus）
 *   40 — 红绿灯（always green，不触发）
 */

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

function _halfLength(v) {
  const L = { bus: 1500, car: 500, taxi: 500, moto: 600 }[v.kind] ?? 500;
  return (L * v.scale) / 2;
}

export class VehicleStateMachine {
  constructor(vehicle) {
    this.vehicle = vehicle;
    // 每辆车生成时固定目标速度，制造速度抖动
    vehicle.targetSpeed  = vehicle.baseSpeed * (0.85 + Math.random() * 0.30);
    vehicle.currentSpeed = vehicle.targetSpeed;
    vehicle.vsmState     = 'cruising';
    vehicle._busStopTarget = null;
    vehicle._busStopDone   = false;
  }

  /**
   * 每帧由 TrafficManager 调用。
   * @param {number}   delta                毫秒
   * @param {VehicleEntity[]} sameDirVehicles 同方向其他车辆列表
   * @param {BusStop[]}       busStops
   */
  update(delta, sameDirVehicles, busStops) {
    const v  = this.vehicle;
    const dt = delta / 1000;

    // 公交站离开（BusStop.depart() 设置 _busStopDone）
    if (v._busStopDone) {
      v._busStopDone   = false;
      v._busStopTarget = null;
      v.vsmState       = 'accelerating';
    } else if (!(v.vsmState === 'stopped' && v._busStopTarget)) {
      // 停站等待时不重新求值；其他情况每帧重新求值
      v.vsmState = this._evaluate(sameDirVehicles, busStops);
    }

    this._applySpeed(dt);
  }

  // ─── 内部 ────────────────────────────────────────────────────────────────────

  _evaluate(sameDirVehicles, busStops) {
    const v     = this.vehicle;
    const state = v.vsmState;

    // Priority 10: 跟车
    const leader = this._findLeader(sameDirVehicles);
    if (leader !== null) {
      const gap = this._gap(leader);
      if (gap <= 40) return 'stopped';
      return 'decelerating';
    }

    // Priority 30: 公交站
    if (v.kind === 'bus') {
      const stop = this._findBusStop(busStops, 150);
      if (stop) {
        const dist = this._distToStop(stop);
        if (dist <= 8) {
          if (v._busStopTarget !== stop) {
            v._busStopTarget = stop;
            stop.arrive(v);
          }
          return 'stopped';
        }
        return 'decelerating';
      }
    }

    // Priority 40: 红绿灯（always green，不触发）

    // 无障碍：向 cruising 过渡
    if (state === 'stopped' || state === 'decelerating' || state === 'braking') {
      return 'accelerating';
    }
    if (state === 'accelerating' && v.currentSpeed >= v.targetSpeed * 0.95) {
      return 'cruising';
    }
    return state === 'cruising' ? 'cruising' : state;
  }

  _applySpeed(dt) {
    const v = this.vehicle;
    switch (v.vsmState) {
      case 'cruising':
        v.currentSpeed = lerp(v.currentSpeed, v.targetSpeed, dt * 3);
        break;
      case 'decelerating':
        // 减速至低速（15）而非直接停止，避免在距站点/前车较远时就完全停下
        v.currentSpeed = lerp(v.currentSpeed, 15, dt * 3);
        break;
      case 'stopped':
        v.currentSpeed = lerp(v.currentSpeed, 0, dt * 8);
        if (v.currentSpeed < 0.5) v.currentSpeed = 0;
        break;
      case 'accelerating':
        v.currentSpeed = lerp(v.currentSpeed, v.targetSpeed, dt * 2);
        break;
      case 'braking':
        v.currentSpeed = lerp(v.currentSpeed, 0, dt * 10);
        if (v.currentSpeed < 0.5) v.currentSpeed = 0;
        break;
    }
  }

  _findLeader(sameDirVehicles) {
    const v      = this.vehicle;
    const d      = v.direction;
    const myHalfL = _halfLength(v);
    let closest  = null;
    let bestGap  = 120; // 探测上限 px

    for (const other of sameDirVehicles) {
      if (!other.alive) continue;
      // 同车道判定：比较固定行带 Y（±12px）
      if (Math.abs(other._laneY - v._laneY) > 12) continue;
      const dxAhead = d * (other.x - v.x); // 正值 = other 在前方
      if (dxAhead <= 0) continue;
      const gap = dxAhead - myHalfL - _halfLength(other);
      if (gap < bestGap) {
        bestGap = gap;
        closest = other;
      }
    }
    return closest;
  }

  _gap(leader) {
    const v = this.vehicle;
    const dxAhead = v.direction * (leader.x - v.x);
    return dxAhead - _halfLength(v) - _halfLength(leader);
  }

  _findBusStop(busStops, range) {
    const v = this.vehicle;
    const d = v.direction;
    for (const stop of busStops) {
      if (stop.direction !== d) continue;
      if (stop._occupant && stop._occupant !== v) continue; // 已被其他公交占用
      const distAhead = d * (stop.x - v.x); // 正值 = stop 在前方（以车身中心计）
      if (distAhead >= -5 && distAhead <= range) return stop;
    }
    return null;
  }

  _distToStop(stop) {
    // 以车身中心计（停止时车体中心对准站点 x）
    return this.vehicle.direction * (stop.x - this.vehicle.x);
  }
}
