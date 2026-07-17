/**
 * PlanService — Intent 层 → Planning 层胶水（goal-pipeline-v1.md N-2b）
 *
 * CONTRACT
 *   OWNS:      mot.goal lifecycle；mot.path 唯一写入点。
 *   WRITES:    mot.goal, mot.path, mot.needReplan（均在 npc.mem('motor')）。
 *   READS:     NavGrid via PathPlanner；npc.mem('agenda').profile（jaywalkChance）。
 *   MUST NOT:  write npc.x/y/state/speed/animation；call setState；
 *              read npc.mem('social')；import from BaseStateMachine.
 */

import { getPlanner, PLANNING_RULES } from './PathPlanner.js';

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
  mot.goal       = { dest, timeout: timeout ?? null, onDone, meta: { jaywalk }, elapsed: 0 };
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
  let roadCost = PLANNING_RULES.roadCostDefault;
  if (goal.meta.jaywalk) roadCost = PLANNING_RULES.jaywalkRoadCost;
  const pts      = planner.plan(npc.x, npc.y, goal.dest.x, goal.dest.y, bounds, { roadCost });

  if (!pts || pts.length === 0) { _fireBlocked(mot, goal); return; }
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
  const pts    = planner.plan(npc.x, npc.y, roamTarget.x, roamTarget.y, bounds);
  mot.path     = (pts && pts.length > 0) ? { pts, idx: 0, goalX: roamTarget.x, goalY: roamTarget.y } : null;
}

function _fireBlocked(mot, goal) {
  const cb       = goal.onDone;
  mot.goal       = null;
  mot.path       = null;
  mot.needReplan = undefined;
  if (cb) cb('blocked');
}
