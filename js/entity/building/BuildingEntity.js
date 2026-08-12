/**
 * BuildingEntity — 俯视角"老街区"沿街楼，6 种原型
 */

import { Entity }        from '../../core/Entity.js';
import { ARCH }          from './building.js';
import { drawBuilding }  from './drawBuilding.js';

export class BuildingEntity extends Entity {
  constructor(config) {
    super({ ...config, width: config.bWidth ?? 529, height: config.bDepth ?? 371, static: true });
    this.bWidth     = config.bWidth     ?? 529;
    this.bDepth     = config.bDepth     ?? 371;
    this.waterTower = config.waterTower ?? false;
    this.solar      = config.solar      ?? false;
    this.billboard  = config.billboard  ?? false;

    const t = (this.tags ?? []).find(tag => tag in ARCH) || 'default';
    this.arch = t;
    this.A    = ARCH[t];
    this.facadeH = config.facadeH ?? 476;
  }

  get _sortY() { return this.y + this.facadeH; }

  /**
   * 贴地竖直广告牌盒（语义见 Entity.getBounds()）：
   * `this.x` 是**左边缘**（楼的老约定，跟通用 Entity 的 x=中心不一样，
   * 见 drawBuilding.js / EntityManager 占位分支）；`this.y` 是立面顶部
   * （roofline），接地线在 `y + facadeH`（同 `_sortY`）。
   *
   * 历史 bug（2026-08-12 修）：这里原本返回
   * `{y: this.y - this.bDepth, height: this.bDepth}`——拿**进深**当高度、
   * 又把盒子下沿放在 roofline 而不是接地线上，等于整体往上（往场景深处）
   * 错了一个 facadeH。O-2 之前世界 y 就是屏幕 y，这个框大致罩住"屋顶那一
   * 片"，看着不算离谱所以一直没被发现；接上真投影后，取景框的黄色高亮框
   * 明显浮在后排楼的上方（Hsinlung 实机发现）。进深不属于包围盒，它在
   * footprint / PROP_DEPTH 那边。
   */
  getBounds() {
    return { x: this.x, y: this.y, width: this.bWidth, height: this.facadeH };
  }

  draw(g) {
    if (!this.visible) return;
    drawBuilding(g, this);
  }
}
