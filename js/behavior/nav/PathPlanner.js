/**
 * CONTRACT  (see docs/contracts/movement.md)
 *   OWNS:      A* planning from world coordinates to [{x,y}] waypoint arrays.
 *   WRITES:    nothing on any NPC or shared state — pure function.
 *   READS:     NavGrid singleton (getNavGrid) for zone lookups; read-only.
 *   MUST NOT:  write any npc field; mutate the NavGrid zone map;
 *              own cost policy — the zone→cost table is supplied by the caller
 *              (PlanService: DEFAULT_ZONE_COSTS + profile.zoneCosts + jaywalk);
 *              be called with a ZONE.ROAD goal — goal must be sanitized to walkable;
 *              ZONE.ROAD start is valid (planner routes out from any non-BLOCKED position).
 *
 * PathPlanner — A* 寻路 + 视距拉直
 *
 * plan(x0, y0, x1, y1, bounds, zoneCosts) → [{x,y}] 世界坐标路点数组；
 * 起/终点落在 BLOCKED 格时自动吸附到最近可走格。
 * 无路返回 null。
 *
 * 代价来源：zoneCosts[zone] —— 表值 0 表示该 zone 不可通行（A* skip）。
 */

import { CELL, ZONE, DEFAULT_ZONE_COSTS, getNavGrid } from './NavGrid.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../core/Layout.js';

/**
 * 拉直粗糙度 —— 只服务 _lineOfSight 的"不穿更粗糙地面"约束，与规划代价无关
 * （代价住 zoneCosts 表；roughness 是地面质地的序，不参与 A*）。
 * 铺装（SIDEWALK/CROSSWALK）1 < 草地 2 << ROAD/BLOCKED 999（后两者另有显式拒绝，
 * 999 只是保证它们永不放宽 maxR）。
 */
const ZONE_ROUGHNESS = {
  [ZONE.SIDEWALK]:  1,
  [ZONE.CROSSWALK]: 1,
  [ZONE.GRASS]:     2,
  [ZONE.ROAD]:      999,
  [ZONE.BLOCKED]:   999,
};
const _roughness = (z) => ZONE_ROUGHNESS[z] ?? 999;

const SQRT2 = Math.SQRT2;
// [dx, dy, moveCostMultiplier]
const DIRS = [
  [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
  [-1, -1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [1, 1, SQRT2],
];

// ─── 二叉最小堆 ──────────────────────────────────────────────────────────────
class Heap {
  constructor() { this._d = []; }
  get size() { return this._d.length; }
  push(item) {
    this._d.push(item);
    let i = this._d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._d[p].f <= this._d[i].f) break;
      const tmp = this._d[p]; this._d[p] = this._d[i]; this._d[i] = tmp;
      i = p;
    }
  }
  pop() {
    const top = this._d[0];
    const last = this._d.pop();
    if (this._d.length > 0) {
      this._d[0] = last;
      let i = 0;
      const n = this._d.length;
      for (;;) {
        let m = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && this._d[l].f < this._d[m].f) m = l;
        if (r < n && this._d[r].f < this._d[m].f) m = r;
        if (m === i) break;
        const tmp = this._d[m]; this._d[m] = this._d[i]; this._d[i] = tmp;
        i = m;
      }
    }
    return top;
  }
}

// ─── PathPlanner ──────────────────────────────────────────────────────────────
export class PathPlanner {
  constructor(navGrid) {
    this._grid = navGrid;
  }

  /**
   * 规划路径，返回世界坐标路点数组（含终点），无路返回 null。
   * @param {number} x0 @param {number} y0 起点
   * @param {number} x1 @param {number} y1 终点
   * @param {{minX,maxX,minY,maxY}|null} bounds  可选活动边界（格中心在界外的格跳过）
   * @param {Object<number,number>} zoneCosts  zone→有效代价表；值 0 = 不可通行
   */
  plan(x0, y0, x1, y1, bounds = null, zoneCosts = DEFAULT_ZONE_COSTS) {
    const grid = this._grid;
    let s = grid.worldToCell(x0, y0);
    let e = grid.worldToCell(x1, y1);

    const sz = grid.zone(s.gx, s.gy);
    if (x0 < 0 || x0 > WORLD_WIDTH || y0 < 0 || y0 > WORLD_HEIGHT || sz === ZONE.BLOCKED) {
      const snap = grid.nearestWalkable(x0, y0, bounds);
      s = grid.worldToCell(snap.x, snap.y);
    }
    const ez = grid.zone(e.gx, e.gy);
    if (x1 < 0 || x1 > WORLD_WIDTH || y1 < 0 || y1 > WORLD_HEIGHT
        || ez === ZONE.BLOCKED || ez === ZONE.ROAD) {
      // 目的地不可是 ROAD——目标经 sanitize，此为不变量而非限制
      const snap = grid.nearestWalkable(x1, y1, bounds);
      e = grid.worldToCell(snap.x, snap.y);
    }

    if (s.gx === e.gx && s.gy === e.gy) return [{ x: x1, y: y1 }];

    const cellPath = this._astar(s.gx, s.gy, e.gx, e.gy, bounds, zoneCosts);
    if (!cellPath || cellPath.length === 0) return null;

    const straight = this._straighten(cellPath);
    const pts = straight.map(c => grid.cellCenter(c.gx, c.gy));
    // 目的地不可是 ROAD——目标经 sanitize，此为不变量而非限制
    if (pts.length > 0 && ez !== ZONE.BLOCKED && ez !== ZONE.ROAD) pts[pts.length - 1] = { x: x1, y: y1 };
    return pts;
  }

  // ─── A* ──────────────────────────────────────────────────────────────────────
  _astar(sx, sy, ex, ey, bounds = null, zoneCosts = DEFAULT_ZONE_COSTS) {
    const { COLS, ROWS } = this._grid;
    console.assert(sx >= 0 && sx < COLS && sy >= 0 && sy < ROWS &&
                   ex >= 0 && ex < COLS && ey >= 0 && ey < ROWS,
      `_astar: out-of-range (${sx},${sy})→(${ex},${ey})`);
    const N      = COLS * ROWS;
    const gCost  = new Float32Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);

    const startIdx = sy * COLS + sx;
    const goalIdx  = ey * COLS + ex;

    gCost[startIdx] = 0;
    const open = new Heap();
    open.push({ f: Math.hypot(sx - ex, sy - ey), gx: sx, gy: sy });

    while (open.size > 0) {
      const { gx, gy } = open.pop();
      const ci = gy * COLS + gx;
      if (closed[ci]) continue;
      closed[ci] = 1;
      if (ci === goalIdx) return this._reconstruct(parent, goalIdx, COLS);

      for (const [dx, dy, mul] of DIRS) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        if (bounds) {
          const wx = (nx + 0.5) * CELL, wy = (ny + 0.5) * CELL;
          if (wx < bounds.minX || wx > bounds.maxX || wy < bounds.minY || wy > bounds.maxY) continue;
        }
        const eff = zoneCosts[this._grid.zone(nx, ny)] ?? 0;
        if (eff === 0) continue;
        // Block diagonal moves that cut through a blocked corner
        if (dx !== 0 && dy !== 0) {
          const e1 = zoneCosts[this._grid.zone(gx + dx, gy)] ?? 0;
          const e2 = zoneCosts[this._grid.zone(gx, gy + dy)] ?? 0;
          if (e1 === 0 || e2 === 0) continue;
        }
        const ni = ny * COLS + nx;
        if (closed[ni]) continue;
        const ng = gCost[ci] + mul * eff;
        if (ng < gCost[ni]) {
          gCost[ni]  = ng;
          parent[ni] = ci;
          open.push({ f: ng + Math.hypot(nx - ex, ny - ey), gx: nx, gy: ny });
        }
      }
    }
    return null;
  }

  _reconstruct(parent, goalIdx, COLS) {
    const path = [];
    let ci = goalIdx;
    while (ci >= 0) {
      path.push({ gx: ci % COLS, gy: Math.floor(ci / COLS) });
      ci = parent[ci];
      if (path.length > 20000) break; // safety
    }
    path.reverse();
    return path;
  }

  // ─── 视距拉直（Bresenham 可见性检查，zone 感知）──────────────────────────────
  // 两道约束：
  //   1. 拉直不得穿 BLOCKED，也不得斜穿 ROAD——否则斑马线折线被拉直成 jaywalk。
  //      CROSSWALK 可拉直（管内本就是合法穿越通道）。
  //   2. 中间格 roughness 不得超过两端 roughness 的 max（ZONE_ROUGHNESS）：
  //      铺装点之间拉直不穿草（公园 walkPaths 专门 bake 了 SIDEWALK 走廊穿过草地，
  //      拉直若抄草等于白修路）；草地内部两点仍可穿草，避免草地内走格子锯齿。
  _lineOfSight(gx0, gy0, gx1, gy1) {
    const endZ = this._grid.zone(gx1, gy1);
    if (endZ === ZONE.BLOCKED || endZ === ZONE.ROAD) return false;
    const maxR = Math.max(_roughness(this._grid.zone(gx0, gy0)), _roughness(endZ));

    const dx = Math.abs(gx1 - gx0), dy = Math.abs(gy1 - gy0);
    const sx = gx0 < gx1 ? 1 : -1, sy = gy0 < gy1 ? 1 : -1;
    let err = dx - dy, x = gx0, y = gy0;
    while (x !== gx1 || y !== gy1) {
      const z = this._grid.zone(x, y);
      if (z === ZONE.BLOCKED || z === ZONE.ROAD) return false;
      if (_roughness(z) > maxR) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx)  { err += dx; y += sy; }
    }
    return true;
  }

  _straighten(path) {
    if (path.length <= 2) return path;
    const result = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !this._lineOfSight(
        path[i].gx, path[i].gy, path[j].gx, path[j].gy)) {
        j--;
      }
      result.push(path[j]);
      i = j;
    }
    return result;
  }
}

// ─── 模块级便捷函数 ───────────────────────────────────────────────────────────
let _planner = null;

export function getPlanner() {
  const grid = getNavGrid();
  if (!grid) return null;
  if (!_planner || _planner._grid !== grid) _planner = new PathPlanner(grid);
  return _planner;
}
