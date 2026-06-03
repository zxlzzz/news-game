import { BuildingEntity }  from '../BuildingEntity.js';
import { PropEntity }      from '../PropEntity.js';
import { BehaviorManager } from '../BehaviorManager.js';
import { ExitRegistry }    from '../behavior/ExitRegistry.js';
import { SpawnManager }    from '../behavior/SpawnManager.js';
import { NpcPropManager }  from '../props/NpcPropManager.js';
import { WaitForBusLayer } from '../behavior/WaitForBusLayer.js';
import { setState }        from '../behavior/BaseStateMachine.js';
import { spawnPedestrians, spawnOnePedestrian } from '../npcs/Pedestrians.js';
import { makeNPC }          from '../npcs/util.js';
import { spawnChess }       from '../npcs/Chess.js';
import { spawnDogWalker }   from '../npcs/DogWalker.js';
import { spawnAthletes }    from '../npcs/Athletes.js';
import { initVehicleSystem } from '../npcs/Vehicles.js';
import {
  WORLD_WIDTH, BUILDING_BASE_Y, FAR_Y, NEAR_Y,
  PARK_TOP, PARK_BOTTOM, SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y,
  BIKE_LANE_FAR_TOP, BUILDING_EXIT_XS,
} from '../SceneConfig.js';

export class SceneInitializer {
  constructor(scene, em, sr, poseCache) {
    this.scene = scene;
    this.em = em;
    this.sr = sr;
    this.poseCache = poseCache;
  }

  spawnAll(sceneData, layout) {
    this._spawnBuildings(sceneData);
    this._spawnProps(sceneData);
    this._spawnTrees(layout);
    this._spawnNPCs(layout);
  }

  // 行道树 / 公园树：从 bg 移到 entity 层，按树干 y 参与 Y 排序（可遮挡后方 NPC）。
  // 渲染交给 PropDrawer.drawTree（propType:'tree'），半径 r → width = 2r。
  _spawnTrees(layout) {
    const { em } = this;
    const groups = [
      { list: layout.sidewalkTrees || [], tags: ['tree', 'greenery'] },
      { list: layout.parkTrees     || [], tags: ['tree', 'park', 'greenery'] },
    ];
    for (const { list, tags } of groups) {
      for (const t of list) {
        em.add(new PropEntity({
          propType: 'tree',
          x: t.x, y: t.y,
          width: t.r * 2, height: t.r * 2,
          _sortY: t.y,
          tags,
        }));
      }
    }
  }

  _spawnBuildings(sceneData) {
    const defs = sceneData?.buildings ?? [];
    const parseColor = c => parseInt(c.replace('#', ''), 16);
    const seed = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
    for (const b of defs) {
      const e = new BuildingEntity({ ...b, y: BUILDING_BASE_Y, color: parseColor(b.color) });
      const off = Math.round((seed(b.x + 7) - 0.5) * 12);
      e.baseY = BUILDING_BASE_Y + off;
      e.y = e.baseY - e.facadeH;
      e.alleyLeft = defs.some(o => o !== b && Math.abs((o.x + o.bWidth) - b.x) <= 2);
      this.em.add(e);
    }
    this._buildingDefs = defs;
  }

  _spawnProps(sceneData) {
    const defs = sceneData?.props ?? [];
    const buildings = this._buildingDefs ?? [];
    const parseColor = c => c ? parseInt(c.replace('#', ''), 16) : 0x888888;
    for (const p of defs) {
      const cfg = { ...p, propColor: parseColor(p.color) };
      if (p.propType === 'sign') {
        const host = buildings.find(b => p.x >= b.x && p.x <= b.x + b.bWidth);
        if (host) cfg.y = BUILDING_BASE_Y - 8;
      }
      this.em.add(new PropEntity(cfg));
    }
  }

  _spawnNPCs(layout) {
    const { em, sr, poseCache } = this;
    const bm = new BehaviorManager(em, poseCache);
    this.scene.behaviorManager = bm;

    const exitRegistry = new ExitRegistry();
    exitRegistry.register({ id: 'edge_left',  type: 'edge', x: -200,              y: null, yZone: null, facing: -1 });
    exitRegistry.register({ id: 'edge_right', type: 'edge', x: WORLD_WIDTH + 200, y: null, yZone: null, facing:  1 });
    for (let i = 0; i < BUILDING_EXIT_XS.length; i++) {
      exitRegistry.register({ id: 'building_' + 'abcd'[i], type: 'building', x: BUILDING_EXIT_XS[i], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    }
    bm.exitRegistry = exitRegistry;

    spawnPedestrians(em, sr, bm);
    spawnChess(em, sr, bm, layout.chessPlaza);
    this._spawnStallSellers(bm);
    this.scene.propManager = new NpcPropManager(em);
    spawnDogWalker(em, sr, bm, this.scene.propManager);
    spawnAthletes(em, sr, bm);
    this.scene.trafficManager = initVehicleSystem(em, sr);
    this._spawnBusStopRoofs(layout);

    if (this.scene.trafficManager.busStops.length > 0)
      bm.waitForBusLayer = new WaitForBusLayer(this.scene.trafficManager.busStops);

    const RY0 = PARK_TOP + 16, RY1 = PARK_BOTTOM - 8;
    const WR = [50, WORLD_WIDTH - 50];
    const spawnZones = [
      { id: 'sidewalk',      target: 3,  yRange: [BUILDING_BASE_Y, FAR_Y], xRange: WR, exitTypes: ['building'], npcTypes: ['pedestrian', 'businessman'] },
      { id: 'park',          target: 10, yRange: [RY0, RY1],               xRange: WR, exitTypes: ['edge'],     npcTypes: ['pedestrian', 'tourist'] },
      { id: 'busstop_far',   target: 3,  yRange: [SIDEWALK_FAR_Y - 20, BIKE_LANE_FAR_TOP], xRange: [380, 620],   exitTypes: ['edge'], npcTypes: ['pedestrian', 'businessman'], isBusWaiter: true, busStopDir: +1 },
      { id: 'busstop_near',  target: 3,  yRange: [PARK_TOP, PARK_TOP + 25],                xRange: [1380, 1620], exitTypes: ['edge'],              npcTypes: ['pedestrian', 'tourist'],     isBusWaiter: true, busStopDir: -1 },
    ];
    this.scene.spawnManager = new SpawnManager({ spawnFn: this._makeSpawnFn(bm, RY0, RY1), exitRegistry, bm, zones: spawnZones });
  }

  // 公交站顶棚：升级为独立 PropEntity，参与 Y 排序（顶棚能遮住后方走过的 NPC）。
  // 柱子 / 长椅 / 站台仍由 SceneRenderer 画在静态背景层。
  _spawnBusStopRoofs(layout) {
    const { em } = this;
    for (const stop of (layout.busStops || [])) {
      // 顶棚底边 y：远端 BIKE_LANE_FAR_TOP-30+roofH，近端 NEAR_Y-15+roofH（与原渲染对齐）
      const roofY = stop.direction > 0
        ? BIKE_LANE_FAR_TOP - 30 + stop.roofH
        : NEAR_Y - 15 + stop.roofH;
      em.add(new PropEntity({
        propType: 'busstop-roof',
        x: stop.x, y: roofY,
        roofW: stop.roofW, roofH: stop.roofH,
        dir: stop.direction,
        width: stop.roofW, height: stop.roofH,
        _sortY: roofY,
        tags: ['busstop-roof'],
      }));
    }
  }

  // 为每个带 smartDef 的摊位生成一名常驻摊主：从地图边缘入场，路由到 seller 槽。
  _spawnStallSellers(bm) {
    const { em, sr } = this;
    const stalls = em.entities.filter(e => e.alive && e.smartDef?.activityType === 'stall' && e._slots);
    for (const stall of stalls) {
      const slot = stall._slots.find(s => s.role === 'seller');
      if (!slot || slot.reserved != null) continue;

      const fromLeft = stall.x < WORLD_WIDTH / 2;
      const seller = makeNPC(em, sr, {
        x: fromLeft ? 10 : WORLD_WIDTH - 10, y: stall.y,
        animation: 'walk', direction: fromLeft ? 1 : -1, speed: 28, vy: 0,
        minX: 0, maxX: WORLD_WIDTH, minY: stall.y - 24, maxY: stall.y + 24,
        tags: ['vendor'], npcType: 'stall_seller',
      });
      seller.scale = em.depthScale(stall.y);
      bm.register(seller, 'stall_seller');

      slot.reserved = seller.id;   // 预约 seller 槽，防止他人占用（永不释放）
      seller._routeTarget = {
        x: stall.x + slot.dx, y: stall.y + slot.dy,
        prop: stall, slot,
        abandonAfter: 60,
        onArrive: (n) => bm.socialLayer.onSlotArrival(n, stall, slot),
      };
      setState(seller, 'routing', 'stall_seller_entry');
    }
  }

  _makeSpawnFn(bm, roamY0, roamY1) {
    const { em, sr } = this;
    return (entry, zone) => {
      const npcType = zone.npcTypes[Math.floor(Math.random() * zone.npcTypes.length)];
      const posY    = entry.y ?? (zone.yRange[0] + zone.yRange[1]) / 2;

      const opts = {
        minX: zone.xRange[0], maxX: zone.xRange[1],
        minY: zone.yRange[0], maxY: zone.yRange[1],
      };

      if (zone.id === 'park') {
        opts.roamZone = { x0: zone.xRange[0], x1: zone.xRange[1], y0: roamY0, y1: roamY1 };
        opts.minY = roamY0;
        opts.maxY = roamY1;
      } else if (zone.isBusWaiter) {
        if (zone.busStopDir > 0) opts.scaleMul = 0.65;
      } else {
        opts.scaleMul = 0.65;
      }

      const npc = spawnOnePedestrian(npcType, em, sr, bm, { x: entry.x, y: posY }, opts);
      npc._ageTimer = -65;

      if (zone.isBusWaiter && bm.waitForBusLayer) {
        const stop = bm.waitForBusLayer._stops.find(s => s.direction === zone.busStopDir);
        if (stop && stop._waiters.length < stop.maxWaiters) {
          npc._routeTarget = {
            x: zone.xRange[0] + Math.random() * (zone.xRange[1] - zone.xRange[0]),
            y: zone.yRange[0] + Math.random() * (zone.yRange[1] - zone.yRange[0]),
            abandonAfter: 60,
            onArrive: (n) => { n._routeTarget = null; bm.waitForBusLayer.addWaiterDirect(n, stop); },
          };
          setState(npc, 'routing', 'entry_bus_waiter');
          return npc;
        }
      }

      return npc;
    };
  }
}
