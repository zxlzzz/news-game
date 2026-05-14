/**
 * NPC
 * 单个NPC：位置、朝向、动画播放、简单行为（含Y轴漂移）
 */

export class NPC {
  /**
   * @param {object} config
   * @param {number} config.x        - 初始世界坐标 x
   * @param {number} config.y        - 初始世界坐标 y（脚底）
   * @param {string} config.animation - 动画名称
   * @param {number} config.direction - 1=右，-1=左
   * @param {number} config.speed    - 水平移动速度（像素/秒），0=静止
   * @param {number} config.vy       - 纵深漂移速度（像素/秒），正=向近端移动
   * @param {number} config.scale    - 缩放（运行时由NPCManager按Y动态覆盖）
   * @param {string[]} config.tags   - 语义标签
   */
  constructor(config) {
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.animation = config.animation || 'idle';
    this.direction = config.direction || 1;
    this.speed = config.speed || 0;
    this.vy = config.vy !== undefined ? config.vy : (Math.random() * 2 - 1) * 18;
    this.scale = config.scale || 0.45;
    this.tags = config.tags || [];
    this.color = config.color || 0x1a1a1a;

    // 动画状态
    this.frameIndex = 0;
    this.frameTimer = 0;

    // X 行为边界
    this.minX = config.minX ?? -100;
    this.maxX = config.maxX ?? 2100;

    // Y 行为边界（纵深范围）
    this.minY = config.minY ?? 250;
    this.maxY = config.maxY ?? 460;

    // 是否在取景框内（由 Viewfinder 设置）
    this.inViewfinder = false;

    // 是否存活
    this.alive = true;
  }

  /**
   * 每帧更新
   * @param {number} delta   - 毫秒
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

    // X 移动
    if (this.speed > 0) {
      this.x += this.direction * this.speed * (delta / 1000);
      if (this.x > this.maxX) {
        this.x = this.maxX;
        this.direction = -1;
      } else if (this.x < this.minX) {
        this.x = this.minX;
        this.direction = 1;
      }
    }

    // Y 漂移（纵深移动）
    this.y += this.vy * (delta / 1000);
    if (this.y > this.maxY) {
      this.y = this.maxY;
      this.vy = -Math.abs(this.vy);
    } else if (this.y < this.minY) {
      this.y = this.minY;
      this.vy = Math.abs(this.vy);
    }
  }

  /**
   * 获取NPC的包围盒（世界坐标），用于取景框碰撞检测
   * scale 由 NPCManager 每帧动态更新，确保深度缩放正确
   */
  getBounds() {
    const h = 80 * this.scale * 2;
    const w = 40 * this.scale * 2;
    return {
      x: this.x - w / 2,
      y: this.y - h,
      width: w,
      height: h,
    };
  }
}
