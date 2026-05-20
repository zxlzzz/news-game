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
import { BuildingEntity }  from '../BuildingEntity.js';
import { PropEntity }      from '../PropEntity.js';
import { Viewfinder }      from '../Viewfinder.js';
import {
  WORLD_WIDTH, WORLD_HEIGHT, FAR_Y, NEAR_Y, BUILDING_BASE_Y,
  SIDEWALK_FAR_Y, SIDEWALK_NEAR_Y,
  GRAY_SKY, GRAY_FAR_PAVE, GRAY_ROAD, GRAY_NEAR_PAVE, GRAY_CURB,
  LINE_FAR_WIDTH, LINE_NEAR_COLOR, LINE_NEAR_WIDTH,
} from '../SceneConfig.js';
import { spawnPedestrians } from '../npcs/Pedestrians.js';
import { spawnChess }       from '../npcs/Chess.js';
import { spawnDogWalker }   from '../npcs/DogWalker.js';
import { spawnAthletes }    from '../npcs/Athletes.js';
import { spawnVehicles }    from '../npcs/Vehicles.js';

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
    this.load.json('anim_phone',      'assets/animations/phone.json');
    this.load.json('anim_bike',       'assets/animations/bike.json');
    this.load.json('anim_mobile',     'assets/animations/mobile.json');
    this.load.json('anim_chess',      'assets/animations/chess.json');
    this.load.json('anim_dance',      'assets/animations/dance.json');
    this.load.json('anim_dogwalk',    'assets/animations/dogwalk.json');
    this.load.json('anim_squat_down', 'assets/animations/squat down.json');
    this.load.json('anim_stand_up',   'assets/animations/stand up.json');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(GRAY_SKY);

    // 渲染层（建筑区背景色由 camera background 提供）
    this.bgGraphics     = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.vfGraphics     = this.add.graphics();

    // 静态地面（只绘制一次）
    this._drawGround();

    // 火柴人渲染器
    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk',       this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run',        this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle',       this.cache.json.get('anim_idle'));
    this.stickRenderer.loadAnimation('jog',        this.cache.json.get('anim_jog'));
    this.stickRenderer.loadAnimation('phone',      this.cache.json.get('anim_phone'));
    this.stickRenderer.loadAnimation('bike',       this.cache.json.get('anim_bike'));
    this.stickRenderer.loadAnimation('mobile',     this.cache.json.get('anim_mobile'));
    this.stickRenderer.loadAnimation('chess',      this.cache.json.get('anim_chess'));
    this.stickRenderer.loadAnimation('dance',      this.cache.json.get('anim_dance'));
    this.stickRenderer.loadAnimation('dogwalk',    this.cache.json.get('anim_dogwalk'));
    this.stickRenderer.loadAnimation('squat_down', this.cache.json.get('anim_squat_down'));
    this.stickRenderer.loadAnimation('stand_up',   this.cache.json.get('anim_stand_up'));

    // 统一 Entity 管理器
    // 缩放参考用人行道带（远端步行带 → 近端步行带），让远小近大对比贯穿整个纵深
    this.entityManager = new EntityManager({
      farY: SIDEWALK_FAR_Y, nearY: SIDEWALK_NEAR_Y, farScale: 0.26, nearScale: 0.92,
    });

    this._spawnBuildings();
    this._spawnProps();
    this._spawnNPCs();

    this.viewfinder = new Viewfinder(this, {
      x: 310, y: 295, width: 210, height: 145,
    });

    this._createUI();
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  _createUI() {
    const W = this.cameras.main.width;
    const H = this.cameras.main.height;

    this.uiText = this.add.text(10, 10, '← → 滚动  |  拖动取景框 · 拖右下角缩放', {
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

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    const spd = 300 * (delta / 1000);

    if (this.cursors.left.isDown)       cam.scrollX -= spd;
    else if (this.cursors.right.isDown) cam.scrollX += spd;

    // 取景框靠近屏幕边缘时自动滚动
    const vfc    = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - cam.scrollX < margin)                    cam.scrollX -= spd * 0.5;
    else if (cam.scrollX + cam.width - vfc.x < margin)   cam.scrollX += spd * 0.5;

    this.entityManager.update(delta);
    this.viewfinder.updateCapture(this.entityManager.getAlive());

    this.entityGraphics.clear();
    this.entityManager.draw(this.entityGraphics);

    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

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

    // 建筑区底色 — 最浅
    g.fillStyle(GRAY_SKY, 1);
    g.fillRect(0, 0, WORLD_WIDTH, BUILDING_BASE_Y);

    // 远端人行道 — 浅灰
    g.fillStyle(GRAY_FAR_PAVE, 1);
    g.fillRect(0, BUILDING_BASE_Y, WORLD_WIDTH, FAR_Y - BUILDING_BASE_Y);

    // 道路 — 中灰
    g.fillStyle(GRAY_ROAD, 1);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);

    // 近端人行道
    g.fillStyle(GRAY_NEAR_PAVE, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, WORLD_HEIGHT - NEAR_Y);

    this._drawRoadMarkings(g);
    this._drawSidewalkTiles(g, BUILDING_BASE_Y + 4, FAR_Y - 4, /*near=*/false);
    this._drawSidewalkTiles(g, NEAR_Y + 8,         WORLD_HEIGHT, /*near=*/true);
    this._drawRoadPatches(g);
    this._drawTrees(g);
  }

  _drawRoadMarkings(g) {
    // 路沿石（仅一条窄高光带 + 描边，不再画双侧白实线）
    g.fillStyle(GRAY_CURB, 1);
    g.fillRect(0, FAR_Y - 3, WORLD_WIDTH, 3);
    g.lineStyle(LINE_FAR_WIDTH, 0x7a7a7a, 0.65);
    g.lineBetween(0, FAR_Y - 3, WORLD_WIDTH, FAR_Y - 3);
    g.lineBetween(0, FAR_Y,     WORLD_WIDTH, FAR_Y);

    g.fillStyle(0xd8d8d8, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, 4);
    g.lineStyle(LINE_NEAR_WIDTH * 0.7, LINE_NEAR_COLOR, 0.55);
    g.lineBetween(0, NEAR_Y + 4, WORLD_WIDTH, NEAR_Y + 4);

    // 中心单虚线（车道分隔）
    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(2, 0xffffff, 0.6);
    for (let x = 0; x < WORLD_WIDTH; x += 56) {
      g.lineBetween(x, midY, x + 28, midY);
    }

    // 斑马线（保留）
    for (const sx of StreetScene.crosswalkStarts()) {
      this._drawCrosswalk(g, sx);
    }
  }

  /** 各斑马线左起 X（NPC 横穿时对齐其中间） */
  static crosswalkStarts() {
    const out = [];
    for (let sx = 220; sx < WORLD_WIDTH; sx += 380) out.push(sx);
    return out;
  }

  // ─── 路面补丁/破损（细节，给柏油路加点纹理） ────────────────────────────────
  _drawRoadPatches(g) {
    // 用稳定哈希散布，每帧不变
    const rand = (i) => {
      const s = Math.sin(i * 91.337) * 43758.5453;
      return s - Math.floor(s);
    };
    // 沥青补丁：几个稍暗矩形
    g.fillStyle(0x7a7a7a, 0.55);
    for (let i = 0; i < 8; i++) {
      const px = rand(i * 3 + 1) * WORLD_WIDTH;
      const py = FAR_Y + 14 + rand(i * 3 + 2) * (NEAR_Y - FAR_Y - 30);
      const pw = 28 + rand(i * 3 + 3) * 50;
      const ph = 6  + rand(i * 3 + 4) * 8;
      g.fillRect(px, py, pw, ph);
    }
    // 油渍/水渍：椭圆细线
    g.lineStyle(0.5, 0x5a5a5a, 0.45);
    for (let i = 0; i < 12; i++) {
      const px = rand(i * 7 + 11) * WORLD_WIDTH;
      const py = FAR_Y + 12 + rand(i * 7 + 12) * (NEAR_Y - FAR_Y - 24);
      const pr = 4 + rand(i * 7 + 13) * 6;
      g.strokeEllipse(px, py, pr * 2, pr * 0.9);
    }
  }

  _drawCrosswalk(g, cx) {
    const roadTop = FAR_Y  + 10;
    const roadBot = NEAR_Y - 10;
    g.fillStyle(0xffffff, 0.55);
    for (let i = 0; i < 8; i++) {
      const fx = cx + i * (8  + 12); // 远端：条宽8，间隔12
      const nx = cx + i * (13 + 16); // 近端：条宽13，间隔16
      g.beginPath();
      g.moveTo(fx,      roadTop);
      g.lineTo(fx + 8,  roadTop);
      g.lineTo(nx + 13, roadBot);
      g.lineTo(nx,      roadBot);
      g.closePath();
      g.fillPath();
    }
  }

  // ─── 人行道地砖网格 ──────────────────────────────────────────────────────
  _drawSidewalkTiles(g, topY, botY, near) {
    // 近端：偏方形大砖（约 36×18），稍深线；远端：长条砖（约 48×10），细浅线
    const tileW  = near ? 36 : 48;
    const tileH  = near ? 18 : 10;
    const color  = near ? 0x7a7a7a : 0xb0b0b0;
    const alpha  = near ? 0.42 : 0.32;
    const lineW  = near ? 0.8  : 0.5;
    g.lineStyle(lineW, color, alpha);
    // 竖向砖缝
    for (let x = 0; x <= WORLD_WIDTH; x += tileW) {
      g.lineBetween(x, topY, x, botY);
    }
    // 横向砖缝（错缝排列）
    let row = 0;
    for (let y = topY; y <= botY; y += tileH) {
      g.lineBetween(0, y, WORLD_WIDTH, y);
      // 错缝：每行偏移 tileW/2 的竖线（让相邻行错开一半）
      if (row % 2 === 1) {
        for (let x = tileW / 2; x <= WORLD_WIDTH; x += tileW) {
          g.lineBetween(x, y, x, Math.min(y + tileH, botY));
        }
      }
      row++;
    }
  }

  // ─── 树木（不规则椭圆轮廓 + 小树干，非对称非放射） ────────────────────────
  _drawTrees(g) {
    // 远端：浅灰薄线小树 — 树冠 Y 不能侵入 FAR_Y - tree_r 区域
    const farXs = [75, 238, 405, 572, 740, 908, 1076, 1244, 1412, 1580, 1748, 1916];
    for (const tx of farXs) {
      const ty = 178 + Math.sin(tx * 0.031) * 6;
      const r  = 10 + Math.sin(tx * 0.071) * 2;
      this._drawBlobTree(g, tx, ty, r, 0.7, 0x808080, 0.9);
    }
    // 近端：深灰粗线大树 — 远离路面（y=485），不会侵入路面
    const nearXs = [140, 340, 540, 740, 940, 1140, 1340, 1540, 1740, 1940];
    for (const tx of nearXs) {
      const ty = 486;
      const r  = 13 + Math.sin(tx * 0.053) * 3;
      this._drawBlobTree(g, tx, ty, r, 1.5, 0x1c1c1c, 0.95);
    }
  }

  /**
   * 不规则椭圆树冠 + 中心十字树干，每棵树轮廓略不同（用 cx 做种子）
   */
  _drawBlobTree(g, cx, cy, r, lw, c, a) {
    // 落地阴影（细椭圆）
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(cx + r * 0.20, cy + r * 0.30, r * 1.9, r * 0.7);

    // 不规则边缘：12 个点，半径加噪声
    const N = 12;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2;
      // 用 sin 多频组合制造稳定噪声
      const n =
        Math.sin(cx * 0.123 + i * 1.7) * 0.18 +
        Math.sin(cx * 0.057 + i * 3.3) * 0.12;
      const rad = r * (1 + n);
      pts.push({
        x: cx + Math.cos(ang) * rad,
        // 椭圆压扁（y 方向乘 0.85），更像俯视投影
        y: cy + Math.sin(ang) * rad * 0.85,
      });
    }
    // 填充极浅一层让"树荫"成形
    g.fillStyle(c, 0.10);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();

    // 锯齿轮廓
    g.lineStyle(lw, c, a);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.strokePath();

    // 树干：小十字（非圆）
    g.lineStyle(lw * 1.2, c, a);
    g.lineBetween(cx - 2, cy, cx + 2, cy);
    g.lineBetween(cx, cy - 2, cx, cy + 2);
  }

  // ─── 实体生成 ─────────────────────────────────────────────────────────────────

  _spawnBuildings() {
    const sceneData = this.cache.json.get('scene_data');
    const defs = sceneData?.buildings ?? [];
    const parseColor = c => parseInt(c.replace('#', ''), 16);
    for (const b of defs) {
      this.entityManager.add(new BuildingEntity({
        ...b,
        y: BUILDING_BASE_Y,
        color: parseColor(b.color),
      }));
    }
  }

  _spawnProps() {
    const sceneData = this.cache.json.get('scene_data');
    const defs = sceneData?.props ?? [];
    const parseColor = c => c ? parseInt(c.replace('#', ''), 16) : 0x888888;
    for (const p of defs) {
      this.entityManager.add(new PropEntity({
        ...p,
        propColor: parseColor(p.color),
      }));
    }
  }

  _spawnNPCs() {
    const em = this.entityManager;
    const sr = this.stickRenderer;
    spawnPedestrians(em, sr);
    spawnChess(em, sr);
    spawnDogWalker(em, sr);
    spawnAthletes(em, sr);
    spawnVehicles(em, sr);
  }
}
