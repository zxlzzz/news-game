/**
 * VehicleEntity — 干净线稿风格的侧视车辆（灰度、按 Y 缩放排序）
 * kind: 'car' | 'taxi' | 'bus' | 'moto'
 *   this.x = 车身中心；this.y = 车轮触地基线（用于深度排序/缩放）
 */

import { Entity }       from './core/Entity.js';
import { depthScale }   from './core/Layout.js';
import { dims }         from './entity/vehicle/vehicle.js';
import { drawVehicle }  from './entity/vehicle/drawVehicle.js';

export class VehicleEntity extends Entity {
  constructor(cfg) {
    super({ ...cfg, static: false });
    this.kind            = cfg.kind || 'car';
    this.direction       = cfg.direction || 1;
    this.speed           = cfg.speed || 80;
    this.currentSpeed    = this.speed;
    this.baseSpeed       = this.speed;
    this.doorOpen        = false;
    this.facingSide      = cfg.facingSide || 'near';
    this.stateMachine    = null;
    this._sr             = null;
    this._laneY          = this.y;
    this.tilt            = 0;
    this._phaseOffset    = Math.random() * Math.PI * 2;
    this._timeAccum      = Math.random() * 10;
    this.minX  = cfg.minX ?? -240;
    this.maxX  = cfg.maxX ?? 2240;
    this.scale = depthScale(this._laneY);
    if (!this.tags || this.tags.length === 0) this.tags = ['vehicle', this.kind];
  }

  _dims() {
    return dims(this.kind);
  }

  getBounds() {
    const s = this.scale, { L, H, r } = this._dims();
    const totalH = (H + r * 2) * s;
    return { x: this.x - L * s / 2, y: this.y - totalH, width: L * s, height: totalH };
  }

  update(delta) {
    if (!this.alive) return;
    const dt = delta / 1000;
    this.scale = depthScale(this._laneY);
    this._timeAccum += dt;
    this.y = this._laneY + Math.sin(this._timeAccum * 0.3 + this._phaseOffset) * 3;
    this.x += this.direction * this.currentSpeed * dt;
    if (this.direction > 0 && this.x > this.maxX) this.alive = false;
    else if (this.direction < 0 && this.x < this.minX) this.alive = false;
  }

  draw(g) {
    if (!this.visible) return;
    drawVehicle(g, this);
  }
}
