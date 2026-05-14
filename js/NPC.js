/**
 * NPC
 * 单个NPC：位置、朝向、动画播放、简单行为
 */

export class NPC {
  /**
   * @param {object} config
   * @param {number} config.x - 初始世界坐标 x
   * @param {number} config.y - 初始世界坐标 y（脚底）
   * @param {string} config.animation - 动画名称
   * @param {number} config.direction - 1=右，-1=左
   * @param {number} config.speed - 移动速度（像素/秒），0=静止
   * @param {number} config.scale - 缩放
   * @param {string[]} config.tags - 语义标签（为取景框系统预留）
   */
  constructor(config) {
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.animation = config.animation || 'idle';
    this.direction = config.direction || 1;
    this.speed = config.speed || 0;
    this.scale = config.scale || 0.45;
    this.tags = config.tags || [];
    this.color = config.color || 0x1a1a1a;

    // 动画状态
    this.frameIndex = 0;
    this.frameTimer = 0;

    // 行为边界（NPC在这个范围内活动）
    this.minX = config.minX ?? -100;
    this.maxX = config.maxX ?? 2100;

    // 是否在取景框内（由 Viewfinder 设置）
    this.inViewfinder = false;

    // 是否存活
    this.alive = true;
  }

  /**
   * 每帧更新
   * @param {number} delta - 毫秒
   * @param {object} renderer - StickRenderer 实例
   */
  update(delta, renderer) {
    if (!this.alive) return;

    // 动画帧推进
    const anim = renderer.getAnimation(this.animation);
    if (anim) {
      this.frameTimer += delta;
      const frameInterval = 1000 / anim.fps;
      if (this.frameTimer >= frameInterval) {
        this.frameTimer -= frameInterval;
        this.frameIndex = (this.frameIndex + 1) % anim.frameCount;
      }
    }

    // 移动
    if (this.speed > 0) {
      this.x += this.direction * this.speed * (delta / 1000);

      // 到达边界折返
      if (this.x > this.maxX) {
        this.x = this.maxX;
        this.direction = -1;
      } else if (this.x < this.minX) {
        this.x = this.minX;
        this.direction = 1;
      }
    }
  }

  /**
   * 获取NPC的包围盒（世界坐标）
   * 用于取景框碰撞检测
   */
  getBounds() {
    const h = 80 * this.scale * 2; // 大致高度
    const w = 40 * this.scale * 2; // 大致宽度
    return {
      x: this.x - w / 2,
      y: this.y - h,
      width: w,
      height: h,
    };
  }
}
