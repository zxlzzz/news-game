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

  /** 附近最近的空闲长椅（未被其他 NPC sit_bench / lie_bench 占用）；无则 null */
  nearestFreeBench(npc, radius = 80) {
    let best = null, bestD = radius;
    for (const e of this.em.entities) {
      if (e.propType !== 'bench') continue;
      const occupied = this.em.entities.some(o =>
        o !== npc && o.renderer && (o.state === 'sit_bench' || o.state === 'lie_bench') &&
        Math.abs(o.x - e.x) < 20 && Math.abs(o.y - e.y) < 30);
      if (occupied) continue;
      const d = Math.hypot(e.x - npc.x, e.y - npc.y);
      if (d <= bestD) { bestD = d; best = e; }
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
