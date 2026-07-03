/**
 * NavGrid — 10px 格代价图
 *
 * 代价编码（Uint8Array）：
 *   0    = 硬阻挡（BLOCKED）：建筑区、障碍物 AABB
 *   1    = 可规划、可采样（人行道、公园小路、plaza）
 *   3    = 可规划、可采样（公园草地，行走代价高）
 *   ROAD = 可通行（Motor._slideMove 不拒绝），但不可规划、不可采样：
 *          自行车道 + 机动车道。planCrossing/modeDirect 可穿越，
 *          PathPlanner / sampleWalkableNear / pickRandom 不选它。
 *
 * 烘焙来源：
 *   1. Y 分带默认代价
 *   2. walkPaths 管道（PATH_TUBE_R px 内 → cost 1）
 *   3. chessPlaza / miniPark 椭圆 → cost 1
 *   4. 道具 AABB + OBS_MARGIN → 0（BLOCKED）
 *
 * 单例：getNavGrid() / setNavGrid()
 */

import {
  WORLD_WIDTH, WORLD_HEIGHT,
  BUILDING_BASE_Y, BIKE_LANE_FAR_TOP,
  NEAR_Y, BIKE_LANE_NEAR_BOTTOM, PARK_TOP, FAR_Y,
} from '../../core/Layout.js';

export const CELL = 10;
export const ROAD = 250;   // 可通行但不可规划/采样的格（马路+自行车道）
const COLS = Math.ceil(WORLD_WIDTH  / CELL);   // 200
const ROWS = Math.ceil(WORLD_HEIGHT / CELL);   // 52
const OBS_MARGIN = 1;
const PATH_TUBE_R = 20;

let _instance = null;
export const getNavGrid = () => _instance;
export const setNavGrid = (g) => { _instance = g; };

/**
 * 调试用：BLOCKED(0) 画 alpha 0.15，ROAD(250) 画 alpha 0.05。
 * window.__navDebug=true 时由 StreetScene 调用。
 */
export function drawNavDebug(g) {
  if (!_instance) return;
  g.lineStyle(0);
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const c = _instance._cost[gy * COLS + gx];
      if (c === 0) {
        g.beginFill(0x000000, 0.15);
        g.drawRect(gx * CELL, gy * CELL, CELL, CELL);
        g.endFill();
      } else if (c === ROAD) {
        g.beginFill(0x000000, 0.05);
        g.drawRect(gx * CELL, gy * CELL, CELL, CELL);
        g.endFill();
      }
    }
  }
}

// ─── Y 分带默认代价 ───────────────────────────────────────────────────────────
function _zoneDefault(wy) {
  if (wy < BUILDING_BASE_Y)       return 0;     // 建筑区（硬阻挡）
  if (wy < BIKE_LANE_FAR_TOP)     return 1;     // 远端人行道 (210-248)
  if (wy < NEAR_Y)                return ROAD;  // 远端自行车道+马路 (248-333)
  if (wy < BIKE_LANE_NEAR_BOTTOM) return ROAD;  // 近端自行车道 (333-353)
  return 3;                                      // 公园草地
}

// ─── 线段到点最短距离 ─────────────────────────────────────────────────────────
function _segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export class NavGrid {
  constructor() {
    this.COLS  = COLS;
    this.ROWS  = ROWS;
    this._cost = new Uint8Array(COLS * ROWS);
    this._baseZone = new Uint8Array(COLS * ROWS);  // zone cost without obstacles
  }

  /** 全场烘焙（场景初始化时调用一次） */
  bake(entities, layout) {
    this._bakeZones(layout);
    this._bakeObstacles(entities, 0, COLS - 1, 0, ROWS - 1);
    this._assertSingleRegions();
  }

  /** 局部重烘焙（动态道具增删时，供后续使用） */
  localRebake(cx, cy, radius, entities) {
    const m = OBS_MARGIN + CELL;
    const gx0 = Math.max(0,        Math.floor((cx - radius - m) / CELL));
    const gx1 = Math.min(COLS - 1, Math.ceil ((cx + radius + m) / CELL));
    const gy0 = Math.max(0,        Math.floor((cy - radius - m) / CELL));
    const gy1 = Math.min(ROWS - 1, Math.ceil ((cy + radius + m) / CELL));
    // 还原区带基础代价
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        this._cost[gy * COLS + gx] = this._baseZone[gy * COLS + gx];
      }
    }
    this._bakeObstacles(entities, gx0, gx1, gy0, gy1);
  }

  cost(gx, gy) {
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return 0;
    return this._cost[gy * COLS + gx];
  }

  worldToCell(wx, wy) {
    return {
      gx: Math.max(0, Math.min(COLS - 1, Math.floor(wx / CELL))),
      gy: Math.max(0, Math.min(ROWS - 1, Math.floor(wy / CELL))),
    };
  }

  cellCenter(gx, gy) {
    return { x: (gx + 0.5) * CELL, y: (gy + 0.5) * CELL };
  }

  /** BFS 找最近可走格（cost 1 或 3，不含 ROAD），返回其中心世界坐标 */
  nearestWalkable(wx, wy) {
    const { gx: sx, gy: sy } = this.worldToCell(wx, wy);
    const c0 = this.cost(sx, sy);
    if (c0 > 0 && c0 < ROAD) return { x: wx, y: wy };

    const visited = new Uint8Array(COLS * ROWS);
    const queue   = [sx + sy * COLS];
    visited[sy * COLS + sx] = 1;
    const DIRS = [-1, 1, -COLS, COLS, -COLS - 1, -COLS + 1, COLS - 1, COLS + 1];
    while (queue.length) {
      const ci = queue.shift();
      const gx = ci % COLS, gy = Math.floor(ci / COLS);
      const cv = this._cost[ci];
      if (cv > 0 && cv < ROAD) return this.cellCenter(gx, gy);
      for (const d of DIRS) {
        const ni = ci + d;
        if (ni < 0 || ni >= COLS * ROWS || visited[ni]) continue;
        const ng = Math.floor(ni / COLS);
        if (Math.abs(ng - gy) > 2) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }
    return { x: wx, y: wy };
  }

  /**
   * 从 NPC 附近采样一个可走点（偏好代价 1 的格子）。
   * 自动过滤掉会跨越马路的点（同侧约束）。
   */
  sampleWalkableNear(npc, radius = 350) {
    const cx = npc.x, cy = npc.y;
    const gxC = Math.floor(cx / CELL);
    const gyC = Math.floor(cy / CELL);
    const gr  = Math.ceil(radius / CELL);

    const isNearSide = cy >= NEAR_Y;  // park side vs far sidewalk side

    const pool1 = [], pool3 = [];  // cost-1 and cost-3 candidates
    for (let dy = -gr; dy <= gr; dy++) {
      for (let dx = -gr; dx <= gr; dx++) {
        if (dx * dx + dy * dy > gr * gr) continue;
        const gx = gxC + dx, gy = gyC + dy;
        const c  = this.cost(gx, gy);
        if (c === 0 || c === ROAD) continue;
        const wx = (gx + 0.5) * CELL;
        const wy = (gy + 0.5) * CELL;
        if ((wy >= NEAR_Y) !== isNearSide) continue;  // 不跨侧
        if (npc.minX != null && (wx < npc.minX || wx > npc.maxX)) continue;
        if (npc.minY != null && (wy < npc.minY || wy > npc.maxY)) continue;
        if (c === 1) pool1.push({ gx, gy });
        else         pool3.push({ gx, gy });
      }
    }

    // 70% 从低代价格采样，30% 从高代价格采样（偶尔抄草坪）
    const pool = (Math.random() < 0.7 && pool1.length)
      ? pool1
      : (pool3.length ? pool3 : pool1);
    if (!pool.length) return null;
    const c = pool[Math.floor(Math.random() * pool.length)];
    return this.cellCenter(c.gx, c.gy);
  }

  // ─── 内部：区带 + 路径代价 ─────────────────────────────────────────────────
  _bakeZones(layout) {
    // 1. 区带默认
    for (let gy = 0; gy < ROWS; gy++) {
      const wy  = (gy + 0.5) * CELL;
      const def = _zoneDefault(wy);
      for (let gx = 0; gx < COLS; gx++) {
        this._cost[gy * COLS + gx] = def;
      }
    }

    // 2. 公园顶部入口带 (PARK_TOP ~ PARK_TOP+28) → cost 1
    const gyEntry0 = Math.floor(PARK_TOP / CELL);
    const gyEntry1 = Math.min(ROWS - 1, Math.floor((PARK_TOP + 28) / CELL));
    for (let gy = gyEntry0; gy <= gyEntry1; gy++) {
      for (let gx = 0; gx < COLS; gx++) {
        if (this._cost[gy * COLS + gx] > 0) this._cost[gy * COLS + gx] = 1;
      }
    }

    // 3. walkPaths 管道 → cost 1
    const pathSegs = [];
    for (const def of Object.values(layout?.walkPaths ?? {})) {
      const wps = def.waypoints ?? [];
      for (let i = 0; i < wps.length - 1; i++) {
        pathSegs.push([wps[i].x, wps[i].y, wps[i + 1].x, wps[i + 1].y]);
      }
      if (def.loop && wps.length > 1) {
        const last = wps[wps.length - 1], first = wps[0];
        pathSegs.push([last.x, last.y, first.x, first.y]);
      }
    }

    // 4. chessPlaza / miniPark 椭圆 → cost 1
    const plazas = [];
    if (layout?.chessPlaza) {
      const { cx, cy, rx, ry } = layout.chessPlaza;
      plazas.push({ cx, cy, rx, ry });
    }
    if (layout?.miniPark) {
      const { cx, cy, rx, ry } = layout.miniPark;
      plazas.push({ cx, cy, rx: rx * 0.85, ry: ry * 0.7 });
    }

    // 仅对公园区域执行路径/plaza 降代价
    for (let gy = Math.floor(PARK_TOP / CELL); gy < ROWS; gy++) {
      const wy = (gy + 0.5) * CELL;
      for (let gx = 0; gx < COLS; gx++) {
        if (this._cost[gy * COLS + gx] === 0) continue;
        const wx = (gx + 0.5) * CELL;
        let low = false;
        for (const [ax, ay, bx, by] of pathSegs) {
          if (_segDist(ax, ay, bx, by, wx, wy) <= PATH_TUBE_R) { low = true; break; }
        }
        if (!low) {
          for (const { cx, cy, rx, ry } of plazas) {
            const ex = (wx - cx) / rx, ey = (wy - cy) / ry;
            if (ex * ex + ey * ey <= 1) { low = true; break; }
          }
        }
        if (low) this._cost[gy * COLS + gx] = 1;
      }
    }

    // 保存区带基础代价（不含障碍）
    this._baseZone.set(this._cost);
  }

  // ─── 内部：障碍物 AABB + 边距 → BLOCKED ──────────────────────────────────
  _bakeObstacles(entities, gx0, gx1, gy0, gy1) {
    for (const e of entities) {
      if (!e.alive || !e.obstacle) continue;
      this._markObstacle(e, gx0, gx1, gy0, gy1);
    }
  }

  _markObstacle(e, gx0, gx1, gy0, gy1) {
    const rx = (e.collisionRX || e.width  / 2 || 10) + OBS_MARGIN;
    const ry = (e.collisionRY || e.height / 2 || 10) + OBS_MARGIN;
    const cgx0 = Math.max(gx0, Math.floor((e.x - rx) / CELL));
    const cgx1 = Math.min(gx1, Math.ceil((e.x + rx) / CELL));
    const cgy0 = Math.max(gy0, Math.floor((e.y - ry) / CELL));
    const cgy1 = Math.min(gy1, Math.ceil((e.y + ry) / CELL));
    const isFountain = e.propType === 'fountain';
    for (let gy = cgy0; gy <= cgy1; gy++) {
      const wy = (gy + 0.5) * CELL;
      for (let gx = cgx0; gx <= cgx1; gx++) {
        const wx = (gx + 0.5) * CELL;
        if (isFountain) {
          const ex = (wx - e.x) / rx, ey = (wy - e.y) / ry;
          if (ex * ex + ey * ey > 1) continue;
        } else {
          if (wx < e.x - rx || wx > e.x + rx || wy < e.y - ry || wy > e.y + ry) continue;
        }
        this._cost[gy * COLS + gx] = 0;
      }
    }
  }
  /** 烘焙后断言：每侧可走格应构成单一连通区域。 */
  _assertSingleRegions() {
    const visited = new Uint8Array(COLS * ROWS);
    const DIRS = [-1, 1, -COLS, COLS, -COLS - 1, -COLS + 1, COLS - 1, COLS + 1];
    let farRegions = 0, nearRegions = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = this._cost[i];
      if ((c !== 1 && c !== 3) || visited[i]) continue;
      const seedWy = (Math.floor(i / COLS) + 0.5) * CELL;
      if (seedWy < NEAR_Y) farRegions++; else nearRegions++;
      const stack = [i]; visited[i] = 1;
      while (stack.length) {
        const ci = stack.pop();
        const gy = Math.floor(ci / COLS);
        for (const d of DIRS) {
          const ni = ci + d;
          if (ni < 0 || ni >= COLS * ROWS || visited[ni]) continue;
          const ng = Math.floor(ni / COLS);
          if (Math.abs(ng - gy) > 1) continue;
          const nc = this._cost[ni];
          if (nc !== 1 && nc !== 3) continue;
          visited[ni] = 1; stack.push(ni);
        }
      }
    }
    console.assert(farRegions  <= 1, `NavGrid: far side has ${farRegions} walkable regions (expected 1)`);
    console.assert(nearRegions <= 1, `NavGrid: near side has ${nearRegions} walkable regions (expected 1)`);
  }
}

