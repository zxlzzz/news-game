/**
 * Motor — NPC 字段唯一写入层
 *
 * 保护字段：state / speed / animation / x / y
 * 写入路径：仅 Motor 内部函数经由 _mw() 写入；其他层调用 Motor API。
 * _walkMode 已迁入 npc.mem('motor').walkMode，不再受写保护。
 *
 * Debug 写保护（默认开启）：
 *   Object.defineProperty 拦截非授权写入 → console.warn + window.__motorViolations++
 *   关闭：window.__motorDebug = false
 *
 * CONTRACT
 *   OWNS:      npc.{x,y,speed,state,animation} write gate (_mw);
 *              npc.mem('motor').walkMode lifecycle (N-2b: stack deleted);
 *              npc.mem('motor').{goal,path,needReplan} lifecycle (N-2b;
 *              M-1: needReplan 不再由 Motor 置 true——progress-monitor 已删);
 *              npc.mem('motor').tags (cleared in _defaultOnExit);
 *              npc.mem('motor').faceAcc (facing dead-zone accumulator, L-1);
 *              npc.mem('motor').{frontAccDx,frontAccDy} (front/side variant dead-zone
 *              accumulators, L-3 — independent of faceAcc, see _updateFrontVariant);
 *              npc.roamTarget null on mode change.
 *   WRITES:    x, y via setXY/nudgeXY/_slideMove;
 *              speed via setState; state/animation via setState/setAnimation;
 *              npc.direction in walk/run/jog/ride states, derived from real x
 *              displacement written this frame by _slideMove (L-1; sole address —
 *              see movement.md, BaseStateMachine MUST NOT write it in these states);
 *              npc.animation swap to/from '<id>_front' variants when vertical
 *              displacement dominates in walk/run/jog/ride states (L-3,
 *              _updateFrontVariant; resets npc.phase/frameIndex on switch);
 *              walkMode via setWalkMode; roamTarget=null on every mode switch;
 *              goal/path lifecycle (fire result on timeout).
 *   READS:     npc.mem('motor').{walkMode,goal,path} (integratePhysics);
 *              NavGrid singleton (getNavGrid) for collision in _slideMove.
 *   MUST NOT:  call setState from outside Motor; read npc._walkMode (legacy, deleted);
 *              write npc.mem('social') or npc.mem('agenda').
 */

import { standUp }  from '../entity/seat/seat.js';
import { dlog }     from './DebugLog.js';
import { getNavGrid, CELL, ZONE } from './nav/NavGrid.js';
import { audit } from '../debug/MovementAudit.js';
import { clipLibrary } from '../core/ClipLibrary.js';

// ── 安全网裁决表 — Physics 层策略参数唯一住址（goal-pipeline-v1.md §3）────────────
// U-3: 每条 reason 里的长度常数须标注单位——骨架单位（消费时乘 npc.scale）或
// NavGrid 格（消费时乘 CELL）；非长度量（比例 speedK、字符串 anim）不标注。
// check-invariants.mjs Rule 17 静态门此表。
//
// M-1「信任路径」重构：删除三层反应式避障 + 卡死恢复——
//   • lookahead（前瞻 35° 旋转 + 近墙减速 slowFactor=0.4，原 Lookahead.js，已删）
//   • wall_avoid（末帧 90° 偏转 _lookaheadDeflect，已删）
//   • separation（NPC 位置分离 _separate，已删）
//   • RECOVERY_RULES.progress_monitor（1.5s 位移不足重规划/弃目标，已删）
// 理由：A* 路径本已无碰撞（NavGrid Minkowski 外扩），跟随即可；这些反应层反而把
// NPC 从干净路径上推离/甩离、顶进墙角，才是"卡死+移动乱"的根因。churn 源既除，
// 卡死恢复无必要：不可达目标在规划期即判——goal 由 PlanService `_fireBlocked`，
// wander 由 steerRoam 丢弃 roamTarget 下帧重选。_slideMove 仍是"绝不踏入 BLOCKED
// 格"的硬兜底。未来的预测式避让 / 接触碰撞解算作为独立层叠在 steerRoam→积分之间。
export const SAFETY_RULES = {
  jaywalk_sprint:{ speedK: 2.4, anim: 'run', reason: '马路格速度倍增（NavGrid cell cost 空间派生；speedK 为比例，非长度）', src: 'N-2b' },
  facing:        { deadZone: 10,             reason: '朝向翻转空间死区（骨架单位，消费时乘 npc.scale）；替代旧版转向意图速度 + 时间冷却迟滞', src: 'L-1' },
};

// ── 写入授权门 ─────────────────────────────────────────────────────────────────
let _writing = false;

/** 授权写入单个字段 */
function _mw(npc, field, value) {
  if (!npc._motorInstalled) { npc[field] = value; return; }
  _writing = true;
  npc[field] = value;
  _writing = false;
}

const PROTECTED = ['state', 'speed', 'animation', 'x', 'y'];

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

// ── WalkMode ───────────────────────────────────────────────────────────────────
export function setWalkMode(npc, desc) {
  npc.mem('motor').walkMode = desc;
  npc.roamTarget            = null;
}

// ── 状态定义 ───────────────────────────────────────────────────────────────────
function _defaultOnExit(npc, _toState) {
  npc.mem('motor').tags = null;
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
      const ws = npc.mem('motor').wallSpot;
      if (ws) {
        if (ws.side === 'left') ws.building._leanLeft = null;
        else ws.building._leanRight = null;
        npc.mem('motor').wallSpot = null;
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
      const lt = npc.mem('loiter');
      if (lt.dir !== undefined) npc.direction = lt.dir;
      npc.clearMem('loiter');
      _defaultOnExit(npc, toState);
    },
  },
  // Patch F 修正：anim 从 'chess' 改 'stand'（零 delta 基座）。ChessActivity 的落子
  // 手势用 ClipPlayer 驱动 modifier 覆盖全身 11 个关节（含 neck/body/legs），若基座仍是
  // 'chess' 自身（不再被主动推进、冻结在任意一帧），Npc.js#_buildJointOverrides 的
  // 链根重锚（neck/legs 相对 frame.body/frame.neck 平移）会把这个冻结帧的 body/neck
  // 位移当成常量偏移叠加进每一帧手势里，整个姿势跟着错位。'stand' 全零 delta，
  // 重锚退化成 no-op——Stall/Talk/UsePropTask 全部用 'stand' 做 ClipPlayer 基座正是
  // 同一个原因。npc.state 仍是 'chess'（tag/StuckProbe 等按 state 走，不受影响，
  // Npc.js#STATE_TAGS 已补 chess:'sitting' 保住原有语义标签）。
  chess:          { anim: 'stand',           speedK: 0,   once: true,  dur: null, onExit: _defaultOnExit },
  chess_onlooker: { anim: 'chess_onlookers', speedK: 0,   once: true,  dur: null, onExit: _defaultOnExit },
  // N3-c: 骑手单态；anim 仅用于 setState fallback，CyclistSpawner 用 setAnimation 覆写实际 clip
  ride:           { anim: 'bike',            speedK: 1.0, once: false, dur: null, onExit: _defaultOnExit },
  // A-1: play_guitar 脚本的 pose 步骤用；anim='lift' 是 manifest kind:overlay
  // 的 clip（只声明 r_elbow/r_hand 两个关节 delta），其余关节零 delta=停在
  // defaultPose——静止站立、右臂抬起，不是行走态，故 speedK=0。
  lift:           { anim: 'lift',            speedK: 0,   once: true,  dur: null, onExit: _defaultOnExit },
};

const rand = (a, b) => a + Math.random() * (b - a);

// ── setState ──────────────────────────────────────────────────────────────────
export function setState(npc, state, trigger = '?') {
  const def = STATE_DEFS[state];
  if (!def) return;
  const prev = npc.state;

  if (prev && STATE_DEFS[prev]) STATE_DEFS[prev].onExit?.(npc, state);

  const mot = npc.mem('motor');
  // U-2: npc.speed 世界像素/秒 = speedK × walkSpeed(骨架单位/秒) × npc.scale。
  // scale 随 y 变，这里只是状态切换瞬间的初始值；speedK 存入 mot 供
  // integratePhysics 每帧用当帧最新 scale 重算，Motor 仍是唯一写入点。
  mot.speedK = def.speedK;
  _mw(npc, 'state',     state);
  _mw(npc, 'animation', def.anim);
  _mw(npc, 'speed',     def.speedK * npc.walkSpeed * npc.scale);
  npc.stateTimer = 0;
  npc.stateDur   = def.dur ? rand(def.dur[0], def.dur[1]) : Infinity;
  npc.playOnce   = def.once;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;

  if (mot.walkMode?.kind === 'wander' && (state === 'walk' || state === 'run'))
    npc.roamTarget = null;

  if (state === 'lie_bench')
    mot.tags = (Math.random() < 0.2) ? ['resting', 'homeless'] : ['resting'];

  if (state === 'loiter') {
    const lt     = npc.mem('loiter');
    lt.dur       = null;
    lt.elapsed   = 0;
    lt.microPhase = null;
    lt.microTimer = 0;
    lt.tags      = ['standing', 'idle'];
  }

  if (prev && prev !== state) {
    const dur   = npc.stateDur === Infinity ? '∞' : npc.stateDur.toFixed(1) + 's';
    const ltags = npc.mem('loiter').tags ?? npc.mem('motor').tags;
    const extra = ltags ? `, extra_tags=[${ltags.join(',')}]` : '';
    dlog(`[NPC-${npc.id}] ${prev} → ${state} (dur=${dur}, trigger=${trigger}${extra})`);
  }
}

// ── 碰撞辅助 ────────────────────────────────────────────────────────────────
function _navBlocked(grid, wx, wy) {
  const { gx, gy } = grid.worldToCell(wx, wy);
  return grid.zone(gx, gy) === ZONE.BLOCKED;
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
    audit.count(npc, 'slide_steer');
    return;
  }
  if (dy !== 0 && !_navBlocked(grid, npc.x, ny)) {
    _mw(npc, 'y', npc.y + Math.sign(dy) * mag);
    audit.count(npc, 'slide_steer');
    return;
  }

  // Wall-slide: pure horizontal blocked → nudge perpendicularly at original speed
  if (dx !== 0 && dy === 0) {
    if (!_navBlocked(grid, npc.x, npc.y - CELL * 0.6)) { _mw(npc, 'y', npc.y - mag); audit.count(npc, 'slide_steer'); return; }
    if (!_navBlocked(grid, npc.x, npc.y + CELL * 0.6)) { _mw(npc, 'y', npc.y + mag); audit.count(npc, 'slide_steer'); return; }
  }
  // Fully blocked: no movement
  audit.count(npc, 'blocked_contact');
}

// ── 朝向（唯一住址，L-1）─────────────────────────────────────────────────────
// walk/run/jog/ride 状态下，npc.direction 由本帧真实 x 位移（_slideMove 写入后的
// 实际增量，非转向意图速度）派生。迟滞用空间死区取代旧版时间冷却迟滞：
// mot.faceAcc 累加带符号真实 dx，越过 SAFETY_RULES.facing.deadZone × npc.scale
// 才翻转，翻转后清零。其余状态（落座/离场朝向、Director 出生朝向、
// LoiterBehavior 等）的直接写入不受影响——本函数对它们是空操作（状态白名单守卫）。
const FACING_STATES = new Set(['walk', 'run', 'jog', 'ride']);

function _updateDirection(npc, dx) {
  if (!FACING_STATES.has(npc.state) || dx === 0) return;
  const mot = npc.mem('motor');
  // dir_mismatch：可回归指标，比较本帧真实 dx 符号与当前朝向（翻转判据之外的观测）
  if (Math.sign(dx) !== npc.direction) audit.count(npc, 'dir_mismatch');
  const acc = (mot.faceAcc || 0) + dx;
  const dz  = SAFETY_RULES.facing.deadZone * npc.scale;
  const desired = acc >= dz ? 1 : acc <= -dz ? -1 : null;
  if (desired !== null) {
    npc.direction = desired;
    mot.faceAcc   = 0;
  } else {
    mot.faceAcc = acc;
  }
}

// ── 竖视变体切换（唯一住址，L-3）─────────────────────────────────────────────
// walk_front / stand_front / idle_front / squat_front 已在 manifest 注册但此前
// 全库零消费点（PoseCacheBuilder 的 front/side 配对只服务 kind==='overlay' 的
// trait，这几个是 kind==='cycle'，落不进去）。以竖直位移为主时切到 _front 变体。
//
// FRONT_VARIANTS 只声明"配对关系"（新增变体在此登记）；是否真的切换看下方对
// manifest 的存在性查表（查表，不是兜底）——manifest 里删掉某个 clip 时这里
// 自动降级为保持当前 clip，不会引用到不存在的资产。
const FRONT_VARIANTS = {
  walk:  'walk_front',
  stand: 'stand_front',
  idle:  'idle_front',
  squat: 'squat_front',
};
const SIDE_OF_FRONT = Object.fromEntries(
  Object.entries(FRONT_VARIANTS).map(([side, front]) => [front, side])
);

// 迟滞复用 L-1 的空间死区阈值（SAFETY_RULES.facing.deadZone），不新增阈值；
// 但用独立的 dx/dy 累加器，不直接复用 mot.faceAcc——faceAcc 的清零时机绑定朝向
// 翻转判定，与本判据的清零时机混用会产生不受控的隐式耦合。
// 切换时相位归零（npc.phase/frameIndex=0）——walk 20 帧、walk_front 13 帧，
// 帧数不同，两个变体的帧未必逐帧姿势对应，归零避免瞬间跳到不对应的姿势。
function _updateFrontVariant(npc, dx, dy) {
  if (!FACING_STATES.has(npc.state) || (dx === 0 && dy === 0)) return;
  const mot = npc.mem('motor');
  const accDx = (mot.frontAccDx || 0) + dx;
  const accDy = (mot.frontAccDy || 0) + dy;
  const dz = SAFETY_RULES.facing.deadZone * npc.scale;
  if (Math.abs(accDx) < dz && Math.abs(accDy) < dz) {
    mot.frontAccDx = accDx;
    mot.frontAccDy = accDy;
    return;
  }
  const wantFront = Math.abs(accDy) > Math.abs(accDx);
  mot.frontAccDx = 0;
  mot.frontAccDy = 0;

  const targetId = wantFront ? FRONT_VARIANTS[npc.animation] : SIDE_OF_FRONT[npc.animation];
  if (targetId && clipLibrary.manifest?.clips[targetId]) {
    setAnimation(npc, targetId);
    npc.phase = 0;
    npc.frameIndex = 0;
  }
}

// ── 位置写入（setXY 供落座/对齐；nudgeXY 保留为公开 API，M-1 后暂无调用方）────────
export function setXY(npc, x, y) {
  _mw(npc, 'x', x);
  _mw(npc, 'y', y);
}

export function nudgeXY(npc, dx, dy) {
  _slideMove(npc, dx, dy);
}

// ── 动画直写（供 jaywalk_sprint 等非 setState 场景）──────────────────────────
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
  const mot = npc.mem('motor');
  // U-2: npc.speed 每帧从 speedK × walkSpeed × scale 重算——scale 随 y 变，
  // setState 的初值只是切换瞬间的快照，此处才是持续正确的唯一来源。
  _mw(npc, 'speed', mot.speedK * npc.walkSpeed * npc.scale);

  if (mot.vel) {
    let vx = mot.vel.vx, vy = mot.vel.vy;
    // Y boundary clamp at consume-time (walkMode: stop at boundary)
    const tentY = npc.y + vy * dt;
    if (npc.maxY != null && tentY > npc.maxY && npc.y <= npc.maxY) vy = 0;
    else if (npc.minY != null && tentY < npc.minY && npc.y >= npc.minY) vy = 0;
    // P-1 振荡探针：追踪 vx 符号翻转次数（纯计数，不影响行为）
    const vxSign = vx > 0 ? 1 : vx < 0 ? -1 : 0;
    if (vxSign !== 0 && mot._obsVxSign !== undefined && mot._obsVxSign !== 0 && vxSign !== mot._obsVxSign) {
      mot._obsFlipVx = (mot._obsFlipVx ?? 0) + 1;
    }
    mot._obsVxSign = vxSign;
    mot.vel = null;
    const _prevX = npc.x, _prevY = npc.y;
    _slideMove(npc, vx * dt, vy * dt);
    const _dx = npc.x - _prevX, _dy = npc.y - _prevY;
    _updateDirection(npc, _dx);
    _updateFrontVariant(npc, _dx, _dy);
  }
  // else: mot.vel absent → stationary this frame

  // Goal elapsed + timeout（铁律③：计时器累加只在裁决文件）
  const goal = mot.goal;
  if (goal) {
    goal.elapsed += dt;
    if (goal.timeout != null && goal.elapsed > goal.timeout) {
      const cb       = goal.onDone;
      mot.goal       = null;
      mot.path       = null;
      mot.needReplan = undefined;
      if (cb) cb('timeout');
    }
  }

  // M-1: progress-monitor 卡死重规划已删除（见 SAFETY_RULES 上方注记）。不可达目标
  // 在规划期即处理：goal 由 PlanService._fireBlocked，wander 由 steerRoam 丢弃 roamTarget。
}
