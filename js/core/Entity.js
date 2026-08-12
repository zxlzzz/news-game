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
  }

  /**
   * AABB 包围盒（世界坐标）——语义是**贴地竖直广告牌盒**，不是地面足迹。
   * 默认：以 (x − w/2, y − h) 为左上角的矩形（x=中心，y=底部接地）。
   *
   * 约定（所有子类覆盖时都必须遵守，O-2 投影之后这条尤其要紧）：
   *   `x` / `width`  = 水平范围（世界 x）
   *   `y` / `height` = **离地高度**范围；盒子下沿 `y + height` 落在地面接触线上
   * 也就是说 `height` 是"物体有多高"，**不是**"物体在纵深方向有多厚"。
   * 进深（厚度）不在包围盒里，另见 `propDefaults.js#PROP_DEPTH` 与
   * `footprint()`——那两个才是地面足迹/碰撞的住址。
   *
   * 投影到屏幕请用 `Projection.billboardScreenBox()`，它按上面的语义分别走
   * `toScreen`（接地点，纵深量）和 `toScreenLength`（宽高，平长度）两个通道。
   * 别丢给 `projectGroundRect()`——会把高度当纵深，物体越高错得越离谱。
   *
   * 消费者：Viewfinder（取景命中 + 高亮描边）、EntityManager 占位盒子、
   * DebugOverlay 浮标定位。碰撞/导航不走这里。
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

  /** 地面预通道：在 Y 排序主绘制之前调用，绘制贴地平面元素（子类按需覆盖） */
  drawGround(g) {}

  /** 绘制自身到 Graphics 对象（子类实现） */
  draw(g) {}
}
