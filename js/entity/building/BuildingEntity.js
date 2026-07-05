/**
 * BuildingEntity — 俯视角"老街区"沿街楼，6 种原型
 */

import { Entity }        from '../../core/Entity.js';
import { ARCH }          from './building.js';
import { drawBuilding }  from './drawBuilding.js';

export class BuildingEntity extends Entity {
  constructor(config) {
    super({ ...config, width: config.bWidth ?? 100, height: config.bDepth ?? 70, static: true });
    this.bWidth     = config.bWidth     ?? 100;
    this.bDepth     = config.bDepth     ?? 70;
    this.waterTower = config.waterTower ?? false;
    this.solar      = config.solar      ?? false;
    this.billboard  = config.billboard  ?? false;

    const t = (this.tags ?? []).find(tag => tag in ARCH) || 'default';
    this.arch = t;
    this.A    = ARCH[t];
    this.facadeH = config.facadeH ?? 90;
  }

  get _sortY() { return this.y + this.facadeH; }

  getBounds() {
    return { x: this.x, y: this.y - this.bDepth, width: this.bWidth, height: this.bDepth };
  }

  draw(g) {
    if (!this.visible) return;
    drawBuilding(g, this);
  }
}
