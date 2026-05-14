/**
 * NPCManager
 * 管理所有NPC的生成、更新、深度排序绘制
 */

import { NPC } from './NPC.js';

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
    this.renderer   = renderer;
    this.farY       = config.farY   ?? 250;
    this.nearY      = config.nearY  ?? 460;
    this.farScale   = config.farScale  ?? 0.25;
    this.nearScale  = config.nearScale ?? 0.55;
    this.npcs = [];
  }

  /** 按Y坐标计算深度缩放 */
  depthScale(y) {
    const t = Math.max(0, Math.min(1, (y - this.farY) / (this.nearY - this.farY)));
    return this.farScale + t * (this.nearScale - this.farScale);
  }

  /**
   * 生成初始NPC
   * @param {number} worldWidth
   */
  spawnInitial(worldWidth) {
    const { farY, nearY } = this;
    const span = nearY - farY;

    // 随机Y（带分段，保证各纵深都有人）
    const yAt = (frac, jitter = 0.12) =>
      farY + span * Math.max(0, Math.min(1, frac + (Math.random() - 0.5) * jitter));
    const rv = (mag = 18) => (Math.random() - 0.5) * 2 * mag;

    const configs = [
      // ── 行人 pedestrian（最多，各纵深均有）──
      { x:  130, y: yAt(0.10), animation: 'walk', direction:  1, speed: 38, vy: rv(16), tags: ['pedestrian'] },
      { x:  460, y: yAt(0.45), animation: 'walk', direction: -1, speed: 33, vy: rv(18), tags: ['pedestrian'] },
      { x:  790, y: yAt(0.75), animation: 'walk', direction:  1, speed: 41, vy: rv(15), tags: ['pedestrian'] },
      { x: 1120, y: yAt(0.30), animation: 'walk', direction: -1, speed: 36, vy: rv(17), tags: ['pedestrian'] },
      { x: 1450, y: yAt(0.60), animation: 'walk', direction:  1, speed: 44, vy: rv(16), tags: ['pedestrian'] },
      { x: 1780, y: yAt(0.20), animation: 'walk', direction: -1, speed: 39, vy: rv(14), tags: ['pedestrian'] },

      // ── 跑者 runner ──
      { x:  320, y: yAt(0.55), animation: 'run',  direction:  1, speed: 94, vy: rv(12), tags: ['runner'] },
      { x:  970, y: yAt(0.35), animation: 'run',  direction: -1, speed: 88, vy: rv(14), tags: ['runner'] },
      { x: 1650, y: yAt(0.70), animation: 'run',  direction:  1, speed: 100, vy: rv(10), tags: ['runner'] },

      // ── 旁观者 bystander（基本静止，轻微漂移）──
      { x:  580, y: yAt(0.82), animation: 'idle', direction:  1, speed: 0, vy: rv(7),  tags: ['bystander'] },
      { x:  870, y: yAt(0.40), animation: 'idle', direction: -1, speed: 0, vy: rv(6),  tags: ['bystander'] },
      { x: 1240, y: yAt(0.65), animation: 'idle', direction:  1, speed: 0, vy: rv(8),  tags: ['bystander'] },
      { x: 1900, y: yAt(0.22), animation: 'idle', direction: -1, speed: 0, vy: rv(5),  tags: ['bystander'] },

      // ── 警察 officer（缓慢巡逻）──
      { x:  700, y: yAt(0.50), animation: 'walk', direction:  1, speed: 22, vy: rv(8),  tags: ['officer'] },
      { x: 1550, y: yAt(0.38), animation: 'walk', direction: -1, speed: 20, vy: rv(7),  tags: ['officer'] },

      // ── 小贩 vendor（几乎不动）──
      { x: 1050, y: yAt(0.78), animation: 'idle', direction:  1, speed: 0, vy: rv(4),  tags: ['vendor'] },

      // ── 游客 tourist（慢速闲逛，Y漂移大）──
      { x:  240, y: yAt(0.62), animation: 'walk', direction:  1, speed: 18, vy: rv(22), tags: ['tourist'] },
      { x: 1350, y: yAt(0.28), animation: 'walk', direction: -1, speed: 16, vy: rv(20), tags: ['tourist'] },
    ];

    for (const cfg of configs) {
      cfg.minX  = 50;
      cfg.maxX  = worldWidth - 50;
      cfg.minY  = this.farY;
      cfg.maxY  = this.nearY;
      cfg.color = this._colorForTag(cfg.tags[0]);
      const npc = new NPC(cfg);
      npc.frameIndex = Math.floor(Math.random() * 8);
      this.npcs.push(npc);
    }
  }

  /** 根据标签返回带随机变化的服装颜色 */
  _colorForTag(tag) {
    const palettes = {
      pedestrian: [0x1a1a2a, 0x22304a, 0x2a1810, 0x182818, 0x28201a, 0x101828],
      runner:     [0x3a1800, 0x1a2a08, 0x0a1a30, 0x301020],
      bystander:  [0x202020, 0x1a1a30, 0x181818, 0x281820, 0x202818],
      officer:    [0x0a1840, 0x081838],  // 深蓝制服
      vendor:     [0x3a1a00, 0x2a1000],  // 深褐
      tourist:    [0x2a1c0c, 0x1a2010, 0x300a0a],
    };
    const colors = palettes[tag] || [0x1a1a1a];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 更新所有NPC，并将深度缩放写入 npc.scale（供 getBounds 使用）
   */
  update(delta) {
    for (const npc of this.npcs) {
      npc.scale = this.depthScale(npc.y);
      npc.update(delta, this.renderer);
    }
  }

  /**
   * 按Y深度排序后绘制（Y小=远=先画，Y大=近=后画压前面）
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

  getAlive() {
    return this.npcs.filter(n => n.alive);
  }
}
