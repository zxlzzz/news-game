/**
 * CONTRACT  (see docs/contracts/movement.md)
 *   OWNS:      Per-frame velocity adjustment to avoid BLOCKED cells (cost===0).
 *   WRITES:    nothing on npc fields — returns adjusted {vx,vy} to caller.
 *              audit.count(npc, 'probe_steer') on redirect (MovementAudit).
 *   READS:     NavGrid singleton (getNavGrid); npc.x, npc.y (position only).
 *   MUST NOT:  write npc.x/y/speed/state/animation;
 *              treat ROAD cells (cost=250) as blocked — road crossing must stay passable.
 *
 * Lookahead — 前瞻探針
 *
 * applyLookahead(npc, vx, vy) → {vx, vy}
 *
 * 沿速度方向采 3 个探测点，距离 [1, 2, 4]×CELL，y 分量减半（压扁世界）。
 * blocked 判定：仅 cost === 0（ROAD=250 可通行，不干扰过马路）。
 * 只调整本帧速度输出，不改 _navPath / waypoint / roamTarget。
 */

import { CELL, getNavGrid } from './NavGrid.js';
import { audit } from '../../debug/MovementAudit.js';

/** 在世界坐标 (px, py) 处探测是否 BLOCKED (cost===0) */
function _blocked(grid, px, py) {
  const { gx, gy } = grid.worldToCell(px, py);
  return grid.cost(gx, gy) === 0;
}

/**
 * 应用前瞻探针，返回（可能调整后的）本帧速度向量。
 * @param {object} npc
 * @param {number} vx  速度 X（像素/s）
 * @param {number} vy  速度 Y（像素/s）
 * @param {object|null} params  来自 SAFETY_RULES.lookahead；null 则用内联默认值
 * @returns {{vx:number, vy:number}}
 */
export function applyLookahead(npc, vx, vy, params = null) {
  const p = params ?? { probeCells: 4, rotateDeg: 35, nearCells: 1, slowFactor: 0.4 };
  const grid = getNavGrid();
  if (!grid) return { vx, vy };

  const speed = Math.hypot(vx, vy);
  if (speed < 0.01) return { vx, vy };

  // 自身格已 blocked → 逃逸中，不干预
  const { gx: sgx, gy: sgy } = grid.worldToCell(npc.x, npc.y);
  if (grid.cost(sgx, sgy) === 0) return { vx, vy };

  // 归一化速度方向
  const ux = vx / speed;
  const uy = vy / speed;

  const angle    = p.rotateDeg * Math.PI / 180;
  const cos      = Math.cos(angle);
  const sin      = Math.sin(angle);
  const rotProbe = p.probeCells >> 1;

  // 探测点：y 分量减半（2.5D 世界压扁）
  const probe = (dist, dux, duy) => _blocked(grid,
    npc.x + dux * dist * CELL,
    npc.y + duy * 0.5 * dist * CELL,
  );

  // 远点 blocked → 尝试旋转 ±rotateDeg°，各在 rotProbe 格处探一次
  if (probe(p.probeCells, ux, uy)) {
    for (const sign of [1, -1]) {
      const rux = ux * cos - uy * sin * sign;
      const ruy = ux * sin * sign + uy * cos;
      if (!probe(rotProbe, rux, ruy)) {
        audit.count(npc, 'probe_steer');
        return { vx: rux * speed, vy: ruy * speed };
      }
    }
    // 两侧都堵：不转向，保持原方向（交给 _slideMove 处理）
  }

  // 近点 blocked → 本帧减速
  if (probe(p.nearCells, ux, uy)) {
    return { vx: vx * p.slowFactor, vy: vy * p.slowFactor };
  }

  return { vx, vy };
}
