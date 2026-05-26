/**
 * BaseStateMachine — 集中式转换表状态机（Unity 风格）
 *
 * 架构：
 *   STATE_DEFS          — 状态定义（动画/速度/计时），不含转换逻辑
 *   TRANSITIONS         — 全局转换规则数组，按 priority 降序预排序
 *   registerTransition  — 外部注入规则的接口（供 SocialLayer / 镜头层等使用）
 *   _evaluateTransitions— 每帧求值：遍历规则，首个满足条件的规则触发
 *   _tickState          — 当前状态的 per-frame 行为（位置更新等，不含转换判断）
 *   tickBaseState       — 对外接口：stateTimer++ → _evaluateTransitions → _tickState
 *
 * 转换规则结构：
 *   {
 *     from:      'walk'  | 'any',          // 来源状态；'any' 不限状态
 *     to:        'stand' | null,            // 目标状态；null 时由 resolve 动态决定
 *     priority:  number,                   // 越大越优先，同帧内取最高优先级的第一条
 *     trigger:   string,                   // 日志用触发原因
 *     condition: (npc, envQuery, profile) => boolean,
 *     resolve?:  (npc, envQuery, profile) => string | null,
 *       // 有 resolve 时忽略 to；返回 null 表示本条规则跳过
 *   }
 *
 * priority 约定：
 *   1~9   普通日常（timeout 驱动，由 profile.transitions 权重表选目标）
 *   10~49 环境触发（靠近长椅/墙等，可主动打断日常计时，待扩展）
 *   50~98 社交触发（SocialLayer 外部注入，预留）
 *   99+   强制打断（animDone 驱动，fall/get_up 等不可被其他规则抢占）
 */

import { dlog } from './DebugLog.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── 状态定义（不含转换逻辑）────────────────────────────────────────────────
const STATE_DEFS = {
  walk:       { anim: 'walk',       speedK: 1.0, once: false, dur: [4, 10]  },
  run:        { anim: 'run',        speedK: 2.4, once: false, dur: [2, 4]   },
  jog:        { anim: 'jog',        speedK: 1.0, once: false, dur: null     },
  stand:      { anim: 'single',     speedK: 0,   once: false, dur: [3, 8]   },
  sit_bench:  { anim: 'sit_bench',  speedK: 0,   once: true,  dur: [8, 15]  },
  fall:       { anim: 'fall',       speedK: 0,   once: true,  dur: null     },
  lie_ground: { anim: 'lie_ground', speedK: 0,   once: true,  dur: [4, 8]   },
  lean_wall:  { anim: 'lean_wall',  speedK: 0,   once: true,  dur: [8, 20]  },
  squat:      { anim: 'squat',      speedK: 0,   once: true,  dur: [5, 15]  },
  sit_ground: { anim: 'sit_ground', speedK: 0,   once: true,  dur: [8, 20]  },
  lie_bench:  { anim: 'lie_bench',  speedK: 0,   once: true,  dur: [15, 40] },
  get_up:     { anim: 'get_up',     speedK: 0,   once: true,  dur: null     },
  talk:       { anim: 'single',     speedK: 0,   once: false, dur: null     },
  loiter:     { anim: 'single',     speedK: 0,   once: false, dur: null     },
  routing:    { anim: 'walk',       speedK: 1.0, once: false, dur: null     },
};

export { STATE_DEFS };

// ─── setState（对外 API；供 Activity / SocialLayer 等外部直接切换状态）──────
export function setState(npc, state, trigger = '?') {
  const def = STATE_DEFS[state];
  if (!def) return;
  const prev = npc.state;

  // 离开 sit_bench/lie_bench 时归还长椅占用；两态间转换保持占用
  if (npc._bench && state !== 'sit_bench' && state !== 'lie_bench') {
    npc._bench._occupiedBy = null;
    npc._bench = null;
  }

  // 离开 loiter 时清理微行为遗留（朝向 + overlayPose）
  if (prev === 'loiter' && state !== 'loiter') {
    npc.overlayPose = null;
    if (npc._loiterDir !== undefined) { npc.direction = npc._loiterDir; npc._loiterDir = undefined; }
  }

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
  if (npc.roam && (state === 'walk' || state === 'run')) npc.roamTarget = null;

  // 临时附加标签（随状态生灭）
  npc._extraTags = null;
  if (state === 'lie_bench') {
    npc._extraTags = (Math.random() < 0.2) ? ['resting', 'homeless'] : ['resting'];
  }
  if (state === 'loiter') {
    npc._loiterDur     = null;   // _tickLoiter 首帧初始化
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
  // 环境前置：不满足则回退 stand
  if (chosen === 'sit_bench'  && !envQuery.isNearBench(npc)) return 'stand';
  if (chosen === 'sit_ground' &&  envQuery.isNearBench(npc)) return 'stand';
  if (chosen === 'lean_wall'  && !envQuery.isNearWall(npc))  return 'stand';
  if (chosen === 'squat'      && !envQuery.isNearWall(npc))  return 'stand';
  if (chosen === 'lie_bench'  && npc.stateTimer < 12)        return 'stand';
  return chosen;
}

// ─── 内部：timeout 触发时解析最终目标（含 sit_bench 占位/对齐副作用）──────────
// resolve 函数里统一做副作用后返回目标状态名，_evaluateTransitions 再调 setState。
function _resolveTimeout(npc, envQuery, profile) {
  const next = _pickNext(npc, profile, envQuery);
  if (!next) return null;
  if (next === 'sit_bench') {
    const bench = envQuery.nearestFreeBench(npc, 80);
    if (!bench) return 'stand';    // 无空椅 → 回退站立
    bench._occupiedBy = npc.id;
    npc._bench = bench;
    // 对齐到椅心，夹在 NPC 自身活动带内（防人行道行人被吸到墙边椅）
    npc.x = Math.max(npc.minX, Math.min(npc.maxX, bench.x));
    npc.y = Math.max(npc.minY, Math.min(npc.maxY, bench.y));
    // TODO：lean_wall / lie_bench 等也需按 propType 做类似 snap 对齐
    return 'sit_bench';
  }
  return next;
}

// ─── 转换规则表 ───────────────────────────────────────────────────────────────
const TRANSITIONS = [

  // ── 99+：强制打断（animDone 驱动，优先级最高，任何其他规则无法抢占）────────
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

  // ── 1~9：日常 timeout（由 profile.transitions 权重表决定目标状态）─────────
  // 覆盖所有 stateDur 有限的状态；fall/get_up/jog/talk 的 stateDur=Infinity 自然跳过
  {
    from: 'any', to: null,
    priority: 5,    trigger: 'timeout',
    condition: (npc) => npc.stateDur < Infinity && npc.stateTimer >= npc.stateDur,
    resolve: _resolveTimeout,
  },

  // ── 10~49：环境触发（预留，后续扩展）────────────────────────────────────────
  // 示例：NPC 靠近长椅时主动坐下（不等 timeout），priority: 15
  // { from: 'stand', to: 'sit_bench', priority: 15, trigger: 'env-bench',
  //   condition: (npc, env) => env.isNearBench(npc) && Math.random() < 0.002,
  //   resolve: (npc, env) => { ... snap logic ... return 'sit_bench'; } }

  // ── 50~98：社交触发（预留，由 SocialLayer 通过 registerTransition 注入）──────
];

// 按优先级降序预排序（模块加载时执行一次；registerTransition 后也会重新排）
TRANSITIONS.sort((a, b) => b.priority - a.priority);

/**
 * 外部注入转换规则（SocialLayer / CameraReactionLayer 等使用）。
 * 注入后自动重新排序，保证优先级语义正确。
 * @param {object} rule - 同 TRANSITIONS 元素结构
 */
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
    if (target == null) continue;    // resolve 返回 null → 本规则跳过，继续下一条
    setState(npc, target, t.trigger);
    return;
  }
}

// ─── 当前状态的 per-frame 行为（纯行为，不含转换判断）────────────────────────
function _tickState(npc, envQuery, profile, dt) {
  // walk/run：逐帧转向漫游目标点（含避障）；routing：直奔槽位
  if (npc.state === 'routing' || (npc.roam && (npc.state === 'walk' || npc.state === 'run'))) {
    steerRoam(npc, envQuery, profile, dt);
  }
  // loiter：驱动内部微行为循环
  if (npc.state === 'loiter') {
    _tickLoiter(npc, profile, dt);
  }
}

// ─── Loiter 微行为循环 ────────────────────────────────────────────────────────
// phone-look pose：双手抬至胸前持机；bag-adjust pose：换手拎包（两组交替）
const POSE_PHONE = { l_elbow: [-9, -8], r_elbow: [9, -8], l_hand: [-4, -18], r_hand: [4, -18] };
const POSE_BAG_A = { r_elbow: [12, -8], r_hand: [16, -3] };
const POSE_BAG_B = { l_elbow: [-12, -8], l_hand: [-16, -3] };

function _getMicroActionDur(npc) {
  const ov = npc._loiterOverlay;
  if (ov === 'phone_call')                  return rand(3, 6);
  if (ov === 'phone_look')                  return rand(5, 10);
  if (npc._traits && npc._traits.smoker)    return rand(4, 6);
  if (npc.persistentOverlay === 'hold_bag') return rand(2, 3);
  if (npc._traits && npc._traits.walk_dog)  return rand(3, 5);  // TODO: 狗停下嗅地
  return rand(5, 8);
}

function _updateLoiterExtraTags(npc) {
  const base = ['standing', 'idle'];
  if (npc._microPhase !== 1) { npc._extraTags = base.slice(); return; }
  const ov = npc._loiterOverlay;
  if      (ov === 'phone_call')                 npc._extraTags = [...base, 'phone_call', 'communicating'];
  else if (ov === 'phone_look')                 npc._extraTags = [...base, 'phone_use', 'distracted'];
  else if (npc._traits && npc._traits.smoker)   npc._extraTags = [...base, 'smoking'];
  else if (npc._traits && npc._traits.walk_dog) npc._extraTags = [...base, 'dog_owner', 'watching'];
  else                                          npc._extraTags = [...base, 'phone_use', 'distracted'];
}

function _applyLoiterVisuals(npc) {
  if (npc._microPhase !== 1) { npc.overlayPose = null; return; }
  const ov = npc._loiterOverlay;
  if (ov === 'phone_call' || (npc._traits && npc._traits.smoker)) {
    npc.overlayPose = null;       // 各自 overlay 负责视觉（TODO）
  } else if (npc.persistentOverlay === 'hold_bag') {
    npc.overlayPose = (Math.floor(npc._loiterElapsed * 2) % 2 === 0) ? POSE_BAG_A : POSE_BAG_B;
  } else {
    npc.overlayPose = POSE_PHONE; // phone_look / walk_dog / 默认：低头看手机
  }
}

function _advanceMicroPhase(npc) {
  // 离开 check_around 时还原朝向
  if (npc._microPhase === 3 && npc._loiterDir !== undefined) {
    npc.direction  = npc._loiterDir;
    npc._loiterDir = undefined;
  }
  const next = (npc._microPhase + 1) % 4;
  npc._microPhase     = next;
  npc._microPhaseName = ['look_around', 'micro_action', 'look_around', 'check_around'][next];
  switch (next) {
    case 0: npc._microTimer = rand(3, 6);                break;
    case 1: npc._microTimer = _getMicroActionDur(npc);   break;
    case 2: npc._microTimer = rand(2, 4);                break;
    case 3:
      npc._microTimer = rand(1, 2);
      npc._loiterDir  = npc.direction;
      npc.direction   = -npc.direction;   // 短暂转身看另一个方向
      break;
  }
  _updateLoiterExtraTags(npc);
}

function _tickLoiter(npc, profile, dt) {
  // 首帧初始化（setState 将 _loiterDur 置 null 作为触发信号）
  if (npc._loiterDur === null) {
    const range         = profile.loiterDurationRange || [15, 45];
    npc._loiterDur      = rand(range[0], range[1]);
    npc._loiterElapsed  = 0;
    npc._loiterOverlay  = npc.overlay;   // 快照进入时的 overlay，供 micro_action 分派
    npc._microPhase     = 0;
    npc._microPhaseName = 'look_around';
    npc._microTimer     = rand(3, 6);
    _updateLoiterExtraTags(npc);
  }

  npc._loiterElapsed += dt;

  // 总时长耗尽 → 重新 walk
  if (npc._loiterElapsed >= npc._loiterDur) {
    setState(npc, 'walk', 'loiter-end');
    return;
  }

  npc._microTimer -= dt;
  if (npc._microTimer <= 0) _advanceMicroPhase(npc);

  _applyLoiterVisuals(npc);
}

// ─── 二维漫游转向：朝目标点的 seek + 切向避障（steering behavior）─────────────
function steerRoam(npc, envQuery, profile, dt) {
  // routing：直线奔赴目标槽位，不走随机漫游逻辑
  if (npc.state === 'routing') {
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
    const spd = npc.speed || 26;
    npc.x += (dx / dist) * spd * dt;
    npc.y += (dy / dist) * spd * dt;
    return;
  }

  if (!npc.roamTarget) pickRoamTarget(npc, envQuery);
  const t = npc.roamTarget;
  const dx = t.x - npc.x, dy = t.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) {
    const lc = profile && profile.loiterChance;
    if (lc && Math.random() < lc) { setState(npc, 'loiter', 'loiter-chance'); return; }
    pickRoamTarget(npc, envQuery);
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

  // 朝向防抖：阈值 + 冷却，杜绝原地左右乱闪
  npc._dirCD = (npc._dirCD || 0) - dt;
  const desired = vx >= 0 ? 1 : -1;
  if (Math.abs(vx) > total * 0.35 && desired !== npc.direction && npc._dirCD <= 0) {
    npc.direction = desired;
    npc._dirCD = 0.45;
  }
}

// 切向椭圆避障：在归一化椭圆空间里判断远近与法向，障碍在前方时沿其边缘绕行
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

function pickRoamTarget(npc, envQuery) {
  const r = npc.roam;
  let pt = null;
  for (let i = 0; i < 5; i++) {
    const c = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
    if (!envQuery.pointBlocked(c.x, c.y)) { pt = c; break; }
    pt = c;
  }
  npc.roamTarget = pt;
}

// ─── 离场系统 ─────────────────────────────────────────────────────────────────
/**
 * 将 NPC 路由到出口；离场全程不可打断（abandonAfter=999），到达后 alive=false。
 * 注意：调用前须确保 npc._departing = true 已设置。
 */
function _routeToExit(npc, exit) {
  const tx = exit.x;
  const ty = exit.y ?? npc.y;    // edge 出口跟随当前 Y，building 出口用固定 Y
  if (exit.facing !== 0) npc.direction = exit.facing;
  npc.roam = null;               // 关闭随机漫游
  // 清除随机 overlay；持久特征 hold_bag 保留
  if (npc.overlay && npc.overlay !== npc.persistentOverlay) npc.overlay = null;
  setState(npc, 'routing', 'departure');
  npc._routeTarget = {
    x: tx, y: ty,
    exitType: exit.type,         // 供 steerRoam 判断到达阈值（building=20，edge=8）
    abandonAfter: 999,           // 离场不放弃
    onArrive: (n) => { n.alive = false; },
  };
}

/**
 * 触发 NPC 离场：选出口 → 设 _departing → 进入 routing（或先站起再 routing）
 * 找不到出口时延长寿命 30s 后重试。
 * @param {object} exitRegistry - ExitRegistry 实例
 */
export function triggerDeparture(npc, exitRegistry) {
  if (!exitRegistry) return;
  const exit = exitRegistry.findExit(npc);
  if (!exit) { npc._lifespan += 30; return; }  // 无出口：延长寿命

  npc._departing = true;

  // 坐着/躺着/蹲着：先站起来，下一帧再进 routing
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

  // 延迟离场：上帧进入 stand，本帧立即进入 routing
  if (npc._pendingDeparture && npc.state === 'stand') {
    const exit = npc._pendingDeparture;
    npc._pendingDeparture = null;
    _routeToExit(npc, exit);
    return;
  }

  _evaluateTransitions(npc, profile, envQuery);   // 转换求值
  _tickState(npc, envQuery, profile, dt);         // per-state 行为（steerRoam 等）
}
