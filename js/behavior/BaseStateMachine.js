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
  if (chosen === 'lie_bench'  && npc.stateTimer < 12)        return 'stand'; // 需久坐后才躺下
  return chosen;
}

// ─── 二维漫游转向：把"朝目标点"的速度分解到水平 speed + 纵深 vy ──────────────────
function steerRoam(npc) {
  if (!npc.roamTarget) pickRoamTarget(npc);
  const t = npc.roamTarget;
  const dx = t.x - npc.x;
  const dy = t.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) { pickRoamTarget(npc); return; }
  const total = (npc.walkSpeed || 26) * (npc.state === 'run' ? 2.4 : 1);
  npc.direction = dx >= 0 ? 1 : -1;
  npc.speed     = Math.abs(dx) / dist * total;
  npc.vy        = dy / dist * total;
}

function pickRoamTarget(npc) {
  const r = npc.roam;
  npc.roamTarget = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
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
    if (next) setState(npc, next, 'timeout');
  }

  // 漫游 NPC 在 walk/run 态逐帧转向目标点
  if (npc.roam && (npc.state === 'walk' || npc.state === 'run')) steerRoam(npc);
}
