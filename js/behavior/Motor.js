/**
 * Motor — NPC 字段唯一写入层
 *
 * 保护字段：state / speed / animation / _walkMode / x / y
 * 写入路径：仅 Motor 内部函数经由 _mw() 写入；其他层调用 Motor API。
 *
 * Debug 写保护（默认开启）：
 *   Object.defineProperty 拦截非授权写入 → console.warn + window.__motorViolations++
 *   关闭：window.__motorDebug = false
 */

import { standUp }  from '../entity/seat/seat.js';
import { dlog }     from './DebugLog.js';
import { getNavGrid, CELL } from './nav/NavGrid.js';

// ── 写入授权门 ─────────────────────────────────────────────────────────────────
let _writing = false;

/** 授权写入单个字段 */
function _mw(npc, field, value) {
  if (!npc._motorInstalled) { npc[field] = value; return; }
  _writing = true;
  npc[field] = value;
  _writing = false;
}

const PROTECTED = ['state', 'speed', 'animation', '_walkMode', 'x', 'y'];

// ── 写保护安装 ─────────────────────────────────────────────────────────────────
export function installProtection(npc) {
  if (npc._motorInstalled) return;
  npc._motorInstalled = true;
  npc._motor = {};

  for (const f of PROTECTED) {
    npc._motor[f] = Object.prototype.hasOwnProperty.call(npc, f) ? npc[f] : undefined;
    delete npc[f];
    Object.defineProperty(npc, f, {
      get()  { return this._motor[f]; },
      set(v) {
        if (_writing) { this._motor[f] = v; return; }
        window.__motorViolations = (window.__motorViolations | 0) + 1;
        if (window.__motorDebug !== false) {
          console.warn(`[Motor] unauthorized write npc#${this.id}.${f} =`, v,
            '\n', new Error().stack);
        }
        this._motor[f] = v;   // still apply so behavior continues
      },
      configurable: true,
      enumerable:   true,
    });
  }
}

// ── WalkMode 栈 ────────────────────────────────────────────────────────────────
export function setWalkMode(npc, desc) {
  _mw(npc, '_walkMode', desc);
  npc._walkModeStack = npc._walkModeStack ?? [];
  npc.roamTarget     = null;
}

export function pushWalkMode(npc, desc) {
  npc._walkModeStack = npc._walkModeStack ?? [];
  if (npc._walkMode) npc._walkModeStack.push(npc._walkMode);
  _mw(npc, '_walkMode', desc);
  npc.roamTarget = null;
}

export function popWalkMode(npc) {
  const stack = npc._walkModeStack;
  if (!stack?.length) return;
  _mw(npc, '_walkMode', stack.pop());
  npc.roamTarget = null;
}

// ── 状态定义 ───────────────────────────────────────────────────────────────────
function _defaultOnExit(npc, toState) {
  npc._extraTags = null;
  if ((toState === 'walk' || toState === 'run') && npc._walkModeStack?.length > 0) {
    _mw(npc, '_walkMode', npc._walkModeStack.pop());
    npc.roamTarget = null;
  }
}

export const STATE_DEFS = {
  walk:   { anim: 'walk',   speedK: 1.0, once: false, dur: [4, 10],  onExit: _defaultOnExit },
  run:    { anim: 'run',    speedK: 2.4, once: false, dur: [2, 4],   onExit: _defaultOnExit },
  jog:    { anim: 'jog',    speedK: 1.0, once: false, dur: null,     onExit: _defaultOnExit },
  stand:  { anim: 'stand',  speedK: 0,   once: false, dur: [3, 8],   onExit: _defaultOnExit },
  sit_bench: {
    anim: 'sit_bench', speedK: 0, once: true, dur: [8, 15],
    onExit: (npc, toState) => { if (toState !== 'lie_bench') standUp(npc); _defaultOnExit(npc, toState); },
  },
  fall:       { anim: 'fall',       speedK: 0, once: true,  dur: null,     onExit: _defaultOnExit },
  lie_ground: { anim: 'lie_ground', speedK: 0, once: true,  dur: [4, 8],   onExit: _defaultOnExit },
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
  squat:      { anim: 'squat',      speedK: 0, once: true,  dur: [5, 15],  onExit: _defaultOnExit },
  sit_ground: { anim: 'sit_ground', speedK: 0, once: true,  dur: [8, 20],  onExit: _defaultOnExit },
  lie_bench: {
    anim: 'lie_bench', speedK: 0, once: true, dur: [15, 40],
    onExit: (npc, toState) => { standUp(npc); _defaultOnExit(npc, toState); },
  },
  get_up:   { anim: 'get_up', speedK: 0, once: true,  dur: null, onExit: _defaultOnExit },
  talk:     { anim: 'stand',  speedK: 0, once: false, dur: null, onExit: _defaultOnExit },
  loiter: {
    anim: 'stand', speedK: 0, once: false, dur: null,
    onExit: (npc, toState) => {
      npc.modifiers = npc.modifiers.filter(m => m.id !== '_loiter_micro');
      if (npc._loiterDir !== undefined) npc.direction = npc._loiterDir;
      npc._loiterDir = undefined;
      _defaultOnExit(npc, toState);
    },
  },
  routing:        { anim: 'walk',            speedK: 1.0, once: false, dur: null, onExit: _defaultOnExit },
  chess:          { anim: 'chess',           speedK: 0,   once: true,  dur: null, onExit: _defaultOnExit },
  chess_onlooker: { anim: 'chess_onlookers', speedK: 0,   once: true,  dur: null, onExit: _defaultOnExit },
};

const rand = (a, b) => a + Math.random() * (b - a);

// ── setState ──────────────────────────────────────────────────────────────────
export function setState(npc, state, trigger = '?') {
  const def = STATE_DEFS[state];
  if (!def) return;
  const prev = npc.state;

  if (prev && STATE_DEFS[prev]) STATE_DEFS[prev].onExit?.(npc, state);

  _mw(npc, 'state',     state);
  _mw(npc, 'animation', def.anim);
  _mw(npc, 'speed',     def.speedK * (npc.walkSpeed || 26));
  npc.stateTimer = 0;
  npc.stateDur   = def.dur ? rand(def.dur[0], def.dur[1]) : Infinity;
  npc.vy         = 0;
  npc.playOnce   = def.once;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;

  if (npc._walkMode?.kind === 'wander' && (state === 'walk' || state === 'run'))
    npc.roamTarget = null;

  if (state === 'lie_bench')
    npc._extraTags = (Math.random() < 0.2) ? ['resting', 'homeless'] : ['resting'];

  if (state === 'loiter') {
    npc._loiterDur     = null;
    npc._loiterElapsed = 0;
    npc._microPhase    = null;
    npc._microTimer    = 0;
    npc._extraTags     = ['standing', 'idle'];
  }

  if (prev && prev !== state) {
    const dur   = npc.stateDur === Infinity ? '∞' : npc.stateDur.toFixed(1) + 's';
    const extra = npc._extraTags ? `, extra_tags=[${npc._extraTags.join(',')}]` : '';
    dlog(`[NPC-${npc.id}] ${prev} → ${state} (dur=${dur}, trigger=${trigger}${extra})`);
  }
}

// ── 碰撞辅助 ────────────────────────────────────────────────────────────────
function _navBlocked(grid, wx, wy) {
  const { gx, gy } = grid.worldToCell(wx, wy);
  return grid.cost(gx, gy) === 0;
}

/**
 * 尝试移动 (dx, dy)，NavGrid 阻挡时做轴分离滑行，位移归一化到原速度模长（贴边不减速）。
 *   0. 自身格已 BLOCKED → 无条件放行（逃逸）。
 *   1. 全向 → 单轴 → 垂直让行逐级尝试。
 *   2. 全阻：静止，不维护任何计数器。
 */
function _slideMove(npc, dx, dy) {
  // Bounds clamp: only block displacement that crosses from inside to outside
  if (npc.minX != null && npc.x >= npc.minX && npc.x + dx < npc.minX) dx = npc.minX - npc.x;
  if (npc.maxX != null && npc.x <= npc.maxX && npc.x + dx > npc.maxX) dx = npc.maxX - npc.x;
  if (npc.minY != null && npc.y >= npc.minY && npc.y + dy < npc.minY) dy = npc.minY - npc.y;
  if (npc.maxY != null && npc.y <= npc.maxY && npc.y + dy > npc.maxY) dy = npc.maxY - npc.y;
  if (dx === 0 && dy === 0) return;

  const grid = getNavGrid();
  const nx = npc.x + dx, ny = npc.y + dy;
  const mag = Math.hypot(dx, dy);

  // Escape rule: already in a blocked cell → move freely to get out
  if (grid && _navBlocked(grid, npc.x, npc.y)) {
    _mw(npc, 'x', nx); _mw(npc, 'y', ny);
    return;
  }

  // Full move
  if (!grid || !_navBlocked(grid, nx, ny)) {
    _mw(npc, 'x', nx); _mw(npc, 'y', ny);
    return;
  }

  // Axis separation — normalize to original magnitude to preserve speed
  if (dx !== 0 && !_navBlocked(grid, nx, npc.y)) {
    _mw(npc, 'x', npc.x + Math.sign(dx) * mag);
    return;
  }
  if (dy !== 0 && !_navBlocked(grid, npc.x, ny)) {
    _mw(npc, 'y', npc.y + Math.sign(dy) * mag);
    return;
  }

  // Wall-slide: pure horizontal blocked → nudge perpendicularly at original speed
  if (dx !== 0 && dy === 0) {
    if (!_navBlocked(grid, npc.x, npc.y - CELL * 0.6)) { _mw(npc, 'y', npc.y - mag); return; }
    if (!_navBlocked(grid, npc.x, npc.y + CELL * 0.6)) { _mw(npc, 'y', npc.y + mag); return; }
  }
  // Fully blocked: no movement, no counters
}

// ── 位置写入（供 steerRoam / _separate）──────────────────────────────────────
export function setXY(npc, x, y) {
  _mw(npc, 'x', x);
  _mw(npc, 'y', y);
}

export function nudgeXY(npc, dx, dy) {
  _slideMove(npc, dx, dy);
}

// ── 速度写入（供 steerRoam）──────────────────────────────────────────────────
export function setSpeed(npc, speed) {
  _mw(npc, 'speed', speed);
}

// ── 动画直写（供 planCrossing 等非 setState 场景）────────────────────────────
export function setAnimation(npc, anim) {
  _mw(npc, 'animation', anim);
}

// ── 物理积分（NPC.update 调用，授权写入 x / y）───────────────────────────────
export function integratePhysics(npc, delta) {
  const dt = delta / 1000;
  if (npc.leashTarget) {
    _mw(npc, 'x', npc.leashTarget.x + npc.leashOffset.x * npc.leashTarget.direction);
    _mw(npc, 'y', npc.leashTarget.y + npc.leashOffset.y);
    npc.direction = npc.leashTarget.direction;
    return;
  }
  let dx = 0, dy = 0;
  if (npc.speed > 0) {
    const tentX = npc.x + npc.direction * npc.speed * dt;
    if (!npc._walkMode) {
      if (npc.maxX != null && tentX > npc.maxX && npc.x <= npc.maxX) npc.direction = -1;
      else if (npc.minX != null && tentX < npc.minX && npc.x >= npc.minX) npc.direction = 1;
    }
    dx = npc.direction * npc.speed * dt;
  }
  const tentY = npc.y + npc.vy * dt;
  if (npc.maxY != null && tentY > npc.maxY && npc.y <= npc.maxY) {
    npc.vy = npc._walkMode ? 0 : -Math.abs(npc.vy);
  } else if (npc.minY != null && tentY < npc.minY && npc.y >= npc.minY) {
    npc.vy = npc._walkMode ? 0 : Math.abs(npc.vy);
  }
  dy = npc.vy * dt;
  if (dx !== 0 || dy !== 0) _slideMove(npc, dx, dy);

  // Progress monitor: every 1.5 s compare displacement; < 15 px with active goal → fail leg
  npc._progressAcc = (npc._progressAcc ?? 0) + dt;
  if (npc._progressAcc >= 1.5) {
    npc._progressAcc = 0;
    const snap  = npc._progressSnap;
    const moved = snap ? Math.hypot(npc.x - snap.x, npc.y - snap.y) : Infinity;
    npc._progressSnap = { x: npc.x, y: npc.y };

    const hasGoal = npc.speed > 0 || npc.state === 'routing';
    if (hasGoal && moved < 15) {
      const mode = npc._walkMode;
      if (mode?.kind === 'direct') {
        mode._elapsed = mode.abandonAfter ?? 60;
      } else if (mode?.kind === 'wander') {
        npc.roamTarget = null;
      } else if (npc.state === 'routing') {
        if (!npc._routeReplan) {
          // First failure: replan once; fresh window so second check starts now
          npc._routePts   = null;
          npc._routeIdx   = 0;
          npc._routeReplan = 1;
          npc._progressSnap = { x: npc.x, y: npc.y };
        } else {
          // Second consecutive failure: hand off to existing routing timeout
          npc._routeReplan = 0;
          npc.stateTimer   = 9999;
        }
      }
      else if (!mode){
        npc.direction=-npc.direction;
      }
    } else {
      npc._routeReplan = 0; // progress made or no goal → reset replan counter
    }
  }
}
