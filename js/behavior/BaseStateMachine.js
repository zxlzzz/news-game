/**
 * CONTRACT  (see docs/contracts/movement.md)
 *   OWNS:      steerRoam — the sole per-frame caller of pickModeTarget / Lookahead;
 *              npc.mem('motor').{navPath,navIdx,navGoalX,navGoalY} lifecycle;
 *              npc.mem('motor').{routeTarget,routePts,routeIdx} lifecycle;
 *              npc.vy during routing (set on crossing entry/exit/arrival).
 *   WRITES:    mot.routeTarget (triggerDeparture:319); mot.navPath/navIdx/navGoal*;
 *              mot.routePts/routeIdx; npc.vy; npc.direction (steer + departure);
 *              npc.mem('motor').wallSpot (lean_wall assignment:94).
 *   READS:     npc.state, npc.speed, npc.roamTarget, npc.mem('motor').walkMode,
 *              npc.mem('motor').routeTarget, NavGrid singleton.
 *   MUST NOT:  write npc.speed/state/animation — use Motor.setState/setSpeed/setAnimation;
 *              write npc.x/y — use Motor.setXY/nudgeXY;
 *              call pickModeTarget outside of steerRoam.
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
import { PARK_TOP, WORLD_WIDTH } from '../core/Layout.js';
import { sitDown, alignLie } from '../entity/seat/seat.js';
import { tickLoiter } from '../npc/LoiterBehavior.js';

import {
  tickWalkMode, pickModeTarget, onPathArrival,
  setWalkMode, popWalkMode, isRoadZone, modeWander,
} from './WalkMode.js';

import { setState, STATE_DEFS, setXY, nudgeXY, setSpeed } from './Motor.js';
import { getPlanner } from './nav/PathPlanner.js';
import { applyLookahead } from './nav/Lookahead.js';

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

  const needsSteer = npc.state === 'routing' || (isWalking && npc.mem('motor').walkMode);
  if (needsSteer) steerRoam(npc, envQuery, profile, dt);

  if (npc.state === 'loiter') tickLoiter(npc, profile, dt);
}

// ─── 二维漫游转向 ─────────────────────────────────────────────────────────────
function steerRoam(npc, envQuery, profile, dt) {
  const mot = npc.mem('motor');

  if (npc.state === 'routing') {
    setSpeed(npc, 0);
    npc.vy = 0;
    if (!mot.routeTarget) { setWalkMode(npc, modeWander()); setState(npc, 'walk', 'routing_no_target'); return; }
    const t = mot.routeTarget;
    const arriveThreshold = t.exitType === 'building' ? 20 : 8;

    if (npc.stateTimer > (t.abandonAfter ?? 30)) {
      envQuery.releaseSlotReservation(npc);
      if (mot.routeTarget?.exitType) {
        const ag2 = npc.mem('agenda');
        ag2.departing = false;
        ag2.lifespan += 30;   // prevent immediate re-trigger (mirrors triggerDeparture no-exit path)
        restoreDepartureBounds(npc);
      }
      mot.routeTarget = null; mot.routePts = null; mot.routeIdx = 0;
      setWalkMode(npc, modeWander());
      setState(npc, 'walk', 'routing_timeout');
      return;
    }

    // One-shot path planning when routePts is null
    if (mot.routePts == null) {
      if (!envQuery.raycastObstacle(npc.x, npc.y, t.x, t.y)) {
        mot.routePts = [t];
      } else {
        const _b = npc.minX != null ? { minX: npc.minX, maxX: npc.maxX, minY: npc.minY, maxY: npc.maxY } : null;
        const pts = getPlanner()?.plan(npc.x, npc.y, t.x, t.y, _b);
        mot.routePts = (pts && pts.length > 0) ? pts : [t];
      }
      mot.routeIdx = 0;
    }

    const pts  = mot.routePts;
    const idx  = mot.routeIdx ?? 0;
    const wp   = pts[Math.min(idx, pts.length - 1)];
    const isLast = idx >= pts.length - 1;
    const dx = wp.x - npc.x, dy = wp.y - npc.y;
    const dist = Math.hypot(dx, dy);

    if (isLast) {
      if (dist < arriveThreshold) {
        setXY(npc, t.x, t.y);
        const cb = t.onArrive;
        mot.routeTarget = null; mot.routePts = null; mot.routeIdx = 0;
        if (cb) cb(npc);
        return;
      }
    } else if (dist < 8) {
      mot.routeIdx = idx + 1;
      return;
    }

    if (Math.abs(dx) > 2) npc.direction = dx > 0 ? 1 : -1;
    const spd = npc.walkSpeed || 26;
    const { vx: rvx, vy: rvy } = applyLookahead(npc, (dx / dist) * spd, (dy / dist) * spd);
    nudgeXY(npc, rvx * dt, rvy * dt);
    return;
  }

  if (mot.walkMode?.kind === 'path_follow' && mot.walkMode.pausing) {
    setSpeed(npc, 0);
    npc.vy = 0;
    return;
  }

  if (!npc.roamTarget) pickModeTarget(npc, envQuery);
  if (!npc.roamTarget) return;

  const t = npc.roamTarget;

  // ── Path layer: plan once per roamTarget, follow waypoints ────────────
  if (!mot.navPath || mot.navGoalX !== t.x || mot.navGoalY !== t.y) {
    mot.navGoalX = t.x;
    mot.navGoalY = t.y;
    mot.navPath  = null;
    mot.navIdx   = 0;
    const planner = getPlanner();
    if (planner) {
      const _b = npc.minX != null
        ? { minX: npc.minX, maxX: npc.maxX, minY: npc.minY, maxY: npc.maxY }
        : null;
      const pts = planner.plan(npc.x, npc.y, t.x, t.y, _b);
      if (pts && pts.length > 0) {
        mot.navPath = pts;
        mot.navIdx  = 0;
      }
    }
  }

  // Steering target: current waypoint if path exists, else direct to roamTarget
  const wp = (mot.navPath && mot.navIdx < mot.navPath.length)
    ? mot.navPath[mot.navIdx]
    : t;

  const dx = wp.x - npc.x, dy = wp.y - npc.y;
  const dist = Math.hypot(dx, dy);

  // ── Waypoint arrival (intermediate) ───────────────────────────────────
  if (mot.navPath && mot.navIdx < mot.navPath.length - 1 && dist < 8) {
    mot.navIdx++;
    return;
  }

  // ── Final target arrival (roamTarget) ─────────────────────────────────
  const distToGoal = Math.hypot(t.x - npc.x, t.y - npc.y);
  if (distToGoal < 6) {
    mot.navPath = null;
    const mode = mot.walkMode;
    if (mode?.kind === 'path_follow') {
      onPathArrival(mode, npc);
    } else if (mode?.kind === 'direct') {
      const nt = mode.nextTarget;
      if (!nt || distToGoal < 2 || !envQuery.raycastObstacle(npc.x, npc.y, nt.x, nt.y)) {
        const cb = mode.onArrive;
        setWalkMode(npc, modeWander());
        if (cb) cb(npc);
      }
    } else {
      const lc = profile?.loiterChance;
      if (lc && Math.random() < lc && !isRoadZone(npc.y)) {
        setState(npc, 'loiter', 'loiter-chance');
      } else {
        pickModeTarget(npc, envQuery);
      }
    }
    return;
  }

  // ── Steer toward current waypoint ─────────────────────────────────────
  const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
  const { vx, vy } = applyLookahead(npc, dx / dist * total, dy / dist * total);
  if (npc.speed > 0 && vx !== 0 && Math.sign(vx) !== npc.direction) audit.count(npc, 'dir_mismatch');
  // Write full velocity vector — integratePhysics consumes mot.vel when present
  mot.vel = { vx, vy };
  setSpeed(npc, Math.hypot(vx, vy));
  npc.vy = vy;

  // direction: facing-only, driven by same 0.35 threshold + 0.45 s cooldown
  mot.dirCD = (mot.dirCD || 0) - dt;
  const desired = vx >= 0 ? 1 : -1;
  if (Math.abs(vx) > total * 0.35 && desired !== npc.direction && mot.dirCD <= 0) {
    npc.direction = desired;
    mot.dirCD = 0.45;
  }
}

// ─── 离场系统 ─────────────────────────────────────────────────────────────────
function _routeToExit(npc, exit) {
  const tx = exit.x;
  const ty = exit.y ?? npc.y;
  if (exit.facing !== 0) npc.direction = exit.facing;
  setWalkMode(npc, null);
  npc.modifiers = npc.modifiers.filter(m => m.kind !== 'held');
  setState(npc, 'routing', 'departure');
  if (exit.type === 'edge') {
    const mot = npc.mem('motor');
    mot.savedBounds = { minX: npc.minX, maxX: npc.maxX };
    if (exit.x < (npc.minX ?? 0))          npc.minX = exit.x - 10;
    if (exit.x > (npc.maxX ?? WORLD_WIDTH)) npc.maxX = exit.x + 10;
  }
  npc.mem('motor').routeTarget = {
    x: tx, y: ty,
    exitType: exit.type,
    abandonAfter: 60,
    onArrive: (n) => { n.alive = false; },
  };
}

export function triggerDeparture(npc, exitRegistry) {
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
    return;
  }
  _routeToExit(npc, exit);
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
    ag.pendingDeparture = null;
    _routeToExit(npc, exit);
    return;
  }

  _evaluateTransitions(npc, profile, envQuery);
  _tickState(npc, envQuery, profile, dt);
}
