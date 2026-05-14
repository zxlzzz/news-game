/**
 * NPCManager
 * 管理所有NPC的生成、更新、绘制
 */

import { NPC } from './NPC.js';

export class NPCManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.npcs = [];
  }

  /**
   * 生成初始NPC
   * @param {number} groundY - 地面 Y 坐标
   * @param {number} worldWidth - 世界宽度
   */
  spawnInitial(groundY, worldWidth) {
    const configs = [
      // 走路的行人
      { x: 200,  y: groundY, animation: 'walk', direction: 1,  speed: 40,  tags: ['pedestrian'] },
      { x: 600,  y: groundY, animation: 'walk', direction: -1, speed: 35,  tags: ['pedestrian'] },
      { x: 1000, y: groundY, animation: 'walk', direction: 1,  speed: 45,  tags: ['pedestrian'] },
      { x: 1400, y: groundY, animation: 'walk', direction: -1, speed: 38,  tags: ['pedestrian'] },

      // 跑步的人
      { x: 400,  y: groundY, animation: 'run',  direction: 1,  speed: 90,  tags: ['runner'] },
      { x: 1200, y: groundY, animation: 'run',  direction: -1, speed: 85,  tags: ['runner'] },

      // 站着的人
      { x: 500,  y: groundY, animation: 'idle', direction: 1,  speed: 0,   tags: ['bystander'] },
      { x: 800,  y: groundY, animation: 'idle', direction: -1, speed: 0,   tags: ['bystander'] },
      { x: 1600, y: groundY, animation: 'idle', direction: 1,  speed: 0,   tags: ['bystander'] },
    ];

    for (const cfg of configs) {
      cfg.minX = 50;
      cfg.maxX = worldWidth - 50;
      // 随机化起始帧，避免所有同动画NPC同步
      const npc = new NPC(cfg);
      npc.frameIndex = Math.floor(Math.random() * 8);
      this.npcs.push(npc);
    }
  }

  /**
   * 更新所有NPC
   */
  update(delta) {
    for (const npc of this.npcs) {
      npc.update(delta, this.renderer);
    }
  }

  /**
   * 绘制所有NPC
   * @param {Phaser.GameObjects.Graphics} g
   */
  draw(g) {
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const color = npc.inViewfinder ? 0xcc2200 : npc.color;
      this.renderer.draw(
        g, npc.animation, npc.frameIndex,
        npc.x, npc.y, npc.scale, npc.direction,
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
