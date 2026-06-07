/**
 * BaseStateMachine — 集中式转换表状态机（Unity 风格）
 *
 * 架构：
 *   STATE_DEFS          — 状态定义（动画/速度/计时/onExit 钩子），不含转换逻辑
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
import { PARK_TOP }     from '../SceneConfig.js';
import { sitDown, alignLie, standUp } from '../entity/bench/bench.js';
import { tickLoiter, initPoseCache as initLoiterPoseCache } from './LoiterBehavior.js';

import {
  tickWalkMode, pickModeTarget, onPathArrival,
  setWalkMode, popWalkMode, isRoadZone, modeWander,
} from './WalkMode.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── 共享 onExit 工具 ──────────────────────────────────────────────────────────

// 清临时标签 + walk/run 时恢复压栈的 walk mode
function _defaultOnExit(npc, toState) {
  npc._extraTags = null;
  if ((toState === 'walk' || toState === 'run') && npc._walkModeStack?.length > 0) {
    npc._walkMode  = npc._walkModeStack.pop();
    npc.roamTarget = null;
  }
}

// ─── 状态定义（不含转换逻辑）────────────────────────────────────────────────
const STATE_DEFS = {
  walk: {
    anim: 'walk', speedK: 1.0, once: false, dur: [4, 10],
    onExit: _defaultOnExit,
  },
  run: {
    anim: 'run', speedK: 2.4, once: false, dur: [2, 4],
    onExit: _defaultOnExit,
  },
  jog: {
    anim: 'jog', speedK: 1.0, once: false, dur: null,
    onExit: _defaultOnExit,
  },
  stand: {
    anim: 'stand', speedK: 0, once: false, dur: [3, 8],
    onExit: _defaultOnExit,
  },
  sit_bench: {
    anim: 'sit_bench', speedK: 0, once: true, dur: [8, 15],
    onExit: (npc, toState) => {
      if (toState !== 'lie_bench') standUp(npc);
      _defaultOnExit(npc, toState);
    },
  },
  fall: {
    anim: 'fall', speedK: 0, once: true, dur: null,
    onExit: _defaultOnExit,
  },
  lie_ground: {
    anim: 'lie_ground', speedK: 0, once: true, dur: [4, 8],
    onExit: _defaultOnExit,
  },
  lean_wall: {
    anim: 'lean_wall', speedK: 0, once: true, dur: [8, 20],
    onExit: (npc, toState) => {
      if (npc._wallSpot) {
        const ws = npc._wallSpot;
        if (ws.side === 'left') ws.building._leanLeft = null;
        else ws.building._leanRight = null;
        npc._wallSpot = null;
      }
      _defaultOnExit(npc, toState);
    },
  },
  squat: {
    anim: 'squat', speedK: 0, once: true, dur: [5, 15],
    onExit: _defaultOnExit,
  },
  sit_ground: {
    anim: 'sit_ground', speedK: 0, once: true, dur: [8, 20],
    onExit: _defaultOnExit,
  },
  lie_bench: {
    anim: 'lie_bench', speedK: 0, once: true, dur: [15, 40],
    onExit: (npc, toState) => {
      standUp(npc);
      _defaultOnExit(npc, toState);
    },
  },
  get_up: {
    anim: 'get_up', speedK: 0, once: true, dur: null,
    onExit: _defaultOnExit,
  },
  talk: {
    anim: 'stand', speedK: 0, once: false, dur: null,
    onExit: _defaultOnExit,
  },
  loiter: {
    anim: 'stand', speedK: 0, once: false, dur: null,
    onExit: (npc, toState) => {
      npc.modifiers = npc.modifiers.filter(m => m.id !== '_loiter_micro');
      if (npc._loiterDir !== undefined) npc.direction = npc._loiterDir;
      npc._loiterDir = undefined;
      _defaultOnExit(npc, toState);
    },
  },
  routing: {
    anim: 'walk', speedK: 1.0, once: false, dur: null,
    onExit: _defaultOnExit,
  },
};

export { STATE_DEFS };

// ─── setState（对外 API；供 Activity / SocialLayer 等外部直接切换状态）──────
export function setState(npc, state, trigger = '?') {
  const def = STATE_DEFS[state];
  if (!def) return;
  const prev = npc.state;

  // 调用前一状态的退出钩子（清理 bench/wall 占用、loiter 状态、walk mode 等）
  if (prev) STATE_DEFS[prev]?.onExit?.(npc, state);

  npc.state      = state;
  npc.stateTimer = 0;
  npc.stateDur   = def.dur ? rand(def.dur[0], def.dur[1]) : Infinity;
  npc.animation  = def.anim;
  npc.speed      = def.speedK * (npc.walkSpeed || 26);
  npc.vy         = 0;        // 纵深速度由 steerRoam 每帧设定；静止态归零防漂移
  npc.playOnce   = def.once;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
  if (npc._walkMode?.kind === 'wander' && (state === 'walk' || state === 'run')) npc.roamTarget = null;

  // 进入 lie_bench：_extraTags 已由 onExit 清空，此处重新按状态赋值
  if (state === 'lie_bench') {
    npc._extraTags = (Math.random() < 0.2) ? ['resting', 'homeless'] : ['resting'];
  }
  // 进入 loiter：初始化微行为（首帧由 tickLoiter 完成，_loiterDur=null 为触发信号）
  if (state === 'loiter') {
    npc._loiterDur     = null;
    npc._loiterElapsed = 0;
    npc._microPhase    = null;
    npc._microTimer    = 0;
    npc._extraTags     = ['standing', 'idle'];
  }

  if (prev && prev !== state) {
    const dur = npc.stateDur === Infinity ? '∞' : npc.stateDur.toFixed(1) + 's';
    const extra = npc._extraTags ? `, extra_tags=[${npc._extraTags.join(',')}]` : '';
    dlog(`[NPC-${npc.id}] ${prev} → ${state} (dur=${dur}, trigger=${trigger}${extra})`);
  }
}

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
    npc.x = Math.max(npc.minX, Math.min(npc.maxX, spot.x + dx));
    npc.y = Math.max(npc.minY, Math.min(npc.maxY, spot.building.baseY));
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
    npc.speed = 0;
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
      npc.x = t.x; npc.y = t.y;
      const cb = t.onArrive;
      npc._routeTarget = null;
      if (cb) cb(npc);
      return;
    }
    npc.direction = dx > 0 ? 1 : -1;
    const spd = npc.walkSpeed || 26;
    npc.x += (dx / dist) * spd * dt;
    npc.y += (dy / dist) * spd * dt;
    return;
  }

  if (npc._walkMode?.kind === 'path_follow' && npc._walkMode.pausing) {
    npc.speed = 0; npc.vy = 0;
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
  npc.speed = Math.abs(vx);
  npc.vy    = vy;

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
    if (sd < 1) { npc.x = o.x + ox / sd; npc.y = o.y + oy / sd; }
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
  npc._walkMode = null;
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
