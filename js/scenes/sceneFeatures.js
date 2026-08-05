/**
 * sceneFeatures — 既有 spawn 函数 → featureRegistry 契约的包装层（Z-2e）
 *
 * 每个 registerFeature() 调用把一个既有的、签名各异的 spawn 函数包成
 * `(ctx, cfg) => void`。本文件是唯一改动点——被包装的函数（spawnChess /
 * spawnDogWalker / spawnAthletes / spawnPedestrians / initVehicleSystem /
 * spawnBusStop）本身零改动，签名和内部硬编码几何原样保留。
 *
 * ctx 契约（由 SceneInitializer 构建，对所有 feature 只读）：
 *   { em, sr, bm, scene, layout, sceneData, propManager, navGrid, spawnPoints }
 *
 * cfg 是该 feature 在 scene.json `features[]` 里的那一条（已去掉 `type` 键）。
 */

import { registerFeature } from '../core/featureRegistry.js';
import { resolveY, depthScale } from '../core/Layout.js';
import { spawnPedestrians, spawnOnePedestrian } from '../npc/Pedestrians.js';
import { Agenda } from '../behavior/Agenda.js';
import { spawnChess } from '../npc/Chess.js';
import { spawnDogWalker } from '../npc/DogWalker.js';
import { spawnAthletes } from '../npc/Athletes.js';
import { initVehicleSystem } from '../entity/vehicle/vehicleSpawner.js';
import { spawnBusStop } from '../entity/busstop/busstop.js';
import { WaitForBusLayer } from '../entity/busstop/WaitForBusLayer.js';
import { setState, setXY } from '../behavior/Motor.js';
import { publishGoal } from '../behavior/nav/PlanService.js';
import { makeNPC } from '../npc/npcUtil.js';

function _need(v, what) {
  if (v == null) throw new Error(`sceneFeatures: scene config 缺 ${what}`);
  return v;
}

// ─── pedestrians：环境路人，count 可配（原默认值 18） ─────────────────────────
registerFeature('pedestrians', (ctx, cfg) => {
  spawnPedestrians(ctx.em, ctx.sr, ctx.bm, ctx.spawnPoints, cfg.count ?? 18);
});

// ─── park_idlers：公园常驻闲逛 NPC（原为 SceneInitializer 内联循环）───────────
registerFeature('park_idlers', (ctx, cfg) => {
  const { em, sr, bm } = ctx;
  const minY = resolveY(cfg.minYBand ?? 'PARK_TOP');
  const maxY = resolveY(cfg.maxYBand ?? 'PARK_BOTTOM');
  const midY = minY + (maxY - minY) * (cfg.midYFrac ?? 0.35);
  const [cMin, cMax] = cfg.countRange ?? [3, 5];
  const count = cMin + Math.floor(Math.random() * (cMax - cMin + 1));
  const xMargin = cfg.xMargin ?? 80;
  const worldWidth = ctx.worldWidth;
  const [lMin, lMax] = cfg.lifespanRange ?? [120, 300];
  const ageTimerMax = cfg.ageTimerMax ?? 30;

  for (let i = 0; i < count; i++) {
    const px = xMargin + Math.random() * (worldWidth - 2 * xMargin);
    const npc = spawnOnePedestrian('pedestrian', em, sr, bm,
      { x: px, y: midY },
      { minY, maxY });
    const ag = npc.mem('agenda');
    ag.agenda = new Agenda(
      { ...ag.profile, agendaTemplate: cfg.agendaTemplate ?? 'park_idler' },
      bm.envQuery,
    );
    ag.lifespan  = lMin + Math.random() * (lMax - lMin);
    ag.ageTimer  = Math.random() * ageTimerMax;
  }
});

// ─── chess：棋局双人组（plaza 几何来自 layout，默认 chessPlaza） ─────────────
registerFeature('chess', (ctx, cfg) => {
  const plaza = ctx.layout[cfg.plaza ?? 'chessPlaza'];
  if (!plaza) return;  // 场景无棋盘广场则跳过（例：学校场景）
  spawnChess(ctx.em, ctx.sr, ctx.bm, plaza);
});

// ─── stall_sellers：为每个带 smartDef 的摊位生成常驻摊主 ─────────────────────
// 原 SceneInitializer#_spawnStallSellers 方法逐字迁入，只把 this.em/this.sr 换成 ctx.em/ctx.sr。
registerFeature('stall_sellers', (ctx) => {
  const { em, sr, bm, worldWidth: WORLD_WIDTH } = ctx;
  const stalls = em.entities.filter(e => e.alive && e.smartDef?.activityType === 'stall' && e._slots);
  for (const stall of stalls) {
    const slot = stall._slots.find(s => s.role === 'seller');
    if (!slot || slot.reserved != null) continue;

    const fromLeft = stall.x < WORLD_WIDTH / 2;
    // U-2d（补漏）：speed 骨架单位/秒（走 bm.register 的 npc.speed>0 分支直接
    // 播种 walkSpeed，语义须与 U-2 全库一致）。原世界像素值 28 ÷ 主漫游区
    // scale 0.188 换算：28/0.188≈149。
    const seller = makeNPC(em, sr, {
      x: fromLeft ? 10 : WORLD_WIDTH - 10, y: stall.y,
      animation: 'walk', direction: fromLeft ? 1 : -1, speed: 149, vy: 0,
      minX: 0, maxX: WORLD_WIDTH, minY: resolveY('BUILDING_BASE_Y'), maxY: resolveY('PARK_BOTTOM'),
      tags: ['vendor'], npcType: 'stall_seller',
    });
    seller.scale = depthScale(stall.y);
    bm.register(seller, 'stall_seller');

    slot.reserved = seller.id;
    const _destX = stall.x + slot.dx, _destY = stall.y + slot.dy;
    let _slotRetries = 0;
    const _onSlotDone = (result) => {
      if (result === 'arrived') {
        bm.socialLayer.onSlotArrival(seller, stall, slot);
      } else if (_slotRetries < 2) {
        _slotRetries++;
        publishGoal(seller, { x: _destX, y: _destY }, 60, _onSlotDone, {});
      } else {
        setXY(seller, _destX, _destY);
        bm.socialLayer.onSlotArrival(seller, stall, slot);
      }
    };
    publishGoal(seller, { x: _destX, y: _destY }, 60, _onSlotDone, {});
    setState(seller, 'walk', 'stall_seller_entry');
  }
});

// ─── dog_walker：需要 propManager 记录 leash 关系 ─────────────────────────────
registerFeature('dog_walker', (ctx) => {
  spawnDogWalker(ctx.em, ctx.sr, ctx.bm, ctx.propManager);
});

// ─── athletes：常驻布景跑者，每个 runner 的路线名须与 layout.walkPaths 存在的键匹配 ──
registerFeature('athletes', (ctx, cfg) => {
  spawnAthletes(ctx.em, ctx.sr, ctx.bm, ctx.layout, cfg);
});

// ─── vehicles：车流系统 + 公交等待层（两者强耦合，捆成一个 feature）───────────
// busStops 坐标唯一来源 = layout.busStops（scene.json），与 bus_stops feature
// 渲染顶棚/长椅用的是同一份数据，不再各自硬编码。
registerFeature('vehicles', (ctx) => {
  const tm = initVehicleSystem(ctx.em, ctx.sr, ctx.bm, ctx.layout.busStops);
  ctx.scene.trafficManager = tm;
  if (tm.busStops.length > 0) {
    ctx.bm.waitForBusLayer = new WaitForBusLayer(tm.busStops, ctx.em.entities, ctx.bm.socialLayer);
  }
});

// ─── bus_stops：公交站视觉实体（顶棚/长椅/站牌），来自 layout.busStops ───────
registerFeature('bus_stops', (ctx) => {
  for (const stop of (ctx.layout.busStops ?? [])) spawnBusStop(ctx.em, stop);
});

// ─── ambient_affordance：无实体的区域采样目的地（如公园草地小憩点） ───────────
// anchor / weightMul 是行为逻辑，保留为代码；数值（半径/权重/阈值带名）走 cfg。
registerFeature('ambient_affordance', (ctx, cfg) => {
  const minY = resolveY(cfg.minYBand ?? 'PARK_TOP');
  ctx.bm.envQuery.registerAmbientAffordance({
    kind:         _need(cfg.kind,         'features[ambient_affordance].kind'),
    arrivalState: _need(cfg.arrivalState, 'features[ambient_affordance].arrivalState'),
    dur:          _need(cfg.dur,          'features[ambient_affordance].dur'),
    weight:       _need(cfg.weight,       'features[ambient_affordance].weight'),
    slots:        null,
    facing:       null,
    use:          cfg.use ?? 'visit',
    tags:         cfg.tags ?? [],
    anchor:       (npc) => npc.y >= minY ? ctx.navGrid.sampleWalkableNear(npc, cfg.radius ?? 200) : null,
    weightMul:    (npc, env) => env.nearestFreeBench(npc, cfg.benchAvoidRadius ?? 200)
      ? (cfg.benchAvoidFactor ?? 0.3) : 1,
  });
});
