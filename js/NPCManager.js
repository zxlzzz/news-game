/**
 * NPCManager
 * 管理所有NPC的生成、更新、深度排序绘制
 */

import { NPC } from './NPC.js';

// NPC颜色池（增加多样性）
const COLORS = [0x1a1a1a, 0x222244, 0x331100, 0x004422, 0x221122, 0x333300];

export class NPCManager {
  /**
   * @param {StickRenderer} renderer
   * @param {object} config
   * @param {number} config.farY      - 纵深远端 Y（NPC最小Y，显示最小）
   * @param {number} config.nearY     - 纵深近端 Y（NPC最大Y，显示最大）
   * @param {number} config.farScale  - 远端缩放系数
   * @param {number} config.nearScale - 近端缩放系数
   */
  constructor(renderer, config = {}) {
    this.renderer = renderer;
    this.farY = config.farY ?? 250;
    this.nearY = config.nearY ?? 460;
    this.farScale = config.farScale ?? 0.25;
    this.nearScale = config.nearScale ?? 0.55;
    this.npcs = [];
  }

  /**
   * 按Y坐标计算深度缩放系数
   */
  depthScale(y) {
    const t = Math.max(0, Math.min(1, (y - this.farY) / (this.nearY - this.farY)));
    return this.farScale + t * (this.nearScale - this.farScale);
  }

  /**
   * 生成初始NPC
   * @param {number} worldWidth - 世界宽度
   */
  spawnInitial(worldWidth) {
    const midY = (this.farY + this.nearY) / 2;
    const configs = [
      // 走路的行人（分布在不同纵深）
      { x: 200,  y: this.farY + 30,  animation: 'walk', direction:  1, speed: 40, vy:  14, tags: ['pedestrian'] },
      { x: 600,  y: midY,            animation: 'walk', direction: -1, speed: 35, vy: -16, tags: ['pedestrian'] },
      { x: 1000, y: this.nearY - 30, animation: 'walk', direction:  1, speed: 45, vy:  12, tags: ['pedestrian'] },
      { x: 1400, y: midY - 30,       animation: 'walk', direction: -1, speed: 38, vy: -10, tags: ['pedestrian'] },
      { x: 1750, y: this.farY + 60,  animation: 'walk', direction:  1, speed: 42, vy:  18, tags: ['pedestrian'] },

      // 跑步的人
      { x: 400,  y: midY + 40,       animation: 'run',  direction:  1, speed: 90, vy: -20, tags: ['runner'] },
      { x: 1200, y: midY - 20,       animation: 'run',  direction: -1, speed: 85, vy:  15, tags: ['runner'] },

      // 站着的人
      { x: 500,  y: this.nearY - 20, animation: 'idle', direction:  1, speed: 0,  vy:   8, tags: ['bystander'] },
      { x: 800,  y: midY + 10,       animation: 'idle', direction: -1, speed: 0,  vy:  -6, tags: ['bystander'] },
      { x: 1600, y: this.farY + 40,  animation: 'idle', direction:  1, speed: 0,  vy:  10, tags: ['bystander'] },
    ];

    for (const cfg of configs) {
      cfg.minX = 50;
      cfg.maxX = worldWidth - 50;
      cfg.minY = this.farY;
      cfg.maxY = this.nearY;
      cfg.color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const npc = new NPC(cfg);
      npc.frameIndex = Math.floor(Math.random() * 8);
      this.npcs.push(npc);
    }
  }

  /**
   * 更新所有NPC，并同步深度缩放到 npc.scale（供 getBounds 使用）
   */
  update(delta) {
    for (const npc of this.npcs) {
      npc.scale = this.depthScale(npc.y); // 实时更新缩放，getBounds 依赖此值
      npc.update(delta, this.renderer);
    }
  }

  /**
   * 按Y深度排序后绘制所有NPC（Y小→远→先画）
   * @param {Phaser.GameObjects.Graphics} g
   */
  draw(g) {
    const alive = this.npcs.filter(n => n.alive);
    alive.sort((a, b) => a.y - b.y);

    for (const npc of alive) {
      const scale = this.depthScale(npc.y);
      const color = npc.inViewfinder ? 0xcc2200 : npc.color;
      this.renderer.draw(
        g, npc.animation, npc.frameIndex,
        npc.x, npc.y, scale, npc.direction,
        color, 1
      );
    }
  }

  /**
   * 获取所有存活的NPC列表
   */
  getAlive() {
    return this.npcs.filter(n => n.alive);
  }
}
