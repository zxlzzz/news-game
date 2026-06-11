/**
 * BehaviorManager — 行为系统薄协调器
 *
 * 组合各行为层，对所有被托管的 NPC 每帧驱动：
 *   - SocialLayer：tick 所有 Activity（对话/下棋/遛狗）+ 周期性配对新对话
 *   - 自由 NPC（未被 Activity 锁定）：BaseStateMachine + ModifierLayer
 *   - CameraReactionLayer：镜头反应（本次留空）
 *
 * Smart Object 路由规则由 initSmartObjectRoutes() 构造完成后调用，
 * 扫描 em.entities 中所有含 smartDef.routing 的 PropEntity 并自动注册 registerTransition。
 */

import { getProfile }          from '../npc/NpcProfile.js';
import { EnvironmentQuery }     from './EnvironmentQuery.js';
import { tickBaseState, setState, registerTransition, triggerDeparture, initPoseCache as initBsmPoseCache } from './BaseStateMachine.js';
import { installProtection, nudgeXY } from './Motor.js';
import { tickModifiers, initPoseCache as initModPoseCache } from './ModifierLayer.js';
import { SocialLayer }          from './SocialLayer.js';
import { CameraReactionLayer }  from '../camera/CameraReactionLayer.js';
import { WaitForBusLayer }      from '../entity/busstop/WaitForBusLayer.js';
import { refreshDebugFlag }     from './DebugLog.js';
import { checkZoneTransition }  from './WalkMode.js';

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
      initBsmPoseCache(poseCache);
    }

    this.socialLayer = new SocialLayer(this.envQuery, poseCache);
    this.cameraLayer = new CameraReactionLayer();
    this.npcs            = [];
    this.waitForBusLayer = null;
    this.routeSelector   = null;
  }

  /**
   * 扫描 em.entities 中所有含 smartDef.routing 的 PropEntity，
   * 为每个唯一 activityFlag 自动注册一条 walk → routing 转换规则。
   * 须在所有实体（包括 Chess.js 等代码生成的道具）加入 em 之后调用。
   */
  initSmartObjectRoutes() {
    const sl = this.socialLayer;
    const bm = this;   // captured for condition closures (dt normalization)
    const seenFlags = new Set();

    for (const entity of this.em.entities) {
      if (!entity.smartDef?.routing) continue;
      const activityType = entity.smartDef.activityType;

      for (const cfg of entity.smartDef.routing) {
        if (seenFlags.has(cfg.activityFlag)) continue;
        seenFlags.add(cfg.activityFlag);

        // 捕获本次循环的配置（避免闭包共享变量）
        const flag            = cfg.activityFlag;
        const role            = cfg.role ?? null;
        const defaultChance   = cfg.chance;
        const radius          = cfg.radius;
        const requireOccupied = cfg.requireOccupied ?? false;

        registerTransition({
          from: 'walk', to: 'routing', priority: 10,
          trigger: 'smart-object',
          condition: (npc, env, profile) => {
            if (npc._departing) return false;
            if (!profile?.activities?.includes(flag)) return false;
            const p = profile.smartObjectChance?.[flag] ?? defaultChance;
            if (Math.random() > p * (bm._dt ?? 1 / 60) * 60) return false;
            const opts = role ? { role, requireOccupied } : undefined;
            const found = env.findAvailableSlot(activityType, npc, radius, opts);
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
    }
  }

  /** 注册 NPC 并指定行为档案；返回该 NPC */
  register(npc, profileName = 'pedestrian') {
    npc._profile  = getProfile(profileName);
    npc._activity = null;
    npc.walkSpeed = npc.speed > 0 ? npc.speed : rand(20, 34);
    this.npcs.push(npc);
    installProtection(npc);
    setState(npc, npc._profile.initial || 'walk');
    return npc;
  }

  update(delta) {
    const dt = delta / 1000;
    this._dt = dt;   // exposed for smart-object condition closures
    refreshDebugFlag();

    // 1) Activity 层
    this.socialLayer.update(this.npcs, dt);

    // 2) WaitForBusLayer 扫描
    if (this.waitForBusLayer) this.waitForBusLayer.update(this.npcs, dt);

    // 3) 自由 NPC：基础状态机 + 叠加动作
    const heldCount = this.npcs.filter(n =>
      n.alive && n.modifiers?.some(m => m.kind === 'held' && !m.id.startsWith('_'))
    ).length;
    const globalHeldFrac = this.npcs.length > 0 ? heldCount / this.npcs.length : 0;

    for (const npc of this.npcs) {
      if (!npc.alive || npc._activity) continue;

      if (npc._waitingBusStop && npc.state !== 'routing') {
        if (this.waitForBusLayer) this.waitForBusLayer.tickWaiter(npc, dt);
        continue;
      }

      if (!npc._departing && npc._lifespan != null && !npc._waitingBusStop) {
        npc._ageTimer = (npc._ageTimer || 0) + dt;
        if (npc._ageTimer >= npc._lifespan) {
          releaseAllHoldings(npc, this.envQuery);
          triggerDeparture(npc, this.exitRegistry);
        }
      }

      tickBaseState(npc, npc._profile, this.envQuery, dt);
      if (npc.state === 'walk' || npc.state === 'run') checkZoneTransition(npc);
      if (npc._needsNewRoute && this.routeSelector) {
        this.routeSelector.pickAndStart(npc, this.npcs);
      }
      if (!npc._departing) tickModifiers(npc, npc._profile, dt, globalHeldFrac);
    }

    // 4) NPC 间分离
    this._separate(dt);

    // 5) 镜头反应层（预留）
    // this.cameraLayer.update(this.npcs, viewfinder, stability, dt);

    // 6) 定期清理死亡 NPC
    this._pruneTimer = (this._pruneTimer ?? 0) - dt;
    if (this._pruneTimer <= 0) {
      this.npcs = this.npcs.filter(n => n.alive);
      this._pruneTimer = 10;
    }
  }

  _separate(dt) {
    const MOVING = new Set(['walk', 'run', 'jog']);
    const movers = this.npcs.filter(n =>
      n.alive && !n._activity && !n.leashTarget && MOVING.has(n.state));
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const sepR = 24 * ((a.scale + b.scale) / 2 / 0.18);
        if (d > 0 && d < sepR) {
          const f = ((sepR - d) / sepR) * 16 * dt;
          const ux = dx / d, uy = dy / d;
          nudgeXY(a,  ux * f,  uy * f);
          nudgeXY(b, -ux * f, -uy * f);
        }
      }
    }
  }
}
