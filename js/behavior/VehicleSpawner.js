/**
 * VehicleSpawner — 边缘入场管理器
 *
 * 每 2~4 秒检查各行带密度，不足 target 时以 30% 概率从对应边缘生成一辆新车。
 * 密度门控 + 边缘入场，专为机动车设计。
 */

import { VehicleEntity }        from '../entity/vehicle/VehicleEntity.js';
import { VehicleStateMachine }  from '../entity/vehicle/VehicleStateMachine.js';
import { roadY, WORLD_WIDTH }   from '../core/Layout.js';

const LANES = [
  { id: 'upbound',   direction: +1, yRange: [roadY(0.10), roadY(0.38)], target: 3, entryX: -200 },
  { id: 'downbound', direction: -1, yRange: [roadY(0.62), roadY(0.90)], target: 3, entryX: WORLD_WIDTH + 200 },
];

// 车型权重（两个方向各有一座公交站，故两向都生成 bus）
const WEIGHTS = {
  '1':  { car: 5, taxi: 2, moto: 2, bus: 1 },
  '-1': { car: 5, taxi: 2, moto: 2, bus: 1 },
};

const rand = (a, b) => a + Math.random() * (b - a);

export class VehicleSpawner {
  /**
   * @param {object}         opts
   * @param {TrafficManager} opts.trafficManager
   * @param {StickRenderer}  opts.sr
   */
  constructor({ trafficManager, sr }) {
    this._tm    = trafficManager;
    this._sr    = sr ?? null;
    this._timer = 0;
  }

  /** 场景初始化时调用：将车辆分散铺满世界 */
  spawnInitial() {
    for (const lane of LANES) {
      const n = lane.target;
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * WORLD_WIDTH;
        this._spawnVehicle(lane, x);
      }
    }
  }

  /** 每帧由 TrafficManager 调用（delta ms） */
  update(delta, vehicles) {
    this._timer -= delta;
    if (this._timer > 0) return;
    this._timer = 2000 + Math.random() * 2000;  // 2~4 秒检查一次

    for (const lane of LANES) {
      const count = vehicles.filter(v =>
        v.alive &&
        v.direction === lane.direction &&
        v._laneY >= lane.yRange[0] && v._laneY <= lane.yRange[1]
      ).length;

      if (count < lane.target && Math.random() < 0.30) {
        this._spawnVehicle(lane, lane.entryX);
      }
    }
  }

  _spawnVehicle(lane, entryX) {
    const weights = WEIGHTS[String(lane.direction)];
    const kind    = this._pickKind(weights);

    const y     = rand(lane.yRange[0], lane.yRange[1]);
    const speed = kind === 'moto' ? rand(100, 150) : rand(70, 130);
    const tagName = kind === 'taxi' ? 'taxi' : kind === 'bus' ? 'transit' : kind;

    const v = new VehicleEntity({
      kind,
      x:         entryX,
      y,
      direction: lane.direction,
      speed,
      minX:      -250,
      maxX:      WORLD_WIDTH + 250,
      tags:      [tagName, 'vehicle'],
      facingSide: kind === 'bus' ? (lane.direction > 0 ? 'far' : 'near') : 'near',
    });

    v.stateMachine = new VehicleStateMachine(v);
    if (kind === 'moto' && this._sr) v._sr = this._sr;
    this._tm.addVehicle(v);
    return v;
  }

  _pickKind(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [kind, w] of Object.entries(weights)) {
      r -= w;
      if (r <= 0) return kind;
    }
    return Object.keys(weights)[0];
  }
}
