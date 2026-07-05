/**
 * seat — 可坐道具行为模块（bench / chair 共用）
 *
 * 独占写入权：_occupiedBy、_bench、_sortY 由本模块负责写入。
 * Activity.js 的 occupy/release 方法负责道具侧的 _occupiedBy 写入，
 * 两者互不干涉：seat.js 管理 NPC 侧（sit/stand），Activity.js 管理活动侧。
 *
 * 可坐道具通过 tags 数组包含 'seatable' 来声明，而非 propType 判断。
 *
 * 注：与 Motor.js 存在循环依赖（Motor 导入 standUp；seat 导入 setXY）。
 * ES module live bindings 在运行时（非初始化期）正确解析，无需特殊处理。
 */

// Circular import with Motor.js — Motor imports standUp; we need setXY for NPC position writes.
// ES module live bindings resolve at runtime; both values are only used after all modules load.
import { setXY as _motorSetXY } from '../../behavior/Motor.js';

/** 长椅内禀尺寸（未缩放，世界单位） */
export const INTRINSIC = { width: 300, height: 80, seatH: 40, legH: 23, seatT: 17, backH: 40 };

/** 座面距 prop.y 的默认偏移（像素），与 drawBench 座板锚点一致 */
const BENCH_SEAT_H = 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function _setXY(npc, x, y) {
  if (typeof _motorSetXY === 'function') { _motorSetXY(npc, x, y); } else { npc.x = x; npc.y = y; }
}

/** 座面世界 Y（NPC 臀部应落于此） */
export function seatSurfaceY(bench) {
  return bench.y - (bench.seatH ?? BENCH_SEAT_H);
}

/** 在 entities 中寻找距 npc 最近的空闲可坐道具（跳过 busstop tag）；无则 null */
export function findFree(entities, npc, radius = 80) {
  let best = null, bestD = radius;
  for (const e of entities) {
    if (!e.tags?.includes('seatable') || e._occupiedBy != null) continue;
    if (e.tags?.includes('busstop')) continue;
    const d = Math.hypot(e.x - npc.x, e.y - npc.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

/** 附近是否有可坐道具（|dx| < dxT && |dy| < dyT） */
export function isNear(entities, npc, dxT = 60, dyT = 80) {
  for (const e of entities) {
    if (e.tags?.includes('seatable') &&
        Math.abs(e.x - npc.x) < dxT && Math.abs(e.y - npc.y) < dyT) return true;
  }
  return false;
}

/** 将 NPC 对齐到座位落座：占位 + x/y 对齐 + 按 facing 设图层 */
export function sitDown(npc, bench) {
  bench._occupiedBy = npc.id;
  npc._bench = bench;
  _setXY(npc, clamp(bench.x, npc.minX, npc.maxX), clamp(seatSurfaceY(bench), npc.minY, npc.maxY));
  const far = bench.facing === 'up' || bench.facing === 'left';
  npc._sortY = far ? bench.y - 1 : bench.y + 1;
}

/** 释放座位占位，清 _bench 和 _sortY */
export function standUp(npc) {
  if (!npc._bench) return;
  npc._bench._occupiedBy = null;
  npc._bench = null;
  npc._sortY = undefined;
}

/**
 * sit_bench → lie_bench 转换时重对齐。
 * lie_bench anchorMode='back'（无竖向偏移），需要重算 npc.x / npc.y。
 */
export function alignLie(npc, renderer) {
  if (!npc._bench) return;
  let bodyX = -46, bodyY = 79;
  if (renderer) {
    const anim = renderer.getAnimation('lie_bench');
    if (anim && anim.frames[0]) {
      bodyX = anim.frames[0].body[0];
      bodyY = anim.frames[0].body[1];
    }
  }
  const sc = npc.scale || 0.45;
  const seatY = seatSurfaceY(npc._bench);
  const canonDir = renderer?.getAnimation('lie_bench')?.canonicalDirection || 1;
  const dir = npc.direction * canonDir;
  _setXY(npc,
    clamp(npc._bench.x - Math.round(bodyX * sc * dir), npc.minX, npc.maxX),
    clamp(seatY - Math.round(bodyY * sc), npc.minY, npc.maxY),
  );
  npc._sortY = npc._bench.y + 1;
}
