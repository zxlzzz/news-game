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
import { NPC }             from '../NPC.js';
import { BuildingEntity }  from '../BuildingEntity.js';
import { PropEntity }      from '../PropEntity.js';
import { Viewfinder }      from '../Viewfinder.js';

const WORLD_WIDTH  = 2000;
const WORLD_HEIGHT = 500;

// 纵深范围：Y=FAR_Y 为远端（NPC小），Y=NEAR_Y 为近端（NPC大）
const FAR_Y  = 252;
const NEAR_Y = 458;

// 建筑临街底边 Y
const BUILDING_BASE_Y = 130;

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
    this.lastPhoto = null;
  }

  preload() {
    this.load.json('anim_walk', 'assets/animations/walk.json');
    this.load.json('anim_run',  'assets/animations/run.json');
    this.load.json('anim_idle', 'assets/animations/idle.json');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(0xc8c3bc);

    // 渲染层（建筑区背景色由 camera background 提供）
    this.bgGraphics     = this.add.graphics();
    this.entityGraphics = this.add.graphics();
    this.vfGraphics     = this.add.graphics();

    // 静态地面（只绘制一次）
    this._drawGround();

    // 火柴人渲染器
    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk', this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run',  this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle', this.cache.json.get('anim_idle'));

    // 统一 Entity 管理器
    this.entityManager = new EntityManager({
      farY: FAR_Y, nearY: NEAR_Y, farScale: 0.24, nearScale: 0.60,
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

    this.uiText = this.add.text(10, 10, '← → 滚动  |  拖动取景框捕捉目标', {
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

    // 建筑区底色（Y 0–BUILDING_BASE_Y）
    g.fillStyle(0xc8c3bc, 1);
    g.fillRect(0, 0, WORLD_WIDTH, BUILDING_BASE_Y);

    // 远端人行道（Y BUILDING_BASE_Y–FAR_Y）
    g.fillStyle(0xd0cbc2, 1);
    g.fillRect(0, BUILDING_BASE_Y, WORLD_WIDTH, FAR_Y - BUILDING_BASE_Y);

    // 道路（Y FAR_Y–NEAR_Y）
    g.fillStyle(0x797573, 1);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);

    // 近端人行道（Y NEAR_Y–500）
    g.fillStyle(0xd4cfc6, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, WORLD_HEIGHT - NEAR_Y);

    this._drawRoadMarkings(g);
    this._drawPavement(g, BUILDING_BASE_Y, FAR_Y,        48, 3);
    this._drawPavement(g, NEAR_Y + 4,      WORLD_HEIGHT, 52, 2);
    this._drawTrees(g);
  }

  _drawRoadMarkings(g) {
    // 透视横线：由近至远间距缩减，强化纵深感
    let lineY   = NEAR_Y - 10;
    let spacing = 30;
    while (lineY > FAR_Y + 5 && spacing > 2.8) {
      g.lineStyle(1, 0x626060, 0.22);
      g.lineBetween(0, Math.round(lineY), WORLD_WIDTH, Math.round(lineY));
      spacing *= 0.80;
      lineY   -= spacing;
    }

    // 路沿石
    g.fillStyle(0xe2ddd4, 1);
    g.fillRect(0, FAR_Y - 4, WORLD_WIDTH, 5);
    g.fillStyle(0xe8e3da, 1);
    g.fillRect(0, NEAR_Y,    WORLD_WIDTH, 5);

    // 路边白实线（道路内侧）
    g.lineStyle(3, 0xffffff, 0.45);
    g.lineBetween(0, FAR_Y + 9,  WORLD_WIDTH, FAR_Y + 9);
    g.lineBetween(0, NEAR_Y - 9, WORLD_WIDTH, NEAR_Y - 9);

    // 中心双黄虚线
    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(2, 0xc8b040, 0.75);
    for (let x = 0; x < WORLD_WIDTH; x += 68) {
      g.lineBetween(x, midY - 2, x + 36, midY - 2);
      g.lineBetween(x, midY + 2, x + 36, midY + 2);
    }

    // 梯形斑马线（近端宽远端窄，产生透视感）
    for (let cx = 220; cx < WORLD_WIDTH; cx += 380) {
      this._drawCrosswalk(g, cx);
    }
  }

  _drawCrosswalk(g, cx) {
    const roadTop = FAR_Y  + 10;
    const roadBot = NEAR_Y - 10;
    g.fillStyle(0xffffff, 0.50);
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

  _drawPavement(g, topY, botY, colStep, rows) {
    g.lineStyle(1, 0xb5b0a6, 0.28);
    for (let x = 0; x < WORLD_WIDTH; x += colStep) {
      g.lineBetween(x, topY, x, botY);
    }
    for (let r = 1; r < rows; r++) {
      const ly = topY + (botY - topY) * r / rows;
      g.lineBetween(0, ly, WORLD_WIDTH, ly);
    }
  }

  _drawTrees(g) {
    // 远端人行道树（Y ≈ 168，较小）
    const farXs = [75, 238, 405, 572, 740, 908, 1076, 1244, 1412, 1580, 1748, 1916];
    for (const tx of farXs) {
      const ty = 168 + Math.sin(tx * 0.031) * 9;
      const r  = 14  + Math.sin(tx * 0.071) * 3;
      g.fillStyle(0x000000, 0.16);
      g.fillEllipse(tx + 5, ty + 7, r * 2.6, r * 1.5);
      g.fillStyle(0x4e7430, 1);
      g.fillCircle(tx, ty, r);
      g.fillStyle(0x72a848, 0.52);
      g.fillCircle(tx - 4, ty - 4, r * 0.44);
    }

    // 近端人行道树（Y ≈ 480，较大）
    const nearXs = [140, 340, 540, 740, 940, 1140, 1340, 1540, 1740, 1940];
    for (const tx of nearXs) {
      const ty = 480;
      const r  = 17 + Math.sin(tx * 0.053) * 4;
      g.fillStyle(0x000000, 0.13);
      g.fillEllipse(tx + 6, ty + 8, r * 2.9, r * 1.6);
      g.fillStyle(0x436228, 1);
      g.fillCircle(tx, ty, r);
      g.fillStyle(0x628840, 0.48);
      g.fillCircle(tx - 5, ty - 5, r * 0.42);
    }
  }

  // ─── 实体生成 ─────────────────────────────────────────────────────────────────

  _spawnBuildings() {
    // 每栋建筑：x=左边缘，y=临街底边(130)，带语义标签
    const defs = [
      { x: 15,   bWidth: 115, bDepth: 80, color: 0x9e9590, tags: ['office', 'building'] },
      { x: 152,  bWidth:  88, bDepth: 62, color: 0x8a9098, tags: ['shop', 'retail', 'building'] },
      { x: 263,  bWidth: 148, bDepth: 87, color: 0xa08878, tags: ['bank', 'finance', 'building'], waterTower: true },
      { x: 430,  bWidth:  82, bDepth: 58, color: 0x909898, tags: ['shop', 'retail', 'building'] },
      { x: 534,  bWidth: 126, bDepth: 73, color: 0x94887a, tags: ['restaurant', 'food', 'building'] },
      { x: 684,  bWidth: 106, bDepth: 68, color: 0x7e8898, tags: ['office', 'building'] },
      { x: 813,  bWidth: 158, bDepth: 90, color: 0xa09488, tags: ['hotel', 'building'],            waterTower: true },
      { x: 992,  bWidth:  88, bDepth: 60, color: 0x8c9890, tags: ['shop', 'retail', 'building'] },
      { x: 1102, bWidth: 134, bDepth: 78, color: 0x988a7e, tags: ['bank', 'finance', 'building'] },
      { x: 1258, bWidth:  80, bDepth: 56, color: 0x8898a0, tags: ['apartment', 'residential', 'building'] },
      { x: 1362, bWidth: 118, bDepth: 70, color: 0x9a9080, tags: ['office', 'building'] },
      { x: 1505, bWidth: 148, bDepth: 84, color: 0x7e8898, tags: ['hotel', 'building'],            waterTower: true },
      { x: 1678, bWidth:  92, bDepth: 64, color: 0x988890, tags: ['restaurant', 'food', 'building'] },
      { x: 1798, bWidth: 126, bDepth: 74, color: 0xa09488, tags: ['shop', 'retail', 'building'] },
    ];
    for (const b of defs) {
      this.entityManager.add(new BuildingEntity({ ...b, y: BUILDING_BASE_Y }));
    }
  }

  _spawnProps() {
    // 远端路沿路灯（每155px一盏）
    for (let x = 95; x < WORLD_WIDTH; x += 155) {
      this.entityManager.add(new PropEntity({
        x, y: FAR_Y, width: 14, height: 14,
        propType: 'lamp-far',
        tags: ['lamp', 'street-furniture'],
      }));
    }

    // 近端路沿路灯（offset，与远端错开）
    for (let x = 172; x < WORLD_WIDTH; x += 155) {
      this.entityManager.add(new PropEntity({
        x, y: NEAR_Y, width: 14, height: 14,
        propType: 'lamp-near',
        tags: ['lamp', 'street-furniture'],
      }));
    }

    // 远端人行道长椅
    for (let x = 135; x < WORLD_WIDTH; x += 290) {
      this.entityManager.add(new PropEntity({
        x, y: 216, width: 32, height: 12,
        propType: 'bench',
        tags: ['bench', 'street-furniture'],
      }));
    }

    // 远端人行道垃圾桶
    for (let x = 300; x < WORLD_WIDTH; x += 450) {
      this.entityManager.add(new PropEntity({
        x, y: 230, width: 12, height: 12,
        propType: 'trash',
        tags: ['trash-can', 'street-furniture'],
      }));
    }

    // 近端人行道垃圾桶
    for (let x = 210; x < WORLD_WIDTH; x += 380) {
      this.entityManager.add(new PropEntity({
        x, y: 472, width: 12, height: 12,
        propType: 'trash',
        tags: ['trash-can', 'street-furniture'],
      }));
    }

    // 各建筑门口招牌（颜色和标签对应建筑类型）
    const signs = [
      { x:  72, propColor: 0x1a4488, tags: ['sign', 'office']     }, // office
      { x: 196, propColor: 0xcc3322, tags: ['sign', 'retail']      }, // shop
      { x: 337, propColor: 0x886600, tags: ['sign', 'finance']     }, // bank
      { x: 471, propColor: 0x22aa55, tags: ['sign', 'retail']      }, // shop
      { x: 597, propColor: 0xcc6622, tags: ['sign', 'food']        }, // restaurant
      { x: 737, propColor: 0x336688, tags: ['sign', 'office']      }, // office
      { x: 892, propColor: 0x7a3322, tags: ['sign', 'hotel']       }, // hotel
      { x: 1036, propColor: 0xaa2288, tags: ['sign', 'retail']     }, // shop
      { x: 1169, propColor: 0x886600, tags: ['sign', 'finance']    }, // bank
      { x: 1421, propColor: 0x225588, tags: ['sign', 'office']     }, // office
      { x: 1579, propColor: 0x7a3322, tags: ['sign', 'hotel']      }, // hotel
      { x: 1724, propColor: 0xcc6622, tags: ['sign', 'food']       }, // restaurant
      { x: 1861, propColor: 0xcc3322, tags: ['sign', 'retail']     }, // shop
    ];
    for (const s of signs) {
      this.entityManager.add(new PropEntity({
        x: s.x, y: BUILDING_BASE_Y + 1, width: 24, height: 14,
        propType: 'sign',
        propColor: s.propColor,
        tags: s.tags,
      }));
    }
  }

  _spawnNPCs() {
    const { farY, nearY } = this.entityManager;
    const span = nearY - farY;
    const yAt  = (f, j = 0.12) => farY + span * Math.max(0, Math.min(1, f + (Math.random() - 0.5) * j));
    const rv   = (m = 18) => (Math.random() - 0.5) * 2 * m;

    const configs = [
      // 行人（pedestrian）—— 各纵深均有
      { x:  130, y: yAt(0.10), animation: 'walk', direction:  1, speed: 38, vy: rv(16), tags: ['pedestrian'] },
      { x:  460, y: yAt(0.45), animation: 'walk', direction: -1, speed: 33, vy: rv(18), tags: ['pedestrian'] },
      { x:  790, y: yAt(0.75), animation: 'walk', direction:  1, speed: 41, vy: rv(15), tags: ['pedestrian'] },
      { x: 1120, y: yAt(0.30), animation: 'walk', direction: -1, speed: 36, vy: rv(17), tags: ['pedestrian'] },
      { x: 1450, y: yAt(0.60), animation: 'walk', direction:  1, speed: 44, vy: rv(16), tags: ['pedestrian'] },
      { x: 1780, y: yAt(0.20), animation: 'walk', direction: -1, speed: 39, vy: rv(14), tags: ['pedestrian'] },
      // 跑者（runner）
      { x:  320, y: yAt(0.55), animation: 'run',  direction:  1, speed:  94, vy: rv(12), tags: ['runner'] },
      { x:  970, y: yAt(0.35), animation: 'run',  direction: -1, speed:  88, vy: rv(14), tags: ['runner'] },
      { x: 1650, y: yAt(0.70), animation: 'run',  direction:  1, speed: 100, vy: rv(10), tags: ['runner'] },
      // 旁观者（bystander）—— 几乎静止
      { x:  580, y: yAt(0.82), animation: 'idle', direction:  1, speed: 0, vy: rv(7),  tags: ['bystander'] },
      { x:  870, y: yAt(0.40), animation: 'idle', direction: -1, speed: 0, vy: rv(6),  tags: ['bystander'] },
      { x: 1240, y: yAt(0.65), animation: 'idle', direction:  1, speed: 0, vy: rv(8),  tags: ['bystander'] },
      { x: 1900, y: yAt(0.22), animation: 'idle', direction: -1, speed: 0, vy: rv(5),  tags: ['bystander'] },
      // 警察（officer）—— 缓慢巡逻
      { x:  700, y: yAt(0.50), animation: 'walk', direction:  1, speed: 22, vy: rv(8),  tags: ['officer'] },
      { x: 1550, y: yAt(0.38), animation: 'walk', direction: -1, speed: 20, vy: rv(7),  tags: ['officer'] },
      // 小贩（vendor）—— 几乎不动
      { x: 1050, y: yAt(0.78), animation: 'idle', direction:  1, speed: 0, vy: rv(4),  tags: ['vendor'] },
      // 游客（tourist）—— 慢速，Y漂移大
      { x:  240, y: yAt(0.62), animation: 'walk', direction:  1, speed: 18, vy: rv(22), tags: ['tourist'] },
      { x: 1350, y: yAt(0.28), animation: 'walk', direction: -1, speed: 16, vy: rv(20), tags: ['tourist'] },
    ];

    for (const cfg of configs) {
      cfg.renderer = this.stickRenderer;
      cfg.minX     = 50;
      cfg.maxX     = WORLD_WIDTH - 50;
      cfg.minY     = farY;
      cfg.maxY     = nearY;
      cfg.color    = this._npcColorForTag(cfg.tags[0]);
      const npc    = new NPC(cfg);
      npc.frameIndex = Math.floor(Math.random() * 8);
      this.entityManager.add(npc);
    }
  }

  _npcColorForTag(tag) {
    const palettes = {
      pedestrian: [0x1a1a2a, 0x22304a, 0x2a1810, 0x182818, 0x28201a, 0x101828],
      runner:     [0x3a1800, 0x1a2a08, 0x0a1a30, 0x301020],
      bystander:  [0x202020, 0x1a1a30, 0x181818, 0x281820, 0x202818],
      officer:    [0x0a1840, 0x081838],
      vendor:     [0x3a1a00, 0x2a1000],
      tourist:    [0x2a1c0c, 0x1a2010, 0x300a0a],
    };
    const colors = palettes[tag] || [0x1a1a1a];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
