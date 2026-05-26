/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 组合各行为层，对所有被托管的 NPC 每帧驱动：
 *   - SocialLayer：tick 所有 Activity（对话/下棋/遛狗）+ 周期性配对新对话
 *   - 自由 NPC（未被 Activity 锁定）：BaseStateMachine + OverlayLayer
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
import { tickBaseState, setState, registerTransition, triggerDeparture } from './behavior/BaseStateMachine.js';
import { tickOverlay }          from './behavior/OverlayLayer.js';
import { SocialLayer }          from './behavior/SocialLayer.js';
import { CameraReactionLayer }  from './behavior/CameraReactionLayer.js';
import { refreshDebugFlag }     from './behavior/DebugLog.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class BehaviorManager {
  /** @param {EntityManager} entityManager */
  constructor(entityManager) {
    this.em          = entityManager;
    this.envQuery    = new EnvironmentQuery(entityManager);
    this.socialLayer = new SocialLayer(this.envQuery);
    this.cameraLayer = new CameraReactionLayer();
    this.npcs        = [];

    // 注入 Smart Object routing 转换：行走中的 NPC 低概率发现空棋桌并前往
    const sl = this.socialLayer;
    registerTransition({
      from: 'walk', to: 'routing', priority: 10,
      trigger: 'smart-object',
      condition: (npc, env, profile) => {
        if (npc._departing) return false;
        if (!profile?.activities?.includes('chess')) return false;
        if (Math.random() > 0.003) return false;
        const found = env.findAvailableSlot('chess', npc, 220);
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

    // 2) 自由 NPC（未被 Activity 锁定）走基础状态机 + 叠加动作
    for (const npc of this.npcs) {
      if (!npc.alive || npc._activity) continue;

      // 年龄计时 + 离场触发（仅对有 lifespan 的 NPC 生效，_departing 后不再计时）
      if (!npc._departing && npc._lifespan != null) {
        npc._ageTimer = (npc._ageTimer || 0) + dt;
        if (npc._ageTimer >= npc._lifespan) {
          triggerDeparture(npc, this.exitRegistry);
        }
      }

      tickBaseState(npc, npc._profile, this.envQuery, dt);
      // 离场中的 NPC 跳过 overlay 随机触发
      if (!npc._departing) tickOverlay(npc, npc._profile, dt);
    }

    // 3) NPC 间分离：行走中的两人靠太近时互相推开，避免重叠穿模
    this._separate(dt);

    // 4) 镜头反应层（依赖社会稳定度系统，本次留空）
    // this.cameraLayer.update(this.npcs, viewfinder, stability, dt);
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
