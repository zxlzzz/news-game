/**
 * VehicleEntity — 双行道上的机动车（侧视、纯灰度、按 Y 缩放排序）
 * kind: 'car' | 'taxi' | 'bus' | 'moto'
 *   this.x = 车身中心；this.y = 车轮触地基线（用于深度排序/缩放）
 *   循环行驶：驶出一端后从另一端重新进入。
 */

import { Entity } from './Entity.js';

export class VehicleEntity extends Entity {
  constructor(cfg) {
    super({ ...cfg, static: false });
    this.kind      = cfg.kind || 'car';
    this.direction = cfg.direction || 1;
    this.speed     = cfg.speed || 80;
    this.minX      = cfg.minX ?? -240;
    this.maxX      = cfg.maxX ?? 2240;
    this.scale     = cfg.scale ?? 0.9;
    this.scaleMul  = cfg.scaleMul ?? 4.0;
    if (!this.tags || this.tags.length === 0) this.tags = ['vehicle', this.kind];
  }

  _dims() {
    switch (this.kind) {
      case 'bus':  return { L: 94, H: 24, r: 5.5 };
      case 'moto': return { L: 30, H: 16, r: 5 };
      default:     return { L: 48, H: 13, r: 5 };   // car / taxi
    }
  }

  getBounds() {
    const s = this.scale, { L, H, r } = this._dims();
    return { x: this.x - L * s / 2, y: this.y - (H + r) * s, width: L * s, height: (H + r) * s };
  }

  update(delta) {
    if (!this.alive) return;
    this.x += this.direction * this.speed * (delta / 1000);
    if (this.direction > 0 && this.x > this.maxX) this.x = this.minX;
    else if (this.direction < 0 && this.x < this.minX) this.x = this.maxX;
  }

  draw(g) {
    if (!this.visible) return;
    const body = this.inViewfinder ? 0xcc2200 : null;
    switch (this.kind) {
      case 'bus':  this._bus(g, body);  break;
      case 'taxi': this._taxi(g, body); break;
      case 'moto': this._moto(g, body); break;
      default:     this._car(g, body);  break;
    }
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  // 车轮（外胎 + 轮毂）
  _wheels(g, xs, wy, r) {
    for (const wx of xs) {
      g.fillStyle(0x1c1c1c, 1); g.fillCircle(wx, wy, r);
      g.fillStyle(0x9a9a9a, 1); g.fillCircle(wx, wy, r * 0.42);
      g.fillStyle(0x1c1c1c, 1); g.fillCircle(wx, wy, r * 0.15);
    }
  }

  // 头灯（前）+ 尾灯（后），按行驶方向放置
  _lights(g, left, right, ly, s) {
    const d = this.direction;
    const fx = d > 0 ? right - 2 * s : left;
    const bx = d > 0 ? left : right - 2 * s;
    g.fillStyle(0xf2f2f2, 0.95); g.fillRect(fx, ly, 2 * s, 2.4 * s);
    g.fillStyle(0x707070, 0.9);  g.fillRect(bx, ly, 2 * s, 2.4 * s);
  }

  _car(g, body) {
    const s = this.scale, x = this.x, y = this.y, { L, H, r } = this._dims();
    const left = x - L * s / 2, right = x + L * s / 2;
    const wy = y - r * s;
    this._wheels(g, [left + L * s * 0.24, right - L * s * 0.24], wy, r * s);
    const col = body ?? 0x8a8a8a;
    const bH = H * s, top = y - r * s * 1.1 - bH;
    // 下半车身
    g.fillStyle(col, 1); g.fillRect(left, top + bH * 0.42, L * s, bH * 0.6 + r * s * 0.2);
    // 车舱（梯形）
    const cL = left + L * s * 0.26, cR = right - L * s * 0.2;
    g.beginPath();
    g.moveTo(cL, top + bH * 0.5); g.lineTo(cL + 3 * s, top); g.lineTo(cR - 3 * s, top); g.lineTo(cR, top + bH * 0.5);
    g.closePath(); g.fillPath();
    // 车窗
    g.fillStyle(0x3a3a3a, 0.82); g.fillRect(cL + 2 * s, top + 1.5 * s, (cR - cL) - 4 * s, bH * 0.38);
    g.fillStyle(0xffffff, 0.16); g.fillRect(cL + 2 * s, top + 1.5 * s, (cR - cL) - 4 * s, bH * 0.16);
    // 描边 + 灯
    g.lineStyle(Math.max(0.5, 0.9 * s), 0x202020, 0.9);
    g.strokeRect(left, top + bH * 0.42, L * s, bH * 0.6 + r * s * 0.2);
    this._lights(g, left, right, top + bH * 0.5, s);
  }

  _taxi(g, body) {
    this._car(g, body ?? 0xb4b4b4);
    // 顶灯牌 + 棋格条
    const s = this.scale, x = this.x, y = this.y, { L, H, r } = this._dims();
    const top = y - r * s * 1.1 - H * s;
    g.fillStyle(0x2a2a2a, 1); g.fillRect(x - 4 * s, top - 3.5 * s, 8 * s, 3.5 * s);
    g.fillStyle(0xeaeaea, 0.9); g.fillRect(x - 3 * s, top - 2.8 * s, 6 * s, 1.4 * s);
    // 车身棋格带
    g.fillStyle(0x202020, 0.85);
    const left = x - L * s / 2;
    for (let i = 0; i < 6; i++) g.fillRect(left + 4 * s + i * 7 * s, top + H * s * 0.5, 3 * s, 2 * s);
  }

  _bus(g, body) {
    const s = this.scale, x = this.x, y = this.y, { L, H, r } = this._dims();
    const left = x - L * s / 2, right = x + L * s / 2;
    const wy = y - r * s;
    this._wheels(g, [left + L * s * 0.18, right - L * s * 0.18], wy, r * s);
    const col = body ?? 0x9c9c9c;
    const bH = H * s, top = y - r * s * 1.05 - bH;
    g.fillStyle(col, 1); g.fillRect(left, top, L * s, bH);
    g.lineStyle(Math.max(0.5, 1 * s), 0x202020, 0.9); g.strokeRect(left, top, L * s, bH);
    // 顶部浅色带
    g.fillStyle(0xc4c4c4, 1); g.fillRect(left, top, L * s, bH * 0.22);
    // 一排车窗
    g.fillStyle(0x3a3a3a, 0.82);
    const winY = top + bH * 0.3, winH = bH * 0.34, n = Math.max(4, Math.floor(L / 14));
    const gapW = (L * s - 8 * s) / n;
    for (let i = 0; i < n; i++) {
      g.fillRect(left + 4 * s + i * gapW + 1 * s, winY, gapW - 2 * s, winH);
    }
    g.fillStyle(0xffffff, 0.12); g.fillRect(left + 4 * s, winY, L * s - 8 * s, winH * 0.4);
    // 车门（后侧）+ 灯
    const d = this.direction;
    const doorX = d > 0 ? left + L * s * 0.16 : right - L * s * 0.16 - 5 * s;
    g.fillStyle(0x2c2c2c, 0.8); g.fillRect(doorX, top + bH * 0.5, 5 * s, bH * 0.48);
    this._lights(g, left, right, top + bH * 0.72, s);
  }

  _moto(g, body) {
    const s = this.scale, x = this.x, y = this.y, d = this.direction, { L, r } = this._dims();
    const left = x - L * s / 2, right = x + L * s / 2;
    const wy = y - r * s;
    this._wheels(g, [left + r * s, right - r * s], wy, r * s);
    const col = body ?? 0x6a6a6a;
    // 车身（座 + 油箱）
    g.fillStyle(col, 1);
    g.beginPath();
    g.moveTo(left + r * s, wy - r * s * 0.4);
    g.lineTo(right - r * s, wy - r * s * 0.4);
    g.lineTo(right - r * s * 1.6, wy - r * s * 1.8);
    g.lineTo(left + r * s * 2.2, wy - r * s * 1.8);
    g.closePath(); g.fillPath();
    // 车把（前 d 向）
    g.lineStyle(Math.max(0.6, 1.2 * s), 0x222222, 1);
    const fx = d > 0 ? right - r * s : left + r * s;
    g.lineBetween(fx, wy - r * s * 0.4, fx + d * 3 * s, wy - r * s * 2.6);
    // 简易骑手（坐姿小火柴）
    const rx = x - d * 2 * s, hipY = wy - r * s * 1.9;
    g.lineStyle(Math.max(0.7, 1.4 * s), 0x2a2a2a, 1);
    g.lineBetween(rx, hipY, rx + d * 1.5 * s, hipY - 5 * s);            // 躯干
    g.lineBetween(rx + d * 1.5 * s, hipY - 5 * s, fx + d * 3 * s, wy - r * s * 2.6); // 臂→把
    g.lineBetween(rx, hipY, fx - d * 1 * s, wy - r * s * 0.2);          // 腿
    g.fillStyle(0x2a2a2a, 1); g.fillCircle(rx + d * 1.8 * s, hipY - 6.5 * s, 1.8 * s); // 头
  }
}
