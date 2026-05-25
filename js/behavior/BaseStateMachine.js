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
function _tickState(npc, envQuery, dt) {
  // walk/run：逐帧转向漫游目标点（含避障）
  if (npc.roam && (npc.state === 'walk' || npc.state === 'run')) {
    steerRoam(npc, envQuery, dt);
  }
}

// ─── 二维漫游转向：朝目标点的 seek + 切向避障（steering behavior）─────────────
function steerRoam(npc, envQuery, dt) {
  if (!npc.roamTarget) pickRoamTarget(npc, envQuery);
  const t = npc.roamTarget;
  const dx = t.x - npc.x, dy = t.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) { pickRoamTarget(npc, envQuery); return; }

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

// ─── 对外主接口：每帧推进单个 NPC 的基础状态 ──────────────────────────────────
export function tickBaseState(npc, profile, envQuery, dt) {
  npc.stateTimer += dt;
  _evaluateTransitions(npc, profile, envQuery);   // 转换求值（不含 setState 的纯行为）
  _tickState(npc, envQuery, dt);                  // per-state 行为（steerRoam 等）
}
