import { toScreen, toScreenLength } from './Projection.js';

/**
 * O-2 占位盒子：真正的三面体积渲染留给 O-3（drawObliqueBox）+ O-4（剩余 28 个
 * draw 函数逐批转过去）；本补丁只验证投影几何本身（位置/深度排序/倾角），
 * 不调用实体自己的 draw()——那套内容还是按老的"容器整体缩放"假设写的，没跟
 * Projection 对齐，直接调用会在投影后的场景里显得完全错位。
 *
 * 楼是唯一特殊分支：BuildingEntity.y 是立面顶部（roofline），不是地面接触点
 * （接地线在 y+facadeH，见 BuildingEntity._sortY 与 drawBuilding.js 的
 * baseY 算法），其余实体一律遵循 CLAUDE.md 的铁律——entity.y = 地面接触点。
 */
function _drawPlaceholder(g, e) {
  const b = e.getBounds();
  g.lineStyle(0);
  g.beginFill(0xaaaaaa, 1);
  if (typeof e.facadeH === 'number') {
    const groundY = e.y + e.facadeH;
    const base = toScreen(e.x, groundY);
    const w = toScreenLength(e.bWidth ?? b.width);
    const h = toScreenLength(e.facadeH);
    g.drawRect(base.x - w / 2, base.y - h, w, h);
  } else {
    const base = toScreen(e.x, e.y);
    const w = toScreenLength(b.width);
    const h = toScreenLength(b.height);
    g.drawRect(base.x - w / 2, base.y - h, w, h);
  }
  g.endFill();
}

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
   * O-2：占位阶段只画本管理器自己的实体（有 getBounds() 世界坐标信息可投影）。
   * extras（NPC 手持道具等 {_sortY,draw} 包装对象，见 NpcPropManager.getDrawables）
   * 内部几何是按老的容器缩放假设写的，还没跟 Projection 对齐，硬画出来会叠在
   * 投影后的场景上显得错位，先跳过；ground pre-pass（drawGround，如喷泉水面/
   * 井盖）同理跳过——这些都在 O-4 第三批"地面 + 公园"清单里，等转完真实 draw
   * 函数再接回来。
   */
  draw(g, extras = []) {
    const list = this.entities.filter(e => e.alive && e.visible);
    list.sort((a, b) => (a._sortY ?? a.y) - (b._sortY ?? b.y));
    for (const e of list) _drawPlaceholder(g, e);
  }

  /** 返回所有存活且可见的实体（供取景框碰撞检测使用） */
  getAlive() {
    return this.entities.filter(e => e.alive && e.visible);
  }
}
