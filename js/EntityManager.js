/**
 * EntityManager
 * 统一管理所有场景实体（NPC、建筑、道具）：
 * - 更新动态实体并同步深度缩放
 * - 按Y深度排序绘制（Y小=远=先画）
 * - 提供矩形区域查询接口供取景框使用
 */
export class EntityManager {
  /**
   * @param {object} config
   * @param {number} config.farY      - 纵深远端 Y（NPC最小Y）
   * @param {number} config.nearY     - 纵深近端 Y（NPC最大Y）
   * @param {number} config.farScale  - 远端缩放系数
   * @param {number} config.nearScale - 近端缩放系数
   */
  constructor(config = {}) {
    this.farY      = config.farY      ?? 250;
    this.nearY     = config.nearY     ?? 460;
    this.farScale  = config.farScale  ?? 0.25;
    this.nearScale = config.nearScale ?? 0.55;
    this.entities  = [];
  }

  /** 添加一个实体，返回该实体（方便链式调用） */
  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  /** 按 Y 坐标计算深度缩放系数（仅对动态实体生效） */
  depthScale(y) {
    const t = Math.max(0, Math.min(1, (y - this.farY) / (this.nearY - this.farY)));
    return this.farScale + t * (this.nearScale - this.farScale);
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
        e.scale = this.depthScale(e.y);
      }
      e.update(delta);
    }
  }

  /**
   * 按 Y 深度排序后统一绘制所有可见实体
   * @param {Phaser.GameObjects.Graphics} g
   */
  draw(g) {
    const visible = this.entities.filter(e => e.alive && e.visible);
    visible.sort((a, b) => a.y - b.y);
    for (const e of visible) {
      e.draw(g);
    }
  }

  /** 返回所有存活且可见的实体（供取景框碰撞检测使用） */
  getAlive() {
    return this.entities.filter(e => e.alive && e.visible);
  }
}
