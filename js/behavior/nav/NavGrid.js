/**
 * CONTRACT  (see docs/contracts/movement.md)
 *   OWNS:      The singleton NavGrid instance (_instance / getNavGrid / setNavGrid);
 *              zone map encoding (ZONE.* semantic IDs) and DEFAULT_ZONE_COSTS.
 *   WRITES:    _instance (setNavGrid — called once from SceneInitializer.js:96).
 *   READS:     scene layout (walkPaths, obstacles, crosswalks) at bake time only;
 *              read-only after bake.
 *   MUST NOT:  be replaced or mutated after scene init;
 *              be called with setNavGrid from anywhere except SceneInitializer;
 *              hold planning cost numbers — cost lives in the profile cost table
 *              (DEFAULT_ZONE_COSTS / profile.zoneCosts), the grid stores zones only.
 *
 * NavGrid — 10px 格 zone 图
 *
 * 两层结构（Z-1 zone-profile split）：
 *   本模块烘焙 **zone**（语义 ID，无代价含义）；
 *   有效代价由消费者从 zone → cost 表查得（DEFAULT_ZONE_COSTS，profile 可覆盖）。
 *
 * zone 编码（Uint8Array）：
 *   ZONE.BLOCKED   — 硬阻挡：建筑区、障碍物 AABB（cost 表值 0 即不可通行）
 *   ZONE.SIDEWALK  — 人行道 / 公园小路 / plaza（可规划、可采样）
 *   ZONE.GRASS     — 公园草地（可规划、可采样，代价高）
 *   ZONE.ROAD      — 自行车道 + 机动车道：可通行（Motor._slideMove 不拒绝）、
 *                    可规划（有效代价由 profile 表决定）、不可采样、不可作目的地
 *   ZONE.CROSSWALK — 斑马线管：ROAD 带内的低代价穿越通道，可采样、可作目的地
 *
 * 烘焙来源（Z-2b 起全部由 scene.json 的 `zones` 配置驱动，本文件不含 Y 分带数字）：
 *   1. `zones.bands`     — Y 分带默认 zone（按数组顺序，首个 `wy < to` 命中）
 *   2. `zones.overlays`  — 附加带（如公园顶部入口带），非 BLOCKED 格改写
 *   3. `zones.paving`    — walkPaths 管道 + plaza 椭圆 → 铺装 zone
 *   4. `zones.crossings` — 斑马线管（仅覆盖 `over` 指定的 zone）
 *   5. 道具 AABB + NPC_HALF_W → BLOCKED（几何来自 entity.footprint，非配置）
 *
 * 边界值在配置里写**分带名字**（`"to": "FAR_Y"`），经 `Layout.resolveY` 解析，
 * 故数值仍只有 scene.json 的 `yBands` 一处。
 *
 * 单例：getNavGrid() / setNavGrid()
 */

import { WORLD_WIDTH, WORLD_HEIGHT, NEAR_Y, resolveY } from '../../core/Layout.js';
import { projectGroundRect } from '../../core/Projection.js';

export const CELL = 53; // O-1：世界单位重标，10 → 53（骨架单位，随 UNIT_REBASE_FACTOR）

/** zone 语义 ID — 格子「是什么」，不含代价含义。BLOCKED 取 0 以便真值判断。 */
export const ZONE = {
  BLOCKED:   0,
  SIDEWALK:  1,
  GRASS:     2,
  ROAD:      3,
  CROSSWALK: 4,
};

/**
 * zone → 有效规划代价 的默认表（Planning 层代价政策唯一住址，goal-pipeline-v1.md §3）。
 * 道路穿越是代价而非流程：ROAD 可规划，代价由此表 / profile.zoneCosts 决定。
 *   BLOCKED   0  — 代价 0 = 不可通行（A* skip）
 *   SIDEWALK  1  — 基准
 *   GRASS     8  — 可抄近路但不划算
 *   ROAD    250  — ≈9 格横穿 2250，任何合理绕行必胜 → 默认人格不横穿
 *                  （jaywalk 目标由 PlanService 覆盖为 3：直穿 ≈27，胜过绝大多数绕行）
 *   CROSSWALK 2  — 低于草 8、高于人行道 1：有斑马线必走斑马线，
 *                  且不把同侧路径全吸进管
 */
export const DEFAULT_ZONE_COSTS = {
  [ZONE.BLOCKED]:   0,
  [ZONE.SIDEWALK]:  1,
  [ZONE.GRASS]:     8,
  [ZONE.ROAD]:      250,
  [ZONE.CROSSWALK]: 2,
};

// COLS/ROWS 是 fallback：模块顶层求值早于 initLayout，此处用 fallback 世界尺寸兜底。
// NavGrid 构造时（晚于 initLayout）会按注入后的 WORLD_* 现算并覆写这两个 let，
// 让所有引用它们的方法跟随世界尺寸（世界可频繁重新生成，尺寸各异）。
let COLS = Math.ceil(WORLD_WIDTH  / CELL);
let ROWS = Math.ceil(WORLD_HEIGHT / CELL);
const NPC_HALF_W = 37;  // O-1：10 → 53 CELL 换算下的等比值，7 → 37。Minkowski expansion — NPC collision half-width added to every obstacle

/** zone 名 → ID；配置里写名字，拼错立刻抛错（不静默变 undefined） */
function _zoneId(name) {
  const id = ZONE[name];
  if (id == null) throw new Error(`NavGrid: unknown zone name '${name}' (合法值 ${Object.keys(ZONE).join('/')})`);
  return id;
}

function _need(v, what) {
  if (v == null) throw new Error(`NavGrid.bake: scene config 缺 ${what}`);
  return v;
}

let _instance = null;
export const getNavGrid = () => _instance;
export const setNavGrid = (g) => { _instance = g; };

/**
 * 调试用：BLOCKED 画 alpha 0.15，ROAD 画 alpha 0.05。
 * window.__navDebug=true 时由 StreetScene 调用。
 */
export function drawNavDebug(g) {
  if (!_instance) return;
  g.lineStyle(0);
  for (let gy = 0; gy < ROWS; gy++) {
    for (let gx = 0; gx < COLS; gx++) {
      const z = _instance._zone[gy * COLS + gx];
      // O-2：格子投影后是平行四边形，不再是 drawRect
      if (z === ZONE.BLOCKED) {
        g.beginFill(0x000000, 0.15);
        g.drawPolygon(projectGroundRect(gx * CELL, gy * CELL, (gx + 1) * CELL, (gy + 1) * CELL));
        g.endFill();
      } else if (z === ZONE.ROAD) {
        g.beginFill(0x000000, 0.05);
        g.drawPolygon(projectGroundRect(gx * CELL, gy * CELL, (gx + 1) * CELL, (gy + 1) * CELL));
        g.endFill();
      }
    }
  }
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
    // 按当前（注入后的）世界尺寸现算格数，覆写模块级 COLS/ROWS——NavGrid 在
    // initLayout 之后构造，故 WORLD_* 已是真值。这样所有引用模块级 COLS/ROWS 的
    // 方法（含独立函数 drawNavDebug）都跟随世界尺寸，解除顶层冻结的历史债。
    COLS = Math.ceil(WORLD_WIDTH  / CELL);
    ROWS = Math.ceil(WORLD_HEIGHT / CELL);
    this.COLS  = COLS;
    this.ROWS  = ROWS;
    this._zone = new Uint8Array(COLS * ROWS);
    this._baseZoneMap = new Uint8Array(COLS * ROWS);  // zone map without obstacles
  }

  /**
   * 全场烘焙（场景初始化时调用一次）。
   * @param entities 实体数组（obstacle 者烘为 BLOCKED）
   * @param layout   sceneData.layout（walkPaths / chessPlaza / miniPark / crosswalks 几何）
   * @param zones    sceneData.zones（分带 + 铺装 + 斑马线的 zone 配置；无它则抛错）
   */
  bake(entities, layout, zones) {
    this._bakeZones(layout, zones);
    this._bakeObstacles(entities, 0, COLS - 1, 0, ROWS - 1);
    this._assertSingleRegions();
  }

  /** 局部重烘焙（动态道具增删时，供后续使用） */
  localRebake(cx, cy, radius, entities) {
    const m = NPC_HALF_W + CELL;
    const gx0 = Math.max(0,        Math.floor((cx - radius - m) / CELL));
    const gx1 = Math.min(COLS - 1, Math.ceil ((cx + radius + m) / CELL));
    const gy0 = Math.max(0,        Math.floor((cy - radius - m) / CELL));
    const gy1 = Math.min(ROWS - 1, Math.ceil ((cy + radius + m) / CELL));
    // 还原区带基础 zone
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        this._zone[gy * COLS + gx] = this._baseZoneMap[gy * COLS + gx];
      }
    }
    this._bakeObstacles(entities, gx0, gx1, gy0, gy1);
  }

  /** 格 zone ID（ZONE.*）；代价查询由消费者经 zoneCosts 表完成 */
  zone(gx, gy) {
    console.assert(gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS, `NavGrid.zone out-of-range (${gx},${gy})`);
    return this._zone[gy * COLS + gx];
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

  /** BFS 找最近可走格（SIDEWALK / GRASS / CROSSWALK，不含 BLOCKED / ROAD），返回其中心世界坐标 */
  nearestWalkable(wx, wy, bounds = null) {
    const { gx: sx, gy: sy } = this.worldToCell(wx, wy);
    const z0 = this.zone(sx, sy);
    if (z0 !== ZONE.BLOCKED && z0 !== ZONE.ROAD) {
      if (!bounds) return { x: wx, y: wy };
      if (wx >= bounds.minX && wx <= bounds.maxX && wy >= bounds.minY && wy <= bounds.maxY)
        return { x: wx, y: wy };
    }

    const visited = new Uint8Array(COLS * ROWS);
    const queue   = [{ gx: sx, gy: sy }];
    visited[sy * COLS + sx] = 1;
    while (queue.length) {
      const { gx, gy } = queue.shift();
      const zv = this._zone[gy * COLS + gx];
      if (zv !== ZONE.BLOCKED && zv !== ZONE.ROAD) {
        const { x: cx, y: cy } = this.cellCenter(gx, gy);
        if (!bounds || (cx >= bounds.minX && cx <= bounds.maxX && cy >= bounds.minY && cy <= bounds.maxY))
          return { x: cx, y: cy };
      }
      for (let dy = -1; dy <= 1; dy++) {
        const ny = gy + dy;
        if (ny < 0 || ny >= ROWS) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = Math.max(0, Math.min(COLS - 1, gx + dx));
          const ni = ny * COLS + nx;
          if (visited[ni]) continue;
          visited[ni] = 1;
          queue.push({ gx: nx, gy: ny });
        }
      }
    }
    return { x: wx, y: wy };
  }

  /**
   * 从 NPC 附近采样一个可走点（偏好铺装格：SIDEWALK / CROSSWALK）。
   * 自动过滤掉会跨越马路的点（同侧约束）。
   */
  sampleWalkableNear(npc, radius = 350) {
    const cx = npc.x, cy = npc.y;
    const gxC = Math.floor(cx / CELL);
    const gyC = Math.floor(cy / CELL);
    const gr  = Math.ceil(radius / CELL);

    const isNearSide = cy >= NEAR_Y;  // park side vs far sidewalk side

    const poolPaved = [], poolGrass = [];
    for (let dy = -gr; dy <= gr; dy++) {
      for (let dx = -gr; dx <= gr; dx++) {
        if (dx * dx + dy * dy > gr * gr) continue;
        const gx = gxC + dx, gy = gyC + dy;
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) continue;
        const z  = this.zone(gx, gy);
        if (z === ZONE.BLOCKED || z === ZONE.ROAD) continue;
        const wx = (gx + 0.5) * CELL;
        const wy = (gy + 0.5) * CELL;
        if ((wy >= NEAR_Y) !== isNearSide) continue;  // 不跨侧
        if (npc.minX != null && (wx < npc.minX || wx > npc.maxX)) continue;
        if (npc.minY != null && (wy < npc.minY || wy > npc.maxY)) continue;
        if (z === ZONE.SIDEWALK || z === ZONE.CROSSWALK) poolPaved.push({ gx, gy });
        else if (z === ZONE.GRASS)                       poolGrass.push({ gx, gy });
      }
    }

    // 92% 从铺装格采样，8% 从草地采样（偶尔抄草坪）
    const pool = (Math.random() < 0.92 && poolPaved.length)
      ? poolPaved
      : (poolGrass.length ? poolGrass : poolPaved);
    if (!pool.length) {
      // Bounds-clamped fallback: snap center to bounds then find nearest walkable
      if (npc.minX != null) {
        const clampX = Math.max(npc.minX, Math.min(npc.maxX, cx));
        const clampY = Math.max(npc.minY, Math.min(npc.maxY, cy));
        const pt = this.nearestWalkable(clampX, clampY);
        if (pt) return pt;
      }
      return null;
    }
    const c = pool[Math.floor(Math.random() * pool.length)];
    return this.cellCenter(c.gx, c.gy);
  }

  // ─── 内部：zone 烘焙（全程配置驱动，本方法不含任何 Y 分带数字）─────────────
  _bakeZones(layout, zones) {
    _need(zones, 'zones');
    const bands = _need(zones.bands, 'zones.bands')
      .map(b => ({ zone: _zoneId(b.zone), to: resolveY(_need(b.to, `zones.bands[${b.name}].to`)) }));
    const fallbackZone = bands[bands.length - 1].zone;

    // 1. 分带默认：按数组顺序，首个 wy < to 命中；越过末带则沿用末带
    for (let gy = 0; gy < ROWS; gy++) {
      const wy = (gy + 0.5) * CELL;
      let def = fallbackZone;
      for (const b of bands) { if (wy < b.to) { def = b.zone; break; } }
      for (let gx = 0; gx < COLS; gx++) {
        this._zone[gy * COLS + gx] = def;
      }
    }

    // 2. 附加带（如公园顶部入口带）：非 BLOCKED 格改写
    //    注：行区间用 floor(y/CELL) 端点闭区间，非格中心判定——沿用 Z-2b 前的既有算法
    for (const ov of (zones.overlays ?? [])) {
      const z    = _zoneId(ov.zone);
      const from = resolveY(_need(ov.from, `zones.overlays[${ov.name}].from`));
      const gy0  = Math.floor(from / CELL);
      const gy1  = Math.min(ROWS - 1, Math.floor((from + _need(ov.height, `zones.overlays[${ov.name}].height`)) / CELL));
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = 0; gx < COLS; gx++) {
          const idx = gy * COLS + gx;
          if (this._zone[idx] !== ZONE.BLOCKED) this._zone[idx] = z;
        }
      }
    }

    // 3. 铺装：walkPaths 管道 + plaza 椭圆 → paving.zone
    const pv = zones.paving;
    if (pv) {
      const pavedZone = _zoneId(pv.zone);
      const tubeR     = _need(pv.pathTubeRadius, 'zones.paving.pathTubeRadius');

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

      const plazas = [];
      for (const p of (pv.plazas ?? [])) {
        const src = layout?.[_need(p.ref, 'zones.paving.plazas[].ref')];
        if (!src) continue;
        const [kx, ky] = p.shrink ?? [1, 1];
        plazas.push({ cx: src.cx, cy: src.cy, rx: src.rx * kx, ry: src.ry * ky });
      }

      // 铺装只在 paving.from 以下生效（公园区域）
      for (let gy = Math.floor(resolveY(_need(pv.from, 'zones.paving.from')) / CELL); gy < ROWS; gy++) {
        const wy = (gy + 0.5) * CELL;
        for (let gx = 0; gx < COLS; gx++) {
          if (this._zone[gy * COLS + gx] === ZONE.BLOCKED) continue;
          const wx = (gx + 0.5) * CELL;
          let paved = false;
          for (const [ax, ay, bx, by] of pathSegs) {
            if (_segDist(ax, ay, bx, by, wx, wy) <= tubeR) { paved = true; break; }
          }
          if (!paved) {
            for (const { cx, cy, rx, ry } of plazas) {
              const ex = (wx - cx) / rx, ey = (wy - cy) / ry;
              if (ex * ex + ey * ey <= 1) { paved = true; break; }
            }
          }
          if (paved) this._zone[gy * COLS + gx] = pavedZone;
        }
      }
    }

    // 4. 斑马线管：仅覆盖 crossings.over 指定的 zone（BLOCKED 等保持不变）
    const cr = zones.crossings;
    if (cr) {
      const z      = _zoneId(cr.zone);
      const overZ  = _zoneId(_need(cr.over, 'zones.crossings.over'));
      const halfW  = _need(cr.halfWidth, 'zones.crossings.halfWidth');
      const yFrom  = resolveY(_need(cr.from, 'zones.crossings.from'));
      const yTo    = resolveY(_need(cr.to,   'zones.crossings.to'));
      for (const { x: cwx } of (layout?.[_need(cr.ref, 'zones.crossings.ref')] ?? [])) {
        for (let gy = 0; gy < ROWS; gy++) {
          const wy = (gy + 0.5) * CELL;
          if (wy < yFrom || wy >= yTo) continue;
          for (let gx = 0; gx < COLS; gx++) {
            const wx = (gx + 0.5) * CELL;
            if (Math.abs(wx - cwx) > halfW) continue;
            const idx = gy * COLS + gx;
            if (this._zone[idx] === overZ) this._zone[idx] = z;
          }
        }
      }
    }

    // 保存区带基础 zone（不含障碍；含斑马线，供 localRebake 还原）
    this._baseZoneMap.set(this._zone);
  }

  // ─── 内部：障碍物 AABB + 边距 → BLOCKED ──────────────────────────────────
  _bakeObstacles(entities, gx0, gx1, gy0, gy1) {
    for (const e of entities) {
      if (!e.alive || !e.obstacle) continue;
      this._markObstacle(e, gx0, gx1, gy0, gy1);
    }
  }

  _markObstacle(e, gx0, gx1, gy0, gy1) {
    const rx = e.footprint.rx + NPC_HALF_W;
    const ry = e.footprint.ry + NPC_HALF_W;
    const cgx0 = Math.max(gx0, Math.floor((e.x - rx) / CELL));
    const cgx1 = Math.min(gx1, Math.ceil((e.x + rx) / CELL));
    const cgy0 = Math.max(gy0, Math.floor((e.y - ry) / CELL));
    const cgy1 = Math.min(gy1, Math.ceil((e.y + ry) / CELL));
    const ellipse = e.footprint.shape === 'ellipse';
    for (let gy = cgy0; gy <= cgy1; gy++) {
      const wy = (gy + 0.5) * CELL;
      for (let gx = cgx0; gx <= cgx1; gx++) {
        const wx = (gx + 0.5) * CELL;
        if (ellipse) {
          const ex = (wx - e.x) / rx, ey = (wy - e.y) / ry;
          if (ex * ex + ey * ey > 1) continue;
        } else {
          if (wx < e.x - rx || wx > e.x + rx || wy < e.y - ry || wy > e.y + ry) continue;
        }
        this._zone[gy * COLS + gx] = ZONE.BLOCKED;
      }
    }
  }
  /** 烘焙后断言：每侧驻留格（SIDEWALK / GRASS）应构成单一连通区域。 */
  _assertSingleRegions() {
    const visited = new Uint8Array(COLS * ROWS);
    const DIRS = [-1, 1, -COLS, COLS, -COLS - 1, -COLS + 1, COLS - 1, COLS + 1];
    const isRegion = (z) => z === ZONE.SIDEWALK || z === ZONE.GRASS;
    let farRegions = 0, nearRegions = 0;
    for (let i = 0; i < COLS * ROWS; i++) {
      if (!isRegion(this._zone[i]) || visited[i]) continue;
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
          if (!isRegion(this._zone[ni])) continue;
          visited[ni] = 1; stack.push(ni);
        }
      }
    }
    console.assert(farRegions  <= 1, `NavGrid: far side has ${farRegions} walkable regions (expected 1)`);
    console.assert(nearRegions <= 1, `NavGrid: near side has ${nearRegions} walkable regions (expected 1)`);
  }
}
