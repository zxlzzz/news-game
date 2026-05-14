/**
 * StreetScene
 * 主场景：2.5D俯视角街道 + NPC深度漫步 + 取景框 + 拍照/发布
 */

import { StickRenderer } from '../StickRenderer.js';
import { NPCManager } from '../NPCManager.js';
import { Viewfinder } from '../Viewfinder.js';

const WORLD_WIDTH  = 2000;
const WORLD_HEIGHT = 500;

// 地面纵深：FAR_Y=远端（画面上方小人小），NEAR_Y=近端（画面下方小人大）
const FAR_Y  = 252;
const NEAR_Y = 458;

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

    this.bgGraphics  = this.add.graphics();
    this.npcGraphics = this.add.graphics();
    this.vfGraphics  = this.add.graphics();

    this.drawBackground();

    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk', this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run',  this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle', this.cache.json.get('anim_idle'));

    this.npcManager = new NPCManager(this.stickRenderer, {
      farY: FAR_Y, nearY: NEAR_Y, farScale: 0.24, nearScale: 0.60,
    });
    this.npcManager.spawnInitial(WORLD_WIDTH);

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

    this.uiText = this.add.text(10, 10, '← → 滚动  |  拖动取景框捕捉NPC', {
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
    const count = this.viewfinder.capturedNPCs.length;
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
    this.captureText.setText('新闻已发布！').setColor('#1a3d99');
    this.time.delayedCall(2000, () => this.captureText.setText(''));
  }

  _generateHeadline(tags, count) {
    const subject = tags.join('与');
    const templates = [
      `${count}名${subject}街头聚集，真相令人震惊`,
      `独家现场：${subject}集会背后的秘密`,
      `记者深度揭秘：${subject}事件始末`,
      `突发！${subject}异动，专家紧急发声`,
      `${subject}齐聚广场，舆论哗然`,
      `疑云！${subject}街头事件完整记录`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // ─── 每帧更新 ─────────────────────────────────────────────────────────────────

  update(time, delta) {
    const cam = this.cameras.main;
    const spd = 300 * (delta / 1000);

    if (this.cursors.left.isDown)       cam.scrollX -= spd;
    else if (this.cursors.right.isDown) cam.scrollX += spd;

    const vfc = this.viewfinder.getCenter();
    const margin = 80;
    if (vfc.x - cam.scrollX < margin)                cam.scrollX -= spd * 0.5;
    else if (cam.scrollX + cam.width - vfc.x < margin) cam.scrollX += spd * 0.5;

    this.npcManager.update(delta);
    this.viewfinder.updateCapture(this.npcManager.getAlive());

    this.npcGraphics.clear();
    this.npcManager.draw(this.npcGraphics);

    this.vfGraphics.clear();
    this.viewfinder.draw(this.vfGraphics);

    // 取景框信息提示
    if (!this.lastPhoto) {
      const captured = this.viewfinder.capturedNPCs;
      if (captured.length > 0) {
        this.captureText
          .setText(`取景框内: ${captured.length} 人  [${this.viewfinder.getCapturedTags().join(', ')}]`)
          .setColor('#cc2200');
      } else if (this.captureText.style.color === 'rgb(204, 34, 0)') {
        this.captureText.setText('');
      }
    }
  }

  // ─── 背景绘制 ─────────────────────────────────────────────────────────────────

  drawBackground() {
    const g = this.bgGraphics;

    // 建筑区底色
    g.fillStyle(0xc8c3bc, 1);
    g.fillRect(0, 0, WORLD_WIDTH, 130);

    // 远端人行道
    g.fillStyle(0xd0cbc2, 1);
    g.fillRect(0, 130, WORLD_WIDTH, FAR_Y - 130);

    // 道路沥青
    g.fillStyle(0x797573, 1);
    g.fillRect(0, FAR_Y, WORLD_WIDTH, NEAR_Y - FAR_Y);

    // 近端人行道
    g.fillStyle(0xd4cfc6, 1);
    g.fillRect(0, NEAR_Y, WORLD_WIDTH, WORLD_HEIGHT - NEAR_Y);

    this._drawRoadSurface(g);
    this._drawPavement(g, 132, FAR_Y - 2, 48, 3);
    this._drawPavement(g, NEAR_Y + 4, WORLD_HEIGHT, 52, 2);
    this._drawBuildingTops(g);
    this._drawTrees(g);
    this._drawLampPosts(g);
    this._drawBenches(g);
  }

  _drawRoadSurface(g) {
    // 透视横线：由近至远间距越来越小
    let lineY = NEAR_Y - 10;
    let spacing = 30;
    while (lineY > FAR_Y + 5 && spacing > 2.8) {
      g.lineStyle(1, 0x626060, 0.22);
      g.lineBetween(0, Math.round(lineY), WORLD_WIDTH, Math.round(lineY));
      spacing *= 0.80;
      lineY -= spacing;
    }

    // 路边白实线（道路内侧）
    g.lineStyle(3, 0xffffff, 0.45);
    g.lineBetween(0, FAR_Y + 9,   WORLD_WIDTH, FAR_Y + 9);
    g.lineBetween(0, NEAR_Y - 9,  WORLD_WIDTH, NEAR_Y - 9);

    // 路沿石
    g.fillStyle(0xe2ddd4, 1);
    g.fillRect(0, FAR_Y - 4, WORLD_WIDTH, 5);
    g.fillStyle(0xe8e3da, 1);
    g.fillRect(0, NEAR_Y,    WORLD_WIDTH, 5);

    // 中心双黄虚线
    const midY = Math.round((FAR_Y + NEAR_Y) / 2);
    g.lineStyle(2, 0xc8b040, 0.75);
    for (let x = 0; x < WORLD_WIDTH; x += 68) {
      g.lineBetween(x, midY - 2, x + 36, midY - 2);
      g.lineBetween(x, midY + 2, x + 36, midY + 2);
    }

    // 斑马线（梯形透视条纹）
    for (let cx = 220; cx < WORLD_WIDTH; cx += 380) {
      this._drawCrosswalk(g, cx);
    }
  }

  // 梯形斑马线：近端条纹更宽更稀，产生透视感
  _drawCrosswalk(g, cx) {
    const stripes   = 8;
    const farSW     = 8,  nearSW  = 13; // 条纹宽度
    const farGap    = 12, nearGap = 16; // 间距
    const roadTop   = FAR_Y  + 10;
    const roadBot   = NEAR_Y - 10;

    g.fillStyle(0xffffff, 0.50);
    for (let i = 0; i < stripes; i++) {
      const fx = cx + i * (farSW  + farGap);
      const nx = cx + i * (nearSW + nearGap);
      g.beginPath();
      g.moveTo(fx,         roadTop);
      g.lineTo(fx + farSW, roadTop);
      g.lineTo(nx + nearSW, roadBot);
      g.lineTo(nx,          roadBot);
      g.closePath();
      g.fillPath();
    }
  }

  // 铺砖网格
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

  _drawBuildingTops(g) {
    // 每栋建筑：从远侧（Y=130-depth）到近侧（Y=128）
    const defs = [
      { x: 15,   w: 115, depth: 80, color: 0x9e9590 },
      { x: 152,  w:  88, depth: 62, color: 0x8a9098 },
      { x: 263,  w: 148, depth: 87, color: 0xa08878, wt: true  },
      { x: 430,  w:  82, depth: 58, color: 0x909898 },
      { x: 534,  w: 126, depth: 73, color: 0x94887a },
      { x: 684,  w: 106, depth: 68, color: 0x7e8898 },
      { x: 813,  w: 158, depth: 90, color: 0xa09488, wt: true  },
      { x: 992,  w:  88, depth: 60, color: 0x8c9890 },
      { x: 1102, w: 134, depth: 78, color: 0x988a7e },
      { x: 1258, w:  80, depth: 56, color: 0x8898a0 },
      { x: 1362, w: 118, depth: 70, color: 0x9a9080 },
      { x: 1505, w: 148, depth: 84, color: 0x7e8898, wt: true  },
      { x: 1678, w:  92, depth: 64, color: 0x988890 },
      { x: 1798, w: 126, depth: 74, color: 0xa09488 },
    ];

    for (const b of defs) {
      const top = 130 - b.depth;
      const bot = 128;

      // 主体
      g.fillStyle(b.color, 1);
      g.fillRect(b.x, top, b.w, b.depth);

      // 高光（背街侧）
      g.fillStyle(0xffffff, 0.07);
      g.fillRect(b.x, top, b.w, Math.floor(b.depth * 0.38));

      // 阴影（临街侧）
      g.fillStyle(0x000000, 0.13);
      g.fillRect(b.x, top + b.depth * 0.62, b.w, b.depth * 0.38);

      // 轮廓
      g.lineStyle(1.5, 0x5c5850, 1);
      g.strokeRect(b.x, top, b.w, b.depth);

      // 屋顶中脊
      g.lineStyle(1, 0x706860, 0.45);
      g.lineBetween(b.x + b.w / 2, top, b.x + b.w / 2, bot);

      // 临街阴影线
      g.lineStyle(3, 0x403830, 0.55);
      g.lineBetween(b.x, bot, b.x + b.w, bot);

      // 水塔（部分楼有）
      if (b.wt) {
        const wx = b.x + b.w * 0.38;
        const wy = top + b.depth * 0.35;
        g.fillStyle(0x706858, 1);
        g.fillCircle(wx, wy, 10);
        g.lineStyle(1.5, 0x504840, 1);
        g.strokeCircle(wx, wy, 10);
        g.fillStyle(0x907858, 0.65);
        g.fillCircle(wx, wy, 5);
        // 水塔腿
        g.lineStyle(1.5, 0x605048, 0.8);
        g.lineBetween(wx - 6, wy + 8, wx - 6, wy + 14);
        g.lineBetween(wx + 6, wy + 8, wx + 6, wy + 14);
      }
    }
  }

  _drawTrees(g) {
    // 远端人行道树（Y ≈ 170，较小）
    const farXs = [75, 238, 405, 572, 740, 908, 1076, 1244, 1412, 1580, 1748, 1916];
    for (const tx of farXs) {
      const ty = 168 + Math.sin(tx * 0.031) * 9;
      const r  = 14 + Math.sin(tx * 0.071) * 3;
      g.fillStyle(0x000000, 0.16);
      g.fillEllipse(tx + 5, ty + 7, r * 2.6, r * 1.5);
      g.fillStyle(0x4e7430, 1);
      g.fillCircle(tx, ty, r);
      g.fillStyle(0x72a848, 0.52);
      g.fillCircle(tx - 4, ty - 4, r * 0.44);
    }

    // 近端人行道树（Y ≈ 479，较大）
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

  _drawLampPosts(g) {
    // 远端路沿灯柱（灯臂朝道路方向=Y增大方向）
    for (let x = 95; x < WORLD_WIDTH; x += 155) {
      const px = x, py = FAR_Y - 3;
      // 柱
      g.lineStyle(2.5, 0x8a8880, 0.92);
      g.lineBetween(px, py + 14, px, py - 6);
      // 灯臂（斜向路面）
      g.lineStyle(2, 0x8c8a84, 0.85);
      g.lineBetween(px, py - 6, px + 16, py + 8);
      // 灯头
      g.fillStyle(0xdcd090, 0.95);
      g.fillCircle(px + 16, py + 8, 5);
      g.fillStyle(0xfffff8, 0.45);
      g.fillCircle(px + 16, py + 8, 2.5);
    }

    // 近端路沿灯柱（灯臂朝道路方向=Y减小方向）
    for (let x = 172; x < WORLD_WIDTH; x += 155) {
      const px = x, py = NEAR_Y + 5;
      g.lineStyle(2.5, 0x8a8880, 0.92);
      g.lineBetween(px, py - 12, px, py + 8);
      g.lineStyle(2, 0x8c8a84, 0.85);
      g.lineBetween(px, py - 12, px - 16, py - 5);
      g.fillStyle(0xdcd090, 0.95);
      g.fillCircle(px - 16, py - 5, 5);
      g.fillStyle(0xfffff8, 0.45);
      g.fillCircle(px - 16, py - 5, 2.5);
    }
  }

  _drawBenches(g) {
    // 远端人行道长椅（Y ≈ 208）
    for (let x = 135; x < WORLD_WIDTH; x += 290) {
      const bx = x, by = 206;
      const bw = 30, bh = 11;
      // 椅面
      g.fillStyle(0xb09868, 0.88);
      g.fillRect(bx, by, bw, bh);
      // 椅背（上方细条）
      g.fillStyle(0x907848, 0.75);
      g.fillRect(bx, by - 4, bw, 4);
      // 轮廓
      g.lineStyle(1, 0x7a6040, 0.8);
      g.strokeRect(bx, by, bw, bh);
      // 椅腿（阴影点）
      g.fillStyle(0x605030, 0.55);
      g.fillRect(bx + 4,        by + bh, 3, 4);
      g.fillRect(bx + bw - 7,   by + bh, 3, 4);
    }
  }
}
