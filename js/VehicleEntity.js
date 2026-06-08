/**
 * VehicleEntity — 干净线稿风格的侧视车辆（灰度、按 Y 缩放排序）
 * kind: 'car' | 'taxi' | 'bus' | 'moto'
 *   this.x = 车身中心；this.y = 车轮触地基线（用于深度排序/缩放）
 */

import { Entity }      from './Entity.js';
import { depthScale }  from './Layout.js';

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
    switch (this.kind) {
      case 'bus':  return { L: 1010, H: 213, r: 38 };
      case 'moto': return { L: 187,  H: 84,  r: 26 };
      default:     return { L: 380,  H: 127, r: 26 };
    }
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
    const hl = null;
    switch (this.kind) {
      case 'bus':  this._bus(g, hl);  break;
      case 'taxi': this._taxi(g, hl); break;
      case 'moto': this._moto(g, hl); break;
      default:     this._car(g, hl);  break;
    }
  }

  _wheel(g, wx, wy, r) {
    g.beginFill(0x333333, 1);
    g.drawCircle(wx, wy, r);
    g.endFill();
    g.lineStyle(Math.max(0.8, r * 0.08), 0x1a1a1a, 1);
    g.drawCircle(wx, wy, r);
    g.beginFill(0x7a7a7a, 1);
    g.drawCircle(wx, wy, r * 0.55);
    g.endFill();
    g.lineStyle(Math.max(0.5, r * 0.05), 0x555555, 0.5);
    g.drawCircle(wx, wy, r * 0.55);
    g.beginFill(0x444444, 1);
    g.drawCircle(wx, wy, r * 0.2);
    g.endFill();
  }

  _archTo(g, cx, cy, r, d, steps) {
    steps = steps || 10;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      g.lineTo(cx + d * r * Math.cos(a), cy - r * Math.sin(a));
    }
  }

  _tracePath(g, shape, cx, baseY, halfL, height, d) {
    for (let i = 0; i < shape.length; i++) {
      const px = cx + d * shape[i][0] * halfL;
      const py = baseY - shape[i][1] * height;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
  }

  static CAR_SHAPE = [
    [-1.00, 0.00],
    [-1.00, 0.36],
    [-0.94, 0.42],
    [-0.78, 0.46],
    [-0.62, 0.52],
    [-0.46, 0.90],
    [-0.28, 0.97],
    [ 0.00, 1.00],
    [ 0.24, 0.97],
    [ 0.40, 0.78],
    [ 0.52, 0.46],
    [ 0.78, 0.40],
    [ 0.94, 0.36],
    [ 1.00, 0.30],
    [ 1.00, 0.00],
  ];

  _catmull(ctrl, seg) {
    const out = [];
    const p = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        const cx = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const cy = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        out.push([cx, cy]);
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }

  _car(g, highlight) {
    const s = this.scale, x = this.x, y = this.y, d = this.direction;
    const { L, H, r } = this._dims();
    const ls = L * s, hs = H * s, rs = r * s;
    const halfL = ls / 2;
    const sw = Math.max(1.8, s * 8);

    const groundY = y;
    const bodyBot = groundY - rs * 0.6;
    const wcy = groundY - rs;
    const archR = rs * 1.18;

    const fwx = x + d * halfL * 0.56;
    const rwx = x - d * halfL * 0.56;

    // shadow
    g.beginFill(0x000000, 0.06);
    g.drawEllipse(x, groundY + rs * 0.05, ls * 0.38, rs * 0.13);
    g.endFill();

    this._wheel(g, fwx, wcy, rs);
    this._wheel(g, rwx, wcy, rs);

    // car body
    const pts = VehicleEntity.CAR_SHAPE.map(([xf, yf]) => [x + d * xf * halfL, bodyBot - yf * hs]);
    g.lineStyle(sw, highlight ?? 0x2a2a2a, 1);
    g.beginFill(0xf2f2ef, 1);
    g.moveTo(pts[0][0], pts[0][1]);
    g.lineTo(pts[1][0], pts[1][1]);
    for (const [px, py] of this._catmull(pts.slice(1, 14), 8)) g.lineTo(px, py);
    g.lineTo(pts[14][0], pts[14][1]);
    this._archTo(g, fwx, bodyBot, archR, d);
    this._archTo(g, rwx, bodyBot, archR, d);
    g.closePath();
    g.endFill();

    this._carWindows(g, x, bodyBot, halfL, hs, d, sw);
    this._carDetails(g, x, bodyBot, halfL, hs, rs, d, s);
  }

  _carWindows(g, cx, baseY, halfL, hs, d, sw) {
    const winBot  = baseY - hs * 0.48;
    const winTopR = baseY - hs * 0.82;
    const winTopF = baseY - hs * 0.80;
    const pillarX = cx - d * halfL * 0.04;

    // rear window
    g.lineStyle(Math.max(0.6, sw * 0.35), 0x2a2a2a, 0.6);
    g.beginFill(0xc0c0c0, 0.6);
    g.moveTo(cx - d * halfL * 0.46, winTopR);
    g.lineTo(cx - d * halfL * 0.32, winTopR - hs * 0.04);
    g.lineTo(pillarX - d * halfL * 0.02, winTopR - hs * 0.02);
    g.lineTo(pillarX - d * halfL * 0.02, winBot);
    g.lineTo(cx - d * halfL * 0.44, winBot);
    g.closePath();
    g.endFill();

    // front window
    g.lineStyle(Math.max(0.6, sw * 0.35), 0x2a2a2a, 0.6);
    g.beginFill(0xc0c0c0, 0.5);
    g.moveTo(pillarX + d * halfL * 0.04, winTopR - hs * 0.02);
    g.lineTo(cx + d * halfL * 0.22, winTopF);
    g.lineTo(cx + d * halfL * 0.46, winBot + hs * 0.04);
    g.lineTo(pillarX + d * halfL * 0.04, winBot);
    g.closePath();
    g.endFill();

    // B-pillar
    g.lineStyle(Math.max(1.5, sw * 0.7), 0x2a2a2a, 0.85);
    g.moveTo(pillarX, winTopR - hs * 0.02); g.lineTo(pillarX, winBot);

    // door gap
    g.lineStyle(Math.max(0.5, sw * 0.3), 0x2a2a2a, 0.25);
    g.moveTo(pillarX, winBot); g.lineTo(pillarX, baseY + hs * 0.02);
  }

  _carDetails(g, cx, baseY, halfL, hs, rs, d, s) {
    const front = cx + d * halfL;
    const rear  = cx - d * halfL;

    // door handle
    const dhx = cx + d * halfL * 0.04;
    const dhy = baseY - hs * 0.30;
    g.beginFill(0x999999, 0.7);
    g.drawRect(dhx - 5 * s, dhy, 10 * s, 2.5 * s);
    g.endFill();

    // headlight
    const hlW = Math.max(3, halfL * 0.03);
    const hlH = hs * 0.12;
    const hlx = d > 0 ? front - hlW * 1.2 : front + hlW * 0.2;
    const hly = baseY - hs * 0.26;
    g.beginFill(0xeaeadc, 0.9);
    g.drawRect(hlx, hly, hlW, hlH);
    g.endFill();
    g.lineStyle(Math.max(0.5, s * 2), 0x2a2a2a, 0.5);
    g.drawRect(hlx, hly, hlW, hlH);

    // taillight
    const tlW = Math.max(2.5, halfL * 0.025);
    const tlH = hs * 0.10;
    const tlx = d > 0 ? rear + tlW * 0.2 : rear - tlW * 1.2;
    const tly = baseY - hs * 0.36;
    g.beginFill(0xa0a0a0, 0.7);
    g.drawRect(tlx, tly, tlW, tlH);
    g.endFill();
    g.lineStyle(Math.max(0.5, s * 2), 0x2a2a2a, 0.5);
    g.drawRect(tlx, tly, tlW, tlH);
  }

  _taxi(g, highlight) {
    this._car(g, highlight);

    const s = this.scale, x = this.x, y = this.y, d = this.direction;
    const { L, H, r } = this._dims();
    const ls = L * s, hs = H * s, rs = r * s;
    const halfL = ls / 2;
    const bodyBot = y - rs * 0.6;

    // roof sign
    const roofY = bodyBot - hs * 0.99;
    const signW = ls * 0.07, signH = hs * 0.10;
    g.beginFill(0x222222, 1);
    g.drawRect(x - signW / 2, roofY - signH, signW, signH);
    g.endFill();
    g.lineStyle(Math.max(0.8, s * 3), 0x2a2a2a, 1);
    g.drawRect(x - signW / 2, roofY - signH, signW, signH);
    g.beginFill(0xe8e8e0, 0.9);
    g.drawRect(x - signW * 0.35, roofY - signH * 0.75, signW * 0.70, signH * 0.45);
    g.endFill();

    // checker stripe
    const stripeY = bodyBot - hs * 0.22;
    const stripeH = hs * 0.07;
    const stripeLeft  = Math.min(x - d * halfL * 0.80, x + d * halfL * 0.80);
    const stripeWidth = halfL * 0.80 * 2;
    const checkN = Math.max(6, Math.round(L / 44));
    const checkW = stripeWidth / checkN;
    g.beginFill(0x222222, 0.8);
    for (let i = 0; i < checkN; i += 2) {
      g.drawRect(stripeLeft + i * checkW, stripeY, checkW, stripeH);
    }
    g.endFill();
    g.beginFill(0xe0e0e0, 0.8);
    for (let i = 1; i < checkN; i += 2) {
      g.drawRect(stripeLeft + i * checkW, stripeY, checkW, stripeH);
    }
    g.endFill();
    g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.35);
    g.drawRect(stripeLeft, stripeY, stripeWidth, stripeH);
  }

  static BUS_SHAPE = [
    [-1.00, 0.00],
    [-1.00, 0.96],
    [-0.98, 1.00],
    [ 0.98, 1.00],
    [ 1.00, 0.96],
    [ 1.00, 0.00],
  ];

  _bus(g, highlight) {
    const s = this.scale, x = this.x, y = this.y, d = this.direction;
    const { L, H, r } = this._dims();
    const ls = L * s, hs = H * s, rs = r * s;
    const halfL = ls / 2;
    const sw = Math.max(1.8, s * 8);

    const groundY = y;
    const bodyBot = groundY - rs * 0.55;
    const wcy = groundY - rs;
    const archR = rs * 1.2;

    const fwx = x + d * halfL * 0.82;
    const rwx = x - d * halfL * 0.82;

    // shadow
    g.beginFill(0x000000, 0.05);
    g.drawEllipse(x, groundY + rs * 0.05, ls * 0.44, rs * 0.14);
    g.endFill();

    this._wheel(g, fwx, wcy, rs);
    this._wheel(g, rwx, wcy, rs);

    // bus body
    g.lineStyle(sw, highlight ?? 0x2a2a2a, 1);
    g.beginFill(0xeaeae8, 1);
    this._tracePath(g, VehicleEntity.BUS_SHAPE, x, bodyBot, halfL, hs, d);
    this._archTo(g, fwx, bodyBot, archR, d);
    this._archTo(g, rwx, bodyBot, archR, d);
    g.closePath();
    g.endFill();

    // top color band
    const bodyTop = bodyBot - hs;
    const bandLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.01;
    g.beginFill(0xd0d0cc, 1);
    g.drawRect(bandLeft, bodyTop + hs * 0.02, ls * 0.98, hs * 0.08);
    g.endFill();

    // windows
    const winCount = Math.max(5, Math.round(L / 110));
    const winAreaLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.05;
    const winAreaW = ls * 0.90;
    const winGap = winAreaW / winCount;
    const winW = winGap * 0.68;
    const winTop = bodyTop + hs * 0.14;
    const winH = hs * 0.26;

    for (let i = 0; i < winCount; i++) {
      const wx = winAreaLeft + i * winGap + (winGap - winW) / 2;
      g.beginFill(0xbcbcbc, 0.65);
      g.drawRect(wx, winTop, winW, winH);
      g.endFill();
      g.lineStyle(Math.max(0.5, s * 2.5), 0x2a2a2a, 0.55);
      g.drawRect(wx, winTop, winW, winH);
    }

    // door
    const doorCX = x - d * halfL * 0.52;
    if (this.facingSide !== 'far') {
      const doorW = ls * 0.055;
      const doorH = hs * 0.42;
      const doorTop = bodyBot - doorH - hs * 0.02;
      const doorLeft = doorCX - doorW / 2;
      g.beginFill(0xd8d8d4, 0.85);
      g.drawRect(doorLeft, doorTop, doorW, doorH);
      g.endFill();
      g.lineStyle(Math.max(0.8, s * 3), 0x2a2a2a, 0.65);
      g.drawRect(doorLeft, doorTop, doorW, doorH);
      g.beginFill(0xbcbcbc, 0.6);
      g.drawRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
      g.endFill();
      g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.4);
      g.drawRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
      if (this.doorOpen) {
        g.lineStyle(2, 0x1a1a1a, 1);
        g.moveTo(doorCX, doorTop); g.lineTo(doorCX, doorTop + doorH);
      }
    }

    // headlight
    const front = x + d * halfL;
    const hlW = Math.max(3, halfL * 0.02), hlH = hs * 0.10;
    const hlx = d > 0 ? front - hlW * 1.3 : front + hlW * 0.3;
    g.beginFill(0xeaeadc, 0.9);
    g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH);
    g.endFill();
    g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.4);
    g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH);

    // taillight
    const rear = x - d * halfL;
    const tlW = Math.max(2.5, halfL * 0.018), tlH = hs * 0.08;
    const tlx = d > 0 ? rear + tlW * 0.3 : rear - tlW * 1.3;
    g.beginFill(0xa0a0a0, 0.7);
    g.drawRect(tlx, bodyBot - hs * 0.20, tlW, tlH);
    g.endFill();
  }

  _moto(g, highlight) {
    const u = this.scale, x = this.x, y = this.y, d = this.direction;
    const groundY    = y;
    const bs = u * 1.8;
    const ba = bs * 1.5;
    const riderScale = u * 1.5;

    const fr = this._sr?.getFrame('mobike', 0) ?? {};
    const jBar   = fr.l_hand ?? [50,  6];
    const jFootF = fr.r_foot ?? [-28, 40];
    const jFootR = fr.l_foot ?? [-37, 36];

    const hipX = x - d * 4 * bs;
    const hipY = groundY - 40 * ba;
    const J = (jx, jy) => ({ x: hipX + d * jx * ba, y: hipY + jy * ba });
    const bar   = J(...jBar);
    const footF = J(...jFootF);
    const footR = J(...jFootR);

    const wR  = Math.max(2, 14 * bs);
    const wCy = groundY - wR;
    const rwx = footR.x - d * 3 * bs;
    const fwx = bar.x   + d * 6 * bs;

    const frameCol = highlight ?? 0x3a3a3a;
    const frameSW  = Math.max(1.4, bs * 7);

    // shadow
    g.beginFill(0x000000, 0.06);
    g.drawEllipse((rwx + fwx) / 2, groundY + wR * 0.12, (Math.abs(fwx - rwx) + wR * 2.2) / 2, wR * 0.25);
    g.endFill();

    this._wheel(g, fwx, wCy, wR);
    this._wheel(g, rwx, wCy, wR);

    // frame triangle
    g.lineStyle(frameSW, frameCol, 1);
    g.moveTo(rwx, wCy); g.lineTo(hipX, hipY);
    g.moveTo(hipX, hipY); g.lineTo(bar.x, bar.y);
    g.moveTo(rwx, wCy); g.lineTo(bar.x - d * 8 * bs, bar.y + 5 * bs);

    // fuel tank
    g.lineStyle(Math.max(0.8, bs * 3), 0x2a2a2a, 0.85);
    g.beginFill(0xe0e0dd, 1);
    g.moveTo(hipX,               hipY - 2 * bs);
    g.lineTo(bar.x - d * 12 * bs, bar.y + 1 * bs);
    g.lineTo(bar.x - d * 12 * bs, bar.y + 5 * bs);
    g.lineTo(hipX,               hipY + 4 * bs);
    g.closePath();
    g.endFill();

    // seat
    g.lineStyle(Math.max(2, bs * 6), 0x444444, 1);
    g.moveTo(hipX - d * 10 * bs, hipY + 1 * bs); g.lineTo(hipX + d * 3 * bs, hipY - 1 * bs);

    // front fork
    g.lineStyle(Math.max(1, bs * 5), 0x555555, 1);
    g.moveTo(fwx, wCy); g.lineTo(bar.x, bar.y);

    // handlebar
    g.lineStyle(Math.max(1.2, bs * 6), 0x2a2a2a, 1);
    g.moveTo(bar.x - d * 4 * bs, bar.y + 2 * bs); g.lineTo(bar.x + d * 5 * bs, bar.y - 3 * bs);

    // exhaust
    g.lineStyle(Math.max(0.8, bs * 4), 0x888888, 0.6);
    g.moveTo(hipX - d * 6 * bs, hipY + 6 * bs); g.lineTo(rwx + d * wR * 0.6, wCy + wR * 0.4);

    // footpegs
    g.lineStyle(Math.max(1.5, bs * 4), 0x2a2a2a, 1);
    g.moveTo(footF.x - d * 2 * bs, footF.y); g.lineTo(footF.x + d * 3 * bs, footF.y);
    g.moveTo(footR.x - d * 2 * bs, footR.y); g.lineTo(footR.x + d * 3 * bs, footR.y);

    if (this._sr) {
      this._sr.draw(g, 'mobike', 0, hipX, hipY, riderScale, d, 0x1a1a1a, 1);
    }
  }
}
