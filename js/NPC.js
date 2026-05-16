/**
 * NPC — 继承 Entity 的动态人物实体
 * 保留原有动画播放、X/Y运动行为逻辑；
 * 渲染委托给构造时注入的 StickRenderer。
 */

import { Entity } from './Entity.js';

export class NPC extends Entity {
  /**
   * @param {object}      config
   * @param {StickRenderer} config.renderer  - 火柴人渲染器（必须提供）
   * @param {string}      config.animation  - 动画名称
   * @param {number}      config.direction  - 1=右，-1=左
   * @param {number}      config.speed      - 水平速度（像素/秒），0=静止
   * @param {number}      config.vy         - 纵深漂移速度（像素/秒）
   * @param {number}      config.scale      - 初始缩放（EntityManager每帧会按Y覆盖）
   * @param {number}      config.color      - 服装颜色
   * @param {number}      config.minX/maxX  - X活动边界
   * @param {number}      config.minY/maxY  - Y活动边界（纵深范围）
   */
  constructor(config) {
    super({
      ...config,
      width:  40,
      height: 80,
      static: false,
    });

    this.renderer  = config.renderer;
    this.animation = config.animation || 'idle';
    this.direction = config.direction || 1;
    this.speed     = config.speed     || 0;
    this.vy        = config.vy !== undefined ? config.vy : (Math.random() * 2 - 1) * 18;
    this.scale     = config.scale     ?? 0.45;
    this.color     = config.color     ?? 0x1a1a1a;

    this.frameIndex = 0;
    this.frameTimer = 0;

    this.minX = config.minX ?? -100;
    this.maxX = config.maxX ?? 2100;
    this.minY = config.minY ?? 250;
    this.maxY = config.maxY ?? 460;
  }

  /**
   * 包围盒随深度缩放动态变化（scale 由 EntityManager 每帧写入）
   */
  getBounds() {
    const h = 80 * this.scale * 2;
    const w = 40 * this.scale * 2;
    return {
      x:      this.x - w / 2,
      y:      this.y - h,
      width:  w,
      height: h,
    };
  }

  update(delta) {
    if (!this.alive) return;

    // 动画帧推进
    const anim = this.renderer.getAnimation(this.animation);
    if (anim) {
      this.frameTimer += delta;
      const interval = 1000 / anim.fps;
      if (this.frameTimer >= interval) {
        this.frameTimer -= interval;
        this.frameIndex = (this.frameIndex + 1) % anim.frameCount;
      }
    }

    // X 移动（到达边界折返）
    if (this.speed > 0) {
      this.x += this.direction * this.speed * (delta / 1000);
      if      (this.x > this.maxX) { this.x = this.maxX; this.direction = -1; }
      else if (this.x < this.minX) { this.x = this.minX; this.direction =  1; }
    }

    // Y 纵深漂移（到达边界反向）
    this.y += this.vy * (delta / 1000);
    if      (this.y > this.maxY) { this.y = this.maxY; this.vy = -Math.abs(this.vy); }
    else if (this.y < this.minY) { this.y = this.minY; this.vy =  Math.abs(this.vy); }
  }

  draw(g) {
    if (!this.alive || !this.visible) return;

    const color = this.inViewfinder ? 0xcc2200 : this.color;
    this.renderer.draw(
      g, this.animation, this.frameIndex,
      this.x, this.y, this.scale, this.direction,
      color, 1
    );

    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }
}
