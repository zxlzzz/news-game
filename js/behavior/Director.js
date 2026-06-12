/**
 * Director — 人流源汇调度器（替换 SpawnManager）
 *
 * 职责：
 *   1. 按游戏时段控制场景 NPC 密度目标
 *   2. 按权重（建筑门 60% / 边缘 30% / 公交下客 10%）选 spawn 源
 *   3. 公交到站时吐 0~3 名下客 NPC（onArrival 钩子）
 *   4. spawn 时为每个 NPC 分配 exitBias（楼门/公交/边缘）和 lifespan
 *   5. 初始批次的 NPC 通过 assignDefaults() 补齐 exitBias
 *
 * 铁律：Director 只管 spawn/despawn 调度，个体目标选择全部由 Agenda 负责。
 */

import {
  SIDEWALK_FAR_Y, BUILDING_BASE_Y, FAR_Y, NEAR_Y,
  PARK_TOP, PARK_BOTTOM, WORLD_WIDTH,
  BIKE_LANE_FAR_TOP, depthScale,
} from '../core/Layout.js';
import { gameClock }          from '../core/GameClock.js';
import { spawnOnePedestrian } from '../npc/Pedestrians.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── 时段密度表 ────────────────────────────────────────────────────────────────
// target: 全场目标 NPC 数；mix: 各 profile 占比（和≤1，余量归 pedestrian）
const PERIODS = [
  { startH:  6, endH:  8, target: 10, mix: { businessman: 0.30, pedestrian: 0.55, tourist: 0.15 } },
  { startH:  8, endH: 10, target: 22, mix: { businessman: 0.50, pedestrian: 0.35, tourist: 0.15 } },
  { startH: 10, endH: 16, target: 18, mix: { businessman: 0.15, pedestrian: 0.45, tourist: 0.40 } },
  { startH: 16, endH: 19, target: 25, mix: { businessman: 0.40, pedestrian: 0.38, tourist: 0.22 } },
  { startH: 19, endH: 22, target: 14, mix: { businessman: 0.15, pedestrian: 0.65, tourist: 0.20 } },
  { startH: 22, endH: 24, target:  7, mix: { businessman: 0.10, pedestrian: 0.75, tourist: 0.15 } },
  { startH:  0, endH:  6, target:  4, mix: { businessman: 0.05, pedestrian: 0.85, tourist: 0.10 } },
];

// ─── 出口倾向权重（按 profile）────────────────────────────────────────────────
const EXIT_BIAS = {
  businessman: { building: 0.50, bus: 0.20, edge: 0.30 },
  pedestrian:  { building: 0.30, bus: 0.25, edge: 0.45 },
  tourist:     { building: 0.15, bus: 0.25, edge: 0.60 },
};

function _pickBias(profile) {
  const w = EXIT_BIAS[profile] ?? EXIT_BIAS.pedestrian;
  const r = Math.random();
  if (r < w.building) return 'building';
  if (r < w.building + w.bus) return 'bus';
  return 'edge';
}

function _pickProfile(mix) {
  const r = Math.random();
  let acc = 0;
  for (const [p, w] of Object.entries(mix)) {
    acc += w;
    if (r < acc) return p;
  }
  return 'pedestrian';
}

// ─── spawn 区域（建筑门出来进入远端人行道，或公园两侧边缘）─────────────────────
const FAR_SPAWN_Y  = SIDEWALK_FAR_Y;
const NEAR_SPAWN_Y = PARK_TOP + 30;

export class Director {
  /**
   * @param {object}          opts
   * @param {BehaviorManager} opts.bm
   * @param {EntityManager}   opts.em
   * @param {StickRenderer}   opts.sr
   * @param {ExitRegistry}    opts.exitRegistry
   * @param {Array}           opts.buildingDoors   — [{x, id}]
   * @param {Array}           opts.busStops        — BusStop 实例数组
   */
  constructor({ bm, em, sr, exitRegistry, buildingDoors, busStops }) {
    this._bm           = bm;
    this._em           = em;
    this._sr           = sr;
    this._exitRegistry = exitRegistry;
    this._doors        = buildingDoors ?? [];
    this._busStops     = busStops ?? [];
    this._spawnTimer   = rand(2, 5);

    // 挂 onArrival 钩子到每个公交站
    for (const stop of this._busStops) {
      stop.onArrival = (bus, s) => this._alight(bus, s);
    }
  }

  // ─── 每帧更新：密度检查 + 补充 spawn ──────────────────────────────────────────
  update(dt) {
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    this._spawnTimer = rand(2, 5);

    const alive = this._bm.npcs.filter(n => n.alive && !n._departing).length;
    const { target } = this._currentPeriod();
    if (alive < target) {
      const missing = Math.min(target - alive, 2);
      for (let i = 0; i < missing; i++) this._spawnOne();
    }
  }

  // ─── 初始批次后补分配 exitBias / lifespan ────────────────────────────────────
  assignDefaults(npcs) {
    for (const npc of npcs) {
      if (npc._exitBias == null) {
        npc._exitBias = _pickBias(npc.npcType ?? 'pedestrian');
      }
      this._installRefs(npc);
    }
  }

  // ─── 公交到站下客 ─────────────────────────────────────────────────────────────
  _alight(bus, stop) {
    const alive = this._bm.npcs.filter(n => n.alive && !n._departing).length;
    const { target } = this._currentPeriod();
    const headroom = target - alive;
    if (headroom <= 0) return;

    const count = Math.min(Math.floor(Math.random() * 4), headroom);  // 0-3
    if (count === 0) return;

    const dims   = bus._dims?.() ?? { L: 50 };
    const doorX  = bus.x - bus.direction * dims.L * (bus.scale ?? 1) * 0.52;
    const doorY  = stop.direction > 0 ? BIKE_LANE_FAR_TOP : PARK_TOP;

    const { mix } = this._currentPeriod();
    for (let i = 0; i < count; i++) {
      const profile = _pickProfile(mix);
      const jitter  = (Math.random() - 0.5) * 24;
      this._spawnNPC(profile, doorX + jitter, doorY, null, { exitBias: 'edge' });
    }
  }

  // ─── 单次 spawn：加权选源 ──────────────────────────────────────────────────────
  _spawnOne() {
    const { mix } = this._currentPeriod();
    const profile = _pickProfile(mix);

    const r = Math.random();
    if (r < 0.60 && this._doors.length > 0) {
      // 建筑门出行
      const door = this._doors[Math.floor(Math.random() * this._doors.length)];
      this._spawnNPC(profile, door.x, FAR_SPAWN_Y, door);
    } else if (r < 0.90) {
      // 画面边缘入场
      const fromLeft = Math.random() < 0.5;
      const useNear  = Math.random() < 0.4;  // 40% 从公园侧入
      const x = fromLeft ? -10 : WORLD_WIDTH + 10;
      const y = useNear ? rand(NEAR_SPAWN_Y, PARK_BOTTOM - 20) : rand(FAR_SPAWN_Y - 10, FAR_Y - 5);
      this._spawnNPC(profile, x, y, null);
    }
    // 剩余 10% 等公交到站下客（_alight 处理）
  }

  // ─── 实际创建 NPC ─────────────────────────────────────────────────────────────
  _spawnNPC(profile, x, y, door, extra = {}) {
    const exitBias  = extra.exitBias ?? _pickBias(profile);
    const fromDoor  = door != null;
    const direction = fromDoor
      ? (x < WORLD_WIDTH / 2 ? 1 : -1)
      : (x < 0 ? 1 : -1);

    const npc = spawnOnePedestrian(profile, this._em, this._sr, this._bm, { x, y }, {
      minX: 0, maxX: WORLD_WIDTH,
      minY: BUILDING_BASE_Y, maxY: PARK_BOTTOM,
    });
    npc.direction  = direction;
    npc._exitBias  = exitBias;
    npc._lifespan  = rand(90, 200);
    npc._ageTimer  = fromDoor ? 0 : rand(0, 20);

    this._installRefs(npc);
    return npc;
  }

  // ─── 将运行时引用注入到 NPC，供 ExitSceneTask 使用 ─────────────────────────────
  _installRefs(npc) {
    npc._exitRegistry    = this._exitRegistry;
    npc._waitForBusLayer = this._bm.waitForBusLayer;
    npc._busStops        = this._busStops;
  }

  // ─── 当前时段参数 ─────────────────────────────────────────────────────────────
  _currentPeriod() {
    const h = gameClock();
    for (const p of PERIODS) {
      if (h >= p.startH && h < p.endH) return p;
    }
    return PERIODS[PERIODS.length - 1];
  }
}
