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
import {
  WORLD_WIDTH, WORLD_HEIGHT, SKY_Y, FAR_Y, NEAR_Y, BUILDING_BASE_Y,
  PARK_TOP, PARK_BOTTOM, SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y, CHESS_PLAZA, MINI_PARK,
  GRAY_SKY, GRAY_FAR_PAVE, GRAY_ROAD, GRAY_NEAR_PAVE, GRAY_CURB,
  LINE_FAR_WIDTH, LINE_NEAR_COLOR, LINE_NEAR_WIDTH,
  CLOUD_POSITIONS, SIDEWALK_TREE_XS, SIDEWALK_TREE_Y,
  PARK_TREE_XS, PARK_TREE_Y, ROAD_STRIPE_SPACING, ROAD_STRIPE_LENGTH,
  BUILDING_EXIT_XS,
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
} from '../SceneConfig.js';
import { ExitRegistry }      from '../behavior/ExitRegistry.js';
import { SpawnManager }     from '../behavior/SpawnManager.js';
import { spawnPedestrians, spawnOnePedestrian } from '../npcs/Pedestrians.js';
import { spawnChess }       from '../npcs/Chess.js';
import { spawnDogWalker }   from '../npcs/DogWalker.js';
import { spawnAthletes }    from '../npcs/Athletes.js';
import { initVehicleSystem } from '../npcs/Vehicles.js';

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
    this.lastPhoto = null;
  }

  preload() {
    this.load.json('scene_data',      'assets/scene.json');
    this.load.json('anim_walk',       'assets/animations/walk.json');
    this.load.json('anim_run',        'assets/animations/run.json');
    this.load.json('anim_idle',       'assets/animations/idle.json');
    this.load.json('anim_jog',        'assets/animations/jog.json');
    this.load.json('anim_bike',       'assets/animations/bike.json');
    this.load.json('anim_mobile',     'assets/animations/mobile.json');
    this.load.json('anim_chess',      'assets/animations/chess.json');
    this.load.json('anim_dogwalk',    'assets/animations/pet/dog_walk.json');
    // 行为状态机第一批用到的姿态
    this.load.json('anim_single',     'assets/animations/single.json');
    this.load.json('anim_sit_bench',  'assets/animations/sit_bench.json');
    this.load.json('anim_fall',       'assets/animations/fall.json');
    this.load.json('anim_lie_ground', 'assets/animations/lie_ground.json');
    // 批次 1：路人扩展状态
    this.load.json('anim_lean_wall',       'assets/animations/lean_wall.json');
    this.load.json('anim_squat',           'assets/animations/squat.json');
    this.load.json('anim_sit_ground',      'assets/animations/sit_ground.json');
    this.load.json('anim_lie_bench',       'assets/animations/lie_bench.json');
    this.load.json('anim_get_up',          'assets/animations/get_up.json');
    this.load.json('anim_chess_onlookers', 'assets/animations/chess_onlookers.json');
    this.load.json('anim_cross_arm',       'assets/animations/cross_arm.json');
    this.load.json('anim_mobike',          'assets/animations/mobike.json');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(GRAY_SKY);

    // 渲染层（建筑区背景色由 camera background 提供）
    // skyGraphics 用较小 scrollFactor → 镜头平移时天空/云/远景慢于前景，制造纵深视差。
    // 注意：取景框按世界坐标判定捕获，故只让"非交互装饰背景"做视差，建筑/人物保持 1:1。
    this.skyGraphics    = this.add.graphics().setScrollFactor(0.45);
    this.bgGraphics     = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.vfGraphics     = this.add.graphics();

    // 远景视差层 + 静态地面（只绘制一次）
    this._drawSky();
    this._drawGround();
    this._drawBusStops();

    // 火柴人渲染器
    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk',       this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run',        this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle',       this.cache.json.get('anim_idle'));
    this.stickRenderer.loadAnimation('jog',        this.cache.json.get('anim_jog'));
    this.stickRenderer.loadAnimation('bike',       this.cache.json.get('anim_bike'));
    this.stickRenderer.loadAnimation('mobile',     this.cache.json.get('anim_mobile'));
    this.stickRenderer.loadAnimation('chess',      this.cache.json.get('anim_chess'));
    this.stickRenderer.loadAnimation('dogwalk',    this.cache.json.get('anim_dogwalk'));
    this.stickRenderer.loadAnimation('single',     this.cache.json.get('anim_single'));
    this.stickRenderer.loadAnimation('sit_bench',  this.cache.json.get('anim_sit_bench'));
    this.stickRenderer.loadAnimation('fall',       this.cache.json.get('anim_fall'));
    this.stickRenderer.loadAnimation('lie_ground', this.cache.json.get('anim_lie_ground'));
    this.stickRenderer.loadAnimation('lean_wall',       this.cache.json.get('anim_lean_wall'));
    this.stickRenderer.loadAnimation('squat',           this.cache.json.get('anim_squat'));
    this.stickRenderer.loadAnimation('sit_ground',      this.cache.json.get('anim_sit_ground'));
    this.stickRenderer.loadAnimation('lie_bench',       this.cache.json.get('anim_lie_bench'));
    this.stickRenderer.loadAnimation('get_up',          this.cache.json.get('anim_get_up'));
    this.stickRenderer.loadAnimation('chess_onlookers', this.cache.json.get('anim_chess_onlookers'));
    this.stickRenderer.loadAnimation('cross_arm',       this.cache.json.get('anim_cross_arm'));
    this.stickRenderer.loadAnimation('mobike',          this.cache.json.get('anim_mobike'));

    // 统一 Entity 管理器
    // 缩放参考用人行道带（远端步行带 → 近端步行带），让远小近大对比贯穿整个纵深
    this.entityManager = new EntityManager({
      farY: SIDEWALK_FAR_Y, nearY: SIDEWALK_NEAR_Y, farScale: 0.182, nearScale: 0.434,
    });

    this._spawnBuildings();
    this._spawnProps();
    this._spawnNPCs();

    this.viewfinder = new Viewfinder(this, {
      x: 310, y: 295, width: 210, height: 145,
    });

    this._createUI();

    // 行为系统可视调试层（按 D 切换；console 结构化日志由 localStorage 'npc-debug' 控制）
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
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.85)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '13px',
      color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.85)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.headlinePanel = this.add.text(10, 64, '', {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: 'rgba(10,10,30,0.90)',
      padding: { x: 12, y: 8 },
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
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: bgColor,
      padding: { x: 12, y: 7 },
    }).setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setAlpha(0.78));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    return btn;
  }

  // ─── 导出整条街长图（按 P）：离屏合成 sky+bg+entity 三层（均为世界坐标），导出 PNG ──
  // 不含 HUD/取景框；不打扰可见画布。三层合起来即完整 WORLD_WIDTH×WORLD_HEIGHT 场景。
  _exportImage() {
    const key = '__pano_' + Date.now();
    const dt = this.textures.addDynamicTexture(key, WORLD_WIDTH, WORLD_HEIGHT);
    if (!dt) return;
    dt.fill(GRAY_SKY, 1);                                  // 天空/建筑带底色
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
    this.lastPhoto = {
      tags:  this.viewfinder.getCapturedTags(),
      count,
    };
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
      // 以鼠标位置为支点缩放（世界坐标不变）
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

  // 把所有 scrollFactor=0 的 UI 元素位置除以 zoom，抵消相机缩放导致的位移
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

    // 取景框靠近屏幕边缘时自动滚动
    const vfc    = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - cam.scrollX < margin)                    cam.scrollX -= spd * 0.5;
    else if (cam.scrollX + cam.width - vfc.x < margin)   cam.scrollX += spd * 0.5;

    // 行为状态机先决策（设状态/动画/速度/朝向），再由 EntityManager 推进位移与帧
    this.behaviorManager.update(delta);
    this.spawnManager.update(delta / 1000);
    if (this.trafficManager) {
      this.trafficManager.update(delta);
      this.trafficManager.cyclistSpawner?.update(delta);
    }
    this.entityManager.update(delta);
    this.viewfinder.updateCapture(this.entityManager.getAlive());

    this.entityGraphics.clear();
    this.entityManager.draw(this.entityGraphics);

    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

    // 调试浮标/面板（仅在开启时刷新）
    this.debugOverlay.update();

    // 取景框内容提示
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

  // ─── 静态地面（bgGraphics，只绘一次） ────────────────────────────────────────

  _drawGround() {
    const g = this.bgGraphics;

    // 建筑街墙背后不再铺灰色背景：露出 skyGraphics 的天空底色 + 远景剪影（视差）。
    // 建筑前人行道
    g.fillStyle(GRAY_FAR_PAVE, 1);
    g.fillRect(0, BUILDING_BASE_Y, WORLD_WIDTH, FAR_Y - BUILDING_BASE_Y);

    // 机动车道
    g.fillStyle(GRAY_ROAD, 1);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);

    // 近端非机动车道
    g.fillStyle(GRAY_NEAR_PAVE, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, BIKE_LANE_NEAR_BOTTOM - NEAR_Y);

    // 公园广场（草地）
    g.fillStyle(0xcacaca, 1);
    g.fillRect(0, PARK_TOP, WORLD_WIDTH, WORLD_HEIGHT - PARK_TOP);

    // 非机动车道分隔实线
    g.lineStyle(1.5, 0x888888, 1);
    g.lineBetween(0, BIKE_LANE_FAR_TOP, WORLD_WIDTH, BIKE_LANE_FAR_TOP);           // 远端上边界
    g.lineBetween(0, BIKE_LANE_NEAR_BOTTOM, WORLD_WIDTH, BIKE_LANE_NEAR_BOTTOM);   // 近端下边界

    this._drawRoadMarkings(g);
    this._drawSidewalkTiles(g, BUILDING_BASE_Y + 3, BIKE_LANE_FAR_TOP - 3, /*near=*/false);
    this._drawRoadPatches(g);
    this._drawParkPlaza(g);
    this._drawMiniPark(g);
    this._drawChessPlaza(g);
    this._drawParkPaths(g);
    this._drawTrees(g);
  }

  // ─── 公交站台视觉（bgGraphics，只绘一次） ────────────────────────────────────
  // 两站同款开放候车亭（顶棚宽 250px ≈ 公交车长 130%）：
  //   FAR x=500 — 顶棚贴 FAR_Y 从上往上挂，支柱向上伸，长椅靠顶棚底
  //   NEAR x=1500 — 港湾式，顶棚贴 NEAR_Y，支柱向下伸，长椅在棚下
  _drawBusStops() {
    const g  = this.bgGraphics;
    const ft = BIKE_LANE_FAR_TOP; // 248 — 远端非机动车道顶边
    const fy = FAR_Y;             // 268 — 远端路沿
    const ny = NEAR_Y;            // 333 — 近端路沿

    const ROOF_W = 250;   // 两站共用：顶棚宽
    const ROOF_H = 6;     // 顶棚厚
    const PIL_X  = 112;   // 支柱到中心的横向距离（roofW/2 - 13）

    // 辅助：绘制站牌板（蓝底白内，带模拟图案）
    const drawSign = (px, py) => {
      const sw = 22, sh = 15;
      const sx = px - Math.round(sw / 2);
      g.fillStyle(0x1a44aa, 1);
      g.fillRect(sx, py, sw, sh);
      g.lineStyle(1, 0x0a0820, 1);
      g.strokeRect(sx, py, sw, sh);
      g.fillStyle(0xeaeaf0, 1);
      g.fillRect(sx + 2, py + 2, sw - 4, sh - 4);
      g.fillStyle(0x2255bb, 0.85);
      g.fillRect(sx + 3, py + 3, sw - 6, 4);
      g.fillStyle(0x303050, 0.55);
      g.fillRect(sx + 3, py + 8,  sw - 6, 1);
      g.fillRect(sx + 3, py + 10, sw - 6, 1);
      g.fillRect(sx + 3, py + 12, sw - 8, 1);
    };

    // ── FAR 侧港湾候车亭 x=500（仿 NEAR 港湾式：在远端非机动车道开港湾、路沿弯曲；
    //     顶棚在上、支柱向下开口朝路；透视更小）──────────────────────────────────
    {
      const sx     = 500;
      const F      = 0.76;             // 透视缩小系数
      const BAY_W  = Math.round(266 * F);  // 202 — 港湾宽
      const BAY_D  = 9;                // 港湾深度（向非机动车道凸入）
      const FROOF_W= Math.round(ROOF_W * F); // 190 — 顶棚宽
      const FPIL_X = Math.round(112 * F);    // 85  — 支柱到中心距
      const bx0    = sx - BAY_W / 2;   // 399
      const bx1    = sx + BAY_W / 2;   // 601

      // 港湾路面（从远端路沿 FAR_Y 向上凸入非机动车道，公交向远端路沿靠站）
      g.fillStyle(GRAY_ROAD, 1);
      g.fillRect(bx0, fy - BAY_D, BAY_W, BAY_D);   // 259–268

      // 港湾入口路沿角（镜像 NEAR：开口朝下/朝路，路沿在上侧）
      g.fillStyle(0xd8d8d8, 1);
      g.fillRect(bx0 - 3, fy - BAY_D - 3, 3,         BAY_D + 3);
      g.fillRect(bx1,     fy - BAY_D - 3, 3,         BAY_D + 3);
      g.fillRect(bx0 - 3, fy - BAY_D - 3, BAY_W + 6, 3);

      // 候车平台铺装（港湾顶沿）
      g.fillStyle(0xb2b2b0, 1);
      g.fillRect(bx0, fy - BAY_D - 2, BAY_W, 2);

      // 顶棚（在上，贴远端人行道下沿）
      const rX    = sx - FROOF_W / 2;  // 405
      const roofT = ft - 12;           // 236 — 顶棚顶（远端人行道内）
      g.fillStyle(0x686866, 1);
      g.fillRect(rX, roofT, FROOF_W, ROOF_H);
      g.lineStyle(1.6, 0x181818, 1);
      g.strokeRect(rX, roofT, FROOF_W, ROOF_H);

      // 支柱（从顶棚底向下延伸到候车平台）
      const pillarT = roofT + ROOF_H;       // 242
      const pillarB = fy - BAY_D - 2;       // 257
      g.lineStyle(2.5, 0x282828, 1);
      g.lineBetween(sx - FPIL_X, pillarT, sx - FPIL_X, pillarB);
      g.lineBetween(sx + FPIL_X, pillarT, sx + FPIL_X, pillarB);

      // 长椅（棚下居中）
      const benchY = pillarT + 5;           // 247
      g.fillStyle(0x565654, 1);
      g.fillRect(sx - 66, benchY, 132, 4);
      g.lineStyle(0.8, 0x181818, 0.7);
      g.strokeRect(sx - 66, benchY, 132, 4);
      // 椅腿（向下）
      g.lineStyle(1.5, 0x303030, 0.9);
      g.lineBetween(sx - 56, benchY + 4, sx - 56, benchY + 8);
      g.lineBetween(sx + 56, benchY + 4, sx + 56, benchY + 8);

      // 独立站牌杆（亭外右侧）
      const poleX  = bx1 + 5;          // 606
      const poleTy = roofT;            // 236 — 牌面顶
      const poleBy = fy - BAY_D - 2;   // 257 — 杆底（落到平台）
      g.lineStyle(2.2, 0x2e2e2e, 1);
      g.lineBetween(poleX, poleTy + 15, poleX, poleBy);
      drawSign(poleX, poleTy);
    }

    // ── NEAR 侧开放候车亭 x=1500（右下，港湾式）─────────────────────────────
    {
      const sx    = 1500;
      const BAY_W = 266;              // 港湾宽（略宽于顶棚）
      const BAY_D = 9;               // 港湾深度（向公园侧凸出）
      const bx0   = sx - BAY_W / 2;  // 1367
      const bx1   = sx + BAY_W / 2;  // 1633

      // 港湾路面（覆盖近端路沿条带与自行车道，延伸机动车道色）
      g.fillStyle(GRAY_ROAD, 1);
      g.fillRect(bx0, ny, BAY_W, BAY_D);

      // 港湾入口路沿角
      g.fillStyle(0xd8d8d8, 1);
      g.fillRect(bx0 - 3, ny,         3,         BAY_D + 3);
      g.fillRect(bx1,     ny,         3,         BAY_D + 3);
      g.fillRect(bx0 - 3, ny + BAY_D, BAY_W + 6, 3);

      // 候车平台铺装（港湾底沿）
      g.fillStyle(0xb2b2b0, 1);
      g.fillRect(bx0, ny + BAY_D, BAY_W, 2);

      // 顶棚（顶边贴 NEAR_Y 路沿线）
      const rX    = sx - ROOF_W / 2;  // 1375
      const roofT = ny;                // 333 — 贴路沿
      g.fillStyle(0x686866, 1);
      g.fillRect(rX, roofT, ROOF_W, ROOF_H);
      g.lineStyle(1.6, 0x181818, 1);
      g.strokeRect(rX, roofT, ROOF_W, ROOF_H);

      // 支柱（从顶棚底向下延伸）
      const pillarT = roofT + ROOF_H;  // 339
      const pillarB = ny + 44;         // 377
      g.lineStyle(2.5, 0x282828, 1);
      g.lineBetween(sx - PIL_X, pillarT, sx - PIL_X, pillarB);
      g.lineBetween(sx + PIL_X, pillarT, sx + PIL_X, pillarB);

      // 长椅（棚下居中）
      const benchY = ny + 32;   // 365
      g.fillStyle(0x565654, 1);
      g.fillRect(sx - 88, benchY, 176, 4);
      g.lineStyle(0.8, 0x181818, 0.7);
      g.strokeRect(sx - 88, benchY, 176, 4);
      // 椅腿
      g.lineStyle(1.5, 0x303030, 0.9);
      g.lineBetween(sx - 76, benchY + 4, sx - 76, benchY + 9);
      g.lineBetween(sx + 76, benchY + 4, sx + 76, benchY + 9);

      // 独立站牌杆（亭外右侧）
      const poleX  = bx1 + 5;         // 1638
      const poleTy = ny - 8;           // 325
      const poleBy = ny + BAY_D + 2;   // 344
      g.lineStyle(2.2, 0x2e2e2e, 1);
      g.lineBetween(poleX, poleBy, poleX, poleTy);
      drawSign(poleX, poleTy);
    }
  }

  // ─── 公园园路：带弧度的步道，连接棋摊广场 / 喷泉 / 上沿步道 ────────────────────
  // 所有 Y 坐标通过 CHESS_PLAZA / MINI_PARK / PARK_TOP 派生，随区域整体移动不错位。
  _drawParkPaths(g) {
    const cc    = CHESS_PLAZA;           // { cx:620, cy:443, rx:130, ry:56 }
    const mp    = MINI_PARK;             // { cx:1150, cy:453, rx:210, ry:78 }
    const walkY = PARK_TOP + 15;         // 横向步道中线（PARK_TOP+4 ~ +26 内）

    const paths = [
      // A: 棋摊广场右缘 → 喷泉广场左缘
      [
        [cc.cx + cc.rx,        cc.cy     ],
        [cc.cx + cc.rx + 70,   cc.cy -  9],
        [mp.cx - mp.rx - 50,   mp.cy -  9],
        [mp.cx - mp.rx,        mp.cy     ],
      ],
      // B: 棋摊广场左缘 → 画布左边缘
      [
        [cc.cx - cc.rx,        cc.cy     ],
        [cc.cx - cc.rx - 160,  cc.cy + 14],
        [cc.cx - cc.rx - 340,  cc.cy +  2],
        [0,                     cc.cy +  8],
      ],
      // C: 喷泉广场右缘 → 画布右边缘
      [
        [mp.cx + mp.rx,        mp.cy     ],
        [mp.cx + mp.rx + 180,  mp.cy - 10],
        [mp.cx + mp.rx + 380,  mp.cy +  8],
        [WORLD_WIDTH,           mp.cy     ],
      ],
      // D: 上方横向步道 ↓ 接入公园（x≈1765，NEAR 站台右侧，原 x=1500 位置让给站台）
      [
        [1765, walkY                         ],
        [1762, (walkY + mp.cy) >> 1          ],
        [1768, mp.cy + 6                     ],
      ],
    ];
    for (const pts of paths) this._drawCurvedPath(g, pts, 26);
  }

  _drawCurvedPath(g, ctrl, width) {
    const pts = this._catmullRom(ctrl, 10);
    g.lineStyle(width, 0xdedede, 1);     this._strokePolyline(g, pts);  // 路面
    g.lineStyle(width - 7, 0xe9e9e9, 1); this._strokePolyline(g, pts);  // 中央略亮
    g.lineStyle(0.8, 0xb6b6b6, 0.6);     this._strokePolyline(g, pts);  // 边缘细线
  }

  _strokePolyline(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
  }

  // Catmull-Rom 平滑：每段插值 seg 个点，端点钳制
  _catmullRom(ctrl, seg) {
    const out = [];
    const p = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([x, y]);
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }

  // ─── 公园里的白色广场（棋摊就坐落在它中心，使"在公园里"一目了然） ──────────
  // 左侧棋摊广场：保留边线轮廓（淡），扁平地面色，无阴影/发光
  _drawChessPlaza(g) {
    const { cx, cy, rx, ry } = CHESS_PLAZA;
    g.fillStyle(0xebebeb, 0.4);
    g.fillEllipse(cx, cy, rx * 2, ry * 2);
    g.lineStyle(1, 0xcccccc, 0.9);
    g.strokeEllipse(cx, cy, rx * 2, ry * 2);
    // 放射状铺砖缝（淡）
    g.lineStyle(0.5, 0xd4d4d4, 0.35);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.lineBetween(cx, cy, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
  }

  // 小公园游园区：去掉轮廓，仅以地面色差区分（无 stroke、无阴影）
  _drawMiniPark(g) {
    const { cx, cy, rx, ry } = MINI_PARK;
    const seed = (i) => { const s = Math.sin(i * 57.3) * 43758.5; return s - Math.floor(s); };
    g.fillStyle(0xe8e8e8, 1);
    g.fillEllipse(cx, cy, rx * 2, ry * 2);
    // 少量草簇点缀（地面纹理，不画边线/小径/灌木）
    g.lineStyle(0.6, 0x8a8a8a, 0.28);
    for (let i = 0; i < 28; i++) {
      const a = seed(i * 2) * Math.PI * 2, rr = Math.sqrt(seed(i * 2 + 1));
      const gx = cx + Math.cos(a) * rx * 0.82 * rr;
      const gy = cy + Math.sin(a) * ry * 0.82 * rr;
      g.lineBetween(gx, gy, gx, gy - 3);
      g.lineBetween(gx, gy - 1.5, gx - 1.5, gy - 3.5);
      g.lineBetween(gx, gy - 1.5, gx + 1.5, gy - 3.5);
    }
  }

  // ─── 远景视差层（天空底色 + 远skyline剪影 + 云），随镜头慢移 ─────────────────
  _drawSky() {
    const g = this.skyGraphics;
    g.clear();
    // 天空底色（左右各留余量，保证视差到端点时仍铺满）
    g.fillStyle(GRAY_SKY, 1);
    g.fillRect(-300, 0, WORLD_WIDTH + 600, SKY_Y);
    this._drawFarSkyline(g);
    this._drawClouds(g);
  }

  // 远处天际线：成排较高的浅灰剪影楼（基线落在街墙底 210，高过最矮的近景房顶），
  // 落在近景建筑之后做视差背景；侧路缺口处可见远楼而非空白。
  _drawFarSkyline(g) {
    const seed = (i) => { const s = Math.sin(i * 73.13) * 43758.5; return s - Math.floor(s); };
    const base = BUILDING_BASE_Y;
    // 远排（更浅更密，垫底连续）
    for (let i = 0; i < 48; i++) {
      const bx = i * 46 - 30 + seed(i) * 12;
      const bw = 38 + seed(i + 9) * 26;
      const bh = 78 + seed(i + 3) * 60;            // 78–138
      g.fillStyle(0xf1f1f1, 1);
      g.fillRect(bx, base - bh, bw, bh);
    }
    // 近排（略深更高，错落）
    for (let i = 0; i < 32; i++) {
      const bx = i * 70 - 20 + seed(i + 50) * 28;
      const bw = 44 + seed(i + 60) * 36;
      const bh = 110 + seed(i + 70) * 70;          // 110–180
      g.fillStyle(0xe6e6e6, 1);
      g.fillRect(bx, base - bh, bw, bh);
      g.lineStyle(0.5, 0xd6d6d6, 0.5);
      g.strokeRect(bx, base - bh, bw, bh);
      // 极淡竖向窗缝
      g.lineStyle(0.4, 0xdcdcdc, 0.4);
      for (let k = 1; k < 3; k++) { const lx = bx + bw * k / 3; g.lineBetween(lx, base - bh + 6, lx, base - 4); }
    }
  }

  // ─── 天空：几朵灰度云（软团 + 浅灰描边） ──────────────────────────────────
  _drawClouds(g) {
    for (const [cx, cy, s] of CLOUD_POSITIONS) {
      g.fillStyle(0xffffff, 0.92);
      g.fillEllipse(cx,         cy,        70 * s, 26 * s);
      g.fillEllipse(cx - 28 * s, cy + 6 * s, 44 * s, 20 * s);
      g.fillEllipse(cx + 30 * s, cy + 5 * s, 48 * s, 20 * s);
      g.lineStyle(0.8, 0xd2d2d2, 0.6);
      g.strokeEllipse(cx, cy, 70 * s, 26 * s);
    }
  }

  // ─── 城市大公园：整片连续草地 + 一条贴上沿的横向步道（不再切分草地） ───────
  _drawParkPlaza(g) {
    const top = PARK_TOP, bot = WORLD_HEIGHT;
    const seed = (i) => { const s = Math.sin(i * 91.7) * 43758.5; return s - Math.floor(s); };
    // 草簇/小花（数量减半≈160，成簇不规则分布，非等间距）
    g.lineStyle(0.6, 0x969696, 0.3);
    const clusters = 22;
    let drawn = 0;
    for (let c = 0; c < clusters && drawn < 160; c++) {
      const ccx = seed(c * 3 + 1) * WORLD_WIDTH;
      const ccy = top + 28 + seed(c * 3 + 2) * (bot - top - 34);
      const cn  = 3 + Math.floor(seed(c * 3 + 3) * 7);          // 每簇 3–9 株
      const spread = 24 + seed(c * 5 + 1) * 60;
      for (let k = 0; k < cn && drawn < 160; k++, drawn++) {
        const gx = ccx + (seed(drawn * 2 + 7) - 0.5) * spread;
        const gy = ccy + (seed(drawn * 2 + 8) - 0.5) * spread * 0.55;
        if (gx < 4 || gx > WORLD_WIDTH - 4) continue;
        g.lineBetween(gx, gy, gx, gy - 3);
        g.lineBetween(gx, gy - 1.5, gx - 1.5, gy - 3.5);
        g.lineBetween(gx, gy - 1.5, gx + 1.5, gy - 3.5);
      }
    }
    // 横向步道（紧贴公园上沿，承接过马路下来的人流），下方为整片草地
    g.fillStyle(0xdedede, 1);
    g.fillRect(0, top + 4, WORLD_WIDTH, 22);
    g.lineStyle(0.6, 0xb4b4b4, 0.5);
    g.lineBetween(0, top + 4, WORLD_WIDTH, top + 4);
    g.lineBetween(0, top + 26, WORLD_WIDTH, top + 26);
  }

  _drawRoadMarkings(g) {
    // 路沿石（仅一条窄高光带 + 描边，不再画双侧白实线）
    g.fillStyle(GRAY_CURB, 1);
    g.fillRect(0, FAR_Y - 3, WORLD_WIDTH, 3);
    g.lineStyle(LINE_FAR_WIDTH, 0x7a7a7a, 0.65);
    g.lineBetween(0, FAR_Y - 3, WORLD_WIDTH, FAR_Y - 3);
    g.lineBetween(0, FAR_Y,     WORLD_WIDTH, FAR_Y);
    // 道路边缘线（人行道↔车道过渡软化）：4px 深灰
    g.fillStyle(0x888888, 0.85);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, 4);

    g.fillStyle(0xd8d8d8, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, 4);
    g.lineStyle(LINE_NEAR_WIDTH * 0.7, LINE_NEAR_COLOR, 0.55);
    g.lineBetween(0, NEAR_Y + 4, WORLD_WIDTH, NEAR_Y + 4);

    // 中心单虚线（车道分隔）
    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(2, 0xffffff, 0.6);
    for (let x = 0; x < WORLD_WIDTH; x += ROAD_STRIPE_SPACING) {
      g.lineBetween(x, midY, x + ROAD_STRIPE_LENGTH, midY);
    }

    // 斑马线（保留）
    for (const sx of StreetScene.crosswalkStarts()) {
      this._drawCrosswalk(g, sx);
    }
  }

  /** 斑马线中心 X（横向条纹，NPC 横穿时对齐此 X） */
  static crosswalkStarts() {
    return [350];
  }

  // ─── 路面纹理：仅少量低调沥青补丁矩形（不画椭圆，避免与井盖混淆） ──────────
  _drawRoadPatches(g) {
    const rand = (i) => { const s = Math.sin(i * 91.337) * 43758.5453; return s - Math.floor(s); };
    g.fillStyle(0x8a8a8a, 0.4);
    for (let i = 0; i < 3; i++) {
      const px = (i + 0.5) * WORLD_WIDTH / 3 + (rand(i + 1) - 0.5) * 200;
      const py = FAR_Y + 18 + rand(i * 3 + 2) * (NEAR_Y - FAR_Y - 36);
      const pw = 30 + rand(i * 3 + 3) * 40;
      const ph = 6  + rand(i * 3 + 4) * 6;
      g.fillRect(px, py, pw, ph);
    }
  }

  // 横向斑马线：cx 为中心 X，5 条白色水平矩形均匀分布于马路纵深，
  // 近端条纹略高（1px 递增）模拟 2.5D 透视感。
  _drawCrosswalk(g, cx) {
    const roadTop  = FAR_Y  + 5;   // 273
    const roadBot  = NEAR_Y - 5;   // 328
    const usable   = roadBot - roadTop;   // 55px
    const count    = 5;
    const step     = Math.floor(usable / (count * 2 - 1));   // 6px（条+间隔均等）
    const cw       = 240;                 // 横向总宽度（约公交车身宽）
    const x0       = Math.round(cx - cw / 2);
    g.fillStyle(0xffffff, 0.68);
    for (let i = 0; i < count; i++) {
      const y  = roadTop + i * step * 2;
      const sh = step - 1 + i;             // 远端 5px → 近端 9px，透视渐高
      g.fillRect(x0, y, cw, sh);
    }
  }

  // ─── 人行道纹理：浅灰横线（每 20px 一条，opacity 0.3），过渡更柔和 ──────────
  _drawSidewalkTiles(g, topY, botY, _near) {
    g.lineStyle(0.8, 0xcccccc, 0.3);
    for (let y = topY; y <= botY; y += 20) {
      g.lineBetween(0, y, WORLD_WIDTH, y);
    }
  }

  // ─── 行道树：建筑前人行道一排（小）+ 公园广场后排（中） ────────────────────
  _drawTrees(g) {
    // 建筑前人行道（贴近路沿），与街灯交错
    for (const tx of SIDEWALK_TREE_XS) {
      const ty = SIDEWALK_TREE_Y + Math.sin(tx * 0.05) * 2;
      const r  = 8 + Math.sin(tx * 0.071) * 1.5;
      this._drawBlobTree(g, tx, ty, r, 0.7, 0x808080, 0.9);
    }
    // 公园广场后排（承上启下，远离喷泉/活动区中心）
    for (const tx of PARK_TREE_XS) {
      const ty = PARK_TREE_Y;
      const r  = 12 + Math.sin(tx * 0.053) * 3;
      this._drawBlobTree(g, tx, ty, r, 1.1, 0x4a4a4a, 0.92);
    }
  }

  /**
   * 俯视树冠：柔和起伏的分瓣轮廓（非对称、非放射），中心小十字树干，
   * 内部几条短弧暗示叶丛。每棵以 cx 做种子轮廓略不同。
   */
  _drawBlobTree(g, cx, cy, r, lw, c, a) {
    // 落地阴影
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(cx + r * 0.2, cy + r * 0.3, r * 1.8, r * 0.65);

    // 6 瓣起伏轮廓
    const lobes = 6;
    const steps = lobes * 4;
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const ang  = (i / steps) * Math.PI * 2;
      const lobe = 0.84 + 0.16 * Math.cos(ang * lobes);            // 柔和分瓣
      const nz   = 1 + 0.06 * Math.sin(cx * 0.21 + i * 1.3);       // 每棵微噪声
      const rad  = r * lobe * nz;
      pts.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad * 0.82 });
    }
    // 极浅填充成形
    g.fillStyle(c, 0.08);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
    // 轮廓
    g.lineStyle(lw, c, a);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.strokePath();

    // 内部 2 条短弧（叶丛暗示）
    g.lineStyle(lw * 0.7, c, a * 0.55);
    g.strokeCircle(cx - r * 0.3, cy - r * 0.15, r * 0.3);
    g.strokeCircle(cx + r * 0.28, cy + r * 0.12, r * 0.26);

    // 树干小十字
    g.lineStyle(lw * 1.1, c, a);
    g.lineBetween(cx - 1.5, cy, cx + 1.5, cy);
    g.lineBetween(cx, cy - 1.5, cx, cy + 1.5);
  }

  // ─── 实体生成 ─────────────────────────────────────────────────────────────────

  _spawnBuildings() {
    const sceneData = this.cache.json.get('scene_data');
    const defs = sceneData?.buildings ?? [];
    const parseColor = c => parseInt(c.replace('#', ''), 16);
    const seed = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
    for (const b of defs) {
      const e = new BuildingEntity({ ...b, y: BUILDING_BASE_Y, color: parseColor(b.color) });
      // 底边随机偏移 ±6px，打破整排齐平、增加纵深
      const off = Math.round((seed(b.x + 7) - 0.5) * 12);
      e.baseY = BUILDING_BASE_Y + off;
      e.y = e.baseY - e.facadeH;
      // 左侧若有相邻楼贴合 → 画巷道暗缝
      e.alleyLeft = defs.some(o => o !== b && Math.abs((o.x + o.bWidth) - b.x) <= 2);
      this.entityManager.add(e);
    }
    this._buildingDefs = defs;
  }

  _spawnProps() {
    const sceneData = this.cache.json.get('scene_data');
    const defs = sceneData?.props ?? [];
    const buildings = this._buildingDefs ?? [];
    const parseColor = c => c ? parseInt(c.replace('#', ''), 16) : 0x888888;
    for (const p of defs) {
      const cfg = { ...p, propColor: parseColor(p.color) };
      // 招牌贴在底层店铺位置（人行道之上）
      if (p.propType === 'sign') {
        const host = buildings.find(b => p.x >= b.x && p.x <= b.x + b.bWidth);
        if (host) cfg.y = BUILDING_BASE_Y - 8;
      }
      // 单人 Smart Object：自动贩卖机 / 垃圾桶，槽位在机器正面（偏下，朝镜头）
      else if (p.propType === 'vending') {
        cfg.smartDef = { activityType: 'use_vending', slots: [{ role: 'user', dx: 0, dy: 16 }] };
      } else if (p.propType === 'trash') {
        cfg.smartDef = { activityType: 'use_trash', slots: [{ role: 'user', dx: 0, dy: 12 }] };
      }
      this.entityManager.add(new PropEntity(cfg));
    }
  }

  _spawnNPCs() {
    const em = this.entityManager;
    const sr = this.stickRenderer;
    // 所有 NPC 统一纳入行为系统：spawner 负责生成 + 指定 profile / 创建 Activity
    this.behaviorManager = new BehaviorManager(em);
    const bm = this.behaviorManager;

    // ── 出口注册表 ──────────────────────────────────────────────────────────
    const exitRegistry = new ExitRegistry();
    // 左右场景边缘（覆盖全部 Y 带）
    exitRegistry.register({ id: 'edge_left',  type: 'edge', x: -200,              y: null, yZone: null, facing: -1 });
    exitRegistry.register({ id: 'edge_right', type: 'edge', x: WORLD_WIDTH + 200, y: null, yZone: null, facing:  1 });
    // 建筑入口（仅前人行道区域，Y 固定在建筑立面，NPC 走入后消失）
    exitRegistry.register({ id: 'building_a', type: 'building', x: BUILDING_EXIT_XS[0], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    exitRegistry.register({ id: 'building_b', type: 'building', x: BUILDING_EXIT_XS[1], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    exitRegistry.register({ id: 'building_c', type: 'building', x: BUILDING_EXIT_XS[2], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    exitRegistry.register({ id: 'building_d', type: 'building', x: BUILDING_EXIT_XS[3], y: SIDEWALK_FAR_Y - 10, yZone: [210, 295], facing: 0 });
    // TODO: 加静止车辆时在停车位处注册 type:'vehicle' 出口
    bm.exitRegistry = exitRegistry;

    spawnPedestrians(em, sr, bm);
    spawnChess(em, sr, bm);
    spawnDogWalker(em, sr, bm);
    spawnAthletes(em, sr, bm);
    this.trafficManager = initVehicleSystem(em, sr);

    // ── SpawnManager：NPC 离场后按区域密度自动补充 ──────────────────────────
    // 公园漫游带：PARK_TOP+16..PARK_BOTTOM-8（与 Pedestrians.js 的 ROAM_Y0/Y1 一致）
    const ROAM_Y0 = PARK_TOP + 16;
    const ROAM_Y1 = PARK_BOTTOM - 8;

    const spawnZones = [
      {
        id:        'sidewalk',
        target:    3,                                  // 维持 3 名建筑前人行道行人
        yRange:    [BUILDING_BASE_Y, FAR_Y],           // [210, 268]
        xRange:    [50, WORLD_WIDTH - 50],
        exitTypes: ['building'],          // edge 出口距离过远（~77s），会超时；仅用建筑入口
        npcTypes:  ['pedestrian', 'businessman'],
      },
      {
        id:        'park',
        target:    10,                                 // 维持公园漫游者总数（含固定 NPC）
        yRange:    [ROAM_Y0, ROAM_Y1],                 // [349, 492]
        xRange:    [50, WORLD_WIDTH - 50],
        exitTypes: ['edge'],                           // 公园只从边缘进
        npcTypes:  ['pedestrian', 'tourist'],
      },
    ];

    const spawnFn = _makeSpawnFn(bm, em, sr, ROAM_Y0, ROAM_Y1);
    this.spawnManager = new SpawnManager({
      spawnFn,
      exitRegistry,
      bm,
      zones: spawnZones,
    });
  }
}

// ─── SpawnManager 入场工厂 ─────────────────────────────────────────────────────
// 根据 zone.id 决定 NPC 参数（公园漫游 vs 人行道横走），复用 spawnOnePedestrian。
function _makeSpawnFn(bm, em, sr, roamY0, roamY1) {
  return (entry, zone) => {
    const npcType = zone.npcTypes[Math.floor(Math.random() * zone.npcTypes.length)];
    const posY    = entry.y ?? (zone.yRange[0] + zone.yRange[1]) / 2;

    const opts = {
      minX: zone.xRange[0],
      maxX: zone.xRange[1],
      minY: zone.yRange[0],
      maxY: zone.yRange[1],
    };

    if (zone.id === 'park') {
      // 公园：可自由漫游的二维区域
      opts.roamZone = {
        x0: zone.xRange[0], x1: zone.xRange[1],
        y0: roamY0,         y1: roamY1,
      };
      opts.minY = roamY0;
      opts.maxY = roamY1;
    } else {
      // 人行道：建筑前窄带，缩小比例（远景感）
      opts.scaleMul = 0.65;
    }

    // 入场 NPC 给予 65s 的负计时器，确保路由结束前（最长 60s）不触发离场
    const npc = spawnOnePedestrian(npcType, em, sr, bm, { x: entry.x, y: posY }, opts);
    npc._ageTimer = -65;
    return npc;
  };
}
