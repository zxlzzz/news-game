/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 组合各行为层，对所有被托管的 NPC 每帧驱动：
 *   - SocialLayer：tick 所有 Activity（对话/下棋/遛狗）+ 周期性配对新对话
 *   - 自由 NPC（未被 Activity 锁定）：BaseStateMachine + ModifierLayer
 *   - CameraReactionLayer：镜头反应（本次留空）
 *
 * 行为差异由 NpcProfile 数据驱动；NPC 通过 register(npc, profileName) 纳入框架。
 *
 * 注意：本类只设置状态/动画/速度/朝向，实际位移与帧推进仍由 NPC.update
 *       （经 EntityManager.update）执行。每帧顺序：behaviorManager.update() →
 *       entityManager.update()。
 */

import { getProfile }          from './behavior/NpcProfile.js';
import { EnvironmentQuery }     from './behavior/EnvironmentQuery.js';
import { tickBaseState, setState, registerTransition, triggerDeparture, initPoseCache as initBsmPoseCache } from './behavior/BaseStateMachine.js';
import { tickModifiers, initPoseCache as initModPoseCache } from './behavior/ModifierLayer.js';
import { SocialLayer }          from './behavior/SocialLayer.js';
import { CameraReactionLayer }  from './behavior/CameraReactionLayer.js';
import { WaitForBusLayer }      from './behavior/WaitForBusLayer.js';
import { refreshDebugFlag }     from './behavior/DebugLog.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class BehaviorManager {
  /** @param {EntityManager} entityManager @param {object} poseCache */
  constructor(entityManager, poseCache) {
    this.em          = entityManager;
    this.envQuery    = new EnvironmentQuery(entityManager);
    this.poseCache   = poseCache;

    if (poseCache) {
      initModPoseCache(poseCache);
      initBsmPoseCache(poseCache);
    }

    this.socialLayer = new SocialLayer(this.envQuery, poseCache);
    this.cameraLayer = new CameraReactionLayer();
    this.npcs            = [];
    this.waitForBusLayer = null;

    const sl = this.socialLayer;

    // 加入已在进行的多人 Smart Object（棋局旁观 / 摊位买东西）：
    // 行走中的普通行人低概率发现「已被占用、但仍有空闲 role 槽位」的道具并前往加入。
    // requireOccupied=true 保证目标已有主活动（棋手在下 / 摊主在卖），到位即加入。
    const registerJoinRoute = (activityType, activityFlag, role, defaultChance, radius) => {
      registerTransition({
        from: 'walk', to: 'routing', priority: 10,
        trigger: 'smart-object',
        condition: (npc, env, profile) => {
          if (npc._departing) return false;
          if (!profile?.activities?.includes(activityFlag)) return false;
          const p = profile.smartObjectChance?.[activityFlag] ?? defaultChance;
          if (Math.random() > p) return false;
          const found = env.findAvailableSlot(activityType, npc, radius, { role, requireOccupied: true });
          if (!found) return false;
          const { prop, slot } = found;
          slot.reserved = npc.id;
          npc._routeTarget = {
            x: prop.x + slot.dx,
            y: prop.y + slot.dy,
            prop, slot,
            abandonAfter: 25,
            onArrive: (n) => sl.onSlotArrival(n, prop, slot),
          };
          return true;
        },
      });
    };
    registerJoinRoute('chess', 'chess_onlooker', 'onlooker', 0.003, 220);
    registerJoinRoute('stall', 'stall_buyer',   'buyer',    0.003, 220);

    // 单人 Smart Object（自动贩卖机 / 垃圾桶）：行走中低概率发现附近空闲机器并前往
    const registerSmartObjectRoute = (activityType, defaultChance, radius) => {
      registerTransition({
        from: 'walk', to: 'routing', priority: 10,
        trigger: 'smart-object',
        condition: (npc, env, profile) => {
          if (npc._departing) return false;
          if (!profile?.activities?.includes(activityType)) return false;
          const p = profile.smartObjectChance?.[activityType] ?? defaultChance;
          if (Math.random() > p) return false;
          const found = env.findAvailableSlot(activityType, npc, radius);
          if (!found) return false;
          const { prop, slot } = found;
          slot.reserved = npc.id;
          npc._routeTarget = {
            x: prop.x + slot.dx,
            y: prop.y + slot.dy,
            prop, slot,
            abandonAfter: 25,
            onArrive: (n) => sl.onSlotArrival(n, prop, slot),
          };
          return true;
        },
      });
    };
    registerSmartObjectRoute('use_vending', 0.002, 150);
    registerSmartObjectRoute('use_trash',   0.002, 150);
  }

  /** 注册 NPC 并指定行为档案；返回该 NPC */
  register(npc, profileName = 'pedestrian') {
    npc._profile  = getProfile(profileName);
    npc._activity = null;   // 当前参与的 Activity（null = 自由）
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(20, 34);
    this.npcs.push(npc);
    setState(npc, npc._profile.initial || 'walk');
    return npc;
  }

  update(delta) {
    const dt = delta / 1000;
    refreshDebugFlag();   // 缓存当帧 npc-debug 开关，供各层日志使用

    // 1) Activity 层（tick 所有 Activity + 尝试新配对）
    this.socialLayer.update(this.npcs, dt);

    // 2) WaitForBusLayer 扫描（有 busStops 时才启用）
    if (this.waitForBusLayer) this.waitForBusLayer.update(this.npcs, dt);

    // 3) 自由 NPC（未被 Activity 锁定）走基础状态机 + 叠加动作
    // 计算全局 held 比例，传入 ModifierLayer 做频率上限
    const heldCount = this.npcs.filter(n =>
      n.alive && n.modifiers?.some(m => m.kind === 'held' && !m.id.startsWith('_'))
    ).length;
    const globalHeldFrac = this.npcs.length > 0 ? heldCount / this.npcs.length : 0;

    for (const npc of this.npcs) {
      if (!npc.alive || npc._activity) continue;

      // 等车 NPC：由 WaitForBusLayer 管理状态（stand/loiter 交替）
      // boarding 中的 NPC（routing 状态）仍需 tickBaseState 驱动 steerRoam
      if (npc._waitingBusStop && npc.state !== 'routing') {
        if (this.waitForBusLayer) this.waitForBusLayer.tickWaiter(npc, dt);
        continue;
      }

      // 年龄计时 + 离场触发（仅对有 lifespan 的 NPC 生效，_departing 后不再计时）
      if (!npc._departing && npc._lifespan != null && !npc._waitingBusStop) {
        npc._ageTimer = (npc._ageTimer || 0) + dt;
        if (npc._ageTimer >= npc._lifespan) {
          triggerDeparture(npc, this.exitRegistry);
        }
      }

      tickBaseState(npc, npc._profile, this.envQuery, dt);
      // 离场中的 NPC 跳过 modifier 随机触发
      if (!npc._departing) tickModifiers(npc, npc._profile, dt, globalHeldFrac);
    }

    // 4) NPC 间分离：行走中的两人靠太近时互相推开，避免重叠穿模
    this._separate(dt);

    // 5) 镜头反应层（依赖社会稳定度系统，本次留空）
    // this.cameraLayer.update(this.npcs, viewfinder, stability, dt);

    // 6) 定期清理死亡 NPC，防止数组无限增长（每 10s 一次）
    this._pruneTimer = (this._pruneTimer ?? 0) - dt;
    if (this._pruneTimer <= 0) {
      this.npcs = this.npcs.filter(n => n.alive);
      this._pruneTimer = 10;
    }
  }

  // 简单分离力：仅作用于移动中的自由 NPC（O(n²)，场景 NPC < 30 足够）
  _separate(dt) {
    const MOVING = new Set(['walk', 'run', 'jog']);
    const movers = this.npcs.filter(n =>
      n.alive && !n._activity && !n.leashTarget && MOVING.has(n.state));
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 24) {
          const f = ((24 - d) / 24) * 16 * dt;       // 越近推力越大
          const ux = dx / d, uy = dy / d;
          a.x += ux * f; a.y += uy * f;
          b.x -= ux * f; b.y -= uy * f;
        }
      }
    }
  }
}
