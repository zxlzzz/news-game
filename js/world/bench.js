/**
 * Bench — 长椅交互逻辑
 *
 * 集中管理长椅的所有行为：查找空椅、落座对齐、占位释放、座面高度。
 * 状态机只需调用这些函数，不需要知道对齐的细节。
 *
 * 所有权规则：
 *   - bench._occupiedBy：本模块独占写入
 *   - npc._bench：本模块独占写入
 *   - npc._sortY：本模块在落座时写入，离座时清除
 */

/** 座面距底边的默认高度（与 drawBench 的座板偏移一致） */
export const BENCH_SEAT_H = 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** 座面世界 Y（NPC 臀部应落于此） */
export function seatSurfaceY(bench) {
  return bench.y - (bench.seatH ?? BENCH_SEAT_H);
}

/**
 * 在半径内找最近的空闲长椅。
 * 跳过公交站长椅（tag 含 'busstop'），那些由 WaitForBusLayer 管理。
 * @returns {PropEntity|null}
 */
export function findFreeBench(entities, npc, radius = 80) {
  let best = null, bestD = radius;
  for (const e of entities) {
    if (e.propType !== 'bench' || e._occupiedBy != null) continue;
    if (e.tags?.includes('busstop')) continue;
    const d = Math.hypot(e.x - npc.x, e.y - npc.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * NPC 附近是否有长椅（用于状态转换前置判断）。
 */
export function isNearBench(entities, npc, dxT = 60, dyT = 80) {
  for (const e of entities) {
    if (e.propType === 'bench' &&
        Math.abs(e.x - npc.x) < dxT && Math.abs(e.y - npc.y) < dyT) return true;
  }
  return false;
}

/**
 * 将 NPC 对齐到长椅：占位 + x/y 对齐 + 按 facing 设遮挡层。
 * 调用前需确认 bench 非空。
 */
export function sitDown(npc, bench) {
  bench._occupiedBy = npc.id;
  npc._bench = bench;
  npc.x = clamp(bench.x, npc.minX, npc.maxX);
  npc.y = clamp(seatSurfaceY(bench), npc.minY, npc.maxY);
  const far = bench.facing === 'up' || bench.facing === 'left';
  npc._sortY = far ? bench.y - 1 : bench.y + 1;
}

/**
 * NPC 离开长椅：释放占位 + 清除引用。
 * sit_bench → lie_bench 时不调用此函数（共享 _bench）。
 */
export function standUp(npc) {
  if (npc._bench) {
    npc._bench._occupiedBy = null;
    npc._bench = null;
    npc._sortY = undefined;
  }
}

/**
 * sit_bench → lie_bench 转换时的重新对齐。
 * lie_bench 的 anchorMode='back'，需要根据动画帧数据调整 npc.y/x。
 */
export function alignLieBench(npc, renderer) {
  if (!npc._bench) return;
  let bodyX = -46, bodyY = 79;
  if (renderer) {
    const anim = renderer.getAnimation('lie_bench');
    if (anim?.frames[0]) {
      bodyX = anim.frames[0].body[0];
      bodyY = anim.frames[0].body[1];
    }
  }
  const sc = npc.scale || 0.45;
  const seatY = seatSurfaceY(npc._bench);
  npc.y = clamp(seatY - Math.round(bodyY * sc), npc.minY, npc.maxY);
  const canonDir = renderer?.getAnimation('lie_bench')?.canonicalDirection || 1;
  const dir = npc.direction * canonDir;
  npc.x = clamp(npc._bench.x - Math.round(bodyX * sc * dir), npc.minX, npc.maxX);
  npc._sortY = npc._bench.y + 1;
}