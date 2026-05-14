/**
 * StreetScene
 * 主场景：街道背景 + NPC + 取景框
 */

import { StickRenderer } from '../StickRenderer.js';
import { NPCManager } from '../NPCManager.js';
import { Viewfinder } from '../Viewfinder.js';

// 世界尺寸
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 500;
const GROUND_Y = 420; // 地面位置
const SKY_COLOR = 0xf0ece4;
const GROUND_COLOR = 0xd4cfc4;

export class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StreetScene' });
  }

  preload() {
    // 加载动画 JSON
    this.load.json('anim_walk', 'assets/animations/walk.json');
    this.load.json('anim_run', 'assets/animations/run.json');
    this.load.json('anim_idle', 'assets/animations/idle.json');
  }

  create() {
    // 设置世界和摄像机
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(SKY_COLOR);

    // Graphics 对象 - 背景（静态）
    this.bgGraphics = this.add.graphics();
    this.drawBackground();

    // Graphics 对象 - NPC（每帧重绘）
    this.npcGraphics = this.add.graphics();

    // Graphics 对象 - 取景框（最上层）
    this.vfGraphics = this.add.graphics();

    // 初始化渲染器
    this.stickRenderer = new StickRenderer(this);
    this.stickRenderer.loadAnimation('walk', this.cache.json.get('anim_walk'));
    this.stickRenderer.loadAnimation('run', this.cache.json.get('anim_run'));
    this.stickRenderer.loadAnimation('idle', this.cache.json.get('anim_idle'));

    // 初始化NPC管理器
    this.npcManager = new NPCManager(this.stickRenderer);
    this.npcManager.spawnInitial(GROUND_Y, WORLD_WIDTH);

    // 初始化取景框
    this.viewfinder = new Viewfinder(this, {
      x: 300, y: 260, width: 220, height: 170,
    });

    // UI 文字
    this.uiText = this.add.text(10, 10, '', {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '13px',
      color: '#555555',
      backgroundColor: 'rgba(240,236,228,0.8)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    this.captureText = this.add.text(10, 36, '', {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: '13px',
      color: '#cc2200',
      backgroundColor: 'rgba(240,236,228,0.8)',
      padding: { x: 6, y: 4 },
    }).setScrollFactor(0).setDepth(100);

    // 输入
    this.cursors = this.input.keyboard.createCursorKeys();

    // 提示
    this.uiText.setText('← → 滚动 | 拖动取景框捕捉NPC');
  }

  update(time, delta) {
    // 摄像机滚动
    const cam = this.cameras.main;
    const scrollSpeed = 300 * (delta / 1000);

    if (this.cursors.left.isDown) {
      cam.scrollX -= scrollSpeed;
    } else if (this.cursors.right.isDown) {
      cam.scrollX += scrollSpeed;
    }

    // 取景框靠近边缘时自动滚动
    const vfCenter = this.viewfinder.getCenter();
    const camLeft = cam.scrollX;
    const camRight = cam.scrollX + cam.width;
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

    // 更新 UI
    const captured = this.viewfinder.capturedNPCs;
    if (captured.length > 0) {
      const tags = this.viewfinder.getCapturedTags();
      this.captureText.setText(`取景框内: ${captured.length} 人 [${tags.join(', ')}]`);
    } else {
      this.captureText.setText('');
    }
  }

  drawBackground() {
    const g = this.bgGraphics;

    // 天空已经由摄像机背景色处理

    // 地面
    g.fillStyle(GROUND_COLOR, 1);
    g.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

    // 人行道线
    g.lineStyle(2, 0xbbb5a8, 1);
    g.lineBetween(0, GROUND_Y, WORLD_WIDTH, GROUND_Y);

    // 简单建筑
    this.drawBuildings(g);

    // 路面标线
    g.lineStyle(1, 0xc8c2b6, 0.5);
    g.lineBetween(0, GROUND_Y + 40, WORLD_WIDTH, GROUND_Y + 40);
  }

  drawBuildings(g) {
    const buildings = [
      { x: 30,   w: 120, h: 180, windows: 3, floors: 4 },
      { x: 170,  w: 100, h: 140, windows: 2, floors: 3 },
      { x: 290,  w: 150, h: 200, windows: 3, floors: 5 },
      { x: 460,  w: 90,  h: 120, windows: 2, floors: 3 },
      { x: 570,  w: 130, h: 170, windows: 3, floors: 4 },
      { x: 720,  w: 110, h: 150, windows: 2, floors: 4 },
      { x: 850,  w: 160, h: 210, windows: 4, floors: 5 },
      { x: 1030, w: 100, h: 130, windows: 2, floors: 3 },
      { x: 1150, w: 140, h: 190, windows: 3, floors: 5 },
      { x: 1310, w: 90,  h: 110, windows: 2, floors: 3 },
      { x: 1420, w: 120, h: 160, windows: 3, floors: 4 },
      { x: 1560, w: 150, h: 200, windows: 3, floors: 5 },
      { x: 1730, w: 100, h: 140, windows: 2, floors: 3 },
      { x: 1850, w: 130, h: 175, windows: 3, floors: 4 },
    ];

    for (const b of buildings) {
      const bx = b.x;
      const by = GROUND_Y - b.h;

      // 建筑主体
      g.fillStyle(0xe8e3da, 1);
      g.fillRect(bx, by, b.w, b.h);

      // 轮廓
      g.lineStyle(1.5, 0x999080, 1);
      g.strokeRect(bx, by, b.w, b.h);

      // 窗户
      const winW = 14, winH = 18;
      const floorH = b.h / (b.floors + 0.5);
      const winGap = b.w / (b.windows + 1);

      for (let floor = 0; floor < b.floors; floor++) {
        for (let wi = 0; wi < b.windows; wi++) {
          const wx = bx + winGap * (wi + 1) - winW / 2;
          const wy = by + floorH * (floor + 0.5) - winH / 2;

          g.fillStyle(0xc8c2b6, 0.6);
          g.fillRect(wx, wy, winW, winH);
          g.lineStyle(0.8, 0x999080, 0.8);
          g.strokeRect(wx, wy, winW, winH);
          // 窗户十字
          g.lineBetween(wx + winW / 2, wy, wx + winW / 2, wy + winH);
          g.lineBetween(wx, wy + winH / 2, wx + winW, wy + winH / 2);
        }
      }

      // 门（底层中间）
      const doorW = 20, doorH = 30;
      const doorX = bx + b.w / 2 - doorW / 2;
      const doorY = GROUND_Y - doorH;
      g.fillStyle(0xb0a898, 1);
      g.fillRect(doorX, doorY, doorW, doorH);
      g.lineStyle(1, 0x999080, 1);
      g.strokeRect(doorX, doorY, doorW, doorH);
    }
  }
}
