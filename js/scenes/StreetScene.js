/**
 * StreetScene
 * 主场景：2.5D俯视角街道 + 统一Entity系统 + 取景框 + 拍照/发布
 *
 * 渲染层次（从下到上）：
 *   bgGraphics     — 静态地面（道路/人行道/树木），只绘制一次
 *   entityGraphics — 所有 Entity（建筑、道具、NPC），每帧按Y排序重绘
 *   vfGraphics     — 取景框 UI，最上层
 */

import { StickRenderer }   from '../StickRenderer.js';
import { EntityManager }   from '../EntityManager.js';
import { BehaviorManager } from '../BehaviorManager.js';
import { BuildingEntity }  from '../BuildingEntity.js';
import { PropEntity }      from '../PropEntity.js';
import { Viewfinder }      from '../Viewfinder.js';
import { DebugOverlay }    from '../DebugOverlay.js';
import { SceneRenderer }   from './SceneRenderer.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  GRAY_SKY, BUILDING_BASE_Y, FAR_Y, NEAR_Y,
  PARK_TOP, PARK_BOTTOM, SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y,
  BIKE_LANE_FAR_TOP, BUILDING_EXIT_XS,
} from '../SceneConfig.js';
import { ExitRegistry }      from '../behavior/ExitRegistry.js';
import { SpawnManager }     from '../behavior/SpawnManager.js';
import { spawnPedestrians, spawnOnePedestrian } from '../npcs/Pedestrians.js';
import { spawnChess }       from '../npcs/Chess.js';
import { spawnDogWalker }   from '../npcs/DogWalker.js';
import { spawnAthletes }    from '../npcs/Athletes.js';
import { initVehicleSystem } from '../npcs/Vehicles.js';
import { NpcPropManager }   from '../props/NpcPropManager.js';
import { WaitForBusLayer }  from '../behavior/WaitForBusLayer.js';
import { setState }         from '../behavior/BaseStateMachine.js';

const POSE_FILES = {
  // held poses
  held_phone_call:       'held pose/phone',
  held_phone_look:       'held pose/phone_look',
  held_smoke:            'held pose/smoke',
  held_cross_arm:        'held pose/cross_arm',
  held_hands_in_pocket:  'held pose/hands_in_pocket',
  // traits
  trait_hold_bag:  'trait/hold',
  trait_walk_dog:  'trait/walk_dog',
  trait_backpack:  'trait/backpack',
  trait_umbrella:  'trait/umbrella',
  // gestures
  gesture_check_watch: 'gesture/watch',
  gesture_stretch:     'gesture/stretch',
  gesture_use_vending: 'gesture/machine',
  gesture_use_trash:   'gesture/trash',
  // loiter
  loiter_phone: 'loiter/phone',
  loiter_bag_a: 'loiter/bag_a',
  loiter_bag_b: 'loiter/bag_b',
  // sub_event
  sub_event_push:      'sub_event/push',
  sub_event_give_item: 'sub_event/give_item',
  sub_event_handshake: 'sub_event/handshake',
  sub_event_point_at:  'sub_event/point_at',
};

const ANIM_FILES = {
  walk: 'walk', run: 'run', idle: 'idle', jog: 'jog', bike: 'bike',
  mobile: 'mobile', chess: 'chess', dogwalk: 'pet/dog_walk',
  single: 'single', sit_bench: 'sit_bench', fall: 'fall',
  lie_ground: 'lie_ground', lean_wall: 'lean_wall', squat: 'squat',
  sit_ground: 'sit_ground', lie_bench: 'lie_bench', get_up: 'get_up',
  chess_onlookers: 'chess_onlookers', mobike: 'mobike',
};

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
    this.lastPhoto = null;
  }

  preload() {
    this.load.json('scene_data', 'assets/scene.json');
    for (const [key, file] of Object.entries(ANIM_FILES)) {
      this.load.json('anim_' + key, `assets/animations/${file}.json`);
    }
    for (const [key, file] of Object.entries(POSE_FILES)) {
      this.load.json('pose_' + key, `assets/animations/${file}.json`);
    }
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(GRAY_SKY);

    this.skyGraphics    = this.add.graphics().setScrollFactor(0.45);
    this.bgGraphics     = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.vfGraphics     = this.add.graphics();

    const sceneData = this.cache.json.get('scene_data');
    const layout = sceneData.layout;

    const sceneRenderer = new SceneRenderer(this.bgGraphics, this.skyGraphics, layout);
    sceneRenderer.drawAll();

    this.stickRenderer = new StickRenderer(this);
    for (const key of Object.keys(ANIM_FILES)) {
      this.stickRenderer.loadAnimation(key, this.cache.json.get('anim_' + key));
    }

    const poseCache = this._buildPoseCache();

    this.entityManager = new EntityManager({
      farY: SIDEWALK_FAR_Y, nearY: SIDEWALK_NEAR_Y, farScale: 0.182, nearScale: 0.434,
    });

    this._spawnBuildings(sceneData);
    this._spawnProps(sceneData);
    this._spawnNPCs(layout, poseCache);

    this.viewfinder = new Viewfinder(this, { x: 310, y: 295, width: 210, height: 145 });
    this._createUI();
    this.debugOverlay = new DebugOverlay(this, this.behaviorManager, this.entityManager);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-P', () => this._exportImage());
    this.input.keyboard.on('keydown-D', () => this.debugOverlay.toggle());
    this._setupZoom();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  _createUI() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.uiText = this.add.text(10, 10, '← → 滚动  |  滚轮缩放  Z 重置  |  拖动取景框 · 拖右下角缩放  |  P 导出长图  |  D 调试', {
      fontFamily: '"JetBrains Mono", monospace', fontSize: '13px', color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '13px', color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.85)', padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.headlinePanel = this.add.text(10, 64, '', {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '15px', color: '#ffffff',
      backgroundColor: 'rgba(10,10,30,0.90)', padding: { x: 12, y: 8 },
      wordWrap: { width: W - 200 },
    }).setScrollFactor(0).setDepth(200).setVisible(false);

    this.flashOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
      .setScrollFactor(0).setDepth(190);

    this.btnCapture = this._makeButton(W - 126, H - 50, '[ 拍  照 ]', '#b83000');
    this.btnCapture.on('pointerdown', () => this._takePhoto());

    this.btnPublish = this._makeButton(W - 126, H - 90, '[ 发布新闻 ]', '#1a3d99');
    this.btnPublish.setVisible(false);
    this.btnPublish.on('pointerdown', () => this._publishNews());
  }

  _makeButton(x, y, label, bgColor) {
    const btn = this.add.text(x, y, label, {
      fontFamily: '"Noto Sans SC", sans-serif', fontSize: '14px', color: '#ffffff',
      backgroundColor: bgColor, padding: { x: 12, y: 7 },
    }).setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.78));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    return btn;
  }

  // ─── 导出长图 ───────────────────────────────────────────────────────────────

  _exportImage() {
    const key = '__pano_' + Date.now();
    const dt = this.textures.addDynamicTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
    if (!dt) return;
    dt.fill(GRAY_SKY, 1);
    dt.draw([this.skyGraphics, this.bgGraphics, this.entityGraphics], 0, 0);
    dt.snapshot((image) => {
      const a = document.createElement('a');
      a.href = image.src;
      a.download = `news-street-pano-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.textures.remove(key);
    });
  }

  // ─── 拍照 / 发布 ──────────────────────────────────────────────────────────────

  _takePhoto() {
    const count = this.viewfinder.capturedEntities.length;
    if (count === 0) {
      this.captureText.setText('取景框内没有目标！').setColor('#cc2200');
      this.time.delayedCall(1500, () => this.captureText.setText(''));
      return;
    }
    this.lastPhoto = { tags: this.viewfinder.getCapturedTags(), count };
    this.flashOverlay.setAlpha(0.80);
    this.tweens.add({ targets: this.flashOverlay, alpha: 0, duration: 220, ease: 'Power2' });
    this.btnPublish.setVisible(true);
    this.captureText
      .setText(`已拍摄 ${count} 个目标  [${this.lastPhoto.tags.join('  ')}]`)
      .setColor('#226600');
  }

  _publishNews() {
    if (!this.lastPhoto) return;
    const headline = this._generateHeadline(this.lastPhoto.tags, this.lastPhoto.count);
    this.headlinePanel.setText(`【快讯】${headline}`).setVisible(true);
    this.time.delayedCall(7000, () => this.headlinePanel.setVisible(false));
    this.lastPhoto = null;
    this.btnPublish.setVisible(false);
    this.captureText.setText('新闻已发布！').setColor('#1a3d99');
    this.time.delayedCall(2000, () => this.captureText.setText(''));
  }

  _generateHeadline(tags, count) {
    const subject = tags.filter(t => !['building', 'street-furniture'].includes(t)).join('与') || tags[0];
    const templates = [
      `${count}个目标聚集现场，真相令人震惊`,
      `独家现场：${subject}背后的秘密`,
      `记者深度揭秘：${subject}事件始末`,
      `突发！${subject}异动，专家紧急发声`,
      `${subject}事件曝光，舆论哗然`,
      `疑云！${subject}现场完整记录`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ─── 滚轮缩放 ─────────────────────────────────────────────────────────────────

  _setupZoom() {
    const cam = this.cameras.main;
    this.input.on('wheel', (pointer, _objs, _dx, deltaY) => {
      const factor  = deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Phaser.Math.Clamp(cam.zoom * factor, 0.5, 2.0);
      const wx = cam.scrollX + pointer.x / cam.zoom;
      const wy = cam.scrollY + pointer.y / cam.zoom;
      cam.zoom = newZoom;
      cam.scrollX = wx - pointer.x / newZoom;
      cam.scrollY = wy - pointer.y / newZoom;
      this._updateUIForZoom(newZoom);
    });
    this.input.keyboard.on('keydown-Z', () => {
      cam.zoom = 1.0;
      cam.scrollY = 0;
      this._updateUIForZoom(1.0);
    });
  }

  _updateUIForZoom(zoom) {
    const iz = 1 / zoom;
    const W  = this.cameras.main.width;
    const H  = this.cameras.main.height;
    this.uiText.setPosition(10 * iz, 10 * iz);
    this.captureText.setPosition(10 * iz, 36 * iz);
    this.headlinePanel.setPosition(10 * iz, 64 * iz);
    this.flashOverlay.setPosition(W / 2 * iz, H / 2 * iz);
    this.flashOverlay.setDisplaySize(W * iz, H * iz);
    this.btnCapture.setPosition((W - 126) * iz, (H - 50) * iz);
    this.btnPublish.setPosition((W - 126) * iz, (H - 90) * iz);
    if (this.debugOverlay) this.debugOverlay.panel.setPosition(10 * iz, 150 * iz);
  }

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    const spd = 300 * (delta / 1000);

    if (this.cursors.left.isDown)       cam.scrollX -= spd;
    else if (this.cursors.right.isDown) cam.scrollX += spd;
    if (this.cursors.up.isDown)         cam.scrollY -= spd;
    else if (this.cursors.down.isDown)  cam.scrollY += spd;

    const vfc    = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - cam.scrollX < margin)                    cam.scrollX -= spd * 0.5;
    else if (cam.scrollX + cam.width - vfc.x < margin)   cam.scrollX += spd * 0.5;

    this.behaviorManager.update(delta);
    this.spawnManager.update(delta / 1000);
    if (this.trafficManager) {
      this.trafficManager.update(delta);
      this.trafficManager.cyclistSpawner?.update(delta);
    }
    this.entityManager.update(delta);
    if (this.propManager) this.propManager.update(delta);
    this.viewfinder.updateCapture(this.entityManager.getAlive());

    this.entityGraphics.clear();
    this.entityManager.draw(this.entityGraphics);
    if (this.propManager) this.propManager.draw(this.entityGraphics);

    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

    this.debugOverlay.update();

    if (!this.lastPhoto) {
      const captured = this.viewfinder.capturedEntities;
      if (captured.length > 0) {
        this.captureText
          .setText(`取景框内: ${captured.length} 个目标  [${this.viewfinder.getCapturedTags().join(', ')}]`)
          .setColor('#cc2200');
      } else if (this.captureText.style.color === 'rgb(204, 34, 0)') {
        this.captureText.setText('');
      }
    }
  }

  // ─── poseCache ───────────────────────────────────────────────────────────────

  _buildPoseCache() {
    const g = (key) => this.cache.json.get('pose_' + key);
    return {
      held: {
        phone_call:       g('held_phone_call'),
        phone_look:       g('held_phone_look'),
        smoke:            g('held_smoke'),
        cross_arm:        g('held_cross_arm'),
        hands_in_pocket:  g('held_hands_in_pocket'),
      },
      trait: {
        hold_bag:  g('trait_hold_bag'),
        walk_dog:  g('trait_walk_dog'),
        backpack:  g('trait_backpack'),
        umbrella:  g('trait_umbrella'),
      },
      gesture: {
        check_watch: g('gesture_check_watch'),
        stretch:     g('gesture_stretch'),
        wave:        { type: 'gesture', activeJoints: [], keyframes: [], loop: false },
        use_vending: g('gesture_use_vending'),
        use_trash:   g('gesture_use_trash'),
      },
      loiter: {
        phone: g('loiter_phone')?.joints ?? {},
        bag_a: g('loiter_bag_a')?.joints ?? {},
        bag_b: g('loiter_bag_b')?.joints ?? {},
      },
      sub_event: {
        push:      g('sub_event_push'),
        give_item: g('sub_event_give_item'),
        handshake: g('sub_event_handshake'),
        point_at:  g('sub_event_point_at'),
      },
    };
  }

  // ─── 实体生成 ─────────────────────────────────────────────────────────────────

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
      this.entityManager.add(e);
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
      this.entityManager.add(new PropEntity(cfg));
    }
  }

  _spawnNPCs(layout, poseCache) {
    const em = this.entityManager;
    const sr = this.stickRenderer;
    this.behaviorManager = new BehaviorManager(em, poseCache);
    const bm = this.behaviorManager;

    const exitRegistry = new ExitRegistry();
    exitRegistry.register({ id: 'edge_left',  type: 'edge', x: -200,              y: null, yZone: null, facing: -1 });
    exitRegistry.register({ id: 'edge_right', type: 'edge', x: WORLD_WIDTH + 200, y: null, yZone: null, facing:  1 });
    for (let i = 0; i < BUILDING_EXIT_XS.length; i++) {
      exitRegistry.register({ id: 'building_' + 'abcd'[i], type: 'building', x: BUILDING_EXIT_XS[i], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    }
    bm.exitRegistry = exitRegistry;

    spawnPedestrians(em, sr, bm);
    spawnChess(em, sr, bm, layout.chessPlaza);
    this.propManager = new NpcPropManager(em);
    spawnDogWalker(em, sr, bm, this.propManager);
    spawnAthletes(em, sr, bm);
    this.trafficManager = initVehicleSystem(em, sr);

    if (this.trafficManager.busStops.length > 0)
      bm.waitForBusLayer = new WaitForBusLayer(this.trafficManager.busStops);

    const RY0 = PARK_TOP + 16, RY1 = PARK_BOTTOM - 8;
    const WR = [50, WORLD_WIDTH - 50];
    const spawnZones = [
      { id: 'sidewalk',      target: 3,  yRange: [BUILDING_BASE_Y, FAR_Y], xRange: WR, exitTypes: ['building'], npcTypes: ['pedestrian', 'businessman'] },
      { id: 'park',          target: 10, yRange: [RY0, RY1],               xRange: WR, exitTypes: ['edge'],     npcTypes: ['pedestrian', 'tourist'] },
      { id: 'busstop_far',   target: 3,  yRange: [SIDEWALK_FAR_Y - 20, BIKE_LANE_FAR_TOP], xRange: [380, 620],   exitTypes: ['building', 'edge'], npcTypes: ['pedestrian', 'businessman'], isBusWaiter: true, busStopDir: +1 },
      { id: 'busstop_near',  target: 3,  yRange: [PARK_TOP, PARK_TOP + 25],                xRange: [1380, 1620], exitTypes: ['edge'],              npcTypes: ['pedestrian', 'tourist'],     isBusWaiter: true, busStopDir: -1 },
    ];
    this.spawnManager = new SpawnManager({ spawnFn: _makeSpawnFn(bm, em, sr, RY0, RY1), exitRegistry, bm, zones: spawnZones });
  }
}

// ─── SpawnManager 入场工厂 ─────────────────────────────────────────────────────
function _makeSpawnFn(bm, em, sr, roamY0, roamY1) {
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
