/**
 * BaseStateMachine — 单个 NPC 的基础状态机（无全局状态）
 *
 * 由 BehaviorManager 对每个"未被 Activity 锁定"的 NPC 每帧调用一次 tickBaseState。
 * 状态转换读 profile.transitions（按权重随机），并检查环境前置条件；
 * 同时复刻重构前的二维漫游转向逻辑。
 *
 * 仅设置 npc.state / animation / speed / vy / 计时 / 朝向等字段，
 * 实际位移与帧推进仍由 NPC.update（经 EntityManager.update）执行。
 */

import { dlog } from './DebugLog.js';

const rand = (a, b) => a + Math.random() * (b - a);

// 状态 → 动画 / 速度系数 / 是否单次播放 / 时长区间(秒, null=无计时/由动画驱动)
const STATE_DEFS = {
  walk:       { anim: 'walk',       speedK: 1.0, once: false, dur: [4, 10] },
  run:        { anim: 'run',        speedK: 2.4, once: false, dur: [2, 4]  },
  jog:        { anim: 'jog',        speedK: 1.0, once: false, dur: null    },
  stand:      { anim: 'single',     speedK: 0,   once: false, dur: [3, 8]  },
  sit_bench:  { anim: 'sit_bench',  speedK: 0,   once: true,  dur: [8, 15] },
  fall:       { anim: 'fall',       speedK: 0,   once: true,  dur: null    },
  lie_ground: { anim: 'lie_ground', speedK: 0,   once: true,  dur: [4, 8]  },
  // 批次 1 新增的路人基础状态
  lean_wall:  { anim: 'lean_wall',  speedK: 0,   once: true,  dur: [8, 20] },
  squat:      { anim: 'squat',      speedK: 0,   once: true,  dur: [5, 15] },
  sit_ground: { anim: 'squat',      speedK: 0,   once: true,  dur: [8, 20] }, // TODO: 待制作 sit_ground.json，暂复用 squat
  lie_bench:  { anim: 'lie_bench',  speedK: 0,   once: true,  dur: [15, 40] },
  get_up:     { anim: 'get_up',     speedK: 0,   once: true,  dur: null    }, // 由 animDone 驱动
  talk:       { anim: 'single',     speedK: 0,   once: false, dur: null    },
};

export { STATE_DEFS };

// ─── 进入某状态：设置动画/速度/计时/帧，重置漫游目标 ───────────────────────────
export function setState(npc, state, trigger = '?') {
  const def = STATE_DEFS[state];
  if (!def) return;
  const prev = npc.state;

  // 释放长椅占用：离开 sit_bench/lie_bench 之外的状态时归还（两态间转换保持占用）
  if (npc._bench && state !== 'sit_bench' && state !== 'lie_bench') {
    npc._bench._occupiedBy = null;
    npc._bench = null;
  }

  npc.state      = state;
  npc.stateTimer = 0;
  npc.stateDur   = def.dur ? rand(def.dur[0], def.dur[1]) : Infinity;
  npc.animation  = def.anim;
  npc.speed      = def.speedK * (npc.walkSpeed || 26);
  npc.vy         = 0;            // 纵深速度由漫游转向逐帧设定；非移动态归零防漂移
  npc.playOnce   = def.once;
  npc.animDone   = false;
  npc.frameIndex = 0;
  npc.frameTimer = 0;
  // 漫游 NPC 每次进入 walk/run 重新挑选目标点 → 路径更自然多变
  if (npc.roam && (state === 'walk' || state === 'run')) npc.roamTarget = null;

  // 临时附加标签（随状态生灭）：躺长椅时 resting，小概率 homeless
  npc._extraTags = null;
  if (state === 'lie_bench') {
    npc._extraTags = (Math.random() < 0.2) ? ['resting', 'homeless'] : ['resting'];
  }

  // 结构化日志：仅记录真正的状态切换（忽略 null→初始）
  if (prev && prev !== state) {
    const dur = npc.stateDur === Infinity ? '∞' : npc.stateDur.toFixed(1) + 's';
    const extra = npc._extraTags ? `, extra_tags=[${npc._extraTags.join(',')}]` : '';
    dlog(`[NPC-${npc.id}] ${prev} → ${state} (dur=${dur}, trigger=${trigger}${extra})`);
  }
}

// ─── 按权重从 transitions 表选下一状态（含环境前置检查） ────────────────────────
function pickNext(npc, profile, envQuery) {
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
  // 不在允许集合内的状态丢弃
  if (!profile.allowedStates.includes(chosen)) return null;
  // 环境前置（不满足则回退站立）：
  if (chosen === 'sit_bench'  && !envQuery.isNearBench(npc)) return 'stand'; // 需附近有长椅
  if (chosen === 'sit_ground' &&  envQuery.isNearBench(npc)) return 'stand'; // 附近有椅则不坐地上
  if (chosen === 'lean_wall'  && !envQuery.isNearWall(npc))  return 'stand'; // 需靠近建筑墙面
  if (chosen === 'squat'      && !envQuery.isNearWall(npc))  return 'stand'; // 蹲下只在靠墙时
  if (chosen === 'lie_bench'  && npc.stateTimer < 12)        return 'stand'; // 需久坐后才躺下
  return chosen;
}

// ─── 进入 sit_bench：对齐到最近空闲长椅并标记占用；无空椅则回退 stand ──────────
function enterSitBench(npc, envQuery) {
  const bench = envQuery.nearestFreeBench(npc, 80);
  if (!bench) { setState(npc, 'stand', 'timeout'); return; }
  bench._occupiedBy = npc.id;
  npc._bench = bench;
  setState(npc, 'sit_bench', 'timeout');
  // 对齐到椅心 / 椅脚线，但夹在 NPC 自身活动带内（防止前人行道行人被吸到墙边椅）
  npc.x = Math.max(npc.minX, Math.min(npc.maxX, bench.x));
  npc.y = Math.max(npc.minY, Math.min(npc.maxY, bench.y));
  // TODO（批次 1+）：lean_wall / lie_bench 等也需按 propType 做类似 snap 对齐
}

// ─── 二维漫游转向：朝目标点的 seek + 切向避障（steering behavior）─────────────
function steerRoam(npc, envQuery, dt) {
  if (!npc.roamTarget) pickRoamTarget(npc, envQuery);
  const t = npc.roamTarget;
  const dx = t.x - npc.x, dy = t.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) { pickRoamTarget(npc, envQuery); return; }

  const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
  // 期望速度（指向目标）+ 避障偏移
  let vx = dx / dist * total, vy = dy / dist * total;
  const av = avoidObstacles(npc, vx, vy, envQuery);
  vx += av.x; vy += av.y;
  // 归一回 total 大小，避免叠加后超速
  const mag = Math.hypot(vx, vy) || 1;
  vx = vx / mag * total; vy = vy / mag * total;
  npc.speed = Math.abs(vx);
  npc.vy    = vy;

  // 朝向防抖：阈值 + 冷却。水平分量太小不翻；翻转后 0.45s 内不再翻，杜绝原地左右乱闪
  npc._dirCD = (npc._dirCD || 0) - dt;
  const desired = vx >= 0 ? 1 : -1;
  if (Math.abs(vx) > total * 0.35 && desired !== npc.direction && npc._dirCD <= 0) {
    npc.direction = desired;
    npc._dirCD = 0.45;
  }
}

// 切向椭圆避障：在"归一化椭圆空间"里判断远近与法向，障碍在前方时沿其边缘绕行
// （切向为主 + 少量径向保持距离），避免纯径向排斥与 seek 正面抵消导致原地抖动/卡死。
function avoidObstacles(npc, vx, vy, envQuery) {
  let ax = 0, ay = 0;
  const speed = Math.hypot(vx, vy) || 1;
  const fx = vx / speed, fy = vy / speed;            // 前进单位向量
  const base = npc.walkSpeed || 26;
  const npcR = 12;
  for (const o of envQuery.getObstacles(npc.x, npc.y, 46)) {
    const ox = npc.x - o.x, oy = npc.y - o.y;        // 障碍 → NPC（世界空间）
    // 椭圆归一化空间里的标量距离 sd：<1 在碰撞体内，1..1.8 为影响圈
    const rx = o.collisionRX + npcR, ry = o.collisionRY + npcR;
    const sd = Math.hypot(ox / rx, oy / ry) || 0.001;
    if (sd > 1.8) continue;

    // 已穿入：沿径向把 NPC 精确弹回椭圆表面（不论前后，保证不重叠）
    if (sd < 1) { npc.x = o.x + ox / sd; npc.y = o.y + oy / sd; }

    const d = Math.hypot(ox, oy) || 0.001;
    const dot = (-ox / d) * fx + (-oy / d) * fy;     // NPC→障碍 与前进方向夹角
    if (dot < 0.2) continue;                          // steering 只规避前方障碍

    const prox = Math.max(0, 1 - (sd - 1) / 0.8);     // 越近越强（sd:1→1.8 映射 1→0）
    if (prox <= 0) continue;

    // 外法向（椭圆梯度方向，指向 NPC 外侧）
    let gx = ox / (rx * rx), gy = oy / (ry * ry);
    const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
    // 切向（垂直于法向，取与前进方向同侧 → 自然绕过）
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
  for (let i = 0; i < 5; i++) {                       // 最多重试 5 次避开障碍
    const c = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
    if (!envQuery.pointBlocked(c.x, c.y)) { pt = c; break; }
    pt = c;                                           // 退而求其次：保留最后一次（steering 会绕开）
  }
  npc.roamTarget = pt;
}

// ─── 每帧推进单个 NPC 的基础状态 ──────────────────────────────────────────────
export function tickBaseState(npc, profile, envQuery, dt) {
  npc.stateTimer += dt;
  const st = npc.state;

  // 特判：动画驱动的转换（fall/get_up 播完即切换），其余走计时 + 权重表
  if (st === 'fall') {
    if (npc.animDone) setState(npc, 'lie_ground', 'anim-done');
  } else if (st === 'get_up') {
    if (npc.animDone) setState(npc, 'stand', 'anim-done');
  } else if (npc.stateTimer >= npc.stateDur) {
    const next = pickNext(npc, profile, envQuery);
    if (next === 'sit_bench') enterSitBench(npc, envQuery);   // 需对齐长椅 + 占用
    else if (next)            setState(npc, next, 'timeout');
  }

  // 漫游 NPC 在 walk/run 态逐帧转向目标点（含避障）
  if (npc.roam && (npc.state === 'walk' || npc.state === 'run')) steerRoam(npc, envQuery, dt);
}
