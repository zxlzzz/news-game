/**
 * TrafficManager — 车辆交通统一协调器
 *
 * 持有所有 VehicleEntity、BusStop、TrafficSignal 列表，每帧依次：
 *   ① 更新所有 TrafficSignal
 *   ② 更新所有 BusStop（停站计时）
 *   ③ 清理死亡车辆
 *   ④ 遍历活跃车辆，调用各自 VehicleStateMachine.update()（传入同方向列表）
 *   ⑤ 调用 VehicleSpawner.update()
 */
export class TrafficManager {
  /**
   * @param {object} opts
   * @param {EntityManager} opts.em  - 实体管理器（addVehicle 时用于注册渲染）
   * @param {object}        opts.dep - { scaleMul, roadCenterY, roadHalfHeight }
   */
  constructor({ em, dep }) {
    this._em       = em;
    this._dep      = dep;
    this.vehicles  = [];
    this.busStops  = [];
    this.signals   = [];
    this.spawner   = null;
  }

  /** 添加一辆车（同时注册到 EntityManager 用于渲染） */
  addVehicle(v) {
    this.vehicles.push(v);
    this._em.add(v);
  }

  /** 移除一辆车（标记 alive=false，下帧清理） */
  removeVehicle(v) {
    v.alive = false;
  }

  /** 每帧由 StreetScene.update() 调用（delta ms） */
  update(delta) {
    // 1) 更新红绿灯（stub）
    for (const sig of this.signals) sig.update(delta);

    // 2) 更新公交站计时
    for (const stop of this.busStops) stop.update(delta);

    // 3) 清理死亡车辆
    this.vehicles = this.vehicles.filter(v => v.alive);

    // 4) 逐辆更新状态机
    for (const v of this.vehicles) {
      if (!v.stateMachine) continue;
      const sameDir = this.vehicles.filter(
        u => u !== v && u.direction === v.direction
      );
      v.stateMachine.update(delta, sameDir, this.busStops);
    }

    // 5) 补充车辆
    if (this.spawner) this.spawner.update(delta, this.vehicles);

    // TODO: pedestrian-vehicle interaction
  }
}
