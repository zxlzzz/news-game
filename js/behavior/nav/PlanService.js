/**
 * PlanService — Intent 层 → Planning 层胶水（goal-pipeline-v1.md N-2b）
 *
 * CONTRACT
 *   OWNS:      mot.goal lifecycle；mot.path 唯一写入点。
 *   WRITES:    mot.goal, mot.path, mot.needReplan（均在 npc.mem('motor')）。
 *   READS:     NavGrid via PathPlanner；npc.mem('agenda').profile（jaywalkChance, zoneCosts）。
 *   MUST NOT:  write npc.x/y/state/speed/animation；call setState；
 *              read npc.mem('social')；import from BaseStateMachine.
 *
 * 代价表装配（Z-1 zone-profile split）：唯一住址
 *   DEFAULT_ZONE_COSTS  →  profile.zoneCosts 覆盖  →  jaywalk 目标覆盖 ROAD。
 */

import { getPlanner } from './PathPlanner.js';
import { CELL, ZONE, DEFAULT_ZONE_COSTS } from './NavGrid.js';
import { WORLD_WIDTH } from '../../core/Layout.js';

const JAYWALK_ROAD_COST = 3;  // jaywalk 目标的 ROAD 覆盖代价（直穿 ≈27，胜过绝大多数绕行）

/** 装配本次规划的 zone→cost 表：默认表 → profile 覆盖 → jaywalk 覆盖 */
function _zoneCostsFor(npc, jaywalk) {
  const costs = { ...DEFAULT_ZONE_COSTS, ...(npc.mem('agenda').profile?.zoneCosts ?? {}) };
  if (jaywalk) costs[ZONE.ROAD] = JAYWALK_ROAD_COST;
  return costs;
}

/**
 * 发布目标（Intent 层调用）。
 * 滚动一次 jaywalk 决定并封进 meta，后续重规划复用相同结果。
 * @param {object}             npc
 * @param {{x:number,y:number}} dest     目标世界坐标
 * @param {number|null}        timeout  最长秒数（null = 无限）
 * @param {(result:string)=>void} onDone  result ∈ {'arrived','timeout','blocked'}
 * @param {{wantCross?:boolean}} opts
 */
export function publishGoal(npc, dest, timeout, onDone, opts) {
  const mot     = npc.mem('motor');
  const jaywalk = opts?.wantCross === true
    && Math.random() < (npc.mem('agenda').profile?.jaywalkChance ?? 0.1);
  mot.goal = {
    dest,
    timeout:  timeout ?? null,
    onDone,
    meta: {
      jaywalk,
      arrivalRule: opts?.arrivalRule ?? undefined,
      offWorld:    opts?.offWorld    ?? false,
    },
    elapsed: 0,
  };
  mot.path       = null;
  mot.needReplan = undefined;
}

/**
 * 确保 mot.path 与当前 mot.goal 同步（BehaviorManager 在 tickBaseState 之前调用）。
 * needReplan=true（由 Motor 两击卡死机制写入）时强制重规划。
 */
export function ensurePath(npc) {
  const mot  = npc.mem('motor');
  const goal = mot.goal;
  if (!goal) return;
  if (mot.path && !mot.needReplan) return;
  mot.needReplan = undefined;

  const planner = getPlanner();
  if (!planner) { _fireBlocked(mot, goal); return; }

  const bounds   = npc.minX != null
    ? { minX: npc.minX, maxX: npc.maxX, minY: npc.minY, maxY: npc.maxY }
    : null;
  const zoneCosts = _zoneCostsFor(npc, goal.meta.jaywalk);

  // offWorld: clamp planning dest to grid boundary; append real exit as final path point
  const planDest = goal.meta.offWorld
    ? { x: Math.max(CELL / 2, Math.min(WORLD_WIDTH - CELL / 2, goal.dest.x)), y: goal.dest.y }
    : goal.dest;
  const pts      = planner.plan(npc.x, npc.y, planDest.x, planDest.y, bounds, zoneCosts);

  if (!pts || pts.length === 0) { _fireBlocked(mot, goal); return; }
  if (goal.meta.offWorld) pts.push({ x: goal.dest.x, y: goal.dest.y });
  mot.path = { pts, idx: 0 };
}

/**
 * 确保 mot.path 与当前 roamTarget 同步（steerRoam 内部，wander NPC）。
 * goalX/goalY 作为稳定键；roamTarget 变化时自动重规划。
 */
export function ensureWanderPath(npc, roamTarget) {
  const mot = npc.mem('motor');
  if (mot.path && mot.path.goalX === roamTarget.x && mot.path.goalY === roamTarget.y) return;

  const planner = getPlanner();
  if (!planner) { mot.path = null; return; }

  const bounds = npc.minX != null
    ? { minX: npc.minX, maxX: npc.maxX, minY: npc.minY, maxY: npc.maxY }
    : null;
  const pts    = planner.plan(npc.x, npc.y, roamTarget.x, roamTarget.y, bounds,
                              _zoneCostsFor(npc, false));
  mot.path     = (pts && pts.length > 0) ? { pts, idx: 0, goalX: roamTarget.x, goalY: roamTarget.y } : null;
}

function _fireBlocked(mot, goal) {
  const cb       = goal.onDone;
  mot.goal       = null;
  mot.path       = null;
  mot.needReplan = undefined;
  if (cb) cb('blocked');
}
