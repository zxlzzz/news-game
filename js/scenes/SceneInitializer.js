import { BuildingEntity }  from '../entity/building/BuildingEntity.js';
import { PropEntity }      from '../core/PropEntity.js';
import { BehaviorManager } from '../behavior/BehaviorManager.js';
import { ExitRegistry }    from '../npc/ExitRegistry.js';
import { Director }        from '../behavior/Director.js';
import { NpcPropManager }  from '../npc/props/NpcPropManager.js';
import { WORLD_WIDTH, BUILDING_BASE_Y, resolveY, depthScale } from '../core/Layout.js';
import { initCrosswalks } from '../behavior/WalkMode.js';
import { NavGrid, setNavGrid } from '../behavior/nav/NavGrid.js';
import { getFeatureInit } from '../core/featureRegistry.js';
import './sceneFeatures.js';  // 副作用 import：触发所有 feature type 的 registerFeature()

function _need(v, what) {
  if (v == null) throw new Error(`SceneInitializer: scene config 缺 ${what}`);
  return v;
}

/** side + margin → 世界 X（"left" 贴左边缘外 margin px，"right" 贴右边缘外 margin px） */
function _resolveSideX(side, margin) {
  if (side === 'left')  return -margin;
  if (side === 'right') return WORLD_WIDTH + margin;
  throw new Error(`SceneInitializer: unknown side '${side}' (合法值 left/right)`);
}

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

  // 行道树 / 公园树：从 bg 移到 entity 层。y = 树根落地点（layout 树坐标）。
  // 排序基准由 tree.js footprint 的负 sortDY(-height*0.35) 决定（PropEntity 构造时
  // 据此推出 _sortY，比树根更靠后），让近处路过的 NPC 走在树前。
  // 渲染交给 drawTree，半径 r → width = 2r。
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

    // NavGrid — 在所有静态道具（props/trees）入场后烘焙
    const navGrid = new NavGrid();
    navGrid.bake(em.entities, layout, sceneData.zones);
    setNavGrid(navGrid);

    const bm = new BehaviorManager(em, poseCache);
    this.scene.behaviorManager = bm;

    initCrosswalks(layout.crosswalks);

    // ── ExitRegistry：边缘 + 建筑门（几何来自 scene.json#exits，键名 = yBand 名字）──
    const exitsCfg = _need(sceneData.exits, 'exits');
    const exitRegistry = new ExitRegistry();
    for (const e of _need(exitsCfg.edges, 'exits.edges')) {
      exitRegistry.register({
        id: e.id, type: 'edge',
        x: _resolveSideX(e.side, e.margin), y: null, yZone: null,
        facing: e.facing,
      });
    }

    const doorCfg = _need(exitsCfg.buildingDoor, 'exits.buildingDoor');
    const doorY   = resolveY(_need(doorCfg.yBand, 'exits.buildingDoor.yBand')) + (doorCfg.yOffset ?? 0);
    const doorZone = _need(doorCfg.yZone, 'exits.buildingDoor.yZone').map(resolveY);
    const buildingDoors = [];
    for (const b of (sceneData?.buildings ?? [])) {
      if (b.door == null) continue;
      const id = `building_${b.x}`;
      exitRegistry.register({ id, type: 'building', x: b.door, y: doorY, yZone: doorZone, facing: 0 });
      buildingDoors.push({ id, x: b.door });
    }
    bm.exitRegistry = exitRegistry;

    // ── spawnPoints：建筑门衍生点（代码算）+ scene.json#spawnPoints 固定点（配置） ──
    const spawnPoints = [
      ...buildingDoors.map(d => ({ x: d.x, y: resolveY(doorCfg.yBand), facing: 0 })),
      ...(sceneData.spawnPoints ?? []).map(p => ({
        x: _resolveSideX(p.side, p.margin),
        y: resolveY(_need(p.yBand, 'spawnPoints[].yBand')) + (p.yOffset ?? 0),
        facing: p.facing,
      })),
    ];

    // ── propManager：常驻基础设施（StreetScene.update 每帧读取，与是否有 dog_walker
    //    feature 无关——始终创建，供任何需要 leash/道具挂载的 feature 使用）────────
    this.scene.propManager = new NpcPropManager(em);

    // ── features：scene.json#features 声明的可选场景内容，按数组顺序初始化 ────────
    // 顺序即 Math.random() 消费顺序：调换会改变具体生成结果（位置/数量），
    // 即使各 feature 逻辑上互不依赖。
    const ctx = {
      em, sr, bm, scene: this.scene, layout, sceneData,
      propManager: this.scene.propManager, navGrid, spawnPoints,
      worldWidth: WORLD_WIDTH,
    };
    for (const entry of (sceneData.features ?? [])) {
      const { type, ...cfg } = entry;
      const init = getFeatureInit(type);
      if (!init) throw new Error(`SceneInitializer: unknown feature type '${type}'`);
      init(ctx, cfg);
    }

    // ── Director（替换 SpawnManager）──────────────────────────────────────────
    // busStops 经可选链：vehicles feature 未声明时 trafficManager 不存在
    // （例：无车流的场景，如学校操场）。
    const director = new Director({
      bm, em, sr,
      exitRegistry,
      buildingDoors,
      spawnPoints,
      busStops: this.scene.trafficManager?.busStops ?? [],
    });
    // 初始批次 NPC 补齐 exitBias
    director.assignDefaults(bm.npcs);

    this.scene.director = director;
  }
}
