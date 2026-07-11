/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 主循环顺序（每帧，每个存活 NPC）：
 *   1. SocialLayer.update（Activity tick + talk 配对）
 *   2. WaitForBusLayer.update
 *   3. 寿命到期 → releaseAllHoldings + triggerDeparture + 推 ExitSceneTask
 *   4. Agenda.tick（无 primary 时选下一目标，_activity 时跳过）
 *   5. runner.tick（始终执行，含 TalkToTask / ExitSceneTask 等监控任务）
 *   6. if _activity → continue（跳过 BSM / modifiers）
 *   7. tickBaseState + checkZoneTransition
 *   8. tickModifiers
 *
 * Smart-object 路由规则（walk → routing）已全部删除；
 * 售货机 / 垃圾桶由 Agenda desires 驱动；chess_onlooker / stall_buyer
 * 将在第三刀迁移为 Agenda desires，目前暂无 onlooker / buyer 路由。
 */

import { getProfile }          from '../npc/NpcProfile.js';
import { EnvironmentQuery }     from './EnvironmentQuery.js';
import { tickBaseState, setState, triggerDeparture } from './BaseStateMachine.js';
import { installProtection, nudgeXY } from './Motor.js';
import { tickModifiers, initPoseCache as initModPoseCache } from './ModifierLayer.js';
import { SocialLayer }          from './SocialLayer.js';
import { CameraReactionLayer }  from '../camera/CameraReactionLayer.js';
import { WaitForBusLayer }      from '../entity/busstop/WaitForBusLayer.js';
import { refreshDebugFlag }     from './DebugLog.js';
import { checkZoneTransition }  from './WalkMode.js';
import { TaskRunner }           from './TaskRunner.js';
import { Agenda }               from './Agenda.js';
import { ExitSceneTask }        from './tasks/ExitSceneTask.js';
import { stuckProbe } from './StuckProbe.js';
import { audit } from '../debug/MovementAudit.js';

const rand = (a, b) => a + Math.random() * (b - a);

/** 释放 NPC 占用的所有槽位（reserved 预约 + slot_wait 就位），清 _slotWaitProp */
function releaseAllHoldings(npc, envQuery) {
  envQuery.releaseSlotReservation(npc);
  if (npc._slotWaitProp) {
    for (const s of npc._slotWaitProp._slots) {
      if (s.npc === npc) { s.ready = false; s.npc = null; }
    }
    npc._slotWaitProp = null;
  }
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
    this.cameraLayer     = new CameraReactionLayer();
    this.npcs            = [];
    this.waitForBusLayer = null;
    this.exitRegistry    = null;
  }

  /** 注册 NPC 并指定行为档案；返回该 NPC */
  register(npc, profileName = 'pedestrian') {
    npc._profile  = getProfile(profileName);
    npc._activity = null;
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(20, 34);
    this.npcs.push(npc);
    installProtection(npc);
    setState(npc, npc._profile.initial || 'walk');

    npc._runner = new TaskRunner();
    npc._agenda = new Agenda(npc._profile, this.envQuery);

    // 供 ExitSceneTask 在运行时读取（Director spawn 的 NPC 由 Director._installRefs 覆写）
    npc._exitRegistry    = this.exitRegistry;
    npc._waitForBusLayer = this.waitForBusLayer;
    npc._busStops        = this.waitForBusLayer?._stops ?? [];

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

    // 2) WaitForBusLayer 扫描
    if (this.waitForBusLayer) this.waitForBusLayer.update(this.npcs, dt);

    // 3) 自由 NPC：Agenda + TaskRunner + BSM + modifiers
    const heldCount = this.npcs.filter(n =>
      n.alive && n.modifiers?.some(m => m.kind === 'held' && !m.id.startsWith('_'))
    ).length;
    const globalHeldFrac = this.npcs.length > 0 ? heldCount / this.npcs.length : 0;

    for (const npc of this.npcs) {
      if (!npc.alive) continue;

      // 等公交：bus waiter 逻辑独立
      if (npc._waitingBusStop && npc.state !== 'routing') {
        if (this.waitForBusLayer) this.waitForBusLayer.tickWaiter(npc, dt);
        continue;
      }

      // 寿命到期 → 离场
      if (!npc._departing && npc._lifespan != null && !npc._waitingBusStop) {
        npc._ageTimer = (npc._ageTimer || 0) + dt;
        if (npc._ageTimer >= npc._lifespan) {
          releaseAllHoldings(npc, this.envQuery);
          triggerDeparture(npc, this.exitRegistry);
          if (npc._departing) {
            npc._runner?.setPrimary(new ExitSceneTask(), npc);
          }
        }
      }

      // Agenda 选目标（无 Activity 时才评估）
      if (!npc._activity) {
        npc._agenda?.tick(npc, npc._runner, dt);
      }

      // TaskRunner tick（始终，含 TalkToTask / ExitSceneTask）
      npc._runner?.tick(npc, dt);

      // Activity 锁定 → 跳过 BSM / modifiers
      if (npc._activity) continue;

      tickBaseState(npc, npc._profile, this.envQuery, dt);
      if (npc.state === 'walk' || npc.state === 'run') checkZoneTransition(npc);
      if (!npc._departing) tickModifiers(npc, npc._profile, dt, globalHeldFrac);
    }

    // 4) NPC 间分离
    this._separate(dt);

    // 5) 定期清理死亡 NPC
    this._pruneTimer = (this._pruneTimer ?? 0) - dt;
    if (this._pruneTimer <= 0) {
      this.npcs = this.npcs.filter(n => n.alive);
      this._pruneTimer = 10;
    }
  }

  // 当分离推力方向与 NPC 行进方向相反时衰减为 0.5，避免抖振
  _sepScale(npc, ux, uy) {
    const mode = npc._walkMode;
    if (!mode || mode.kind !== 'direct') return 1;
    const t = mode.target;
    const dx = t.x - npc.x, dy = t.y - npc.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return 1;
    return (ux * dx + uy * dy) / len < -0.4 ? 0.5 : 1;
  }

  _separate(dt) {
    const MOVING = new Set(['walk', 'run', 'jog']);
    const movers  = this.npcs.filter(n =>
      n.alive && !n._activity && !n.leashTarget && MOVING.has(n.state));
    const statics = this.npcs.filter(n =>
      n.alive && !n.leashTarget && !MOVING.has(n.state) && !n._bench);

    // 动 vs 动：双方互推（原逻辑不变）
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const sepR = 24 * ((a.scale + b.scale) / 2 / 0.18);
        if (d > 0 && d < sepR) {
          const f  = ((sepR - d) / sepR) * 16 * dt;
          const ux = dx / d, uy = dy / d;
          const sa = this._sepScale(a,  ux,  uy);
          const sb = this._sepScale(b, -ux, -uy);
          nudgeXY(a,  ux * f * sa,  uy * f * sa);
          nudgeXY(b, -ux * f * sb, -uy * f * sb);
        }
      }
    }

    // 动 vs 静：静止方零位移，行走方受推
    for (const m of movers) {
      for (const s of statics) {
        const dx = m.x - s.x, dy = m.y - s.y;
        const d = Math.hypot(dx, dy);
        const sepR = 24 * ((m.scale + s.scale) / 2 / 0.18);
        if (d > 0 && d < sepR) {
          const f  = ((sepR - d) / sepR) * 16 * dt;
          const ux = dx / d, uy = dy / d;
          const sm = this._sepScale(m, ux, uy);
          nudgeXY(m, ux * f * sm, uy * f * sm);
        }
      }
    }
  }
}
