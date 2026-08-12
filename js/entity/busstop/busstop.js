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
  BIKE_LANE_NEAR_BOTTOM,
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

/**
 * 候车亭几何常量（骨架单位；括号内为按 UNITS_PER_METER=84.7 折算的现实尺寸）。
 *
 * O-4 改动说明：这些值原来散在 spawnBusStop 里，且**竖直方向是用绝对世界 y
 * 相减**表达的（`roofTopY` / `pillarBottomY` 两个绝对坐标）——O-2 之前世界 y
 * 就是屏幕 y，这么写看着没问题；接上真投影后高度与纵深必须分开（见
 * Projection.js 文件头「核心区分」），所以改成"柱脚落地点 + 高度"。
 *
 * 同时修掉两个既有 bug：
 *   1. `stop.bayD` 在 scene.json 里从来没配过（`layout.busStops` 只有
 *      x/direction/bench 三个键），远端站的 `pillarBottomY = FAR_Y - undefined - 2`
 *      算出 **NaN**，整个远端顶棚画不出来，且 `_sortY` 也是 NaN。现在 bay 深度
 *      是本文件的具名常量，不再依赖未配置的场景字段。
 *   2. 近端站的棚顶竖直跨度只有 60 骨架单位 ≈ 0.71 m。那是"扁平视图里看着对"
 *      的数字，当成真实高度就是个要爬进去的亭子。现按现实候车亭改成 2.4 m。
 */
const BUS_BAY_D      = 170; // 2.0m，港湾式停靠区进深（远端站柱脚从路缘往回缩这么多）
const ROOF_CLEAR_H   = 203; // 2.4m，棚底离地净高
const ROOF_SLAB_H    = 21;  // 0.25m，棚板厚度
const ROOF_W         = 800; // 9.4m，顶棚跨度
const PILLAR_OFFSET  = 325; // 3.8m，柱子距中心

/** 一次性创建整个公交站：顶棚 PropEntity + 长椅 PropEntity */
export function spawnBusStop(em, stop) {
  const far     = stop.direction > 0;
  const anchorY = far ? FAR_Y : NEAR_Y;
  // 柱脚落地点：远端站退到港湾后方的人行道上，近端站贴着近侧自行车道外沿
  const pillarBottomY = far
    ? FAR_Y - BUS_BAY_D - 2
    : BIKE_LANE_NEAR_BOTTOM - 5;

  const roofW      = stop.roofW ?? ROOF_W;
  const roofH      = stop.roofH ?? ROOF_SLAB_H;
  const roofClearH = stop.roofClearH ?? ROOF_CLEAR_H;

  const roof = em.add(new PropEntity({
    propType: 'busstop-roof',
    x: stop.x, y: pillarBottomY,          // y = 柱脚落地点（CLAUDE.md 铁律：entity.y = 地面接触线）
    roofW, roofH, roofClearH,
    pillarOffset: stop.pillarOffset ?? PILLAR_OFFSET,
    dir: stop.direction,
    width: roofW, height: roofClearH + roofH,
    _sortY: pillarBottomY,
    tags: [],
  }));
  roof.scale = 1; // O-1：世界坐标各向同性，静态 prop 无景深缩放

  if (stop.bench) {
    const bx = stop.x + stop.bench.dx;
    const by = anchorY + stop.bench.dy;
    const bench = em.add(new PropEntity({
      propType: 'busstop-bench',
      x: bx, y: by,
      width: stop.bench.width,
      height: 12,
      seatH: 34,
      facing: stop.bench.facing ?? 'down',
      tags: ['seatable', 'busstop'],
    }));
    bench.scale = 1;
  }

  if (stop.sign) {
    const signX = stop.x + stop.sign.dx;
    // y = 杆脚落地点（同顶棚柱脚那条地面线；drawBusStopSign 按此往上量杆高）
    const signY = pillarBottomY;
    const signE = em.add(new PropEntity({
      propType: 'busstop-sign',
      x: signX, y: signY,
      dir: stop.direction,
      tags: [],
    }));
    signE.scale = 1;
  }
}
