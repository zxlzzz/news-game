import { depthT, depthScale } from './Layout.js';

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
   * 返回与矩形区域有 AABB 交叠的所有可见实体
   * @param {number} rx - 矩形左边 X
   * @param {number} ry - 矩形上边 Y
   * @param {number} rw - 矩形宽
   * @param {number} rh - 矩形高
   * @returns {Entity[]}
   */
  getEntitiesInRect(rx, ry, rw, rh) {
    return this.entities.filter(e => {
      if (!e.alive || !e.visible) return false;
      const b = e.getBounds();
      return !(
        b.x + b.width  < rx ||
        b.x            > rx + rw ||
        b.y + b.height < ry ||
        b.y            > ry + rh
      );
    });
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
        e.scale = depthScale(e.y);
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
   */
  draw(g, extras = []) {
    const visible = this.entities.filter(e => e.alive && e.visible);
    const list = extras.length ? visible.concat(extras) : visible;
    list.sort((a, b) => (a._sortY ?? a.y) - (b._sortY ?? b.y));
    for (const e of list) e.draw(g);
  }

  /** 返回所有存活且可见的实体（供取景框碰撞检测使用） */
  getAlive() {
    return this.entities.filter(e => e.alive && e.visible);
  }
}
