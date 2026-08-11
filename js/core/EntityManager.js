import { toScreen, toScreenLength } from './Projection.js';

/**
 * O-2 占位盒子：真正的三面体积渲染是 O-3（drawObliqueBox）+ O-4（剩余 draw
 * 函数逐批转过去）在做的事。还没转的实体不调用自己的 draw()——那套内容还是
 * 按老的"容器整体缩放"假设写的，没跟 Projection 对齐，直接调用会在投影后的
 * 场景里显得完全错位；已转的实体（见下方 CONVERTED_PROP_TYPES）改走 draw()。
 *
 * 楼是唯一特殊分支：BuildingEntity.y 是立面顶部（roofline），不是地面接触点
 * （接地线在 y+facadeH，见 BuildingEntity._sortY 与 drawBuilding.js 的
 * baseY 算法），其余实体一律遵循 CLAUDE.md 的铁律——entity.y = 地面接触点。
 * building.x 同理是左边缘（老约定，见 getBounds()/drawBuilding.js），跟通用
 * Entity 的"x=中心"约定不一样，占位盒子要按各自约定取锚点，不能都当中心处理。
 */
function _drawPlaceholder(g, e) {
  const b = e.getBounds();
  g.lineStyle(0);
  g.beginFill(0xaaaaaa, 1);
  if (typeof e.facadeH === 'number') {
    const groundY = e.y + e.facadeH;
    const base = toScreen(e.x, groundY);        // e.x 是左边缘，不用再减半宽居中
    const w = toScreenLength(e.bWidth ?? b.width);
    const h = toScreenLength(e.facadeH);
    g.drawRect(base.x, base.y - h, w, h);
  } else {
    const base = toScreen(e.x, e.y);             // 通用 Entity 约定：e.x=中心
    const w = toScreenLength(b.width);
    const h = toScreenLength(b.height);
    g.drawRect(base.x - w / 2, base.y - h, w, h);
  }
  g.endFill();
}

// O-3：已经转成 drawObliqueBox 的 propType 样板（tasks.md O-3 三选一之二，
// 第三个是 manhole——manhole 走 drawGround 通道，见 draw() 里的特判，不进这个
// 集合）。O-4 逐批转换剩余 draw 函数时往这里加，加了就会用真实 draw()。
const CONVERTED_PROP_TYPES = new Set(['bench']);
const CONVERTED_GROUND_TYPES = new Set(['manhole']);

/**
 * EntityManager
 * 统一管理所有场景实体（NPC、建筑、道具）：
 * - 更新动态实体并同步深度缩放
 * - 按Y深度排序绘制（Y小=远=先画）
 * - 提供矩形区域查询接口供取景框使用
 */
export class EntityManager {
  constructor() {
    this.entities = [];
  }

  /** 添加一个实体，返回该实体（方便链式调用） */
  add(entity) {
    entity.manager = this; // 反向引用，供 NPC.getTags() 做空间关系查询
    this.entities.push(entity);
    return entity;
  }

  /**
   * 更新所有实体
   * - 非静态且有 scale 属性的实体（NPC）自动写入深度缩放值
   * - 静态实体的 update() 是空操作，调用无副作用
   */
  update(delta) {
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (!e.static && 'scale' in e) {
        // O-1：世界坐标各向同性，不再有随 y 变化的景深缩放坡。
        // scale 现在纯是体型比例（成人 1.0、儿童 0.694），道具/车 scale = 1。
        e.scale = e.skeletonScale ?? 1;
      }
      e.update(delta);
    }
    this._pruneTimer = (this._pruneTimer ?? 0) - delta;
    if (this._pruneTimer <= 0) {
      this.entities = this.entities.filter(e => e.alive);
      this._pruneTimer = 10000;
    }
  }

  /**
   * 按 Y 深度排序后绘制（Y 小=远=先画）。所有实体统一用地面接触 Y（_sortY ?? y）。
   * @param {Phaser.GameObjects.Graphics} g - 实体图层
   * @param {Array<{_sortY:number, draw:(g)=>void}>} [extras] - 外部可绘制对象（如 NPC 道具），
   *        与实体混合参与同一次 Y 排序，统一画到 g。
   *
   * O-2/O-3：占位阶段只画本管理器自己的实体（有 getBounds() 世界坐标信息可
   * 投影）。extras（NPC 手持道具等 {_sortY,draw} 包装对象，见
   * NpcPropManager.getDrawables）内部几何还没跟 Projection 对齐，硬画出来会
   * 叠在投影后的场景上显得错位，先跳过，等 O-4 转完真实 draw 函数再接回来。
   * ground pre-pass（drawGround）只对 CONVERTED_GROUND_TYPES 里已转换的类型
   * 开放（O-3：manhole），其余仍跳过。
   */
  draw(g, extras = []) {
    const visible = this.entities.filter(e => e.alive && e.visible);

    for (const e of visible) {
      if (CONVERTED_GROUND_TYPES.has(e.propType)) e.drawGround(g);
    }

    visible.sort((a, b) => (a._sortY ?? a.y) - (b._sortY ?? b.y));
    for (const e of visible) {
      const converted = typeof e.facadeH === 'number'
        || CONVERTED_PROP_TYPES.has(e.propType)
        || CONVERTED_GROUND_TYPES.has(e.propType); // manhole：draw() 在这条路径上安全空转，
                                                     // 真内容已经在上面的 ground pre-pass 画完
      if (converted) e.draw(g);
      else _drawPlaceholder(g, e);
    }
  }

  /** 返回所有存活且可见的实体（供取景框碰撞检测使用） */
  getAlive() {
    return this.entities.filter(e => e.alive && e.visible);
  }
}
