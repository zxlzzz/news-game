/**
 * EnvironmentQuery — 空间查询工具
 *
 * 把 EntityManager 的实体列表包装成语义化查询接口，供行为层判断环境前置条件
 * （如附近有没有长椅、有没有空棋桌）。道具"被占用"用 prop._occupiedBy 标记
 * （Activity 开始时写入其 id，结束时清空），不在 PropEntity 上新增公开属性。
 */

import { BUILDING_BASE_Y } from '../SceneConfig.js';

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

  /** 是否靠近建筑墙面（站在街墙底边附近且落在某栋占地 X 范围内） */
  isNearWall(npc, threshold = 16) {
    if (Math.abs(npc.y - BUILDING_BASE_Y) > threshold) return false;
    for (const e of this.em.entities) {
      if (e.bWidth === undefined) continue;
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
