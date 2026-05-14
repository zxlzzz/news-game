/**
 * StreetScene
 * 主场景：2.5D俯视角广场 + NPC深度漫步 + 取景框 + 拍照/发布
 */

import { StickRenderer } from '../StickRenderer.js';
import { NPCManager } from '../NPCManager.js';
import { Viewfinder } from '../Viewfinder.js';

const WORLD_WIDTH  = 2000;
const WORLD_HEIGHT = 500;

// 地面纵深范围：FAR_Y=远端（画面上方），NEAR_Y=近端（画面下方）
const FAR_Y  = 250;
const NEAR_Y = 460;

// 背景分区颜色
const COLOR_BUILDING_TOP = 0xb5b0a8; // 楼顶区
const COLOR_FAR_WALK     = 0xcac5bc; // 远端人行道
const COLOR_ROAD         = 0x858180; // 道路沥青
const COLOR_NEAR_WALK    = 0xd0cbc2; // 近端人行道
const COLOR_CURB         = 0xe0dbd2; // 路沿石

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
    this.lastPhoto = null; // 最近一次拍摄的数据 { tags, count }
  }

  preload() {
    this.load.json('anim_walk', 'assets/animations/walk.json');
    this.load.json('anim_run',  'assets/animations/run.json');
    this.load.json('anim_idle', 'assets/animations/idle.json');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(COLOR_BUILDING_TOP);

    // 分层 Graphics
    this.bgGraphics  = this.add.graphics();
    this.npcGraphics = this.add.graphics();
    this.vfGraphics  = this.add.graphics();

    this.drawBackground();

    // 渲染器 & 动画
    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk', this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run',  this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle', this.cache.json.get('anim_idle'));

    // NPC管理器（传入纵深参数）
    this.npcManager = new NPCManager(this.stickRenderer, {
      farY: FAR_Y, nearY: NEAR_Y, farScale: 0.25, nearScale: 0.58,
    });
    this.npcManager.spawnInitial(WORLD_WIDTH);

    // 取景框（初始居中可见区域）
    this.viewfinder = new Viewfinder(this, {
      x: 300, y: 290, width: 220, height: 150,
    });

    this._createUI();

    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ─── UI 构建 ────────────────────────────────────────────────────────────────

  _createUI() {
    const W = this.cameras.main.width;   // 900
    const H = this.cameras.main.height;  // 500

    // 顶部状态栏
    this.uiText = this.add.text(10, 10, '← → 滚动  |  拖动取景框捕捉NPC', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.85)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    // 取景框内容信息
    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '13px',
      color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.85)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    // 新闻标题展示面板
    this.headlinePanel = this.add.text(10, 64, '', {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      backgroundColor: 'rgba(10,10,30,0.88)',
      padding: { x: 12, y: 8 },
      wordWrap: { width: W - 200 },
    }).setScrollFactor(0).setDepth(200).setVisible(false);

    // 拍照闪光遮罩
    this.flashOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0)
      .setScrollFactor(0).setDepth(190);

    // 拍照按钮
    this.btnCapture = this._makeButton(W - 130, H - 54, '[ 拍  照 ]', '#cc3300');
    this.btnCapture.on('pointerdown', () => this._takePhoto());

    // 发布按钮（拍照后才出现）
    this.btnPublish = this._makeButton(W - 130, H - 96, '[ 发布新闻 ]', '#224499');
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

    btn.on('pointerover', () => btn.setAlpha(0.8));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    return btn;
  }

  // ─── 拍照 / 发布逻辑 ────────────────────────────────────────────────────────

  _takePhoto() {
    const count = this.viewfinder.capturedNPCs.length;
    if (count === 0) {
      this.captureText.setText('取景框内没有目标！').setColor('#cc2200');
      this.time.delayedCall(1500, () => this.captureText.setText(''));
      return;
    }

    this.lastPhoto = {
      tags: this.viewfinder.getCapturedTags(),
      count,
    };

    // 快门闪光
    this.flashOverlay.setAlpha(0.75);
    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 220,
      ease: 'Power2',
    });

    this.btnPublish.setVisible(true);
    this.captureText
      .setText(`已拍摄 ${count} 人  [${this.lastPhoto.tags.join('  ')}]`)
      .setColor('#226600');
  }

  _publishNews() {
    if (!this.lastPhoto) return;

    const headline = this._generateHeadline(this.lastPhoto.tags, this.lastPhoto.count);
    this.headlinePanel.setText(`【快讯】${headline}`).setVisible(true);

    this.time.delayedCall(7000, () => this.headlinePanel.setVisible(false));

    this.lastPhoto = null;
    this.btnPublish.setVisible(false);
    this.captureText.setText('新闻已发布！').setColor('#224499');
    this.time.delayedCall(2000, () => this.captureText.setText(''));
  }

  _generateHeadline(tags, count) {
    const subject = tags.join('与');
    const templates = [
      `${count}名${subject}街头聚集，事件真相令人震惊`,
      `独家现场：${subject}大规模集会背后的秘密`,
      `记者深度揭秘：${subject}事件始末`,
      `突发！${subject}异动，专家紧急发声`,
      `${subject}齐聚广场，社会各界高度关注`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ─── 每帧更新 ───────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    const scrollSpeed = 300 * (delta / 1000);

    // 键盘滚动
    if (this.cursors.left.isDown) {
      cam.scrollX -= scrollSpeed;
    } else if (this.cursors.right.isDown) {
      cam.scrollX += scrollSpeed;
    }

    // 取景框靠近屏幕边缘时自动跟随滚动
    const vfCenter   = this.viewfinder.getCenter();
    const camLeft    = cam.scrollX;
    const camRight   = cam.scrollX + cam.width;
    const edgeMargin = 80;
    if (vfCenter.x - camLeft < edgeMargin) {
      cam.scrollX -= scrollSpeed * 0.5;
    } else if (camRight - vfCenter.x < edgeMargin) {
      cam.scrollX += scrollSpeed * 0.5;
    }

    // 更新 NPC
    this.npcManager.update(delta);

    // 更新取景框碰撞
    this.viewfinder.updateCapture(this.npcManager.getAlive());

    // 重绘 NPC
    this.npcGraphics.clear();
    this.npcManager.draw(this.npcGraphics);

    // 重绘取景框
    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

    // 取景框内容提示（无拍摄状态时实时更新）
    if (!this.lastPhoto && this.captureText.text === '') {
      const captured = this.viewfinder.capturedNPCs;
      if (captured.length > 0) {
        const tags = this.viewfinder.getCapturedTags();
        this.captureText
          .setText(`取景框内: ${captured.length} 人  [${tags.join(', ')}]`)
          .setColor('#cc2200');
      }
    } else if (!this.lastPhoto && this.viewfinder.capturedNPCs.length === 0
               && this.captureText.style.color === 'rgb(204, 34, 0)') {
      this.captureText.setText('');
    }
  }

  // ─── 背景绘制（俯视角广场/街道） ─────────────────────────────────────────────

  drawBackground() {
    const g = this.bgGraphics;

    // 建筑区（Y 0–130）
    g.fillStyle(COLOR_BUILDING_TOP, 1);
    g.fillRect(0, 0, WORLD_WIDTH, 130);

    // 远端人行道（Y 130–FAR_Y）
    g.fillStyle(COLOR_FAR_WALK, 1);
    g.fillRect(0, 130, WORLD_WIDTH, FAR_Y - 130);

    // 道路（Y FAR_Y–NEAR_Y）
    g.fillStyle(COLOR_ROAD, 1);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);

    // 近端人行道（Y NEAR_Y–500）
    g.fillStyle(COLOR_NEAR_WALK, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, WORLD_HEIGHT - NEAR_Y);

    // 路沿线
    g.lineStyle(4, COLOR_CURB, 1);
    g.lineBetween(0, FAR_Y,  WORLD_WIDTH, FAR_Y);
    g.lineStyle(4, COLOR_CURB, 1);
    g.lineBetween(0, NEAR_Y, WORLD_WIDTH, NEAR_Y);

    // 道路中心虚线
    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(2, 0xfafaf8, 0.55);
    for (let x = 0; x < WORLD_WIDTH; x += 80) {
      g.lineBetween(x, midY, x + 44, midY);
    }

    // 斑马线（每隔约350px一处）
    for (let cx = 180; cx < WORLD_WIDTH; cx += 360) {
      for (let i = 0; i < 7; i++) {
        g.fillStyle(0xffffff, 0.55);
        g.fillRect(cx + i * 14, FAR_Y, 10, NEAR_Y - FAR_Y);
      }
    }

    // 人行道铺砖网格（远端）
    g.lineStyle(1, 0xb8b3aa, 0.35);
    for (let x = 0; x < WORLD_WIDTH; x += 50) {
      g.lineBetween(x, 130, x, FAR_Y);
    }
    g.lineBetween(0, 180, WORLD_WIDTH, 180);
    g.lineBetween(0, 215, WORLD_WIDTH, 215);

    // 人行道铺砖网格（近端）
    for (let x = 0; x < WORLD_WIDTH; x += 55) {
      g.lineBetween(x, NEAR_Y, x, WORLD_HEIGHT);
    }
    g.lineBetween(0, 477, WORLD_WIDTH, 477);

    this._drawBuildingTops(g);
    this._drawTrees(g);
  }

  _drawBuildingTops(g) {
    // 楼顶俯视矩形（位于Y 0–125区域）
    const buildings = [
      { x: 20,   w: 110, h: 70 },
      { x: 155,  w:  90, h: 55 },
      { x: 270,  w: 140, h: 80 },
      { x: 435,  w:  85, h: 60 },
      { x: 545,  w: 120, h: 72 },
      { x: 690,  w: 100, h: 65 },
      { x: 815,  w: 150, h: 82 },
      { x: 990,  w:  90, h: 58 },
      { x: 1105, w: 130, h: 75 },
      { x: 1260, w:  85, h: 60 },
      { x: 1370, w: 115, h: 70 },
      { x: 1510, w: 140, h: 80 },
      { x: 1680, w:  95, h: 62 },
      { x: 1800, w: 120, h: 72 },
    ];

    for (const b of buildings) {
      const by = 8;
      // 楼顶主体
      g.fillStyle(0xa09a92, 1);
      g.fillRect(b.x, by, b.w, b.h);
      // 屋顶高光（上半部分稍亮）
      g.fillStyle(0xb0aaa2, 0.6);
      g.fillRect(b.x, by, b.w, Math.floor(b.h * 0.45));
      // 轮廓
      g.lineStyle(1.5, 0x888078, 1);
      g.strokeRect(b.x, by, b.w, b.h);
      // 屋顶中脊线
      g.lineStyle(1, 0x777068, 0.6);
      g.lineBetween(b.x + b.w / 2, by, b.x + b.w / 2, by + b.h);
      // 楼顶阴影（底边）
      g.lineStyle(3, 0x706860, 0.5);
      g.lineBetween(b.x, by + b.h, b.x + b.w, by + b.h);
    }
  }

  _drawTrees(g) {
    // 远端人行道的树（圆形俯视，Y ≈ 190）
    for (let x = 100; x < WORLD_WIDTH; x += 180) {
      const tx = x + Math.sin(x * 0.05) * 20; // 轻微错落
      const ty = 190;
      // 投影
      g.fillStyle(0x706860, 0.25);
      g.fillEllipse(tx + 6, ty + 6, 38, 26);
      // 树冠
      g.fillStyle(0x5a7a38, 1);
      g.fillCircle(tx, ty, 18);
      // 高光
      g.fillStyle(0x7aaa50, 0.55);
      g.fillCircle(tx - 5, ty - 5, 7);
    }

    // 近端人行道的树（Y ≈ 480，更大）
    for (let x = 190; x < WORLD_WIDTH; x += 200) {
      const tx = x + Math.cos(x * 0.04) * 15;
      const ty = 481;
      g.fillStyle(0x706860, 0.2);
      g.fillEllipse(tx + 7, ty + 5, 42, 22);
      g.fillStyle(0x4e6e30, 1);
      g.fillCircle(tx, ty, 16);
      g.fillStyle(0x6a9844, 0.5);
      g.fillCircle(tx - 4, ty - 4, 6);
    }
  }
}
