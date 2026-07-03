/**
 * vending — 自动贩卖机行为模块
 *
 * 独占写入权：无（贩卖机用 smartDef/_slots 机制，占用状态由 Activity 写入 _occupiedBy）。
 * 本模块只提供内禀尺寸常量和空间查询帮助函数，供 EnvironmentQuery 委托调用。
 *
 * 贩卖机通过 tags 数组包含 'vending' 来声明，propType === 'vending'。
 */

import { depthScale } from '../../core/Layout.js';

/** 贩卖机内禀尺寸（未缩放，世界单位） */
export const INTRINSIC = { width: 80, height: 158 };

/** 落地接触面半宽/半深（世界像素，已乘深度缩放） */
export function footprint(e) {
  return { rx: 40 * depthScale(e.y), ry: 12 };
}

/** 找最近的空闲贩卖机（_occupiedBy == null 且有空闲 user 槽）；无则 null */
export function findFree(entities, npc, radius = 150) {
  let best = null, bestD = radius;
  for (const e of entities) {
    if (!e.alive || e.propType !== 'vending') continue;
    if (e._occupiedBy) continue;
    if (e._slots && !e._slots.some(s => s.reserved == null)) continue;
    const d = Math.hypot(e.x - npc.x, e.y - npc.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

/** 附近是否有贩卖机（|dx| < dxT && |dy| < dyT） */
export function isNear(entities, npc, dxT = 60, dyT = 80) {
  for (const e of entities) {
    if (e.propType === 'vending' &&
        Math.abs(e.x - npc.x) < dxT && Math.abs(e.y - npc.y) < dyT) return true;
  }
  return false;
}
