/**
 * CONTRACT  (see docs/contracts/movement.md)
 *   OWNS:      steerRoam — the sole per-frame caller of pickModeTarget / Lookahead;
 *              mot.path idx advance (arrival detection).
 *   WRITES:    mot.vel (walk branch); mot.path.idx (waypoint advance);
 *              mot.goal = null + onDone callback (arrival);
 *              npc.direction (steer + departure);
 *              npc.mem('motor').wallSpot (lean_wall assignment).
 *   READS:     npc.state, npc.roamTarget, npc.mem('motor').{walkMode,goal,path},
 *              NavGrid singleton.
 *   MUST NOT:  write npc.speed/state — use Motor.setState/setSpeed;
 *              write npc.x/y — use Motor.setXY/nudgeXY;
 *              write mot.path (use PlanService); call pickModeTarget outside steerRoam.
 *
 * BaseStateMachine — 集中式转换表状态机（Unity 风格）
 *
 * 架构：
 *   STATE_DEFS          — 状态定义（动画/速度/计时/onExit 钩子），现存于 Motor.js
 *   TRANSITIONS         — 全局转换规则数组，按 priority 降序预排序
 *   registerTransition  — 外部注入规则的接口（供 SocialLayer / 镜头层等使用）
 *   _evaluateTransitions— 每帧求值：遍历规则，首个满足条件的规则触发
 *   _tickState          — 当前状态的 per-frame 行为（位置更新等，不含转换判断）
 *   tickBaseState       — 对外接口：stateTimer++ → _evaluateTransitions → _tickState
 *
 * 转换规则结构：
 *   {
 *     from:      'walk'  | 'any',
 *     to:        'stand' | null,
 *     priority:  number,
 *     trigger:   string,
 *     condition: (npc, envQuery, profile) => boolean,
 *     resolve?:  (npc, envQuery, profile) => string | null,
 *   }
 *
 * priority 约定：
 *   1~9   普通日常（timeout 驱动）
 *   10~49 环境触发
 *   50~98 社交触发（SocialLayer 外部注入）
 *   99+   强制打断（animDone 驱动）
 *
 * onExit 钩子：STATE_DEFS[state].onExit(npc, toState) 在 setState 切换前调用，
 * 负责离开该状态时的清理（释放 bench/wall 槽位、清 loiter 微行为、恢复 walk mode 等）。
 */

import { dlog }        from './DebugLog.js';
import { audit }        from '../debug/MovementAudit.js';
import { PARK_TOP, WORLD_WIDTH, BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM } from '../core/Layout.js';
import { sitDown, alignLie } from '../entity/seat/seat.js';
import { tickLoiter } from '../npc/LoiterBehavior.js';

import {
  tickWalkMode, pickModeTarget, onPathArrival,
  setWalkMode, isRoadZone, modeWander,
} from './WalkMode.js';

import { setState, STATE_DEFS, setXY, nudgeXY, setAnimation, RECOVERY_RULES, SAFETY_RULES } from './Motor.js';
import { getNavGrid, ROAD } from './nav/NavGrid.js';
import { applyLookahead } from './nav/Lookahead.js';
import { arrived } from './SteeringDecision.js';
import { ensureWanderPath, publishGoal } from './nav/PlanService.js';
import { despawnNpc } from '../npc/despawn.js';

// @deprecated — 兼容层，仅供 activities/*.js 过渡期；第三刀迁移完成后删除
export { setState, STATE_DEFS } from './Motor.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── 内部：按 profile.transitions 权重表随机选下一状态，含环境前置检查 ───────
function _pickNext(npc, profile, envQuery) {
  const table = profile.transitions?.[npc.state];
  if (!table) return null;
  const entries = Object.entries(table);
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  let chosen = null;
  for (const [st, w] of entries) {
    r -= w;
    if (r <= 0) { chosen = st; break; }
  }
  if (!chosen) return null;
  if (!profile.allowedStates.includes(chosen)) return null;
  if (chosen === 'sit_bench'  && !envQuery.isNearBench(npc)) return 'stand';
  if (chosen === 'sit_ground' &&  envQuery.isNearBench(npc)) return 'stand';
  if (chosen === 'lean_wall'  && !envQuery.isNearWall(npc))  return 'stand';
  if (chosen === 'squat'      && !envQuery.isNearWall(npc))  return 'stand';
  if (chosen === 'lie_bench'  && npc.stateTimer < 12)        return 'stand';
  return chosen;
}

// ─── 内部：timeout 触发时解析最终目标（含 sit_bench 占位/对齐副作用）──────────
function _resolveTimeout(npc, envQuery, profile) {
  if (npc.mem('agenda').departing) return null;
  if (isRoadZone(npc.y)) return null;
  const next = _pickNext(npc, profile, envQuery);
  if (!next) return null;
  if (next === 'sit_bench') {
    const bench = envQuery.nearestFreeBench(npc, 80);
    if (!bench) return 'stand';
    sitDown(npc, bench);
    return 'sit_bench';
  }
  // sit_bench→lie_bench: body joint shifts laterally, realign so body maps to seatY
  if (next === 'lie_bench' && npc.mem('social').bench) {
    alignLie(npc, npc.renderer);
  }
  if (next === 'lean_wall') {
    const spot = envQuery.nearestFreeWallSpot(npc, 60);
    if (!spot) return 'stand';
    if (spot.side === 'left') spot.building._leanLeft = npc.id;
    else spot.building._leanRight = npc.id;
    npc.mem('motor').wallSpot = { building: spot.building, side: spot.side };
    const halfW = 20 * (npc.scale || 0.45);
    const dx = spot.side === 'left' ? -halfW : halfW;
    setXY(npc,
      Math.max(npc.minX, Math.min(npc.maxX, spot.x + dx)),
      Math.max(npc.minY, Math.min(npc.maxY, spot.building.baseY)),
    );
    npc.direction = spot.facing;
    return 'lean_wall';
  }
  if (next === 'sit_ground') {
    if (npc.y < PARK_TOP) return 'stand';
    return 'sit_ground';
  }
  return next;
}

// ─── 转换规则表 ───────────────────────────────────────────────────────────────
const TRANSITIONS = [

  // ── 99+：强制打断（animDone 驱动）────────────────────────────────────────────
  {
    from: 'fall',   to: 'lie_ground',
    priority: 99,   trigger: 'anim-done',
    condition: (npc) => npc.animDone,
  },
  {
    from: 'get_up', to: 'stand',
    priority: 99,   trigger: 'anim-done',
    condition: (npc) => npc.animDone,
  },

  // ── 1~9：日常 timeout ──────────────────────────────────────────────────────
  {
    from: 'any', to: null,
    priority: 5,    trigger: 'timeout',
    condition: (npc) => npc.stateDur < Infinity && npc.stateTimer >= npc.stateDur,
    resolve: _resolveTimeout,
  },

  // ── 10~49：环境触发（预留）────────────────────────────────────────────────────

  // ── 50~98：社交触发（SocialLayer 通过 registerTransition 注入）────────────────
];

TRANSITIONS.sort((a, b) => b.priority - a.priority);

export function registerTransition(rule) {
  TRANSITIONS.push(rule);
  TRANSITIONS.sort((a, b) => b.priority - a.priority);
}

// ─── 转换求值：每帧遍历规则，首个满足条件的规则触发 ──────────────────────────
function _evaluateTransitions(npc, profile, envQuery) {
  for (const t of TRANSITIONS) {
    if (t.from !== 'any' && t.from !== npc.state) continue;
    if (!t.condition(npc, envQuery, profile)) continue;
    const target = t.resolve ? t.resolve(npc, envQuery, profile) : t.to;
    if (target == null) continue;
    setState(npc, target, t.trigger);
    return;
  }
}

// ─── 当前状态的 per-frame 行为（纯行为，不含转换判断）────────────────────────
function _tickState(npc, envQuery, profile, dt) {
  const isWalking = npc.state === 'walk' || npc.state === 'run' || npc.state === 'jog';

  if (isWalking) tickWalkMode(npc, dt);

  const mot = npc.mem('motor');
  const needsSteer = isWalking && (mot.walkMode || mot.goal);
  if (needsSteer) steerRoam(npc, envQuery, profile, dt);

  // N3-c: 骑手每帧由状态驱动速度；不走 steerRoam，直接写 mot.vel
  if (npc.state === 'ride') {
    mot.vel = { vx: npc.direction * npc.speed, vy: 0 };
  }

  if (npc.state === 'loiter') tickLoiter(npc, profile, dt);
}

// ─── 朝向更新（单一写入点，带 dirCD 迟滞）───────────────────────────────────────
function updateFacing(npc, vx, spd, dt) {
  const mot = npc.mem('motor');
  mot.dirCD = (mot.dirCD || 0) - dt;
  const desired = vx >= 0 ? 1 : -1;
  if (Math.abs(vx) > spd * 0.35 && desired !== npc.direction && mot.dirCD <= 0) {
    npc.direction = desired;
    mot.dirCD = 0.45;
  }
}

// ─── 二维漫游转向 ─────────────────────────────────────────────────────────────
function steerRoam(npc, envQuery, profile, dt) {
  const mot = npc.mem('motor');

  // path_follow pausing early exit (preserved)
  if (mot.walkMode?.kind === 'path_follow' && mot.walkMode.pausing) {
    return;
  }

  // Wander NPCs manage their path lazily; goal-driven NPCs already have mot.path from ensurePath
  if (!mot.goal) {
    if (!npc.roamTarget) pickModeTarget(npc, envQuery);
    if (!npc.roamTarget) return;
    ensureWanderPath(npc, npc.roamTarget);
  }
  if (!mot.path) return;

  const path = mot.path;
  const wp   = path.pts[Math.min(path.idx, path.pts.length - 1)];
  if (!wp) return;
  const dx = wp.x - npc.x, dy = wp.y - npc.y;
  const dist = Math.hypot(dx, dy);

  // ── Intermediate waypoint arrival ──────────────────────────────────────
  if (path.idx < path.pts.length - 1 && arrived('nav_waypoint', dist)) {
    path.idx++;
    return;
  }

  // ── Final destination arrival ──────────────────────────────────────────
  const finalDest   = mot.goal ? mot.goal.dest : npc.roamTarget;
  const distToFinal = Math.hypot(finalDest.x - npc.x, finalDest.y - npc.y);
  const _offWorld   = mot.goal?.meta?.offWorld;
  if ((_offWorld && (npc.x < 0 || npc.x > WORLD_WIDTH)) ||
      arrived(mot.goal?.meta?.arrivalRule ?? 'walk_goal', distToFinal)) {
    mot.path = null;
    if (mot.goal) {
      const cb = mot.goal.onDone;
      mot.goal = null; mot.needReplan = undefined;
      if (cb) cb('arrived');
    } else {
      const mode = mot.walkMode;
      if (mode?.kind === 'path_follow') {
        onPathArrival(mode, npc);
      } else {
        const lc = profile?.loiterChance;
        if (lc && Math.random() < lc && !isRoadZone(npc.y)) {
          setState(npc, 'loiter', 'loiter-chance');
        } else {
          pickModeTarget(npc, envQuery);
        }
      }
    }
    return;
  }

  // ── Steer toward current waypoint ─────────────────────────────────────
  const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
  if (dist === 0) return;
  const { vx, vy } = applyLookahead(npc, dx / dist * total, dy / dist * total, SAFETY_RULES.lookahead);
  if (vx !== 0 && Math.sign(vx) !== npc.direction) audit.count(npc, 'dir_mismatch');

  // Jaywalk sprint: road-cell → multiply velocity (spatial derivation, replaces planCrossing setSpeed)
  const _grid  = getNavGrid();
  const _inLane = npc.y >= BIKE_LANE_FAR_TOP && npc.y < BIKE_LANE_NEAR_BOTTOM;
  if (_inLane && _grid) {
    const { gx: _gx, gy: _gy } = _grid.worldToCell(npc.x, npc.y);
    if (_grid.cost(_gx, _gy) === ROAD) {
      mot.vel = { vx: vx * SAFETY_RULES.jaywalk_sprint.speedK, vy: vy * SAFETY_RULES.jaywalk_sprint.speedK };
      setAnimation(npc, SAFETY_RULES.jaywalk_sprint.anim);
    } else {
      mot.vel = { vx, vy };
      if (npc.animation === SAFETY_RULES.jaywalk_sprint.anim && npc.state === 'walk') setAnimation(npc, 'walk');
    }
  } else {
    mot.vel = { vx, vy };
    if (npc.animation === SAFETY_RULES.jaywalk_sprint.anim && npc.state === 'walk') setAnimation(npc, 'walk');
  }
  updateFacing(npc, vx, total, dt);
}

// ─── 离场系统 ─────────────────────────────────────────────────────────────────
function _routeToExit(npc, exit, ctx = {}) {
  const tx = exit.x;
  const ty = exit.y ?? npc.y;
  if (exit.facing !== 0) npc.direction = exit.facing;
  setWalkMode(npc, null);
  npc.modifiers = npc.modifiers.filter(m => m.kind !== 'held');
  setState(npc, 'walk', 'departure');
  if (exit.type === 'edge') {
    const mot = npc.mem('motor');
    mot.savedBounds = { minX: npc.minX, maxX: npc.maxX };
    if (exit.x < (npc.minX ?? 0))          npc.minX = exit.x - 10;
    if (exit.x > (npc.maxX ?? WORLD_WIDTH)) npc.maxX = exit.x + 10;
    publishGoal(npc, { x: tx, y: ty }, 60, (result) => {
      if (result === 'arrived') despawnNpc(npc, 'exit-arrive', ctx);
    }, { offWorld: true });
  } else {
    publishGoal(npc, { x: tx, y: ty }, 60, (result) => {
      if (result === 'arrived') despawnNpc(npc, 'exit-arrive', ctx);
    }, { arrivalRule: 'exit_building' });
  }
}

export function triggerDeparture(npc, exitRegistry, ctx = {}) {
  if (!exitRegistry) return;
  const ag = npc.mem('agenda');
  if (ag.departing) return;
  const preferType = ag.preferExitType ?? ag.profile?.departure?.preferExitType ?? null;
  const exit = exitRegistry.findExit(npc, preferType);
  if (!exit) { ag.lifespan += 30; return; }

  ag.departing = true;

  if (['sit_bench', 'lie_bench', 'sit_ground', 'squat'].includes(npc.state)) {
    setState(npc, 'stand', 'departure');
    ag.pendingDeparture = exit;
    ag.pendingDepartureCtx = ctx;
    return;
  }
  _routeToExit(npc, exit, ctx);
}

export function restoreDepartureBounds(npc) {
  const mot = npc.mem('motor');
  if (!mot.savedBounds) return;
  npc.minX = mot.savedBounds.minX;
  npc.maxX = mot.savedBounds.maxX;
  mot.savedBounds = null;
}

// ─── 对外主接口：每帧推进单个 NPC 的基础状态 ──────────────────────────────────
export function tickBaseState(npc, profile, envQuery, dt) {
  npc.stateTimer += dt;

  const ag = npc.mem('agenda');
  if (ag.pendingDeparture && npc.state === 'stand') {
    const exit = ag.pendingDeparture;
    const ctx  = ag.pendingDepartureCtx ?? {};
    ag.pendingDeparture    = null;
    ag.pendingDepartureCtx = null;
    _routeToExit(npc, exit, ctx);
    return;
  }

  _evaluateTransitions(npc, profile, envQuery);
  _tickState(npc, envQuery, profile, dt);
}
