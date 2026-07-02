import {
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

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
  g.lineStyle(0);
  g.beginFill(0xffffff, 0.15);
  const rwMinX = Math.min(cx - d * halfL * 0.42, pillarX - bw);
  g.drawRect(rwMinX, winTop + hs * 0.03, halfL * 0.12, hs * 0.15);
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
  g.lineStyle(0);
  g.beginFill(0xffffff, 0.15);
  const fwMinX = Math.min(leftTopX, topFrontX);
  g.drawRect(fwMinX, winTop + hs * 0.03, halfL * 0.08, hs * 0.12);
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
  g.beginFill(0xffffff, 0.5); g.drawRect(hlx, hly, hlW, hlH); g.endFill();
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

  g.beginFill(0x000000, 0.06);
  g.drawEllipse(x, groundY + rs * 0.05, ls * 0.38, rs * 0.13);
  g.endFill();

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

  g.beginFill(0x000000, 0.05);
  g.drawEllipse(x, groundY + rs * 0.05, ls * 0.44, rs * 0.14);
  g.endFill();

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
    g.beginFill(0xffffff, 0.15); g.drawRect(wx, winTop + winH * 0.05, winW * 0.5, winH * 0.4); g.endFill();
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
    g.beginFill(0xffffff, 0.15);
    g.drawRect(doorLeft + doorW * 0.1, doorTop + doorH * 0.06, doorW * 0.35, doorH * 0.2);
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
  g.beginFill(0xffffff, 0.5); g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH); g.endFill();
  lenv(g, groundY, 0.4); g.drawRect(hlx, bodyBot - hs * 0.24, hlW, hlH);

  const rear = x - d * halfL;
  const tlW = Math.max(2.5, halfL * 0.018), tlH = hs * 0.08;
  const tlx = d > 0 ? rear + tlW * 0.3 : rear - tlW * 1.3;
  g.lineStyle(0);
  g.beginFill(FILL_MID, 0.7); g.drawRect(tlx, bodyBot - hs * 0.20, tlW, tlH); g.endFill();
}

function _moto(g, vehicle, highlight) {
  const u = vehicle.scale, x = vehicle.x, y = vehicle.y, d = vehicle.direction;
  const groundY = y;
  const bs = u;
  const ba = bs * 1.5;
  const riderScale = u * 0.8;

  const fr = vehicle._sr?.getFrame('mobike', 0) ?? {};
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

  const lc = depthLineColor(groundY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  const frameSW  = Math.max(1.4, bs * 7);

  g.beginFill(0x000000, 0.06);
  g.drawEllipse((rwx + fwx) / 2, groundY + wR * 0.12, (Math.abs(fwx - rwx) + wR * 2.2) / 2, wR * 0.25);
  g.endFill();

  _wheel(g, fwx, wCy, wR, groundY);
  _wheel(g, rwx, wCy, wR, groundY);

  g.lineStyle(frameSW, highlight ?? lc, 1);
  g.moveTo(rwx, wCy); g.lineTo(hipX, hipY);
  g.moveTo(hipX, hipY); g.lineTo(bar.x, bar.y);
  g.moveTo(rwx, wCy); g.lineTo(bar.x - d * 8 * bs, bar.y + 5 * bs);

  g.lineStyle(Math.max(0.8, bs * 3), lc, 0.85);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(hipX,                 hipY - 2 * bs);
  g.lineTo(bar.x - d * 12 * bs, bar.y + 1 * bs);
  g.lineTo(bar.x - d * 12 * bs, bar.y + 5 * bs);
  g.lineTo(hipX,                 hipY + 4 * bs);
  g.closePath();
  g.endFill();

  g.lineStyle(Math.max(2, bs * 6), lc, 1);
  g.moveTo(hipX - d * 10 * bs, hipY + 1 * bs); g.lineTo(hipX + d * 3 * bs, hipY - 1 * bs);

  g.lineStyle(Math.max(1, bs * 5), lc, 1);
  g.moveTo(fwx, wCy); g.lineTo(bar.x, bar.y);

  g.lineStyle(Math.max(1.2, bs * 6), lc, 1);
  g.moveTo(bar.x - d * 4 * bs, bar.y + 2 * bs); g.lineTo(bar.x + d * 5 * bs, bar.y - 3 * bs);

  lenv(g, groundY, 0.35);
  g.moveTo(hipX - d * 6 * bs, hipY + 6 * bs); g.lineTo(rwx + d * wR * 0.6, wCy + wR * 0.4);

  g.lineStyle(Math.max(1.5, bs * 4), lc, 1);
  g.moveTo(footF.x - d * 2 * bs, footF.y); g.lineTo(footF.x + d * 3 * bs, footF.y);
  g.moveTo(footR.x - d * 2 * bs, footR.y); g.lineTo(footR.x + d * 3 * bs, footR.y);

  if (vehicle._sr) {
    vehicle._sr.draw(g, 'mobike', 0, hipX, hipY, riderScale, d, lc, 1);
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
