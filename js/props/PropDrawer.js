/**
 * PropDrawer — 所有道具的绘制函数
 *
 * 世界单位基准：火柴人原生高度 144 单位 = 1.7m，1m ≈ 85 单位。
 * 每个函数读 const s = p.scale ?? 1，所有几何尺寸均为世界单位 × s。
 * p.width / p.height 字段保留供碰撞/交互范围使用，不再影响视觉绘制。
 */

import { depthLineWidth, depthLineColor } from '../SceneConfig.js';

export function drawProp(g, prop) {
  switch (prop.propType) {
    case 'lamp':        drawLamp(g, prop);       break;
    case 'bench':       drawBench(g, prop);      break;
    case 'trash':       drawTrash(g, prop);      break;
    case 'sign':        drawSign(g, prop);       break;
    case 'newsrack':    drawNewsRack(g, prop);   break;
    case 'hydrant':     drawHydrant(g, prop);    break;
    case 'mailbox':     drawMailbox(g, prop);    break;
    case 'planter':     drawPlanter(g, prop);    break;
    case 'manhole':     drawManhole(g, prop);    break;
    case 'drain':       drawDrain(g, prop);      break;
    case 'chair':       drawChair(g, prop);      break;
    case 'chess-table': drawChessTable(g, prop); break;
    case 'tree':        drawTree(g, prop);       break;
    case 'fountain':    drawFountain(g, prop);   break;
    case 'stall':       drawStall(g, prop);      break;
    case 'vending':     drawVending(g, prop);    break;
    case 'phonebooth':  drawPhoneBooth(g, prop); break;
    case 'busstop-roof': drawBusStopRoof(g, prop); break;
  }
}

// ─── 路灯 ─────────────────────────────────────────────────────────────────────
// 柱高400, 臂长85, 灯具28×28, 底座22×22

function drawLamp(g, p) {
  const { x, y } = p;
  const s  = p.scale ?? 1;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x6a, dark: 0x1f });

  const poleH  = 300 * s;
  const armLen = 60  * s;
  const boxW   = 28  * s,  boxH  = 28 * s;
  const baseW  = 22  * s,  baseH = 22 * s;
  const topY    = y - poleH;
  const armTipX = x - armLen;
  const armTipY = topY + 28 * s;   // arm slopes slightly downward from pole top

  // base block
  g.fillStyle(0x101010, 1);
  g.fillRect(x - baseW / 2, y - baseH, baseW, baseH);
  // pole
  g.lineStyle(lw * 1.25, lc, 1);
  g.lineBetween(x, y - baseH, x, topY);
  // arm
  g.lineStyle(lw, lc, 1);
  g.lineBetween(x, topY, armTipX, armTipY);
  // light box
  g.fillStyle(0xfafafa, 1);
  g.fillRect(armTipX - boxW, armTipY - boxH / 2, boxW, boxH);
  g.lineStyle(lw * 0.8, 0x101010, 1);
  g.strokeRect(armTipX - boxW, armTipY - boxH / 2, boxW, boxH);
  // diffuser line
  g.lineStyle(lw * 0.35, 0xa0a0a0, 0.85);
  g.lineBetween(armTipX - boxW + 3 * s, armTipY, armTipX - 3 * s, armTipY);
}

// ─── 长椅 ─────────────────────────────────────────────────────────────────────
// 长153, 腿高23, 座厚17, 靠背高40

function drawBench(g, p) {
  const { x, y } = p;
  const f = p.facing || 'down';
  const s = p.scale ?? 1;
  const L     = 300 * s;
  const half  = L / 2;
  const legH  = 23 * s;
  const seatT = 17 * s;
  const backH = 40 * s;
  const lineW = depthLineWidth(y, { wMin: 1, wMax: 2 });
  const lineC = depthLineColor(y, { light: 0x38, dark: 0x08 });

  const P = (u, w) => {
    switch (f) {
      case 'up':    return [x + u, y - w];
      case 'left':  return [x - w, y + u];
      case 'right': return [x + w, y + u];
      default:      return [x + u, y + w];
    }
  };
  const rect = (u0, w0, u1, w1, fill, fa, sw) => {
    const a = P(u0, w0), b = P(u1, w1);
    const rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]);
    const rw = Math.abs(a[0] - b[0]), rh = Math.abs(a[1] - b[1]);
    if (fill != null) { g.fillStyle(fill, fa ?? 1); g.fillRect(rx, ry, rw, rh); }
    if (sw)           { g.lineStyle(sw, lineC, 0.9); g.strokeRect(rx, ry, rw, rh); }
  };
  const line = (u0, w0, u1, w1, lwd, al) => {
    const a = P(u0, w0), b = P(u1, w1);
    g.lineStyle(lwd, lineC, al ?? 0.9);
    g.lineBetween(a[0], a[1], b[0], b[1]);
  };

  // ground shadow
  g.fillStyle(0x000000, 0.10);
  if (f === 'left' || f === 'right') g.fillEllipse(x, y, 12 * s, L * 1.05);
  else                               g.fillEllipse(x, y, L * 1.05, 8 * s);

  // outer + inner legs
  const li = 14 * s;
  line(-(half - li), -legH, -(half - li), 0, lineW, 0.95);
  line( (half - li), -legH,  (half - li), 0, lineW, 0.95);
  line(-(half - 32 * s), -legH, -(half - 32 * s), 0, lineW * 0.85, 0.85);
  line( (half - 32 * s), -legH,  (half - 32 * s), 0, lineW * 0.85, 0.85);
  // horizontal mid-brace
  line(-(half - li), -legH * 0.5, (half - li), -legH * 0.5, lineW * 0.7, 0.8);

  // seat slats
  const n = 4, sw_u = (L - 17 * s) / n;
  for (let i = 0; i < n; i++) {
    const u0 = -half + 9 * s + i * sw_u;
    const shade = 0xe0e0e0 - i * 0x0a0a0a;
    rect(u0, -(legH + seatT), u0 + sw_u - 4 * s, -legH, shade, 0.95, lineW * 0.8);
  }

  // back plank + connecting posts
  const by2  = -(legH + seatT);
  const by3  = -(legH + seatT + backH);
  const plkT = 11 * s;
  rect(-half + 11 * s, by3 + plkT, half - 11 * s, by3, 0xd2d2d2, 0.92, lineW * 0.85);
  for (let i = 0; i <= 4; i++) {
    const u = -half + 11 * s + (L - 22 * s) * i / 4;
    line(u, by2, u + s, by3 + plkT, lineW * 0.7, 0.85);
  }

  // armrest stubs
  for (const dir of [-1, 1]) {
    const u = dir * (half - 9 * s);
    line(u, by2 - 3 * s, u, -(legH + 9 * s), lineW * 0.85, 0.9);
    line(u, -(legH + 9 * s), u - dir * 9 * s, -(legH + 3 * s), lineW * 0.85, 0.9);
  }
}

// ─── 垃圾桶 ──────────────────────────────────────────────────────────────────
// 高80, 宽46（顶部宽）

function drawTrash(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x10 });
  const topW  = 40 * s,  botW = 30 * s,  h = 50 * s;
  const tx    = x - topW / 2;
  const bx    = x - botW / 2;

  g.fillStyle(0xc0c0c0, 0.92);
  g.beginPath();
  g.moveTo(tx,          y - h);
  g.lineTo(tx + topW,   y - h);
  g.lineTo(bx + botW,   y);
  g.lineTo(bx,          y);
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();
  // lid
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(tx - 3 * s, y - h - 3 * s, tx + topW + 3 * s, y - h - 3 * s);
  // grooves
  g.lineStyle(0.5 * s, lineC, 0.6);
  g.lineBetween(x - 6 * s, y - h + 6 * s, x - 6 * s + (botW - topW) * 0.3, y - 3 * s);
  g.lineBetween(x + 6 * s, y - h + 6 * s, x + 6 * s - (botW - topW) * 0.3, y - 3 * s);
}

// ─── 标牌（店招等） ──────────────────────────────────────────────────────────
// 柱高144, 牌面43×35

function drawSign(g, p) {
  const s  = p.scale ?? 1;
  const sw = 43 * s;
  const sh = 35 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;
  const fill = _toGrayBand(p.propColor, 0xa8, 0x60);

  g.fillStyle(fill, 0.95);
  g.fillRect(sx, sy, sw, sh);
  // inner text lines
  g.lineStyle(1.7 * s, 0xfafafa, 0.8);
  g.lineBetween(sx + 9 * s, sy + sh * 0.35, sx + sw - 9 * s, sy + sh * 0.35);
  g.lineBetween(sx + 14 * s, sy + sh * 0.65, sx + sw - 14 * s, sy + sh * 0.65);
  g.lineStyle(2.3 * s, 0x000000, 0.7);
  g.strokeRect(sx, sy, sw, sh);
  // hanger brackets
  g.lineStyle(1.5 * s, 0x303030, 0.7);
  g.lineBetween(sx + 11 * s,       sy, sx + 11 * s,       sy - 9 * s);
  g.lineBetween(sx + sw - 11 * s,  sy, sx + sw - 11 * s,  sy - 9 * s);
}

// ─── 报纸架 ──────────────────────────────────────────────────────────────────
// 高86, 宽58

function drawNewsRack(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 70 * s,  h = 86 * s;
  const px    = x - w / 2;
  const py    = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  g.fillStyle(0xb8b8b8, 0.95);
  g.fillRect(px, py + 17 * s, w, h - 17 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 17 * s, w, h - 17 * s);

  // glass window
  g.fillStyle(0xeaeaea, 0.95);
  g.fillRect(px + 3 * s, py + 20 * s, w - 6 * s, 26 * s);
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.strokeRect(px + 3 * s, py + 20 * s, w - 6 * s, 26 * s);

  // text lines
  g.lineStyle(1.5 * s, lineC, 0.85);
  g.lineBetween(px + 6 * s, py + 26 * s, px + w - 6 * s, py + 26 * s);
  g.lineBetween(px + 6 * s, py + 32 * s, px + w - 6 * s, py + 32 * s);
  g.lineBetween(px + 6 * s, py + 38 * s, px + w - 11 * s, py + 38 * s);

  // coin slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + w / 2 - 6 * s, py + h - 14 * s, 11 * s, 3 * s);

  // header bar
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(px - 3 * s, py + 6 * s, w + 6 * s, 11 * s);
  g.lineStyle(lineW * 0.9, lineC, 0.95);
  g.strokeRect(px - 3 * s, py + 6 * s, w + 6 * s, 11 * s);

  // feet
  g.lineStyle(lineW, lineC, 0.9);
  g.lineBetween(px + 6 * s,     py + h, px + 6 * s,     py + h + 9 * s);
  g.lineBetween(px + w - 6 * s, py + h, px + w - 6 * s, py + h + 9 * s);
}

// ─── 消防栓 ──────────────────────────────────────────────────────────────────
// 高43, 宽23

function drawHydrant(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // base flange（底部法兰）- 改宽度
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);  // 原 -11, 23, 6
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);
  
  // body（主体）- 改宽度和高度
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);  // 原 -9, -29, 17, 23
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);
  
  // dome（顶部圆顶）- 改宽度和高度
  g.fillStyle(0xa0a0a0, 1);
  g.beginPath();
  g.moveTo(x - 8 * s, y - 50 * s);    // 原 -6, -38
  g.lineTo(x + 8 * s, y - 50 * s);    // 原 +6, -38
  g.lineTo(x + 12 * s, y - 38 * s);   // 原 +9, -29
  g.lineTo(x - 12 * s, y - 38 * s);   // 原 -9, -29
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();
  
  // cap bolt（顶部螺栓）- 改大小
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(x - 4 * s, y - 57 * s, 8 * s, 7 * s);  // 原 -3, -43, 6, 5
  
  // side outlets（侧面出水口）- 改位置和大小
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);  // 原 -20, -23, 9, 6
  g.fillRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);  // 原 +11, -23, 9, 6
  g.lineStyle(1.5 * s, lineC, 0.85);
  g.strokeRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);
  g.strokeRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);
}

// ─── 邮筒 ────────────────────────────────────────────────────────────────────
// 高92, 宽40

function drawMailbox(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // 柱子加长量（比如增加 20*s）
  const extraHeight = 20 * s;  // 柱子额外伸长的长度
  
  // post（柱子）- 向下伸更长
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(x, y, x, y - 29 * s - extraHeight);  // 柱子从 y 向上画到更高的位置
  
  // box body - 整体向上平移 extraHeight
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);
  
  // cap - 整体向上平移 extraHeight
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);
  
  // mail slot - 整体向上平移 extraHeight
  g.fillStyle(0x101010, 0.9);
  g.fillRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  
  // flag - 整体向上平移 extraHeight
  g.lineStyle(1.5 * s, 0xfafafa, 0.85);
  g.lineBetween(x - 9 * s, y - 40 * s - extraHeight, x, y - 37 * s - extraHeight);
  g.lineBetween(x, y - 37 * s - extraHeight, x + 9 * s, y - 40 * s - extraHeight);
}

// ─── 花坛 ────────────────────────────────────────────────────────────────────
// 高35, 径58

function drawPlanter(g, p) {
  const s     = p.scale ?? 1;
  const w     = 80 * s;
  const h     = 20 * s;
  const px    = p.x - w / 2;
  const py    = p.y - h;
  const lineW = depthLineWidth(p.y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(p.y, { light: 0x40, dark: 0x10 });

  g.fillStyle(0xb4b4b4, 1);
  g.fillRect(px, py + 9 * s, w, h - 9 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 9 * s, w, h - 9 * s);

  // seams
  g.lineStyle(1.2 * s, lineC, 0.6);
  const segs = Math.max(2, Math.floor(w / (23 * s)));
  for (let i = 1; i < segs; i++) {
    const lx = px + (w * i / segs);
    g.lineBetween(lx, py + 9 * s, lx, py + h);
  }

  // plant clumps
  const clumps = Math.max(2, Math.floor(w / (26 * s)));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 11 * s + i * (w - 23 * s) / Math.max(1, clumps - 1);
    const cy = py + 6 * s;
    g.lineStyle(lineW * 0.9, lineC, 0.85);
    g.lineBetween(cx, cy + 6 * s, cx, cy - 11 * s);
    g.lineBetween(cx, cy - 6 * s, cx - 9 * s, cy - 14 * s);
    g.lineBetween(cx, cy - 6 * s, cx + 9 * s, cy - 14 * s);
    g.lineBetween(cx, cy - 11 * s, cx - 6 * s, cy - 17 * s);
    g.lineBetween(cx, cy - 11 * s, cx + 6 * s, cy - 17 * s);
  }
}

// ─── 井盖（地面贴片） ─────────────────────────────────────────────────────────
// 径40（直径）

function drawManhole(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const rx    = 30 * s;
  const ry    = rx * 0.45;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });

  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + 3 * s, y + 3 * s, rx * 2.1, ry * 2.1);
  g.fillStyle(0x6a6a6a, 1);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(lineW, 0x101010, 0.92);
  g.strokeEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(1.5 * s, 0x1a1a1a, 0.8);
  g.strokeEllipse(x, y, rx * 1.55, ry * 1.55);

  // grate lines
  g.lineStyle(1.5 * s, 0x202020, 0.7);
  for (let i = -2; i <= 2; i++) {
    const ly   = y + i * (ry * 0.32);
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.lineBetween(x - half, ly, x + half, ly);
  }
}

// ─── 排水沟（地面贴片） ──────────────────────────────────────────────────────
// 长58, 宽17

function drawDrain(g, p) {
  const s     = p.scale ?? 1;
  const w     = 58 * s;
  const h     = 27 * s;
  const px    = p.x - w / 2;
  const py    = p.y - h / 2;
  const lineW = depthLineWidth(p.y, { wMin: 0.7, wMax: 1.4 });
  const lineC = depthLineColor(p.y, { light: 0x10, dark: 0x08 });

  g.fillStyle(0x707070, 1);
  g.fillRect(px, py, w, h);
  g.lineStyle(lineW, lineC, 0.9);
  g.strokeRect(px, py, w, h);

  // grate slots
  g.lineStyle(lineW * 0.65, lineC, 0.85);
  const slots = Math.max(3, Math.floor(w / (9 * s)));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.lineBetween(lx, py + 3 * s, lx, py + h - 3 * s);
  }
}

// ─── 椅子 ────────────────────────────────────────────────────────────────────
// 座高17, 靠背高40, 宽35

function drawChair(g, p) {
  const { x, y } = p;
  const s      = p.scale ?? 1;
  const d      = p.dir ?? 1;
  const seatH  = 10 * s;
  const seatW  = 25 * s;
  const backH  = 20 * s;
  const seatY  = y - seatH;
  const seatX1 = x - seatW / 2;
  const seatX2 = x + seatW / 2;
  const lw     = depthLineWidth(y);
  const lc     = depthLineColor(y, { light: 0x20, dark: 0x0a });

  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(seatX1, seatY, seatX2, seatY);
  // back rest
  const backX   = (d > 0) ? seatX1 : seatX2;
  const backTop = seatY - backH;
  g.lineBetween(backX, seatY, backX, backTop);
  g.lineBetween(backX - 6 * s * d, backTop, backX + 3 * s * d, backTop);
  // legs
  g.lineStyle(lw * 0.85, lc, 0.9);
  g.lineBetween(seatX1 + 3 * s, seatY, seatX1 + 3 * s, y);
  g.lineBetween(seatX2 - 3 * s, seatY, seatX2 - 3 * s, y);
  // seat highlight
  g.lineStyle(lw * 0.4, 0x303030, 0.6);
  g.lineBetween(seatX1 + 3 * s, seatY + 3 * s, seatX2 - 3 * s, seatY + 3 * s);
}

// ─── 棋桌 ────────────────────────────────────────────────────────────────────
// 高63, 面宽80

function drawChessTable(g, p) {
  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = 58 * s;
  const topH = 25 * s;
  const th   = 20 * s;
  const topX = x - tw / 2;
  const topY = y - topH;
  const lw   = depthLineWidth(y);
  const lc   = depthLineColor(y, { light: 0x1a, dark: 0x0a });

  // 桌面主体
  g.fillStyle(0xcfcfcf, 1);
  g.fillRect(topX, topY, tw, th);
  g.lineStyle(lw, lc, 0.95);
  g.strokeRect(topX, topY, tw, th);
  
  // 桌面内框装饰线
  g.lineStyle(lw * 0.5, 0x9a9a9a, 0.8);
  g.strokeRect(topX + 4 * s, topY + 4 * s, tw - 8 * s, th - 8 * s);
  
  // 桌面网格线（3x3）
  g.lineStyle(lw * 0.55, lc, 0.85);
  for (let i = 1; i < 3; i++) {
    const lx = topX + (tw * i / 3);
    g.lineBetween(lx, topY + 6 * s, lx, topY + th - 6 * s);
  }
  for (let i = 1; i < 3; i++) {
      const ly = topY + 4.5 * s + (3 + th - 12 * s) * i / 3;
      g.lineBetween(topX + 6 * s, ly, topX + tw - 6 * s, ly);
  }

  // 桌腿
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(topX + 3 * s,       topY + th, topX + 3 * s,       y);
  g.lineBetween(topX + tw - 3 * s,  topY + th, topX + tw - 3 * s,  y);
  g.lineStyle(lw * 0.65, lc, 0.7);
  g.lineBetween(topX + tw * 0.2, topY + th, topX + tw * 0.2, y - 3 * s);
  g.lineBetween(topX + tw * 0.8, topY + th, topX + tw * 0.8, y - 3 * s);
}

// ─── 树木 ────────────────────────────────────────────────────────────────────
// 干115~170, 冠径170~290, 冠高145~230
// tree.crownR（旧世界单位）× 2.88 转换；无则用默认95（世界单位）

/**
 * drawTree(g, p)
 * p.x, p.y       - 树的中心底部坐标
 * p.scale        - 缩放，默认 1
 * p.style        - 'heart' | 'fluffy' | 'round' | 'layered'，默认 'round'
 * p.crownR       - 树冠半径（可选，覆盖默认值）
 */
function drawTree(g, p) {
  const { x, y } = p;
  const s = p.scale ?? 1;
  const r = (p.crownR != null ? p.crownR * 2.88 : 95) * s;

  const lw = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineColor = depthLineColor(y, { light: 0x40, dark: 0x18 });

  const trunkW = r * 0.14;
  const trunkH = r * 0.52;
  const crownBottom = y - trunkH;
  const crownCY = crownBottom - r * 0.38;

  // ── 树干 ─────────────────────────────────────────────
  g.fillStyle(0xE0E0E0, 1);
  g.fillRect(x - trunkW / 2, crownBottom, trunkW, trunkH);
  g.lineStyle(lw, lineColor, 0.9);
  g.strokeRect(x - trunkW / 2, crownBottom, trunkW, trunkH);

  // 分叉
  g.lineStyle(lw * 1.2, lineColor, 0.85);
  const forkY = crownBottom + r * 0.18;
  g.lineBetween(x - trunkW * 0.3, forkY, x - r * 0.28, crownBottom + r * 0.05);
  g.lineBetween(x + trunkW * 0.3, forkY, x + r * 0.22, crownBottom + r * 0.02);

  // ── 树冠填色 ─────────────────────────────────────────
  const blobs = [
    [  0,       -r*0.30,  r*0.52 ],
    [ -r*0.38,  -r*0.14,  r*0.42 ],
    [  r*0.38,  -r*0.10,  r*0.40 ],
    [ -r*0.56,   r*0.14,  r*0.34 ],
    [  r*0.54,   r*0.16,  r*0.34 ],
    [ -r*0.24,   r*0.26,  r*0.36 ],
    [  r*0.26,   r*0.28,  r*0.36 ],
  ];

  g.fillStyle(0xe8e8e8, 1);
  for (const [dx, dy, br] of blobs) {
    g.fillCircle(x + dx, crownCY + dy, br);
  }

  // ── 轮廓点计算 ───────────────────────────────────────
  function isOuter(px, py, skipIdx) {
    for (let i = 0; i < blobs.length; i++) {
      if (i === skipIdx) continue;
      const [dx, dy, br] = blobs[i];
      if ((px - (x + dx)) ** 2 + (py - (crownCY + dy)) ** 2 < (br - lw) ** 2) return false;
    }
    return true;
  }

  const STEPS = 64;
  const pts = [];
  for (let bi = 0; bi < blobs.length; bi++) {
    const [dx, dy, br] = blobs[bi];
    const cx = x + dx, cy = crownCY + dy;
    for (let i = 0; i < STEPS; i++) {
      const a = (2 * Math.PI * i) / STEPS;
      const px = cx + Math.cos(a) * br;
      const py = cy + Math.sin(a) * br;
      if (isOuter(px, py, bi)) pts.push({ x: px, y: py });
    }
  }

  if (pts.length < 3) return;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  pts.sort((a, b) => Math.atan2(a.y - my, a.x - mx) - Math.atan2(b.y - my, b.x - mx));

  // ── 描轮廓 ───────────────────────────────────────────
  g.lineStyle(lw, lineColor, 0.88);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.strokePath();
}

// ─── 喷泉 ────────────────────────────────────────────────────────────────────
// 池径600, 柱高86, 水盘宽58

function drawFountain(g, p) {
  const { x, y } = p;
  const s   = p.scale ?? 1;
  const rx  = 300 * s;   // pool half-diameter
  const ry  = rx * 0.5;
  const lw  = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const lc  = depthLineColor(y, { light: 0xbc, dark: 0x88 });

  // shadow
  g.fillStyle(0x000000, 0.04);
  g.fillEllipse(x, y + 11 * s, rx * 1.9, ry * 1.8);
  // pool rim
  g.fillStyle(0xe5e5e5, 1);
  g.fillEllipse(x, y, rx * 1.55, ry * 1.55);
  g.lineStyle(lw, lc, 0.7);
  g.strokeEllipse(x, y, rx * 1.2, ry * 1.2);
  // water surface
  g.fillStyle(0xd6d6d6, 0.9);
  g.fillEllipse(x + 3 * s, y - 3 * s, rx * 0.92, ry * 0.92);
  g.lineStyle(lw * 0.5, lc, 0.35);
  g.strokeEllipse(x - 3 * s, y, rx * 0.42, ry * 0.42);
  // nozzle + jet
  g.fillStyle(0xa8a8a8, 1);
  g.fillCircle(x, y - 3 * s, 6 * s);
  g.lineStyle(2.3 * s, 0xf0f0f0, 0.6);
  g.lineBetween(x, y - 6 * s, x, y - ry * 1.1);
}

// ─── 小摊 ────────────────────────────────────────────────────────────────────
// 宽290, 棚高144, 台面高72

function drawStall(g, p) {
  const { x, y } = p;
  const s       = p.scale ?? 1;
  const w       = 290 * s;
  const roofH   = 200 * s;
  const ctrH    = 72  * s;
  const lineW   = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
  const lineC   = depthLineColor(y, { light: 0x38, dark: 0x08 });
  const px      = x - w / 2;
  const counterY = y - ctrH;

  // support poles
  g.lineStyle(lineW, lineC, 0.95);
  g.lineBetween(px + 6 * s, y, px + 6 * s, y - roofH);
  g.lineBetween(px + w - 6 * s, y, px + w - 6 * s, y - roofH);

  // awning
  const aY = y - roofH, aH = 17 * s;
  g.fillStyle(0x707070, 1);
  g.beginPath();
  g.moveTo(px, aY + aH); g.lineTo(px + w, aY + aH);
  g.lineTo(px + w + 9 * s, aY); g.lineTo(px - 9 * s, aY);
  g.closePath(); g.fillPath();
  g.lineStyle(lineW, lineC, 0.95); g.strokePath();
  // awning stripes
  g.lineStyle(1.5 * s, 0xdddddd, 0.7);
  for (let i = 1; i < Math.floor(w / (17 * s)); i++) {
    const sx = px - 9 * s + i * 17 * s;
    g.lineBetween(sx, aY, sx + 4 * s, aY + aH);
  }

  // counter
  g.fillStyle(0xc0c0c0, 1);
  g.fillRect(px + 3 * s, counterY, w - 6 * s, 11 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px + 3 * s, counterY, w - 6 * s, 11 * s);

  // items
  g.fillStyle(0x9a9a9a, 1);
  const itemW = 11 * s, itemH = 9 * s;
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.fillRect(gx, counterY - itemH, itemW, itemH);
    g.lineStyle(1.2 * s, lineC, 0.85);
    g.strokeRect(gx, counterY - itemH, itemW, itemH);
  }
}

// ─── 自动售货机 ──────────────────────────────────────────────────────────────
// 高158, 宽58

function drawVending(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 80  * s;
  const h     = 158 * s;
  const px    = x - w / 2,  py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 11 * s);
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(px, py, w, h);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py, w, h);

  // glass front
  const gx = px + 6 * s, gy = py + 6 * s, gw = w * 0.6, gh = h - 29 * s;
  g.fillStyle(0x3a3a3a, 0.6);
  g.fillRect(gx, gy, gw, gh);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(gx + 3 * s, gy + 3 * s, gw - 6 * s, gh * 0.4);
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.strokeRect(gx, gy, gw, gh);

  // shelf lines
  g.lineStyle(1.2 * s, 0xcacaca, 0.6);
  for (let i = 1; i < 5; i++) g.lineBetween(gx, gy + gh * i / 5, gx + gw, gy + gh * i / 5);

  // side panel
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.strokeRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);

  // dispenser slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + 6 * s, py + h - 17 * s, w - 11 * s, 9 * s);
}

// ─── 电话亭 ──────────────────────────────────────────────────────────────────
// 高173, 宽58

function drawPhoneBooth(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 80  * s;
  const h     = 173 * s;
  const px    = x - w / 2,  py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 11 * s);
  g.fillStyle(0x404040, 0.5);
  g.fillRect(px, py + 11 * s, w, h - 11 * s);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(px + 3 * s, py + 14 * s, w - 6 * s, (h - 11 * s) * 0.45);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 11 * s, w, h - 11 * s);

  // interior dividers
  g.lineStyle(1.5 * s, lineC, 0.7);
  g.lineBetween(px + w / 2, py + 14 * s, px + w / 2, y - 3 * s);
  g.lineBetween(px + 6 * s, py + (h - 11 * s) * 0.5 + 11 * s,
                px + w - 6 * s, py + (h - 11 * s) * 0.5 + 11 * s);

  // roof header
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(px - 3 * s, py, w + 6 * s, 14 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px - 3 * s, py, w + 6 * s, 14 * s);
  g.fillStyle(0xeaeaea, 0.9);
  g.fillRect(px + 3 * s, py + 3 * s, w - 6 * s, 6 * s);

  // handset
  g.fillStyle(0x202020, 0.7);
  g.fillRect(px + w - 14 * s, py + 29 * s, 6 * s, 17 * s);
}

// ─── 公交站顶棚（独立 PropEntity，参与 Y 排序）───────────────────────────────
// 宽340, 高65, 柱距260（半距130）
// roofTopY / pillarBottomY 为绝对像素坐标（布局计算所得，不缩放）

function drawBusStopRoof(g, p) {
  const s  = p.scale ?? 1;
  const rW = 800 * s;
  const rH = 30  * s;
  const rX = p.x - rW / 2;

  // roof panel
  g.fillStyle(0x686866, 1);
  g.fillRect(rX, p.roofTopY, rW, rH);
  g.lineStyle(4.6 * s, 0x181818, 1);
  g.strokeRect(rX, p.roofTopY, rW, rH);

  // support pillars
  const pillarT = p.roofTopY + rH;
  const pOff    = 325 * s;
  g.lineStyle(7.2 * s, 0x282828, 1);
  g.lineBetween(p.x - pOff, pillarT, p.x - pOff, p.pillarBottomY);
  g.lineBetween(p.x + pOff, pillarT, p.x + pOff, p.pillarBottomY);
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

function _toGrayBand(color, lightVal, darkVal) {
  if (!color) return (lightVal << 16) | (lightVal << 8) | lightVal;
  const r   = (color >> 16) & 0xff;
  const g   = (color >> 8)  & 0xff;
  const b   =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(lightVal + (lum / 255) * (darkVal - lightVal));
  return (v << 16) | (v << 8) | v;
}