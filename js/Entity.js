/**
 * Entity — 所有场景可交互实体的基类
 * 子类重写 getBounds()、update(delta)、draw(g)
 */
export class Entity {
  /**
   * @param {object} config
   * @param {number}   config.x       - 世界坐标 X（大多数情况为视觉中心或左边缘，由子类约定）
   * @param {number}   config.y       - 世界坐标 Y（实体"底部"接触点，便于深度排序）
   * @param {number}   config.width   - 碰撞包围盒宽度
   * @param {number}   config.height  - 碰撞包围盒高度
   * @param {string[]} config.tags    - 语义标签数组（供取景框收集）
   * @param {boolean}  config.static  - true=静态实体（不调用 update 位置逻辑）
   * @param {boolean}  config.visible - false 则跳过绘制和碰撞检测
   */
  constructor(config = {}) {
    this.x       = config.x      ?? 0;
    this.y       = config.y      ?? 0;
    this.width   = config.width  ?? 40;
    this.height  = config.height ?? 40;
    this.tags    = config.tags   ?? [];
    this.visible = config.visible !== false;
    this.alive   = true;
    this.static  = config.static !== false; // 默认静态；NPC 显式设为 false
    this.inViewfinder = false;
  }

  /**
   * AABB 包围盒（世界坐标）
   * 默认：以 (x − w/2, y − h) 为左上角的矩形（x=中心，y=底部）
   * 建筑等子类会覆盖此方法
   */
  getBounds() {
    return {
      x:      this.x - this.width / 2,
      y:      this.y - this.height,
      width:  this.width,
      height: this.height,
    };
  }

  /** 每帧逻辑更新（静态实体留空） */
  update(delta) {}

  /** 绘制自身到 Graphics 对象（子类实现） */
  draw(g) {}

  /** 被取景框捕获时的红色边框高亮（子类可调用） */
  _drawViewfinderOutline(g) {
    const b = this.getBounds();
    g.lineStyle(1.5, 0xee4400, 0.7);
    g.strokeRect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
  }
}
