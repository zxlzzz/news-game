/**
 * EnvironmentQuery — 空间查询工具
 *
 * 把 EntityManager 的实体列表包装成语义化查询接口，供行为层判断环境前置条件
 * （如附近有没有长椅、有没有空棋桌）。道具"被占用"用 prop._occupiedBy 标记
 * （Activity 开始时写入其 id，结束时清空），不在 PropEntity 上新增公开属性。
 */

import { SIDEWALK_FAR_Y, NEAR_Y } from '../SceneConfig.js';

export class EnvironmentQuery {
  /** @param {EntityManager} entityManager */
  constructor(entityManager) {
    this.em = entityManager;
  }

  /** 半径内最近的指定 propType 道具；无则返回 null */
  nearestProp(npc, propType, radius) {
    let best = null;
    let bestD = radius;
    for (const e of this.em.entities) {
      if (!e.alive || e.propType !== propType) continue;
      const d = Math.hypot(e.x - npc.x, e.y - npc.y);
      if (d <= bestD) { bestD = d; best = e; }
    }
    return best;
  }

  /** 半径内的其他 NPC 列表 */
  nearbyNPCs(npc, radius) {
    const out = [];
    for (const e of this.em.entities) {
      if (e === npc || !e.alive || !e.renderer) continue;   // renderer 标识 NPC
      if (Math.hypot(e.x - npc.x, e.y - npc.y) <= radius) out.push(e);
    }
    return out;
  }

  /**
   * 是否靠近建筑墙面（仅前人行道带）。
   * 公园区域（Y > NEAR_Y）的 NPC 永远 false → 方案 B 自然过滤公园行人的 lean_wall。
   */
  isNearWall(npc, threshold = 30) {
    if (npc.y > NEAR_Y) return false;                          // 公园：远离建筑
    if (Math.abs(npc.y - SIDEWALK_FAR_Y) > threshold) return false;
    for (const e of this.em.entities) {
      if (e.bWidth === undefined) continue;                    // 仅 BuildingEntity 有 bWidth
      if (npc.x >= e.x - threshold && npc.x <= e.x + e.bWidth + threshold) return true;
    }
    return false;
  }

  /** 附近是否有长椅（复刻重构前 _nearBench：|dx|<60, |dy|<80） */
  isNearBench(npc, dxT = 60, dyT = 80) {
    for (const e of this.em.entities) {
      if (e.propType === 'bench' &&
          Math.abs(e.x - npc.x) < dxT && Math.abs(e.y - npc.y) < dyT) return true;
    }
    return false;
  }

  /** 附近最近的空闲长椅（bench._occupiedBy == null）；无则 null */
  nearestFreeBench(npc, radius = 80) {
    let best = null, bestD = radius;
    for (const e of this.em.entities) {
      if (e.propType !== 'bench' || e._occupiedBy != null) continue;
      const d = Math.hypot(e.x - npc.x, e.y - npc.y);
      if (d <= bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ─── 障碍物查询（批次 0 避障）──────────────────────────────────────────────
  // 障碍是静态道具，构建一次缓存后复用（按 X 升序分桶，桶宽 200px）。
  _ensureObstacles() {
    if (this._buckets) return;
    const list = this.em.entities.filter(e => e.obstacle);
    this._buckets = new Map();
    for (const o of list) {
      const b = Math.floor(o.x / 200);
      if (!this._buckets.has(b)) this._buckets.set(b, []);
      this._buckets.get(b).push(o);
    }
  }

  _candidatesNear(cx, span) {
    this._ensureObstacles();
    const out = [];
    const b0 = Math.floor((cx - span) / 200);
    const b1 = Math.floor((cx + span) / 200);
    for (let b = b0; b <= b1; b++) {
      const arr = this._buckets.get(b);
      if (arr) for (const o of arr) out.push(o);
    }
    return out;
  }

  /** center 附近 radius 内的障碍物列表（含各自 collisionRadius） */
  getObstacles(centerX, centerY, radius) {
    const out = [];
    for (const o of this._candidatesNear(centerX, radius + 100)) {
      if (!o.alive) continue;
      if (Math.hypot(o.x - centerX, o.y - centerY) <= radius + o.collisionRadius) out.push(o);
    }
    return out;
  }

  /** 点 (x,y) 是否落在某障碍碰撞体内（含 npc 半径）；命中返回该障碍，否则 null */
  pointBlocked(x, y, npcRadius = 12) {
    for (const o of this._candidatesNear(x, 120)) {
      if (!o.alive) continue;
      if (Math.hypot(o.x - x, o.y - y) < o.collisionRadius + npcRadius) return o;
    }
    return null;
  }

  /** 线段 (x,y)→(tx,ty) 上第一个阻挡的障碍（按距起点最近）；无则 null */
  raycastObstacle(x, y, tx, ty, npcRadius = 12) {
    const dx = tx - x, dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    let best = null, bestT = Infinity;
    for (const o of this._candidatesNear((x + tx) / 2, len / 2 + 120)) {
      if (!o.alive) continue;
      const t = (o.x - x) * ux + (o.y - y) * uy;      // 投影到线段
      if (t < 0 || t > len) continue;
      const px = x + ux * t, py = y + uy * t;
      const dist = Math.hypot(o.x - px, o.y - py);
      if (dist < o.collisionRadius + npcRadius && t < bestT) { best = o; bestT = t; }
    }
    return best;
  }

  /** 在 center 半径内找一个无人占用的指定 propType 道具（如空棋桌）；无则 null */
  findVacantProp(propType, radius, center) {
    let best = null;
    let bestD = radius;
    for (const e of this.em.entities) {
      if (!e.alive || e.propType !== propType || e._occupiedBy) continue;
      const d = Math.hypot(e.x - center.x, e.y - center.y);
      if (d <= bestD) { bestD = d; best = e; }
    }
    return best;
  }
}
