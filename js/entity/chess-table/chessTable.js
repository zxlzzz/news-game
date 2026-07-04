/**
 * chess-table — 棋桌行为模块
 *
 * 独占写入权：_slots 的 reserved/ready/npc 字段由 SocialLayer / spawnChess 负责写入。
 * 本模块提供内禀尺寸常量、布局计算（gap / 槽位偏移）以及空间查询帮助函数，
 * 供 Chess.js 和 EnvironmentQuery 委托调用。
 *
 * 棋桌通过 propType === 'chess-table' 和 smartDef.activityType === 'chess' 来识别。
 */

import { depthScale } from '../../core/Layout.js';

/** 棋桌内禀尺寸（未缩放，世界单位） */
export const INTRINSIC = { tw: 58, topH: 25, th: 20 };

/** 落地接触面半宽/半深（世界像素，已乘深度缩放） */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { rx: 29 * ds, ry: Math.max(3, 10 * ds) };
}

/**
 * 计算参考缩放下的玩家间距（gap）。
 * 基准：scale=0.26 时 gap=68px；任意 scale 线性缩放。
 */
export const gapAt = (scale) => Math.round(68 * scale / 0.26);

/**
 * 根据缩放生成 smartDef.slots 数组（player_a / player_b / onlooker × 2）。
 * Chess.js 用此替代魔法数字硬编码。
 */
export function makeSlots(scale) {
  const gap = gapAt(scale);
  return [
    { role: 'player_a', dx: -(gap / 2),    dy: 0  },
    { role: 'player_b', dx:  (gap / 2),    dy: 0  },
    { role: 'onlooker', dx: -(gap * 0.3), dy: -18 },
    { role: 'onlooker', dx:  (gap * 0.3), dy: -18 },
  ];
}

/** 找最近的有空闲玩家槽且未被占用的棋桌；无则 null */
export function findFree(entities, npc, radius = 200) {
  let best = null, bestD = radius;
  for (const e of entities) {
    if (!e.alive || e.propType !== 'chess-table') continue;
    if (e._occupiedBy) continue;
    if (!e._slots?.some(s => s.reserved == null &&
        (s.role === 'player_a' || s.role === 'player_b'))) continue;
    const d = Math.hypot(e.x - npc.x, e.y - npc.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

/** 附近是否有棋桌（|dx| < dxT && |dy| < dyT） */
export function isNear(entities, npc, dxT = 80, dyT = 80) {
  for (const e of entities) {
    if (e.propType === 'chess-table' &&
        Math.abs(e.x - npc.x) < dxT && Math.abs(e.y - npc.y) < dyT) return true;
  }
  return false;
}