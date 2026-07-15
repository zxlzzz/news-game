/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 帧内执行顺序见 docs/contracts/movement-dataflow.md §1。
 *
 * BM 私有约定：
 *   - activity 存在时 `continue`（跳过 BSM / modifiers）
 *   - `_separate` 由 BM 在每帧末尾统一调用，不由 BSM 调用
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

/** 释放 NPC 占用的所有槽位（reserved 预约 + slot_wait 就位），清 slotWaitProp */
function releaseAllHoldings(npc, envQuery) {
  envQuery.releaseSlotReservation(npc);
  const sc = npc.mem('social');
  if (sc.slotWaitProp) {
    for (const s of sc.slotWaitProp._slots) {
      if (s.npc === npc) { s.ready = false; s.npc = null; }
    }
    sc.slotWaitProp = null;
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
    const ag = npc.mem('agenda');
    ag.profile  = getProfile(profileName);
    npc.mem('social').activity = null;
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(20, 34);
    this.npcs.push(npc);
    installProtection(npc);
    setState(npc, ag.profile.initial || 'walk');

    ag.runner = new TaskRunner();
    ag.agenda = new Agenda(ag.profile, this.envQuery);

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

      // 等公交：bus waiter 逻辑独立
      if (sc.waitingBusStop && npc.state !== 'routing') {
        if (this.waitForBusLayer) this.waitForBusLayer.tickWaiter(npc, dt);
        continue;
      }

      // 寿命到期 → 离场
      if (!ag.departing && ag.lifespan != null && !sc.waitingBusStop) {
        ag.ageTimer = (ag.ageTimer || 0) + dt;
        if (ag.ageTimer >= ag.lifespan && !sc.activity) {
          releaseAllHoldings(npc, this.envQuery);
          triggerDeparture(npc, this.exitRegistry);
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

      // Activity 锁定 → 跳过 BSM / modifiers
      if (sc.activity) continue;

      tickBaseState(npc, ag.profile, this.envQuery, dt);
      if (npc.state === 'walk' || npc.state === 'run') checkZoneTransition(npc);
      if (!ag.departing) tickModifiers(npc, ag.profile, dt, globalHeldFrac);
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
    const mode = npc.mem('motor').walkMode;
    if (!mode || mode.kind !== 'direct') return 1;
    const t = mode.target;
    const dx = t.x - npc.x, dy = t.y - npc.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return 1;
    return (ux * dx + uy * dy) / len < -0.4 ? 0.5 : 1;
  }

  // CONTRACT (_separate)  (see docs/contracts/movement.md)
  //   OWNS:    inter-NPC separation impulses applied via Motor.nudgeXY.
  //   WRITES:  npc.x/y indirectly via nudgeXY (authorised Motor API).
  //   READS:   npc.state, npc.mem('social').{activity,bench}, npc.leashTarget,
  //            npc.mem('motor').walkMode (via _sepScale).
  //   MUST NOT: call setState or set npc.speed; skip leashed NPCs (leashTarget ≠ null).
  _separate(dt) {
    const MOVING = new Set(['walk', 'run', 'jog']);
    const movers  = this.npcs.filter(n =>
      n.alive && !n.mem('social').activity && !n.leashTarget && MOVING.has(n.state));
    const statics = this.npcs.filter(n =>
      n.alive && !n.leashTarget && !MOVING.has(n.state) && !n.mem('social').bench);

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
