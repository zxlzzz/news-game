import {
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';
import { vehicleAnchors } from '../../../assets/vehicle-anchors.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

const CAR_SHAPE = [
  [-1.00, 0.00], [-1.00, 0.36], [-0.94, 0.42], [-0.78, 0.46],
  [-0.62, 0.52], [-0.46, 0.90], [-0.28, 0.97], [ 0.00, 1.00],
  [ 0.24, 0.97], [ 0.40, 0.78], [ 0.52, 0.46], [ 0.78, 0.40],
  [ 0.94, 0.36], [ 1.00, 0.30], [ 1.00, 0.00],
];

const BUS_SHAPE = [
  [-1.00, 0.00], [-1.00, 0.96], [-0.98, 1.00],
  [ 0.98, 1.00], [ 1.00, 0.96], [ 1.00, 0.00],
];

function _wheel(g, wx, wy, r, baseY) {
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1); g.drawCircle(wx, wy, r); g.endFill();
  lenv(g, baseY, 0.9); g.drawCircle(wx, wy, r);
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1); g.drawCircle(wx, wy, r * 0.55); g.endFill();
}

function _archTo(g, cx, cy, r, d, steps) {
  steps = steps || 10;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    g.lineTo(cx + d * r * Math.cos(a), cy - r * Math.sin(a));
  }
}

function _tracePath(g, shape, cx, baseY, halfL, height, d) {
  for (let i = 0; i < shape.length; i++) {
    const px = cx + d * shape[i][0] * halfL;
    const py = baseY - shape[i][1] * height;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
}

function _catmull(ctrl, seg) {
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

function _carWindows(g, cx, baseY, halfL, hs, d) {
  const winBot = baseY - hs * 0.50;
  const winTop = baseY - hs * 0.80;

  const pillarX = cx - d * halfL * 0.02;
  const bw = halfL * 0.015;

  // 后窗
  lenv(g, baseY, 0.5);
  g.beginFill(FILL_LIGHT, 0.55);
  g.moveTo(cx - d * halfL * 0.42, winTop);
  g.lineTo(pillarX - bw, winTop);
  g.lineTo(pillarX - bw, winBot);
  g.lineTo(cx - d * halfL * 0.42, winBot);
  g.closePath();
  g.endFill();

  // 前窗
  const leftTopX = pillarX + bw;
  const leftBotX = pillarX + bw;
  const topFrontX = cx + d * halfL * 0.3;
  const topFrontY = baseY - hs * 0.78;
  const aMidX = cx + d * halfL * 0.35;
  const aMidY = baseY - hs * 0.64;
  const botFrontX = cx + d * halfL * 0.39;
  const botFrontY = winBot + hs * 0.02;

  lenv(g, baseY, 0.5);
  g.beginFill(FILL_LIGHT, 0.50);
  g.moveTo(leftTopX, winTop);
  g.lineTo(topFrontX, topFrontY);
  g.lineTo(aMidX, aMidY);
  g.lineTo(botFrontX, botFrontY);
  g.lineTo(leftBotX, winBot);
  g.closePath();
  g.endFill();

  // B柱
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 0.85);
  g.drawRect(pillarX - bw, winTop, bw * 2, winBot - winTop);
  g.endFill();

  // 腰线
  lenv(g, baseY, 0.25);
  g.moveTo(pillarX, winBot);
  g.lineTo(pillarX, baseY + hs * 0.02);
}

function _carDetails(g, cx, baseY, halfL, hs, rs, d, s) {
  const front = cx + d * halfL;
  const rear  = cx - d * halfL;

  // 门把手
  const dhx = cx + d * halfL * 0.04;
  const dhy = baseY - hs * 0.30;
  g.lineStyle(0);
  g.beginFill(FILL_MID, 0.7);
  g.drawRect(dhx - 5 * s, dhy, 10 * s, 2.5 * s);
  g.endFill();

  // 大灯
  const hlW = Math.max(3, halfL * 0.03);
  const hlH = hs * 0.12;
  const hlx = d > 0 ? front - hlW * 1.2 : front + hlW * 0.2;
  const hly = baseY - hs * 0.26;
  g.lineStyle(0); g.beginFill(FILL_PAPER, 1); g.drawRect(hlx, hly, hlW, hlH); g.endFill();
  lenv(g, baseY, 0.4); g.drawRect(hlx, hly, hlW, hlH);

  // 尾灯
  const tlW = Math.max(2.5, halfL * 0.025);
  const tlH = hs * 0.10;
  const tlx = d > 0 ? rear + tlW * 0.2 : rear - tlW * 1.2;
  const tly = baseY - hs * 0.36;
  g.lineStyle(0);
  g.beginFill(FILL_MID, 0.7); g.drawRect(tlx, tly, tlW, tlH); g.endFill();
  lenv(g, baseY, 0.4); g.drawRect(tlx, tly, tlW, tlH);
}

function _car(g, vehicle, highlight) {
  g.lineStyle(0);
  const s = vehicle.scale, x = vehicle.x, y = vehicle.y, d = vehicle.direction;
  const { L, H, r } = vehicle._dims();
  const ls = L * s, hs = H * s, rs = r * s;
  const halfL = ls / 2;
  const sw = Math.max(1.8, s * 8);

  const groundY = y;
  const bodyBot = groundY - rs * 0.6;
  const wcy = groundY - rs;
  const archR = rs * 1.18;

  const fwx = x + d * halfL * 0.56;
  const rwx = x - d * halfL * 0.56;

  _wheel(g, fwx, wcy, rs, groundY);
  _wheel(g, rwx, wcy, rs, groundY);

  const lc = depthLineColor(groundY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  const pts = CAR_SHAPE.map(([xf, yf]) => [x + d * xf * halfL, bodyBot - yf * hs]);
  g.lineStyle(sw, highlight ?? lc, 1);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(pts[0][0], pts[0][1]);
  g.lineTo(pts[1][0], pts[1][1]);
  for (const [px, py] of _catmull(pts.slice(1, 14), 8)) g.lineTo(px, py);
  g.lineTo(pts[14][0], pts[14][1]);
  _archTo(g, fwx, bodyBot, archR, d);
  _archTo(g, rwx, bodyBot, archR, d);
  g.closePath();
  g.endFill();

  _carWindows(g, x, bodyBot, halfL, hs, d);
  _carDetails(g, x, bodyBot, halfL, hs, rs, d, s);
}

function _taxi(g, vehicle, highlight) {
  _car(g, vehicle, highlight);

  const s = vehicle.scale, x = vehicle.x, y = vehicle.y, d = vehicle.direction;
  const { L, H, r } = vehicle._dims();
  const ls = L * s, hs = H * s, rs = r * s;
  const halfL = ls / 2;
  const bodyBot = y - rs * 0.6;

  const roofY = bodyBot - hs * 0.99;
  const signW = ls * 0.07, signH = hs * 0.10;
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - signW / 2, roofY - signH, signW, signH);
  g.endFill();
  lenv(g, y, 0.8);
  g.drawRect(x - signW / 2, roofY - signH, signW, signH);
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.9);
  g.drawRect(x - signW * 0.35, roofY - signH * 0.75, signW * 0.70, signH * 0.45);
  g.endFill();

  const stripeY = bodyBot - hs * 0.22;
  const stripeH = hs * 0.07;
  const stripeLeft  = Math.min(x - d * halfL * 0.80, x + d * halfL * 0.80);
  const stripeWidth = halfL * 0.80 * 2;
  const checkN = Math.max(6, Math.round(L / 44));
  const checkW = stripeWidth / checkN;
  g.beginFill(FILL_SHADE, 0.8);
  for (let i = 0; i < checkN; i += 2) { g.drawRect(stripeLeft + i * checkW, stripeY, checkW, stripeH); }
  g.endFill();
  g.beginFill(FILL_PAPER, 0.8);
  for (let i = 1; i < checkN; i += 2) { g.drawRect(stripeLeft + i * checkW, stripeY, checkW, stripeH); }
  g.endFill();
  lenv(g, y, 0.3);
  g.drawRect(stripeLeft, stripeY, stripeWidth, stripeH);
}

function _bus(g, vehicle, highlight) {
  g.lineStyle(0);
  const s = vehicle.scale, x = vehicle.x, y = vehicle.y, d = vehicle.direction;
  const { L, H, r } = vehicle._dims();
  const ls = L * s, hs = H * s, rs = r * s;
  const halfL = ls / 2;
  const sw = Math.max(1.8, s * 8);

  const groundY = y;
  const bodyBot = groundY - rs * 0.55;
  const wcy = groundY - rs;
  const archR = rs * 1.2;

  const fwx = x + d * halfL * 0.82;
  const rwx = x - d * halfL * 0.82;

  _wheel(g, fwx, wcy, rs, groundY);
  _wheel(g, rwx, wcy, rs, groundY);

  const lc = depthLineColor(groundY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(sw, highlight ?? lc, 1);
  g.beginFill(FILL_PAPER, 1);
  _tracePath(g, BUS_SHAPE, x, bodyBot, halfL, hs, d);
  _archTo(g, fwx, bodyBot, archR, d);
  _archTo(g, rwx, bodyBot, archR, d);
  g.closePath();
  g.endFill();

  const bodyTop = bodyBot - hs;
  const bandLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.01;
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(bandLeft, bodyTop + hs * 0.02, ls * 0.98, hs * 0.08);
  g.endFill();

  const winCount = Math.max(5, Math.round(L / 110));
  const winAreaLeft = Math.min(x - d * halfL, x + d * halfL) + ls * 0.05;
  const winAreaW = ls * 0.90;
  const winGap = winAreaW / winCount;
  const winW = winGap * 0.68;
  const winTop = bodyTop + hs * 0.14;
  const winH = hs * 0.26;

  for (let i = 0; i < winCount; i++) {
    const wx = winAreaLeft + i * winGap + (winGap - winW) / 2;
    g.lineStyle(0);
    g.beginFill(FILL_LIGHT, 0.65); g.drawRect(wx, winTop, winW, winH); g.endFill();
    lenv(g, groundY, 0.5); g.drawRect(wx, winTop, winW, winH);
  }

  const doorCX = x - d * halfL * 0.52;
  if (vehicle.facingSide !== 'far') {
    const doorW = ls * 0.055;
    const doorH = hs * 0.42;
    const doorTop = bodyBot - doorH - hs * 0.02;
    const doorLeft = doorCX - doorW / 2;
    g.lineStyle(0);
    g.beginFill(FILL_PAPER, 0.85); g.drawRect(doorLeft, doorTop, doorW, doorH); g.endFill();
    lenv(g, groundY, 0.65); g.drawRect(doorLeft, doorTop, doorW, doorH);
    g.lineStyle(0);
    g.beginFill(FILL_LIGHT, 0.6);
    g.drawRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
    g.endFill();
    lenv(g, groundY, 0.4);
    g.drawRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.8, doorH * 0.48);
    if (vehicle.doorOpen) {
      lenv(g, groundY, 0.9);
      g.moveTo(doorCX, doorTop); g.lineTo(doorCX, doorTop + doorH);
    }
  }

  const front = x + d * halfL;
  const hlW = Math.max(3, halfL * 0.02), hlH = hs * 0.10;
  const hlx = d > 0 ? front - hlW * 1.3 : front + hlW * 0.3;
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1); g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH); g.endFill();
  lenv(g, groundY, 0.4); g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH);

  const rear = x - d * halfL;
  const tlW = Math.max(2.5, halfL * 0.018), tlH = hs * 0.08;
  const tlx = d > 0 ? rear + tlW * 0.3 : rear - tlW * 1.3;
  g.lineStyle(0);
  g.beginFill(FILL_MID, 0.7); g.drawRect(tlx, bodyBot - hs * 0.20, tlW, tlH); g.endFill();
}

function _moto(g, vehicle, highlight) {
  g.lineStyle(0);
  const u = vehicle.scale, x = vehicle.x, d = vehicle.direction;
  const groundY = vehicle.y;
  const rs = u * 0.8;   // 骑手缩放

  const va    = vehicleAnchors.mobike;
  const W     = (jx, jy) => ({ x: x + d * jx * rs, y: groundY + jy * rs });
  const hip   = W(va.hip_jx,   va.hip_jy);
  const handL = W(va.handL_jx, va.handL_jy);
  const handR = W(va.handR_jx, va.handR_jy);
  const bar   = handL.x * d >= handR.x * d ? handL : handR;
  const footF = W(va.footF_jx, va.footF_jy);
  const footR = W(va.footR_jx, va.footR_jy);

  // 局部坐标：ux 沿行驶方向，uy 向上为正（单位 u）
  const P = (ux, uy) => ({ x: x + d * ux * u, y: groundY - uy * u });
  const lc = depthLineColor(groundY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  const sw = Math.max(1.5, u * 6);

  // 轮：前轮在把前下方，后轮在脚后
  const wR  = 24 * u;
  const F   = P(56, 24);   // 前轮轴
  const R   = P(-50, 24);  // 后轮轴

  // 后摇臂 + 排气（压在车轮上、车身下）
  lenv(g, groundY, 1.0);
  g.moveTo(P(2, 32).x, P(2, 32).y);  g.lineTo(R.x, R.y);
  lenv(g, groundY, 0.7);
  g.moveTo(P(18, 31).x, P(18, 31).y); g.lineTo(P(-36, 29).x, P(-36, 29).y);
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  const mf = P(-38, 33);
  g.drawRect(Math.min(mf.x, mf.x + d * 18 * u), mf.y, 18 * u, 6 * u);
  g.endFill();

  _wheel(g, F.x, F.y, wR, groundY);
  _wheel(g, R.x, R.y, wR, groundY);

  // 前叉：把立 → 前轮轴
  const sh = { x: bar.x + d * 2 * u, y: bar.y + 7 * u };  // 转向头（手正下方）
  g.lineStyle(sw * 0.7, highlight ?? lc, 1);
  g.moveTo(sh.x, sh.y); g.lineTo(F.x, F.y);

  // 主车身：尾翘 → 座（贴臀）→ 油箱 → 转向头前脸，一个闭合剪影
  const seatY = hip.y + 3 * u;
  const body = [
    P(-34, 55),                                  // 尾底
    P(-36, 62),                                  // 尾尖
    { x: hip.x - d * 22 * u, y: seatY - 1 * u }, // 座后沿
    { x: hip.x + d * 2 * u,  y: seatY },         // 座面（贴臀）
    { x: hip.x + d * 14 * u, y: seatY + 2 * u }, // 油箱后
    { x: sh.x - d * 4 * u,   y: sh.y + 2 * u },  // 油箱前/转向头
    { x: sh.x + d * 2 * u,   y: sh.y + 10 * u }, // 前脸下
    P(26, 42),
    P(-4, 46),
    P(-22, 50),
  ];
  g.lineStyle(sw, highlight ?? lc, 1);
  g.beginFill(FILL_PAPER, 1);
  const bpts = _catmull(body.map(p => [p.x, p.y]), 6);
  g.moveTo(bpts[0][0], bpts[0][1]);
  for (const [px, py] of bpts) g.lineTo(px, py);
  g.closePath();
  g.endFill();

  // 座垫：深色贴条（车身上、骑手下）
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(hip.x - d * 22 * u, seatY - 1 * u);
  g.lineTo(hip.x + d *  6 * u, seatY + 1 * u);
  g.lineTo(hip.x + d *  6 * u, seatY + 5 * u);
  g.lineTo(hip.x - d * 22 * u, seatY + 4 * u);
  g.closePath();
  g.endFill();

  // 发动机块：车身下、两轮之间
  const eg = P(-2, 46);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(Math.min(eg.x, eg.x + d * 24 * u), eg.y, 24 * u, 15 * u);
  g.endFill();

  // 车把：穿过手，前端微翘
  g.lineStyle(sw * 0.7, highlight ?? lc, 1);
  g.moveTo(bar.x - d * 6 * u, bar.y + 3 * u);
  g.lineTo(bar.x + d * 5 * u, bar.y - 2 * u);

  // 大灯：前脸小圆
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawCircle(sh.x + d * 8 * u, sh.y + 12 * u, 4.5 * u);
  g.endFill();
  lenv(g, groundY, 0.6);
  g.drawCircle(sh.x + d * 8 * u, sh.y + 12 * u, 4.5 * u);

  // 尾灯
  g.lineStyle(0);
  g.beginFill(FILL_MID, 0.9);
  const tl = P(-38, 58);
  g.drawRect(Math.min(tl.x, tl.x + d * 3 * u), tl.y, 3 * u, 4 * u);
  g.endFill();

  // 脚踏
  lenv(g, groundY, 0.85);
  g.moveTo(footF.x - d * 2 * u, footF.y); g.lineTo(footF.x + d * 3 * u, footF.y);
  g.moveTo(footR.x - d * 2 * u, footR.y); g.lineTo(footR.x + d * 3 * u, footR.y);

  // 骑手：与 W() 同一原点/缩放，关节精确重合
  if (vehicle._sr) {
    vehicle._sr.draw(g, 'mobike', 0, x, groundY, rs, d, highlight ?? lc, 1);
  }
}


export function drawVehicle(g, vehicle) {
  g.lineStyle(0);
  const hl = null;
  switch (vehicle.kind) {
    case 'bus':  _bus(g, vehicle, hl);  break;
    case 'taxi': _taxi(g, vehicle, hl); break;
    case 'moto': _moto(g, vehicle, hl); break;
    default:     _car(g, vehicle, hl);  break;
  }
}