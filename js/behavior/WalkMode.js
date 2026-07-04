/**
 * WalkMode — NPC 走路模式子系统
 *
 * 三种模式：
 *   wander      在 bounds 区域内随机漂移（默认）
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

import { FAR_Y, NEAR_Y, PARK_TOP, BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM } from '../core/Layout.js';
import { setWalkMode, pushWalkMode, popWalkMode, setAnimation, setSpeed } from './Motor.js';
import { getNavGrid } from './nav/NavGrid.js';

// Re-export for backward-compat
// @deprecated — 兼容层，仅供 activities/*.js 过渡期；第三刀迁移完成后删除
export { setWalkMode, pushWalkMode, popWalkMode } from './Motor.js';

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

// ─── 斑马线注册 ──────────────────────────────────────────────────────────────────

let _CROSSWALKS = [];

export function initCrosswalks(list) {
  _CROSSWALKS = (list || []).map(cw => ({ x: cw.x }));
}

function _nearestCrosswalk(x) {
  if (!_CROSSWALKS.length) return null;
  let best = null, bestD = Infinity;
  for (const cw of _CROSSWALKS) {
    const d = Math.abs(x - cw.x);
    if (d < bestD) { bestD = d; best = cw; }
  }
  return best;
}

// TrafficSignal stub — always green; replace with real implementation when needed
// TODO: export real signal state and wire up to vehicle system
const TrafficSignal = { getState: (_x) => 'green' };

/**
 * 规划过马路（从当前侧到 targetY 所在侧）。
 *   守法：走最近斑马线入口 → 竖穿到对侧，_extraTags=['crossing_road']。
 *   乱穿：原地竖穿，切 run 动画，_extraTags=['jaywalking']。
 * onCrossed(npc) 在完成过马路后回调（可选）。
 */
export function planCrossing(npc, targetY, profile, onCrossed = null) {
  const jaywalkChance = profile?.jaywalkChance ?? 0.1;
  const goingDown = targetY > npc.y;
  const entryY = goingDown ? FAR_Y - 2  : NEAR_Y + 2;
  const exitY  = goingDown ? NEAR_Y + 2 : FAR_Y - 2;

  if (Math.random() < jaywalkChance) {
    npc._extraTags = ['jaywalking'];
    setAnimation(npc, 'run');
    setSpeed(npc, (npc.walkSpeed || 26) * 2.4);
    pushWalkMode(npc, modeDirect({ x: npc.x, y: exitY }, (n) => {
      n._extraTags = null;
      setAnimation(n, 'walk');
      setSpeed(n, n.walkSpeed || 26);
      if (onCrossed) onCrossed(n);
    }, 30));
  } else {
    const cw = _nearestCrosswalk(npc.x);
    const cwX = cw ? cw.x : npc.x;
    // TODO: if (TrafficSignal.getState(cwX) === 'red') { /* wait */ }
    pushWalkMode(npc, modeDirect({ x: cwX, y: entryY }, (n) => {
      n._extraTags = ['crossing_road'];
      setWalkMode(n, modeDirect({ x: cwX, y: exitY }, (n2) => {
        n2._extraTags = null;
        popWalkMode(n2);
        if (onCrossed) onCrossed(n2);
      }, 30));
    }, 60));
  }
}

// ─── 预定义路线（运行时从 scene.json 注入）──────────────────────────────────────
// waypoints: [{x, y, pause?}]  pause = 到达后停留秒数（缺省/0 = 不停留）

let WALK_PATHS = {};

export { WALK_PATHS };

export function initWalkPaths(paths) { WALK_PATHS = paths || {}; }

/** 动态注入单条路线 */
export function addWalkPath(key, def) { WALK_PATHS[key] = def; }

// ─── 模式描述符工厂 ───────────────────────────────────────────────────────────

/** 漫游模式（默认行为，在 bounds 区域内随机选点） */
export function modeWander(bounds = null, maxDuration = null) {
  return { kind: 'wander', bounds, maxDuration, _elapsed: 0 };
}

/**
 * 直线目标模式
 * @param {{x,y}}  target       目标世界坐标
 * @param {Function|null} onArrive  到达回调 (npc) => void；到达后模式自动切回 wander
 * @param {number} abandonAfter  超时放弃（秒），避免卡死
 */
export function modeDirect(target, onArrive = null, abandonAfter = 60, nextTarget = null) {
  return { kind: 'direct', target, onArrive, abandonAfter, _elapsed: 0, nextTarget };
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

// ─── 区域自动切换（安全网）────────────────────────────────────────────────────

/** 是否在自行车道区（两侧自行车道） */
function isBikeLaneZone(y) {
  return (y >= BIKE_LANE_FAR_TOP && y < FAR_Y) ||
         (y >= NEAR_Y && y < BIKE_LANE_NEAR_BOTTOM);
}

/**
 * 检测 wander NPC 是否误入马路或自行车道，若是则自动压栈并切 direct 穿越到安全区。
 * 建议由 BehaviorManager 在每帧（或每 N 帧）调用。
 */
export function checkZoneTransition(npc) {
  if (!npc._walkMode || npc._departing) return;
  if (npc.state !== 'walk' && npc.state !== 'run') return;
  if (npc._walkMode.kind !== 'wander') return;   // direct/path_follow 自行负责区域

  const inRoad     = isRoadZone(npc.y);
  const inBikeLane = !inRoad && isBikeLaneZone(npc.y);
  if (!inRoad && !inBikeLane) return;

  // 误入危险区：压栈，弹回原侧
  const goingDown = (npc.vy ?? 0) >= 0;
  const targetY   = goingDown ? BIKE_LANE_FAR_TOP - 4 : BIKE_LANE_NEAR_BOTTOM + 4;
  pushWalkMode(npc, modeDirect(
    { x: npc.x, y: targetY },
    (n) => { popWalkMode(n); },
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
    if (!mode._sanitized) {
      const grid = getNavGrid();
      if (grid) mode.target = grid.nearestWalkable(mode.target.x, mode.target.y);
      mode._sanitized = true;
    }
    npc.roamTarget = mode.target;
    return;
  }

  if (mode.kind === 'path_follow') {
    if (mode.pausing) return;   // 暂停中：保持 roamTarget=null，steerRoam 检测到后停止

    if (mode.wpIndex >= mode.waypoints.length) {
      if (mode.loop) {
        mode.wpIndex = 0;
      } else {
        setWalkMode(npc, modeWander());
        _pickRandom(npc, envQuery);
        return;
      }
    }
    const wp = mode.waypoints[mode.wpIndex];
    npc.roamTarget = { x: wp.x, y: wp.y };
  }
}

function _pickRandom(npc, envQuery) {
  const r = npc._walkMode?.bounds;
  if (!r) {
    const grid = getNavGrid();
    if (!grid) { npc.roamTarget = null; return; }
    for (let i = 0; i < 5; i++) {
      const pt = grid.sampleWalkableNear(npc, 350);
      if (!pt) break;
      if (!envQuery.raycastObstacle(npc.x, npc.y, pt.x, pt.y)) {
        npc.roamTarget = pt;
        return;
      }
    }
    npc.roamTarget = null;
    return;
  }
  for (let i = 0; i < 5; i++) {
    const c = { x: rand(r.x0, r.x1), y: rand(r.y0, r.y1) };
    if (envQuery.pointBlocked(c.x, c.y)) continue;
    if (envQuery.raycastObstacle(npc.x, npc.y, c.x, c.y)) continue;
    npc.roamTarget = c;
    return;
  }
  npc.roamTarget = null;  // 5 次均失败，保持原地直到下帧再试
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
      setWalkMode(npc, modeWander());
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

// ─── 简单导航辅助 ─────────────────────────────────────────────────────────────

function _crossSide(y1, y2) {
  const side = y => (y < FAR_Y ? 0 : y >= NEAR_Y ? 1 : -1);
  const s1 = side(y1), s2 = side(y2);
  return s1 >= 0 && s2 >= 0 && s1 !== s2;
}

/**
 * 规划从 npc 当前位置到 target 的一次行程（不用 PathPlanner）。
 * 跨侧时先 planCrossing，再 modeDirect；同侧直接 modeDirect。
 * GotoTask / StrollTask 使用 PathPlanner 获得更精确的路径；
 * planLegs 供简单场景（无需绕障）快速设置目标。
 *
 * @param {{x:number, y:number}} target
 * @param {number} timeout  放弃超时（秒）
 * @param {Function|null} onDone  到达回调 (npc) => void
 */
export function planLegs(npc, target, timeout = 60, onDone = null) {
  if (_crossSide(npc.y, target.y ?? npc.y)) {
    planCrossing(npc, target.y, npc._profile, (n) => {
      setWalkMode(n, modeDirect(target, onDone, timeout));
    });
  } else {
    setWalkMode(npc, modeDirect(target, onDone, timeout));
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

  if (mode.kind === 'wander') {
    if (mode.maxDuration != null) {
      mode._elapsed = (mode._elapsed ?? 0) + dt;
      if (mode._elapsed >= mode.maxDuration) {
        setWalkMode(npc, modeWander());
      }
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
