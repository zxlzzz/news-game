/**
 * EnvironmentQuery — 空间查询工具
 *
 * 把 EntityManager 的实体列表包装成语义化查询接口，供行为层判断环境前置条件
 * （如附近有没有长椅、有没有空棋桌）。道具"被占用"用 prop._occupiedBy 标记
 * （Activity 开始时写入其 id，结束时清空），不在 PropEntity 上新增公开属性。
 */

import { SIDEWALK_FAR_Y, FAR_Y, NEAR_Y } from '../core/Layout.js';
import { getNavGrid, CELL, ROAD } from './nav/NavGrid.js';

function _sameSide(y1, y2) {
  const side = y => y < FAR_Y ? 'far' : y >= NEAR_Y ? 'near' : 'road';
  return side(y1) === side(y2);
}
import { findFree as _findFreeBench,   isNear as _isNearBench   } from '../entity/seat/seat.js';
import { findFree as _findFreeVending, isNear as _isNearVending  } from '../entity/vending/vending.js';
import { findFree as _findFreeChess,   isNear as _isNearChess    } from '../entity/chess-table/chessTable.js';

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

  /**
   * 最近的空闲墙面靠点（建筑边缘左侧或右侧）。
   * 每栋楼有 2 个靠点（左边缘 / 右边缘），各容纳 1 人。
   * 返回 { building, side:'left'|'right', x, facing } 或 null。
   */
  nearestFreeWallSpot(npc, radius = 60) {
    if (npc.y > NEAR_Y) return null;
    let best = null, bestD = radius;
    for (const e of this.em.entities) {
      if (e.bWidth === undefined) continue;
      if (!e._leanLeft) {
        const d = Math.abs(npc.x - e.x);
        if (d < bestD) { bestD = d; best = { building: e, side: 'left', x: e.x, facing: -1 }; }
      }
      if (!e._leanRight) {
        const d = Math.abs(npc.x - (e.x + e.bWidth));
        if (d < bestD) { bestD = d; best = { building: e, side: 'right', x: e.x + e.bWidth, facing: 1 }; }
      }
    }
    return best;
  }

  /** 释放某 NPC 占用的墙面靠点 */
  releaseWallSpot(npc) {
    for (const e of this.em.entities) {
      if (e.bWidth === undefined) continue;
      if (e._leanLeft  === npc.id) e._leanLeft  = null;
      if (e._leanRight === npc.id) e._leanRight = null;
    }
  }

  /** 附近是否有长椅（复刻重构前 _nearBench：|dx|<60, |dy|<80） */
  isNearBench(npc, dxT = 60, dyT = 80) {
    return _isNearBench(this.em.entities, npc, dxT, dyT);
  }

  /** 附近最近的空闲长椅（bench._occupiedBy == null）；无则 null */
  nearestFreeBench(npc, radius = 80) {
    return _findFreeBench(this.em.entities, npc, radius);
  }

  /** 附近是否有贩卖机（|dx| < dxT && |dy| < dyT） */
  isNearVending(npc, dxT = 60, dyT = 80) {
    return _isNearVending(this.em.entities, npc, dxT, dyT);
  }

  /** 附近最近的空闲贩卖机；无则 null */
  nearestFreeVending(npc, radius = 150) {
    return _findFreeVending(this.em.entities, npc, radius);
  }

  /** 附近是否有棋桌（|dx| < dxT && |dy| < dyT） */
  isNearChessTable(npc, dxT = 80, dyT = 80) {
    return _isNearChess(this.em.entities, npc, dxT, dyT);
  }

  /** 附近最近的有空闲玩家槽的棋桌；无则 null */
  nearestFreeChessTable(npc, radius = 200) {
    return _findFreeChess(this.em.entities, npc, radius);
  }

  // ─── 障碍物查询（NavGrid 单一真值源）──────────────────────────────────────
  /** 点 (x,y) 是否为不可选目标（BLOCKED 或 ROAD）；是则返回真值，否则 null */
  pointBlocked(x, y, _npcRadius = 12) {
    const grid = getNavGrid();
    if (!grid) return null;
    const { gx, gy } = grid.worldToCell(x, y);
    const c = grid.cost(gx, gy);
    return (c === 0 || c === ROAD) ? { x, y } : null;
  }

  /**
   * 线段 (x,y)→(tx,ty) 沿途是否经过不可选格（BLOCKED）；有则返回首个碰撞点，否则 null。
   * 检查线两侧 npcRadius 范围内的所有格子，防止 NPC 擦边卡住。
   */
  raycastObstacle(x, y, tx, ty, npcRadius = 10) {
    const grid = getNavGrid();
    if (!grid) return null;
    const dx = tx - x, dy = ty - y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    // Perpendicular unit vector
    const px = -dy / len, py = dx / len;
    const steps = Math.ceil(len / (CELL * 0.5));
    for (let i = 1; i <= steps; i++) {
      const t  = i / steps;
      const cx = x + dx * t, cy = y + dy * t;
      // Check center + two perpendicular offsets at ±npcRadius
      for (const off of [0, npcRadius, -npcRadius]) {
        const wx = cx + px * off, wy = cy + py * off;
        const { gx, gy } = grid.worldToCell(wx, wy);
        const c = grid.cost(gx, gy);
        if (c === 0) return { x: cx, y: cy };
      }
    }
    return null;
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

  /**
   * 在 radius 内找一个有空闲槽位的 Smart Object（按 activityType 过滤）。
   * 空闲 = 至少有一个 slot.reserved == null（且匹配 opts.role，若指定）。
   *
   * @param {object} [opts]
   * @param {string} [opts.role]            - 仅匹配该 role 的槽位（如 'buyer' / 'onlooker'）
   * @param {boolean} [opts.requireOccupied] - true：仅匹配已有 Activity 进行中的道具
   *   （供后来者加入，如摊位顾客 / 棋局旁观者）；false（默认）：仅匹配尚未占用的道具
   *   （供首批参与者，如自动贩卖机 / 棋手）。
   * @returns {{prop, slot}|null} 距离最近的道具及其首个匹配空闲槽位
   */
  findAvailableSlot(activityType, npc, radius = 200, opts = {}) {
    const { role = null, requireOccupied = false } = opts;
    let best = null, bestD = radius;
    for (const e of this.em.entities) {
      if (!e.alive || e.smartDef?.activityType !== activityType || !e._slots) continue;
      if (requireOccupied ? !e._occupiedBy : !!e._occupiedBy) continue;
      if (!_sameSide(npc.y, e.y)) continue;
      const free = e._slots.find(s => s.reserved == null && (role == null || s.role === role));
      if (!free) continue;
      const d = Math.hypot(e.x - npc.x, e.y - npc.y);
      if (d <= bestD) { bestD = d; best = { prop: e, slot: free }; }
    }
    return best;
  }

  /** 释放某 NPC 持有的所有槽位预约（NPC 途中放弃或超时时调用） */
  releaseSlotReservation(npc) {
    for (const e of this.em.entities) {
      if (!e._slots) continue;
      for (const s of e._slots) {
        if (s.reserved === npc.id) s.reserved = null;
      }
    }
  }
}