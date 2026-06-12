/**
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
import { PARK_TOP }     from '../core/Layout.js';
import { sitDown, alignLie } from '../entity/seat/seat.js';
import { tickLoiter, initPoseCache as initLoiterPoseCache } from '../npc/LoiterBehavior.js';

import {
  tickWalkMode, pickModeTarget, onPathArrival,
  setWalkMode, popWalkMode, isRoadZone, modeWander,
} from './WalkMode.js';

import { setState, STATE_DEFS, setXY, nudgeXY, setSpeed } from './Motor.js';

// @deprecated — 兼容层，仅供 activities/*.js 过渡期；第三刀迁移完成后删除
export { setState, STATE_DEFS } from './Motor.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── initPoseCache（转发到 LoiterBehavior）──────────────────────────────────
export function initPoseCache(pc) {
  initLoiterPoseCache(pc);
}

// ─── 内部：按 profile.transitions 权重表随机选下一状态，含环境前置检查 ───────
function _pickNext(npc, profile, envQuery) {
  const table = profile.transitions[npc.state];
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
  // lie_bench anchorMode='back'（无竖向偏移），坐→躺转换时重对齐
  if (next === 'lie_bench' && npc._bench) {
    alignLie(npc, npc.renderer);
  }
  if (next === 'lean_wall') {
    const spot = envQuery.nearestFreeWallSpot(npc, 60);
    if (!spot) return 'stand';
    if (spot.side === 'left') spot.building._leanLeft = npc.id;
    else spot.building._leanRight = npc.id;
    npc._wallSpot = { building: spot.building, side: spot.side };
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
  const isWalking = npc.state === 'walk' || npc.state === 'run';

  if (isWalking) tickWalkMode(npc, dt);

  const needsSteer = npc.state === 'routing' || (isWalking && npc._walkMode);
  if (needsSteer) steerRoam(npc, envQuery, profile, dt);

  if (npc.state === 'loiter') tickLoiter(npc, profile, dt);
}

// ─── 二维漫游转向 ─────────────────────────────────────────────────────────────
function steerRoam(npc, envQuery, profile, dt) {
  if (npc.state === 'routing') {
    setSpeed(npc, 0);
    npc.vy    = 0;
    if (!npc._routeTarget) { setState(npc, 'walk', 'routing_no_target'); return; }
    const t  = npc._routeTarget;
    const dx = t.x - npc.x, dy = t.y - npc.y;
    const dist = Math.hypot(dx, dy);
    const arriveThreshold = t.exitType === 'building' ? 20 : 8;

    if (npc.stateTimer > (t.abandonAfter ?? 30)) {
      envQuery.releaseSlotReservation(npc);
      npc._routeTarget = null;
      setState(npc, 'walk', 'routing_timeout');
      return;
    }
    if (dist < arriveThreshold) {
      setXY(npc, t.x, t.y);
      const cb = t.onArrive;
      npc._routeTarget = null;
      if (cb) cb(npc);
      return;
    }
    npc.direction = dx > 0 ? 1 : -1;
    const spd = npc.walkSpeed || 26;
    nudgeXY(npc, (dx / dist) * spd * dt, (dy / dist) * spd * dt);
    return;
  }

  if (npc._walkMode?.kind === 'path_follow' && npc._walkMode.pausing) {
    setSpeed(npc, 0);
    npc.vy = 0;
    return;
  }

  if (!npc.roamTarget) pickModeTarget(npc, envQuery);
  if (!npc.roamTarget) return;

  const t = npc.roamTarget;
  const dx = t.x - npc.x, dy = t.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    const mode = npc._walkMode;
    if (mode?.kind === 'path_follow') {
      onPathArrival(mode, npc);
    } else if (mode?.kind === 'direct') {
      const cb = mode.onArrive;
      setWalkMode(npc, modeWander());
      if (cb) cb(npc);
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

  const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
  let vx = dx / dist * total, vy = dy / dist * total;
  const av = avoidObstacles(npc, vx, vy, envQuery);
  vx += av.x; vy += av.y;
  const mag = Math.hypot(vx, vy) || 1;
  vx = vx / mag * total; vy = vy / mag * total;
  setSpeed(npc, Math.abs(vx));
  npc.vy = vy;

  npc._dirCD = (npc._dirCD || 0) - dt;
  const desired = vx >= 0 ? 1 : -1;
  if (Math.abs(vx) > total * 0.35 && desired !== npc.direction && npc._dirCD <= 0) {
    npc.direction = desired;
    npc._dirCD = 0.45;
  }
}

function avoidObstacles(npc, vx, vy, envQuery) {
  let ax = 0, ay = 0;
  const speed = Math.hypot(vx, vy) || 1;
  const fx = vx / speed, fy = vy / speed;
  const base = npc.walkSpeed || 26;
  const npcR = 12;
  for (const o of envQuery.getObstacles(npc.x, npc.y, 46)) {
    const ox = npc.x - o.x, oy = npc.y - o.y;
    const rx = o.collisionRX + npcR, ry = o.collisionRY + npcR;
    const sd = Math.hypot(ox / rx, oy / ry) || 0.001;
    if (sd > 1.8) continue;
    if (sd < 1) { setXY(npc, o.x + ox / sd, o.y + oy / sd); }
    const d = Math.hypot(ox, oy) || 0.001;
    const dot = (-ox / d) * fx + (-oy / d) * fy;
    if (dot < 0.2) continue;
    const prox = Math.max(0, 1 - (sd - 1) / 0.8);
    if (prox <= 0) continue;
    let gx = ox / (rx * rx), gy = oy / (ry * ry);
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    let tx = -gy, ty = gx;
    if (tx * fx + ty * fy < 0) { tx = -tx; ty = -ty; }
    ax += (tx * 1.4 + gx * 0.6) * base * prox;
    ay += (ty * 1.4 + gy * 0.6) * base * prox;
  }
  return { x: ax, y: ay };
}

// ─── 离场系统 ─────────────────────────────────────────────────────────────────
function _routeToExit(npc, exit) {
  const tx = exit.x;
  const ty = exit.y ?? npc.y;
  if (exit.facing !== 0) npc.direction = exit.facing;
  setWalkMode(npc, null);
  npc.modifiers = npc.modifiers.filter(m => m.kind !== 'held');
  setState(npc, 'routing', 'departure');
  npc._routeTarget = {
    x: tx, y: ty,
    exitType: exit.type,
    abandonAfter: 999,
    onArrive: (n) => { n.alive = false; },
  };
}

export function triggerDeparture(npc, exitRegistry) {
  if (!exitRegistry) return;
  if (npc._departing) return;
  const exit = exitRegistry.findExit(npc, npc._profile?.departure?.preferExitType ?? null);
  if (!exit) { npc._lifespan += 30; return; }

  npc._departing = true;

  if (['sit_bench', 'lie_bench', 'sit_ground', 'squat'].includes(npc.state)) {
    setState(npc, 'stand', 'departure');
    npc._pendingDeparture = exit;
    return;
  }
  _routeToExit(npc, exit);
}

// ─── 对外主接口：每帧推进单个 NPC 的基础状态 ──────────────────────────────────
export function tickBaseState(npc, profile, envQuery, dt) {
  npc.stateTimer += dt;

  if (npc._pendingDeparture && npc.state === 'stand') {
    const exit = npc._pendingDeparture;
    npc._pendingDeparture = null;
    _routeToExit(npc, exit);
    return;
  }

  _evaluateTransitions(npc, profile, envQuery);
  _tickState(npc, envQuery, profile, dt);
}
