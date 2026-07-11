/**
 * Lookahead — 前瞻探针
 *
 * applyLookahead(npc, vx, vy) → {vx, vy}
 *
 * 沿速度方向采 3 个探测点，距离 [1, 2, 4]×CELL，y 分量减半（压扁世界）。
 * blocked 判定：仅 cost === 0（ROAD=250 可通行，不干扰过马路）。
 * 只调整本帧速度输出，不改 _navPath / waypoint / roamTarget。
 */

import { CELL, getNavGrid } from './NavGrid.js';
import { audit } from '../../debug/MovementAudit.js';

const ANGLE_35 = 35 * Math.PI / 180;
const COS35 = Math.cos(ANGLE_35);
const SIN35 = Math.sin(ANGLE_35);

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
 * @returns {{vx:number, vy:number}}
 */
export function applyLookahead(npc, vx, vy) {
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

  // 探测点：y 分量减半（2.5D 世界压扁）
  const probe = (dist, dux, duy) => _blocked(grid,
    npc.x + dux * dist * CELL,
    npc.y + duy * 0.5 * dist * CELL,
  );

  // 远点（4 格）blocked → 尝试旋转 ±35°，各在 2 格处探一次
  if (probe(4, ux, uy)) {
    for (const sign of [1, -1]) {
      const rux = ux * COS35 - uy * SIN35 * sign;
      const ruy = ux * SIN35 * sign + uy * COS35;
      if (!probe(2, rux, ruy)) {
        audit.count(npc, 'probe_steer');
        return { vx: rux * speed, vy: ruy * speed };
      }
    }
    // 两侧都堵：不转向，保持原方向（交给 _slideMove 处理）
  }

  // 近点（1 格）blocked → 本帧减速 ×0.4
  if (probe(1, ux, uy)) {
    return { vx: vx * 0.4, vy: vy * 0.4 };
  }

  return { vx, vy };
}
