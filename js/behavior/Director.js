/**
 * Director — 人流源汇调度器（替换 SpawnManager）
 *
 * 职责：
 *   1. 按游戏时段控制场景流动 NPC 密度目标
 *   2. 按权重（建筑门 60% / 边缘 30% / 公交下客 10%）选 spawn 源
 *   3. 公交到站时吐 0~3 名下客 NPC（onArrival 钩子）
 *   4. spawn 时为每个 NPC 分配 exitBias（楼门/公交/边缘）和 lifespan
 *   5. 初始批次的 NPC 通过 assignDefaults() 补齐 exitBias
 *
 * 密度语义：
 *   target 为流动 NPC 目标数（lifespan != null）；常驻 NPC（棋手/摊主/遛狗者/
 *   运动员，lifespan = null）不计入 transientAlive，不占用 target 配额。
 *   超额时经寿命快进（ag.ageTimer = ag.lifespan）触发减员，由 BM 寿命检查在
 *   下一帧统一走 triggerDeparture 全链路，S1 的 !sc.activity 门自动生效。
 *
 * 铁律：Director 只管 spawn/despawn 调度，个体目标选择全部由 Agenda 负责。
 */

import {
  BUILDING_BASE_Y, PARK_TOP, PARK_BOTTOM, WORLD_WIDTH,
  BIKE_LANE_FAR_TOP,
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

export class Director {
  /**
   * @param {object}          opts
   * @param {BehaviorManager} opts.bm
   * @param {EntityManager}   opts.em
   * @param {StickRenderer}   opts.sr
   * @param {ExitRegistry}    opts.exitRegistry
   * @param {Array}           opts.buildingDoors   — [{x, id}]
   * @param {Array}           opts.spawnPoints     — [{x, y, facing}]
   * @param {Array}           opts.busStops        — BusStop 实例数组
   */
  constructor({ bm, em, sr, exitRegistry, buildingDoors, spawnPoints, busStops }) {
    this._bm           = bm;
    this._em           = em;
    this._sr           = sr;
    this._exitRegistry = exitRegistry;
    this._doors        = buildingDoors ?? [];
    this._spawnPoints  = spawnPoints ?? [];
    this._busStops     = busStops ?? [];
    this._spawnTimer   = rand(2, 5);

    // 挂 onArrival 钩子到每个公交站
    for (const stop of this._busStops) {
      stop.onArrival = (bus, s) => this._alight(bus, s);
    }
  }

  // ─── 每帧更新：密度检查 + 补充 spawn / 超额加速离场 ────────────────────────────
  update(dt) {
    this._spawnTimer -= dt;
    if (this._spawnTimer > 0) return;
    this._spawnTimer = rand(2, 5);

    const transientAlive = this._bm.npcs.filter(n =>
      n.alive && !n.mem('agenda').departing && n.mem('agenda').lifespan != null
    ).length;
    const { target } = this._currentPeriod();

    if (transientAlive < target) {
      const missing = Math.min(target - transientAlive, 2);
      for (let i = 0; i < missing; i++) this._spawnOne();
    } else if (transientAlive > target + 2) {
      // 快进寿命：BM 寿命检查在下一帧经 triggerDeparture 全链路减员
      const excess = Math.min(transientAlive - target, 2);
      const candidates = this._bm.npcs
        .filter(n => {
          if (!n.alive) return false;
          const ag = n.mem('agenda');
          const sc = n.mem('social');
          return ag.lifespan != null && !ag.departing && !sc.activity && !sc.waitingBusStop;
        })
        .sort((a, b) => {
          const ra = a.mem('agenda').ageTimer / a.mem('agenda').lifespan;
          const rb = b.mem('agenda').ageTimer / b.mem('agenda').lifespan;
          return rb - ra;  // 降序：最接近自然离场者先走
        });
      for (let i = 0; i < excess && i < candidates.length; i++) {
        candidates[i].mem('agenda').ageTimer = candidates[i].mem('agenda').lifespan;
      }
    }
  }

  // ─── 初始批次后补分配 exitBias / lifespan ────────────────────────────────────
  assignDefaults(npcs) {
    for (const npc of npcs) {
      const ag = npc.mem('agenda');
      if (ag.exitBias == null) {
        ag.exitBias = _pickBias(npc.npcType ?? 'pedestrian');
      }
      this._installRefs(npc);
    }
  }

  // ─── 公交到站下客 ─────────────────────────────────────────────────────────────
  _alight(bus, stop) {
    const transientAlive = this._bm.npcs.filter(n =>
      n.alive && !n.mem('agenda').departing && n.mem('agenda').lifespan != null
    ).length;
    const { target } = this._currentPeriod();
    const headroom = target - transientAlive;
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

  // ─── 单次 spawn：60% 边缘 / 40% 楼门加权选入口 ───────────────────────────────
  _spawnOne() {
    if (this._spawnPoints.length === 0) return;
    const { mix } = this._currentPeriod();
    const profile = _pickProfile(mix);

    const edges = this._spawnPoints.filter(p => p.facing !== 0);
    const doors = this._spawnPoints.filter(p => p.facing === 0);
    const useEdge = edges.length > 0 && (doors.length === 0 || Math.random() < 0.60);
    const pool = useEdge ? edges : doors;
    const pt   = pool[Math.floor(Math.random() * pool.length)];
    const isDoor = pt.facing === 0;
    this._spawnNPC(profile, pt.x, pt.y, isDoor ? { x: pt.x } : null);
  }

  // ─── 实际创建 NPC ─────────────────────────────────────────────────────────────
  _spawnNPC(profile, x, y, door, extra = {}) {
    const exitBias  = extra.exitBias ?? _pickBias(profile);
    const fromDoor  = door != null;
    const direction = fromDoor
      ? (Math.random() < 0.5 ? 1 : -1)   // door: facing=0, pick randomly
      : (x < 0 ? 1 : -1);                // edge: derive from entry side

    const npc = spawnOnePedestrian(profile, this._em, this._sr, this._bm, { x, y }, {
      minX: 0, maxX: WORLD_WIDTH,
      minY: BUILDING_BASE_Y, maxY: PARK_BOTTOM,
      snap: fromDoor,
    });
    npc.direction = direction;
    const ag = npc.mem('agenda');
    ag.exitBias  = exitBias;
    ag.ageTimer  = fromDoor ? 0 : rand(0, 20);

    this._installRefs(npc);
    return npc;
  }

  // ─── 将运行时引用注入到 NPC，供 ExitSceneTask 使用 ─────────────────────────────
  _installRefs(npc) {
    const ag = npc.mem('agenda');
    ag.exitRegistry    = this._exitRegistry;
    ag.waitForBusLayer = this._bm.waitForBusLayer;
    ag.busStops        = this._busStops;
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
