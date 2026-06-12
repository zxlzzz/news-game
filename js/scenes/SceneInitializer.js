import { BuildingEntity }  from '../entity/building/BuildingEntity.js';
import { PropEntity }      from '../core/PropEntity.js';
import { BehaviorManager } from '../behavior/BehaviorManager.js';
import { ExitRegistry }    from '../npc/ExitRegistry.js';
import { SpawnManager }    from '../npc/SpawnManager.js';
import { NpcPropManager }  from '../npc/props/NpcPropManager.js';
import { WaitForBusLayer } from '../entity/busstop/WaitForBusLayer.js';
import { spawnBusStop }    from '../entity/busstop/busstop.js';
import { setState }        from '../behavior/Motor.js';
import { spawnPedestrians, spawnOnePedestrian } from '../npc/Pedestrians.js';
import { makeNPC }          from '../npc/npcUtil.js';
import { spawnChess }       from '../npc/Chess.js';
import { spawnDogWalker }   from '../npc/DogWalker.js';
import { spawnAthletes }    from '../npc/Athletes.js';
import { initVehicleSystem } from '../entity/vehicle/vehicleSpawner.js';
import {
  WORLD_WIDTH, BUILDING_BASE_Y, FAR_Y, NEAR_Y,
  SIDEWALK_FAR_Y, BIKE_LANE_FAR_TOP, BUILDING_EXIT_XS, BIKE_LANE_NEAR_BOTTOM,
  depthScale,
} from '../core/Layout.js';
import { initCrosswalks } from '../behavior/WalkMode.js';

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
    this._spawnNPCs(layout, sceneData);
  }

  // 行道树 / 公园树：从 bg 移到 entity 层。y = 树根落地点（layout 树坐标），
  // 不设 _sortY（用默认 y 参与 Y 排序）。渲染交给 PropDrawer.drawTree，半径 r → width = 2r。
  _spawnTrees(layout) {
    const { em } = this;
    const groups = [
      { list: layout.sidewalkTrees || [], tags: [] },
      { list: layout.parkTrees     || [], tags: [] },
    ];
    for (const { list, tags } of groups) {
      for (const t of list) {
        const prop = em.add(new PropEntity({
          propType: 'tree',
          x: t.x, y: t.y,
          width: t.r * 2, height: t.r * 2,
          tags,
        }));
        prop.scale = depthScale(prop.y);
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
      const prop = this.em.add(new PropEntity(cfg));
      prop.scale = depthScale(prop.y);
    }
  }

  _spawnNPCs(layout, sceneData) {
    const { em, sr, poseCache } = this;
    const bm = new BehaviorManager(em, poseCache);
    this.scene.behaviorManager = bm;

    initCrosswalks(layout.crosswalks);

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
    for (const stop of (layout.busStops || [])) spawnBusStop(this.em, stop);

    if (this.scene.trafficManager.busStops.length > 0)
      bm.waitForBusLayer = new WaitForBusLayer(this.scene.trafficManager.busStops);

    this.scene.spawnManager = new SpawnManager({
      spawnFn: this._makeSpawnFn(bm),
      exitRegistry,
      bm,
      target: 20,
    });
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
      seller.scale = depthScale(stall.y);
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

  _makeSpawnFn(bm) {
    const { em, sr } = this;
    const npcTypes = ['pedestrian', 'businessman', 'tourist'];
    return (entry) => {
      const npcType = npcTypes[Math.floor(Math.random() * npcTypes.length)];
      const posY    = entry.y ?? SIDEWALK_FAR_Y;
      const npc     = spawnOnePedestrian(npcType, em, sr, bm, { x: entry.x, y: posY });
      npc._ageTimer = -65;
      return npc;
    };
  }
}
