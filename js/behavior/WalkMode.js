/**
 * WalkMode — NPC 走路模式子系统
 *
 * 三种模式：
 *   wander      在 npc.roam 区域内随机漂移（默认）
 *   direct      直线奔赴指定目标点，到达后回调并切回 wander
 *   path_follow 沿 WALK_PATHS 中预定义的 waypoint 序列行走，支持途中暂停
 *
 * 区域约束：
 *   马路区（FAR_Y ≤ y < NEAR_Y）只允许 direct/path_follow，不允许暂停。
 *   wander NPC 闯入马路时 checkZoneTransition 会自动压栈并切 direct 穿越。
 *
 * 与现有系统接入：
 *   tickWalkMode   — 在 _tickState 内、steerRoam 之前调用（管理暂停计时 / 超时）
 *   pickModeTarget — 替代 BaseStateMachine 中的 pickRoamTarget（目标选取分派）
 *   onPathArrival  — steerRoam 到达 waypoint 时调用（前进 / 暂停判断）
 *   setWalkMode / pushWalkMode / popWalkMode — 模式切换 / 优先级打断保存恢复
 */

import { FAR_Y, NEAR_Y, PARK_TOP } from '../Layout.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ─── 区域判断 ─────────────────────────────────────────────────────────────────

/** 返回 Y 坐标所在区域名 */
export function zoneOf(y) {
  if (y < FAR_Y)    return 'far_sidewalk';
  if (y < NEAR_Y)   return 'road';
  if (y < PARK_TOP) return 'near_sidewalk';
  return 'park';
}

/** 是否在机动车道区（FAR_Y ≤ y < NEAR_Y） */
export function isRoadZone(y) {
  return y >= FAR_Y && y < NEAR_Y;
}

// ─── 预定义路线 ───────────────────────────────────────────────────────────────
// waypoints: [{x, y, pause?}]  pause = 到达后停留秒数（缺省/0 = 不停留）
// SceneConfig（Layout.js）导出常量供路线与场景几何保持一致。

export const WALK_PATHS = {
  // 远端人行道 左→右（单程）
  sidewalk_far_lr: {
    waypoints: [
      { x: 60,   y: 230 },
      { x: 500,  y: 232 },
      { x: 1000, y: 228 },
      { x: 1500, y: 231 },
      { x: 1940, y: 230 },
    ],
    loop: false,
  },
  // 远端人行道 右→左（单程）
  sidewalk_far_rl: {
    waypoints: [
      { x: 1940, y: 230 },
      { x: 1500, y: 231 },
      { x: 1000, y: 228 },
      { x: 500,  y: 232 },
      { x: 60,   y: 230 },
    ],
    loop: false,
  },
  // 公园顺时针环形散步路线（loop）
  park_loop_cw: {
    waypoints: [
      { x: 350,  y: 390 },
      { x: 700,  y: 368 },
      { x: 1150, y: 374, pause: 1.5 },   // 喷泉前驻足
      { x: 1600, y: 394 },
      { x: 1850, y: 448 },
      { x: 1500, y: 492 },
      { x: 900,  y: 502, pause: 1.0 },
      { x: 400,  y: 470 },
    ],
    loop: true,
  },
};

// ─── 模式描述符工厂 ───────────────────────────────────────────────────────────

/** 漫游模式（默认行为，在 roam 区域内随机选点） */
export function modeWander() {
  return { kind: 'wander' };
}

/**
 * 直线目标模式
 * @param {{x,y}}  target       目标世界坐标
 * @param {Function|null} onArrive  到达回调 (npc) => void；到达后模式自动切回 wander
 * @param {number} abandonAfter  超时放弃（秒），避免卡死
 */
export function modeDirect(target, onArrive = null, abandonAfter = 60) {
  return { kind: 'direct', target, onArrive, abandonAfter, _elapsed: 0 };
}

/**
 * 路线跟随模式
 * @param {string} pathKey    WALK_PATHS 中的路线键名
 * @param {number} startIndex 起始 waypoint 下标（默认 0）
 */
export function modePathFollow(pathKey, startIndex = 0) {
  const def = WALK_PATHS[pathKey];
  if (!def) return modeWander();   // 找不到路线则降级
  return {
    kind:       'path_follow',
    pathKey,
    waypoints:  def.waypoints,
    loop:       def.loop ?? false,
    wpIndex:    startIndex,
    pausing:    false,
    pauseTimer: 0,
  };
}

// ─── 模式管理 API ─────────────────────────────────────────────────────────────

/** 直接设置模式（清除旧目标，不保存历史） */
export function setWalkMode(npc, desc) {
  npc._walkMode      = desc;
  npc._walkModeStack = npc._walkModeStack ?? [];
  npc.roamTarget     = null;
}

/**
 * 压栈并设新模式（优先级打断用）
 * 调用方负责在合适时机调用 popWalkMode 恢复。
 */
export function pushWalkMode(npc, desc) {
  npc._walkModeStack = npc._walkModeStack ?? [];
  if (npc._walkMode) npc._walkModeStack.push(npc._walkMode);
  npc._walkMode  = desc;
  npc.roamTarget = null;
}

/** 弹出并恢复上一个模式（打断结束后调用） */
export function popWalkMode(npc) {
  const stack = npc._walkModeStack;
  if (!stack?.length) return;
  npc._walkMode  = stack.pop();
  npc.roamTarget = null;
}

// ─── 区域自动切换（安全网）────────────────────────────────────────────────────

/**
 * 检测 wander NPC 是否误入马路，若是则自动压栈并切 direct 穿越到对侧。
 * 建议由 BehaviorManager 在每帧（或每 N 帧）调用。
 */
export function checkZoneTransition(npc) {
  if (!npc._walkMode || npc._departing) return;
  if (npc.state !== 'walk' && npc.state !== 'run') return;
  if (npc._walkMode.kind !== 'wander') return;   // direct/path_follow 自行负责区域
  if (!isRoadZone(npc.y)) return;

  // wander NPC 闯入马路：压栈，切 direct 直穿对侧路沿
  const targetY = (npc.vy ?? 0) >= 0 ? NEAR_Y - 4 : FAR_Y + 4;
  pushWalkMode(npc, modeDirect(
    { x: npc.x, y: targetY },
    (n) => { popWalkMode(n); },   // 到达后恢复原模式
    20,
  ));
}

// ─── 目标点选取（替代 BaseStateMachine 中的 pickRoamTarget）──────────────────

/**
 * 根据当前 walk mode 选取下一个 roamTarget。
 * 在 steerRoam 内 roamTarget == null 时调用。
 */
export function pickModeTarget(npc, envQuery) {
  const mode = npc._walkMode;

  if (!mode || mode.kind === 'wander') {
    _pickRandom(npc, envQuery);
    return;
  }

  if (mode.kind === 'direct') {
    npc.roamTarget = mode.target;
    return;
  }

  if (mode.kind === 'path_follow') {
    if (mode.pausing) return;   // 暂停中：保持 roamTarget=null，steerRoam 检测到后停止

    if (mode.wpIndex >= mode.waypoints.length) {
      if (mode.loop) {
        mode.wpIndex = 0;
      } else {
        npc._walkMode = modeWander();
        _pickRandom(npc, envQuery);
        return;
      }
    }
    const wp = mode.waypoints[mode.wpIndex];
    npc.roamTarget = { x: wp.x, y: wp.y };
  }
}

function _pickRandom(npc, envQuery) {
  const r = npc.roam;
  if (!r) return;
  let pt = null;
  for (let i = 0; i < 5; i++) {
    const c = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
    if (!envQuery.pointBlocked(c.x, c.y)) { pt = c; break; }
    pt = c;
  }
  npc.roamTarget = pt;
}

// ─── Waypoint 到达处理 ────────────────────────────────────────────────────────

/**
 * steerRoam 检测到 path_follow NPC 到达当前 waypoint 时调用。
 * 处理暂停（马路区跳过暂停）、前进到下一 waypoint、路线结束。
 */
export function onPathArrival(mode, npc) {
  const wp = mode.waypoints[mode.wpIndex];
  const pauseDur = (wp?.pause ?? 0);

  mode.wpIndex++;   // 先前进，再判断边界

  if (mode.wpIndex >= mode.waypoints.length) {
    if (mode.loop) {
      mode.wpIndex = 0;
    } else {
      npc._walkMode  = modeWander();
      npc.roamTarget = null;
      return;
    }
  }

  // 马路区强制跳过暂停，避免 NPC 在路中驻足
  if (pauseDur > 0 && !isRoadZone(npc.y)) {
    mode.pausing    = true;
    mode.pauseTimer = pauseDur;
    npc.roamTarget  = null;   // 暂停期间 steerRoam 检测到 null 且 pausing=true → 停止
  } else {
    npc.roamTarget = null;    // 下帧 pickModeTarget 取下一 waypoint
  }
}

// ─── 每帧 tick ────────────────────────────────────────────────────────────────

/**
 * 每帧在 steerRoam 之前调用（由 _tickState 驱动）。
 * 仅处理时间驱动的内部状态：path_follow 暂停计时、direct 超时放弃。
 * 到达检测由 steerRoam 负责。
 */
export function tickWalkMode(npc, dt) {
  const mode = npc._walkMode;
  if (!mode) return;

  if (mode.kind === 'path_follow' && mode.pausing) {
    mode.pauseTimer -= dt;
    if (mode.pauseTimer <= 0) {
      mode.pausing   = false;
      npc.roamTarget = null;   // 解锁，下帧 pickModeTarget 取下一 waypoint
    }
    return;
  }

  if (mode.kind === 'direct') {
    mode._elapsed = (mode._elapsed ?? 0) + dt;
    if (mode._elapsed > (mode.abandonAfter ?? 60)) {
      setWalkMode(npc, modeWander());
    }
  }
}
