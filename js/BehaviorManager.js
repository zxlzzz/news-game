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
import { tickBaseState, setState } from './behavior/BaseStateMachine.js';
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
      tickBaseState(npc, npc._profile, this.envQuery, dt);
      tickOverlay(npc, npc._profile, dt);
    }

    // 3) 镜头反应层（依赖社会稳定度系统，本次留空）
    // this.cameraLayer.update(this.npcs, viewfinder, stability, dt);
  }
}
