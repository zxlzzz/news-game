/**
 * BuildingEntity
 * 俯视角建筑实体：替代原先在 StreetScene 中硬编码的建筑绘制。
 * 每栋建筑带语义 tags（如 ['bank','finance','building']），可被取景框识别。
 *
 * 坐标约定：
 *   this.x = 建筑左边缘 X（非中心）
 *   this.y = 建筑临街底边 Y（面向道路的一侧，默认 130）
 *   bWidth = 建筑宽度（X方向）
 *   bDepth = 建筑纵深（从 y-bDepth 到 y，即俯视时的"楼顶"范围）
 */

import { Entity } from './Entity.js';

export class BuildingEntity extends Entity {
  /**
   * @param {object} config
   * @param {number}   config.x          - 建筑左边缘 X
   * @param {number}   config.y          - 临街底边 Y（通常为 130）
   * @param {number}   config.bWidth     - 建筑宽度
   * @param {number}   config.bDepth     - 建筑纵深（俯视高度）
   * @param {number}   config.color      - 楼顶主色
   * @param {boolean}  config.waterTower - 是否有水塔
   * @param {string[]} config.tags       - 语义标签
   */
  constructor(config) {
    super({
      ...config,
      // Entity.width/height 映射到包围盒，建筑用 getBounds 覆盖
      width:  config.bWidth ?? 100,
      height: config.bDepth ?? 70,
      static: true,
    });
    this.bWidth     = config.bWidth     ?? 100;
    this.bDepth     = config.bDepth     ?? 70;
    this.color      = config.color      ?? 0xa09a92;
    this.waterTower = config.waterTower ?? false;
  }

  /**
   * 包围盒：建筑在俯视图中的矩形占地
   * x=左边缘，y_top=y−bDepth，到 y=底边
   */
  getBounds() {
    return {
      x:      this.x,
      y:      this.y - this.bDepth,
      width:  this.bWidth,
      height: this.bDepth,
    };
  }

  draw(g) {
    if (!this.visible) return;
    const { x, bWidth: w, bDepth: d, color } = this;
    const top = this.y - d;

    // 楼顶主体
    g.fillStyle(color, 1);
    g.fillRect(x, top, w, d);

    // 背街侧高光
    g.fillStyle(0xffffff, 0.07);
    g.fillRect(x, top, w, Math.floor(d * 0.38));

    // 临街侧阴影
    g.fillStyle(0x000000, 0.13);
    g.fillRect(x, top + d * 0.62, w, d * 0.38);

    // 轮廓
    g.lineStyle(1.5, 0x5c5850, 1);
    g.strokeRect(x, top, w, d);

    // 屋顶中脊线
    g.lineStyle(1, 0x706860, 0.45);
    g.lineBetween(x + w / 2, top, x + w / 2, this.y);

    // 临街重阴影线（加强立面感）
    g.lineStyle(3, 0x403830, 0.55);
    g.lineBetween(x, this.y, x + w, this.y);

    if (this.waterTower) this._drawWaterTower(g, top, d);

    // 取景框高亮
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  _drawWaterTower(g, roofTop, d) {
    const wx = this.x + this.bWidth * 0.38;
    const wy = roofTop + d * 0.35;
    g.fillStyle(0x706858, 1);
    g.fillCircle(wx, wy, 10);
    g.lineStyle(1.5, 0x504840, 1);
    g.strokeCircle(wx, wy, 10);
    g.fillStyle(0x907858, 0.65);
    g.fillCircle(wx, wy, 5);
    // 塔腿
    g.lineStyle(1.5, 0x605048, 0.8);
    g.lineBetween(wx - 6, wy + 8, wx - 6, wy + 14);
    g.lineBetween(wx + 6, wy + 8, wx + 6, wy + 14);
  }
}
