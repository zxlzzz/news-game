/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 帧内执行顺序见 docs/contracts/movement-dataflow.md §1。
 *
 * BM 私有约定：
 *   - activity 存在时 `continue`（跳过 BSM / modifiers）
 *   - M-1: NPC 位置分离 `_separate` 已删除（C1 直接穿过；见 update() step 4 注记）
 *
 * Smart-object 路由规则（walk → routing）已全部删除；
 * 售货机 / 垃圾桶由 Agenda desires 驱动；chess_onlooker 由 Agenda 的 affordance
 * 池路由（Patch D，ChessOnlookerTask，单人、非 Activity 成员）；stall 卖家独自
 * 守摊已改走 StallSellerTask（Patch H，prop-as-host，ChainTask、非 Activity
 * 成员）；stall_buyer 路由已补齐（tasks.md P-4）：走同一套 Agenda desires →
 * ChainTask 路径（BehaviorScripts.js#stall_buyer → StallBuyerTask），到达槽位
 * 后调 `this.envQuery.socialLayer.onSlotArrival()`（本文件构造函数里挂的，
 * 见下方 constructor）交给 StallActivity 既有的"买家到位才凑满 roster 去
 * Create"钩子接手。
 */

import { getProfile }          from '../npc/NpcProfile.js';
import { EnvironmentQuery }     from './EnvironmentQuery.js';
import { tickBaseState, triggerDeparture } from './BaseStateMachine.js';
import { installProtection, setState } from './Motor.js';
import { tickModifiers, initPoseCache as initModPoseCache } from './ModifierLayer.js';
import { SocialLayer }          from './SocialLayer.js';
import { WaitForBusLayer }      from '../entity/busstop/WaitForBusLayer.js';
import { refreshDebugFlag }     from './DebugLog.js';
import { checkZoneTransition }  from './WalkMode.js';
import { TaskRunner }           from './TaskRunner.js';
import { Agenda }               from './Agenda.js';
import { ensurePath }           from './nav/PlanService.js';
import { ExitSceneTask }        from './tasks/ExitSceneTask.js';
import { stuckProbe } from './StuckProbe.js';
import { audit } from '../debug/MovementAudit.js';
import { drainNewEvents } from './WorldEventLog.js';
import { generateClaims, evolveMemory, MEMORY_EVOLUTION_INTERVAL_MIN } from './Belief.js';
import { gameClock } from '../core/GameClock.js';

const rand = (a, b) => a + Math.random() * (b - a);

/** 释放 NPC 占用的所有槽位预约（prop-as-host / Patch H：slot_wait 就位态已随
 *  SocialLayer 默认 onSlotArrival 分支一并删除，各 activity 自己的槽位持有物
 *  改经 TaskRunner holdings 机制回收，这里只兜底扫一遍 reserved）。 */
function releaseAllHoldings(npc, envQuery) {
  envQuery.releaseSlotReservation(npc);
}

export class BehaviorManager {
  /** @param {EntityManager} entityManager @param {object} poseCache */
  constructor(entityManager, poseCache) {
    this.em          = entityManager;
    this.envQuery    = new EnvironmentQuery(entityManager);
    this.poseCache   = poseCache;

    if (poseCache) {
      initModPoseCache(poseCache);
    }

    this.socialLayer     = new SocialLayer(this.envQuery, poseCache);
    // P-4：StallBuyerTask（envQuery 是所有 Task/Agenda 共有的依赖，SocialLayer
    // 不是）到达买家槽位后要调 socialLayer.onSlotArrival——挂在 envQuery 上是
    // 复用既有的公共穿透点，不是新开一条穿参路径。
    this.envQuery.socialLayer = this.socialLayer;
    this.npcs            = [];
    this.waitForBusLayer = null;
    this.exitRegistry    = null;
    // P-6：记忆演化攒帧计时器，累计"游戏分钟"（不是实秒）——见 update() 里
    // 用 gameClock() 前后帧差值换算的那一段，以及 Belief.js#evolveMemory 头注释。
    this._memEvoAccMin  = 0;
    this._lastGameHours = gameClock();
  }

  /** 注册 NPC 并指定行为档案；返回该 NPC */
  register(npc, profileName = 'pedestrian') {
    const ag = npc.mem('agenda');
    ag.profile  = getProfile(profileName);
    npc.mem('social').activity = null;
    // U-2: walkSpeed 语义为骨架单位/秒（消费时乘 npc.scale）。迁移基准（U-2b 重校准，
    // 2026-08-05）：主漫游区远人行道 SIDEWALK_FAR_Y=240 有效 scale 0.188
    // （该 y 处旧版景深缩放坡系数 0.221 × human skeletonScale 0.85；O-1 已删除该缩放坡，
    // 此处保留历史换算记录），换算后该深度行为不变：
    // 20/0.188≈106、34/0.188≈181。原基准 NEAR_Y=333（scale 0.262，机动车道边界，
    // NPC 不驻留）与实际漫游区深度不符，曾导致远人行道步速比重构前慢约 30%
    // （14–24px/s vs 原 20–34px/s），已改按主漫游区校准。npc.speed>0 分支走的是
    // 生成器显式指定的速度（Athletes/CyclistSpawner，已同步换算为同一语义）。
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(106, 181);
    this.npcs.push(npc);
    installProtection(npc);
    setState(npc, ag.profile.initial || 'walk');

    ag.runner = new TaskRunner();
    // profile.agenda === false → 常驻布景 NPC（athlete 等），不构造 Agenda；ag.agenda?.tick 天然跳过
    ag.agenda = ag.profile.agenda === false ? undefined : new Agenda(ag.profile, this.envQuery);

    // 供 ExitSceneTask 在运行时读取（Director spawn 的 NPC 由 Director._installRefs 覆写）
    ag.exitRegistry    = this.exitRegistry;
    ag.waitForBusLayer = this.waitForBusLayer;
    ag.busStops        = this.waitForBusLayer?._stops ?? [];

    return npc;
  }

  update(delta) {
    const dt = delta / 1000;
    this._dt = dt;
    refreshDebugFlag();

    stuckProbe(this.npcs, dt);
    audit.tick(this.npcs, dt);

    // 1) Activity 层
    this.socialLayer.update(this.npcs, dt);

    // 1.5) 世界事件 → 目击 claim（W-7a：drainNewEvents() 唯一消费点）
    for (const event of drainNewEvents()) {
      const actorNpcs = event.actors.map(id => this.npcs.find(n => n.id === id) ?? null);
      generateClaims(event, actorNpcs, this.npcs);
    }

    // 1.6) 记忆演化（P-6）：按 GameClock 实际经过的游戏分钟数攒计时器，攒够
    // MEMORY_EVOLUTION_INTERVAL_MIN 才滚一次——不是每帧都滚，量级参考
    // TalkActivity/ChessActivity 的周期化掷骰。跨午夜回绕（24→0）按正向流逝处理。
    {
      const nowH = gameClock();
      let dH = nowH - this._lastGameHours;
      if (dH < 0) dH += 24;
      this._lastGameHours = nowH;
      this._memEvoAccMin += dH * 60;
      if (this._memEvoAccMin >= MEMORY_EVOLUTION_INTERVAL_MIN) {
        const ticks = Math.floor(this._memEvoAccMin / MEMORY_EVOLUTION_INTERVAL_MIN);
        this._memEvoAccMin -= ticks * MEMORY_EVOLUTION_INTERVAL_MIN;
        evolveMemory(this.npcs, ticks);
      }
    }

    // 2) WaitForBusLayer 扫描
    if (this.waitForBusLayer) this.waitForBusLayer.update(this.npcs, dt);

    // 3) 自由 NPC：Agenda + TaskRunner + BSM + modifiers
    const heldCount = this.npcs.filter(n =>
      n.alive && n.modifiers?.some(m => m.kind === 'held' && !m.id.startsWith('_'))
    ).length;
    const globalHeldFrac = this.npcs.length > 0 ? heldCount / this.npcs.length : 0;

    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const ag = npc.mem('agenda');
      const sc = npc.mem('social');

      // 寿命到期 → 离场（等待中 NPC 由 sc.activity 门阻断；候车中 NPC 由
      // sc.waitingBusStop 门阻断——WaitBusTask 是单人 ChainTask 不占 sc.activity，
      // Patch C 前靠 Activity 锁顺带挡住的寿命打断，改靠这个字段单独挡）
      if (!ag.departing && ag.lifespan != null) {
        ag.ageTimer = (ag.ageTimer || 0) + dt;
        if (ag.ageTimer >= ag.lifespan && !sc.activity && !sc.waitingBusStop) {
          releaseAllHoldings(npc, this.envQuery);
          triggerDeparture(npc, this.exitRegistry, { entities: this.em.entities });
          if (ag.departing) {
            ag.runner?.setPrimary(new ExitSceneTask(), npc);
          }
        }
      }

      // Agenda 选目标（无 Activity 时才评估）
      if (!sc.activity) {
        ag.agenda?.tick(npc, ag.runner, dt);
      }

      // TaskRunner tick（始终，含 TalkToTask / ExitSceneTask）
      ag.runner?.tick(npc, dt);

      // Planning 层同步：确保 mot.path 与 mot.goal 一致（TaskRunner 可能刚 publishGoal）
      ensurePath(npc);

      // Activity 锁定 → 跳过 BSM / modifiers
      if (sc.activity) continue;

      tickBaseState(npc, ag.profile, this.envQuery, dt);
      if (npc.state === 'walk' || npc.state === 'run') checkZoneTransition(npc);
      if (!ag.departing) tickModifiers(npc, ag.profile, dt, globalHeldFrac);
    }

    // 4) M-1「信任路径」重构：NPC 位置分离（_separate）已删除（C1 直接穿过）。
    //    位置分离会把 NPC 从无碰撞 A* 路径上推离、顶进墙角造成死锁，是"卡死+乱"的
    //    根因之一。未来的预测式避让 / 接触碰撞解算作为独立层再引入。

    // 5) 定期清理死亡 NPC
    this._pruneTimer = (this._pruneTimer ?? 0) - dt;
    if (this._pruneTimer <= 0) {
      this.npcs = this.npcs.filter(n => n.alive);
      this._pruneTimer = 10;
    }
  }

}
