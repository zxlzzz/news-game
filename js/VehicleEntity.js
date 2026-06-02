/**
 * VehicleEntity — 干净线稿风格的侧视车辆（灰度、按 Y 缩放排序）
 * kind: 'car' | 'taxi' | 'bus' | 'moto'
 *   this.x = 车身中心；this.y = 车轮触地基线（用于深度排序/缩放）
 */

import { Entity } from './Entity.js';

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
    this.minX            = cfg.minX ?? -240;
    this.maxX            = cfg.maxX ?? 2240;
    this.baseScale       = cfg.scale ?? 0.9;
    this.scale           = this.baseScale;
    this.scaleMul        = cfg.scaleMul ?? 1.0;
    this.roadCenterY     = cfg.roadCenterY ?? 0;
    this.roadHalfHeight  = cfg.roadHalfHeight ?? 1;
    if (!this.tags || this.tags.length === 0) this.tags = ['vehicle', this.kind];
  }

  // L = 车总长, H = 车身总高(含车舱), r = 轮半径
  _dims() {
    switch (this.kind) {
      case 'bus':  return { L: 1500, H: 480, r: 60 };
      case 'moto': return { L: 400, H: 200, r: 20 }; // 仅供取景框包围盒；实际几何以骑手锚点为准（见 _moto）
      default:     return { L: 480, H: 200, r: 34 }; // car/taxi
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
    if (this.scaleMul !== 1.0 && this.roadHalfHeight > 0) {
      const t = (this._laneY - this.roadCenterY) / this.roadHalfHeight;
      this.scale = this.baseScale * (1 + t * (this.scaleMul - 1));
    }
    this._timeAccum += dt;
    this.y = this._laneY + Math.sin(this._timeAccum * 0.3 + this._phaseOffset) * 3;
    this.x += this.direction * this.currentSpeed * dt;
    if (this.direction > 0 && this.x > this.maxX) this.alive = false;
    else if (this.direction < 0 && this.x < this.minX) this.alive = false;
  }

  draw(g) {
    if (!this.visible) return;
    const hl = this.inViewfinder ? 0xcc2200 : null;
    switch (this.kind) {
      case 'bus':  this._bus(g, hl);  break;
      case 'taxi': this._taxi(g, hl); break;
      case 'moto': this._moto(g, hl); break;
      default:     this._car(g, hl);  break;
    }
    if (this.inViewfinder) this._drawViewfinderOutline(g);
  }

  /* ═══════════════════════════════════════════════
     工具方法
     ═══════════════════════════════════════════════ */

  /** 简洁轮子：外胎 → 轮毂 → 中心 */
  _wheel(g, wx, wy, r) {
    // 外胎
    g.fillStyle(0x333333, 1);
    g.fillCircle(wx, wy, r);
    g.lineStyle(Math.max(0.8, r * 0.08), 0x1a1a1a, 1);
    g.strokeCircle(wx, wy, r);
    // 轮毂
    g.fillStyle(0x7a7a7a, 1);
    g.fillCircle(wx, wy, r * 0.55);
    g.lineStyle(Math.max(0.5, r * 0.05), 0x555555, 0.5);
    g.strokeCircle(wx, wy, r * 0.55);
    // 中心
    g.fillStyle(0x444444, 1);
    g.fillCircle(wx, wy, r * 0.2);
  }

  /** 沿路径追加半圆轮拱点（从前→后方向，朝上凸起）*/
  _archTo(g, cx, cy, r, d, steps) {
    steps = steps || 10;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      g.lineTo(cx + d * r * Math.cos(a), cy - r * Math.sin(a));
    }
  }

  /** 用归一化形状表画轮廓路径
   *  shape: [[xFrac, yFrac], ...] 
   *    screenX = cx + d * xFrac * halfL
   *    screenY = baseY - yFrac * height      */
  _tracePath(g, shape, cx, baseY, halfL, height, d) {
    for (let i = 0; i < shape.length; i++) {
      const px = cx + d * shape[i][0] * halfL;
      const py = baseY - shape[i][1] * height;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
  }

  /* ═══════════════════════════════════════════════
     轿车  —— 参考图：一笔连续轮廓，白底粗描边
     形状表 xFrac: -1(后)→+1(前)   yFrac: 0(底)→1(顶)
     ═══════════════════════════════════════════════ */

  // 轿车的 H 代表 从车底到车顶的全部可见高度；所有 yFrac 最大 ~1.0 = 车顶。
  // 上缘（索引 1..13）经 Catmull-Rom 平滑成连续曲线，前后保险杠竖直段（0-1 / 13-14）保持直线。
  // C柱前(idx4)、A柱前(idx9)补腰线锚点，使风挡/后窗过渡平缓不折角。
  static CAR_SHAPE = [
    [-1.00, 0.00],   // 0  后保险杠底
    [-1.00, 0.36],   // 1  后脸竖直上
    [-0.94, 0.42],   // 2  后备箱起
    [-0.78, 0.46],   // 3  后备箱顶 / 腰线
    [-0.62, 0.52],   // 4  C柱腰线（缓过渡）
    [-0.46, 0.90],   // 5  C柱 → 车顶
    [-0.28, 0.97],   // 6  车顶后段
    [ 0.00, 1.00],   // 7  车顶最高
    [ 0.24, 0.97],   // 8  车顶前段
    [ 0.40, 0.78],   // 9  A柱（缓过渡）
    [ 0.52, 0.46],   // 10 前风挡底 / 腰线
    [ 0.78, 0.40],   // 11 引擎盖
    [ 0.94, 0.36],   // 12 引擎盖末端
    [ 1.00, 0.30],   // 13 前脸上角
    [ 1.00, 0.00],   // 14 前保险杠底
  ];

  // 局部 Catmull-Rom（端点钳制），对 [x,y] 屏幕点做平滑，每段插 seg 个点
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
    // bodyBot: 车身底边，在轮心上方一点
    const bodyBot = groundY - rs * 0.6;
    const wcy = groundY - rs;
    const archR = rs * 1.18;

    // 轮的 X 位置
    const fwx = x + d * halfL * 0.56;
    const rwx = x - d * halfL * 0.56;

    // ── 阴影 ──
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(x, groundY + rs * 0.05, ls * 0.76, rs * 0.26);

    // ── 车轮（画在车身下层）──
    this._wheel(g, fwx, wcy, rs);
    this._wheel(g, rwx, wcy, rs);

    // ── 车身轮廓（上缘平滑，前后保险杠竖直段保持直线）──
    const pts = VehicleEntity.CAR_SHAPE.map(([xf, yf]) => [x + d * xf * halfL, bodyBot - yf * hs]);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);          // 后保险杠底
    g.lineTo(pts[1][0], pts[1][1]);          // 后脸竖直
    for (const [px, py] of this._catmull(pts.slice(1, 14), 8)) g.lineTo(px, py); // 平滑上缘
    g.lineTo(pts[14][0], pts[14][1]);        // 前保险杠竖直
    // 底边 + 轮拱
    this._archTo(g, fwx, bodyBot, archR, d);
    this._archTo(g, rwx, bodyBot, archR, d);
    g.closePath();

    g.fillStyle(0xf2f2ef, 1);
    g.fillPath();
    g.lineStyle(sw, highlight ?? 0x2a2a2a, 1);
    g.strokePath();

    // ── 车窗 ──
    this._carWindows(g, x, bodyBot, halfL, hs, d, sw);

    // ── 细节 ──
    this._carDetails(g, x, bodyBot, halfL, hs, rs, d, s);
  }

  /** 车窗（前窗 + 后窗 + B柱） */
  _carWindows(g, cx, baseY, halfL, hs, d, sw) {
    // 窗户区域 yFrac 范围：底 ~0.48（腰线）→ 顶 ~0.82（新圆顶下留顶盖带）
    const winBot  = baseY - hs * 0.48;
    const winTopR = baseY - hs * 0.82;  // 后窗顶
    const winTopF = baseY - hs * 0.80;  // 前窗顶

    // B柱 X（略偏后）
    const pillarX = cx - d * halfL * 0.04;

    // ── 后窗 ──
    g.fillStyle(0xc0c0c0, 0.6);
    g.beginPath();
    g.moveTo(cx - d * halfL * 0.46, winTopR);     // C柱侧上角
    g.lineTo(cx - d * halfL * 0.32, winTopR - hs * 0.04); // 顶边
    g.lineTo(pillarX - d * halfL * 0.02, winTopR - hs * 0.02);
    g.lineTo(pillarX - d * halfL * 0.02, winBot);
    g.lineTo(cx - d * halfL * 0.44, winBot);
    g.closePath();
    g.fillPath();
    g.lineStyle(Math.max(0.6, sw * 0.35), 0x2a2a2a, 0.6);
    g.strokePath();

    // ── 前窗（风挡更倾斜）──
    g.fillStyle(0xc0c0c0, 0.5);
    g.beginPath();
    g.moveTo(pillarX + d * halfL * 0.04, winTopR - hs * 0.02);
    g.lineTo(cx + d * halfL * 0.22, winTopF);
    g.lineTo(cx + d * halfL * 0.46, winBot + hs * 0.04);
    g.lineTo(pillarX + d * halfL * 0.04, winBot);
    g.closePath();
    g.fillPath();
    g.lineStyle(Math.max(0.6, sw * 0.35), 0x2a2a2a, 0.6);
    g.strokePath();

    // ── B柱 ──
    g.lineStyle(Math.max(1.5, sw * 0.7), 0x2a2a2a, 0.85);
    g.lineBetween(pillarX, winTopR - hs * 0.02, pillarX, winBot);

    // ── 门缝线 ──
    g.lineStyle(Math.max(0.5, sw * 0.3), 0x2a2a2a, 0.25);
    g.lineBetween(pillarX, winBot, pillarX, baseY + hs * 0.02);
  }

  /** 车灯、门把手等小细节 */
  _carDetails(g, cx, baseY, halfL, hs, rs, d, s) {
    const front = cx + d * halfL;
    const rear  = cx - d * halfL;

    // 门把手
    const dhx = cx + d * halfL * 0.04;
    const dhy = baseY - hs * 0.30;
    g.fillStyle(0x999999, 0.7);
    g.fillRect(dhx - 5 * s, dhy, 10 * s, 2.5 * s);

    // 头灯
    const hlW = Math.max(3, halfL * 0.03);
    const hlH = hs * 0.12;
    const hlx = d > 0 ? front - hlW * 1.2 : front + hlW * 0.2;
    const hly = baseY - hs * 0.26;
    g.fillStyle(0xeaeadc, 0.9);
    g.fillRect(hlx, hly, hlW, hlH);
    g.lineStyle(Math.max(0.5, s * 2), 0x2a2a2a, 0.5);
    g.strokeRect(hlx, hly, hlW, hlH);

    // 尾灯
    const tlW = Math.max(2.5, halfL * 0.025);
    const tlH = hs * 0.10;
    const tlx = d > 0 ? rear + tlW * 0.2 : rear - tlW * 1.2;
    const tly = baseY - hs * 0.36;
    g.fillStyle(0xa0a0a0, 0.7);
    g.fillRect(tlx, tly, tlW, tlH);
    g.lineStyle(Math.max(0.5, s * 2), 0x2a2a2a, 0.5);
    g.strokeRect(tlx, tly, tlW, tlH);
  }

  /* ═══════════════════════════════════════════════
     出租车
     ═══════════════════════════════════════════════ */

  _taxi(g, highlight) {
    this._car(g, highlight);

    const s = this.scale, x = this.x, y = this.y, d = this.direction;
    const { L, H, r } = this._dims();
    const ls = L * s, hs = H * s, rs = r * s;
    const halfL = ls / 2;
    const bodyBot = y - rs * 0.6;

    // 顶灯
    const roofY = bodyBot - hs * 0.99;
    const signW = ls * 0.07, signH = hs * 0.10;
    g.fillStyle(0x222222, 1);
    g.fillRect(x - signW / 2, roofY - signH, signW, signH);
    g.lineStyle(Math.max(0.8, s * 3), 0x2a2a2a, 1);
    g.strokeRect(x - signW / 2, roofY - signH, signW, signH);
    g.fillStyle(0xe8e8e0, 0.9);
    g.fillRect(x - signW * 0.35, roofY - signH * 0.75, signW * 0.70, signH * 0.45);

    // 棋格腰线
    const stripeY = bodyBot - hs * 0.22;
    const stripeH = hs * 0.07;
    const stripeLeft  = Math.min(x - d * halfL * 0.80, x + d * halfL * 0.80);
    const stripeWidth = halfL * 0.80 * 2;
    const checkN = Math.max(6, Math.round(L / 44));
    const checkW = stripeWidth / checkN;
    for (let i = 0; i < checkN; i++) {
      g.fillStyle(i % 2 === 0 ? 0x222222 : 0xe0e0e0, 0.8);
      g.fillRect(stripeLeft + i * checkW, stripeY, checkW, stripeH);
    }
    g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.35);
    g.strokeRect(stripeLeft, stripeY, stripeWidth, stripeH);
  }

  /* ═══════════════════════════════════════════════
     公交车 —— 高大方正的箱体，微圆角
     ═══════════════════════════════════════════════ */

  static BUS_SHAPE = [
    [-1.00, 0.00],
    [-1.00, 0.96],   // 后面几乎垂直
    [-0.98, 1.00],   // 后顶圆角
    [ 0.98, 1.00],   // 前顶圆角
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

    // 阴影
    g.fillStyle(0x000000, 0.05);
    g.fillEllipse(x, groundY + rs * 0.05, ls * 0.88, rs * 0.28);

    // 车轮
    this._wheel(g, fwx, wcy, rs);
    this._wheel(g, rwx, wcy, rs);

    // 车身
    g.beginPath();
    this._tracePath(g, VehicleEntity.BUS_SHAPE, x, bodyBot, halfL, hs, d);
    this._archTo(g, fwx, bodyBot, archR, d);
    this._archTo(g, rwx, bodyBot, archR, d);
    g.closePath();

    g.fillStyle(0xeaeae8, 1);
    g.fillPath();
    g.lineStyle(sw, highlight ?? 0x2a2a2a, 1);
    g.strokePath();

    // 顶部色带
    const bodyTop = bodyBot - hs;
    const bandLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.01;
    g.fillStyle(0xd0d0cc, 1);
    g.fillRect(bandLeft, bodyTop + hs * 0.02, ls * 0.98, hs * 0.08);

    // 一排车窗
    const winCount = Math.max(5, Math.round(L / 110));
    const winAreaLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.05;
    const winAreaW = ls * 0.90;
    const winGap = winAreaW / winCount;
    const winW = winGap * 0.68;
    const winTop = bodyTop + hs * 0.14;
    const winH = hs * 0.26;

    for (let i = 0; i < winCount; i++) {
      const wx = winAreaLeft + i * winGap + (winGap - winW) / 2;
      g.fillStyle(0xbcbcbc, 0.65);
      g.fillRect(wx, winTop, winW, winH);
      g.lineStyle(Math.max(0.5, s * 2.5), 0x2a2a2a, 0.55);
      g.strokeRect(wx, winTop, winW, winH);
    }

    // 车门（偏后位置）——仅 facingSide='near' 时渲染（门朝玩家侧）
    const doorCX = x - d * halfL * 0.52;
    if (this.facingSide !== 'far') {
      const doorW = ls * 0.055;
      const doorH = hs * 0.42;
      const doorTop = bodyBot - doorH - hs * 0.02;
      const doorLeft = doorCX - doorW / 2;
      g.fillStyle(0xd8d8d4, 0.85);
      g.fillRect(doorLeft, doorTop, doorW, doorH);
      g.lineStyle(Math.max(0.8, s * 3), 0x2a2a2a, 0.65);
      g.strokeRect(doorLeft, doorTop, doorW, doorH);
      g.fillStyle(0xbcbcbc, 0.6);
      g.fillRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
      g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.4);
      g.strokeRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
      if (this.doorOpen) {
        g.lineStyle(2, 0x1a1a1a, 1);
        g.lineBetween(doorCX, doorTop, doorCX, doorTop + doorH);
      }
    }

    // 头灯
    const front = x + d * halfL;
    const hlW = Math.max(3, halfL * 0.02), hlH = hs * 0.10;
    const hlx = d > 0 ? front - hlW * 1.3 : front + hlW * 0.3;
    g.fillStyle(0xeaeadc, 0.9);
    g.fillRect(hlx, bodyBot - hs * 0.24, hlW, hlH);
    g.lineStyle(Math.max(0.4, s * 1.5), 0x2a2a2a, 0.4);
    g.strokeRect(hlx, bodyBot - hs * 0.24, hlW, hlH);

    // 尾灯
    const rear = x - d * halfL;
    const tlW = Math.max(2.5, halfL * 0.018), tlH = hs * 0.08;
    const tlx = d > 0 ? rear + tlW * 0.3 : rear - tlW * 1.3;
    g.fillStyle(0xa0a0a0, 0.7);
    g.fillRect(tlx, bodyBot - hs * 0.20, tlW, tlH);
  }

  /* ═══════════════════════════════════════════════
     摩托车
     ═══════════════════════════════════════════════ */

  /* 摩托车以骑手为基准绘制，人车一体。
     车架锚点从 mobike.json frame0 动态读取：
     前手(l_hand)=车把、臀(body)=座垫、右脚(r_foot)=前踏板、左脚(l_foot)=后踏板。
     车身用 ba 比例放大，骑手用 riderScale 单独渲染，共用同一 hipX/hipY。 */
  _moto(g, highlight) {
    const u = this.scale, x = this.x, y = this.y, d = this.direction;
    const groundY    = y;
    const bs = u * 1.8;
    const ba = bs * 1.5;          // 车身造型比例
    const riderScale = u * 1.5;   // 骑手渲染比例

    // 从 mobike.json frame0 读取关节坐标（fallback 到旧硬编码值）
    const fr = this._sr?.getFrame('mobike', 0) ?? {};
    const jBar   = fr.l_hand ?? [50,  6];
    const jFootF = fr.r_foot ?? [-28, 40];
    const jFootR = fr.l_foot ?? [-37, 36];

    // 车身造型锚点
    const hipX = x - d * 4 * bs;
    const hipY = groundY - 40 * ba;
    const J = (jx, jy) => ({ x: hipX + d * jx * ba, y: hipY + jy * ba });
    const bar   = J(...jBar);
    const footF = J(...jFootF);
    const footR = J(...jFootR);

    const wR  = Math.max(2, 14 * bs);
    const wCy = groundY - wR;
    const rwx = footR.x - d * 3 * bs;   // 后轮
    const fwx = bar.x   + d * 6 * bs;   // 前轮

    const frameCol = highlight ?? 0x3a3a3a;
    const frameSW  = Math.max(1.4, bs * 7);

    // 阴影
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse((rwx + fwx) / 2, groundY + wR * 0.12, Math.abs(fwx - rwx) + wR * 2.2, wR * 0.5);

    // 车轮（先画，压在车架下层）
    this._wheel(g, fwx, wCy, wR);
    this._wheel(g, rwx, wCy, wR);

    // ── 车架三角：后摇臂 / 上管(座→把) / 下管 ──
    g.lineStyle(frameSW, frameCol, 1);
    g.lineBetween(rwx, wCy, hipX, hipY);
    g.lineBetween(hipX, hipY, bar.x, bar.y);
    g.lineBetween(rwx, wCy, bar.x - d * 8 * bs, bar.y + 5 * bs);

    // ── 油箱块（座与车把之间）──
    g.fillStyle(0xe0e0dd, 1);
    g.beginPath();
    g.moveTo(hipX,               hipY - 2 * bs);
    g.lineTo(bar.x - d * 12 * bs, bar.y + 1 * bs);
    g.lineTo(bar.x - d * 12 * bs, bar.y + 5 * bs);
    g.lineTo(hipX,               hipY + 4 * bs);
    g.closePath();
    g.fillPath();
    g.lineStyle(Math.max(0.8, bs * 3), 0x2a2a2a, 0.85);
    g.strokePath();

    // 座垫（深色，臀下）
    g.lineStyle(Math.max(2, bs * 6), 0x444444, 1);
    g.lineBetween(hipX - d * 10 * bs, hipY + 1 * bs, hipX + d * 3 * bs, hipY - 1 * bs);

    // ── 前叉 ──
    g.lineStyle(Math.max(1, bs * 5), 0x555555, 1);
    g.lineBetween(fwx, wCy, bar.x, bar.y);

    // ── 车把握把 ──
    g.lineStyle(Math.max(1.2, bs * 6), 0x2a2a2a, 1);
    g.lineBetween(bar.x - d * 4 * bs, bar.y + 2 * bs, bar.x + d * 5 * bs, bar.y - 3 * bs);

    // ── 排气管（后轮低处）──
    g.lineStyle(Math.max(0.8, bs * 4), 0x888888, 0.6);
    g.lineBetween(hipX - d * 6 * bs, hipY + 6 * bs, rwx + d * wR * 0.6, wCy + wR * 0.4);

    // ── 踏板块 ──
    g.lineStyle(Math.max(1.5, bs * 4), 0x2a2a2a, 1);
    g.lineBetween(footF.x - d * 2 * bs, footF.y, footF.x + d * 3 * bs, footF.y);
    g.lineBetween(footR.x - d * 2 * bs, footR.y, footR.x + d * 3 * bs, footR.y);

    // ── 骑手（最后画，放大前大小，坐在座垫上；车身 3× 故人相对偏小）──
    if (this._sr) {
      this._sr.draw(g, 'mobike', 0, hipX, hipY, riderScale, d, 0x1a1a1a, 1);
    }
  }
}