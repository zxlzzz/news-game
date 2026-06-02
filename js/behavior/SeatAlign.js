/**
 * SeatAlign — 落座/坐姿对齐的统一代码路径
 *
 * 公园长椅、公交站长椅（以及后续其他可坐道具）共用同一套对齐逻辑：
 *   - 竖直：sit_bench 动画 anchorMode='hip'，npc.y 即 body/hip 关节世界 Y，
 *     令其落在座面 seatSurfaceY = bench.y - seatH，臀部紧贴座面。
 *   - 图层：按长椅 facing 决定前后遮挡。
 *     facing 'down'/'right'（近侧，座面朝镜头）→ 人在长椅上方（_sortY = bench.y+1），挡住椅腿；
 *     facing 'up'/'left'（远侧）            → 长椅在人上方（_sortY = bench.y-1），椅子遮人。
 */

import { BIKE_LANE_FAR_TOP, NEAR_Y } from '../SceneConfig.js';

/**
 * 长椅座面默认高度（座面距底边）。
 * 与 PropDrawer.drawBench 的座板偏移一致：座板顶面绘制在 y-12，故臀部锚点亦取 y-12。
 */
export const BENCH_SEAT_H = 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 座面世界 Y（人臀部应落于此） */
export function seatSurfaceY(bench) {
  return bench.y - (bench.seatH ?? BENCH_SEAT_H);
}

/**
 * 将 NPC 对齐到长椅落座：占位 + x/y 对齐 + 按 facing 设图层。
 * 调用前需确认 bench 非空。
 */
export function alignSitBench(npc, bench) {
  bench._occupiedBy = npc.id;
  npc._bench = bench;
  npc.x = clamp(bench.x, npc.minX, npc.maxX);
  npc.y = clamp(seatSurfaceY(bench), npc.minY, npc.maxY);
  // facing 决定前后：近侧人在上、远侧椅在上
  const far = bench.facing === 'up' || bench.facing === 'left';
  npc._sortY = far ? bench.y - 1 : bench.y + 1;
}

/**
 * 公交站长椅座面 Y（与 SceneRenderer 的站台绘制保持一致）。
 * 远站（direction>0，屏幕上方）：roofT = BIKE_LANE_FAR_TOP-30；benchY = roofT+roofH+15。
 * 近站（direction<0，屏幕下方）：benchY = NEAR_Y+32。
 */
export function busStopBenchY(stop) {
  if (stop.direction > 0) return (BIKE_LANE_FAR_TOP - 30) + stop.roofH + 15;
  return NEAR_Y + 32;
}
