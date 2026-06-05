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

// ─── 路灯 ────────────────────────────────────────────────────────────────────
// 世界单位: 柱高140, 臂长30, 灯具10×10, 底座8×8

function drawLamp(g, p) {
  const { x, y } = p;
  const s  = p.scale ?? 1;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x6a, dark: 0x1f });

  const poleH  = 140 * s;
  const armLen = 30  * s;
  const boxW   = 10  * s,  boxH  = 10 * s;
  const baseW  = 8   * s,  baseH =  8 * s;

  const topY     = y - poleH;
  const armTipX  = x - armLen;
  const armTipY  = topY + 10 * s;   // arm slopes slightly downward from pole top

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

  // diffuser line inside box
  g.lineStyle(lw * 0.35, 0xa0a0a0, 0.85);
  g.lineBetween(armTipX - boxW + s, armTipY, armTipX - s, armTipY);
}

// ─── 长椅 ────────────────────────────────────────────────────────────────────
// 世界单位: 长55, 腿高8, 座厚6, 靠背高14

function drawBench(g, p) {
  const { x, y } = p;
  const f = p.facing || 'down';
  const s = p.scale ?? 1;
  const L      = (p.width ?? 55) * s;
  const half   = L / 2;
  const legH   = 8  * s;
  const seatT  = 6  * s;
  const backH  = 14 * s;
  const lineW  = depthLineWidth(y, { wMin: 1, wMax: 2 });
  const lineC  = depthLineColor(y, { light: 0x38, dark: 0x08 });

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
    if (sw) { g.lineStyle(sw, lineC, 0.9); g.strokeRect(rx, ry, rw, rh); }
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

  // legs (outer + inner pair)
  const li = 5 * s;
  line(-(half - li), -legH, -(half - li), 0, lineW, 0.95);
  line( (half - li), -legH,  (half - li), 0, lineW, 0.95);
  line(-(half - 11 * s), -legH, -(half - 11 * s), 0, lineW * 0.85, 0.85);
  line( (half - 11 * s), -legH,  (half - 11 * s), 0, lineW * 0.85, 0.85);
  // horizontal mid-brace
  line(-(half - li), -legH * 0.5, (half - li), -legH * 0.5, lineW * 0.7, 0.8);

  // seat slats
  const n = 4, sw_u = (L - 6 * s) / n;
  for (let i = 0; i < n; i++) {
    const u0 = -half + 3 * s + i * sw_u;
    const shade = 0xe0e0e0 - i * 0x0a0a0a;
    rect(u0, -(legH + seatT), u0 + sw_u - 1.5 * s, -legH, shade, 0.95, lineW * 0.8);
  }

  // back plank + connecting posts
  const by2 = -(legH + seatT);
  const by3 = -(legH + seatT + backH);
  const plkT = 4 * s;
  rect(-half + 4 * s, by3 + plkT, half - 4 * s, by3, 0xd2d2d2, 0.92, lineW * 0.85);
  for (let i = 0; i <= 4; i++) {
    const u = -half + 4 * s + (L - 8 * s) * i / 4;
    line(u, by2, u + 2 * s, by3 + plkT, lineW * 0.7, 0.85);
  }

  // armrest stubs
  for (const dir of [-1, 1]) {
    const u = dir * (half - 3 * s);
    line(u, by2 - s, u, -(legH + 3 * s), lineW * 0.85, 0.9);
    line(u, -(legH + 3 * s), u - dir * 3 * s, -(legH + s), lineW * 0.85, 0.9);
  }
}

// ─── 垃圾桶 ──────────────────────────────────────────────────────────────────
// 世界单位: 高28, 宽16

function drawTrash(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x10 });
  const topW  = 16 * s, botW = 12 * s, h = 28 * s;
  const tx    = x - topW / 2;
  const bx    = x - botW / 2;
  g.fillStyle(0xc0c0c0, 0.92);
  g.beginPath();
  g.moveTo(tx,         y - h);
  g.lineTo(tx + topW,  y - h);
  g.lineTo(bx + botW,  y);
  g.lineTo(bx,         y);
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();
  // lid
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(tx - s, y - h - s, tx + topW + s, y - h - s);
  // vertical grooves
  g.lineStyle(0.5, lineC, 0.6);
  g.lineBetween(x - 2 * s, y - h + 2 * s, x - 2 * s + (botW - topW) * 0.3, y - s);
  g.lineBetween(x + 2 * s, y - h + 2 * s, x + 2 * s - (botW - topW) * 0.3, y - s);
}

// ─── 标牌（店招等） ──────────────────────────────────────────────────────────
// 世界单位: 宽从 p.width 读，高12

function drawSign(g, p) {
  const s  = p.scale ?? 1;
  const sw = (p.width ?? 15) * s;
  const sh = 12 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;
  const fill = _toGrayBand(p.propColor, 0xa8, 0x60);
  g.fillStyle(fill, 0.95);
  g.fillRect(sx, sy, sw, sh);
  g.lineStyle(0.6 * s, 0xfafafa, 0.8);
  g.lineBetween(sx + 3 * s, sy + sh * 0.35, sx + sw - 3 * s, sy + sh * 0.35);
  g.lineBetween(sx + 5 * s, sy + sh * 0.65, sx + sw - 5 * s, sy + sh * 0.65);
  g.lineStyle(0.8 * s, 0x000000, 0.7);
  g.strokeRect(sx, sy, sw, sh);
  // hanger brackets
  g.lineStyle(0.5 * s, 0x303030, 0.7);
  g.lineBetween(sx + 4 * s,      sy, sx + 4 * s,      sy - 3 * s);
  g.lineBetween(sx + sw - 4 * s, sy, sx + sw - 4 * s, sy - 3 * s);
}

// ─── 报纸架 ──────────────────────────────────────────────────────────────────
// 世界单位: 高30, 宽20

function drawNewsRack(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 20 * s, h = 30 * s;
  const px    = x - w / 2;
  const py    = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  g.fillStyle(0xb8b8b8, 0.95);
  g.fillRect(px, py + 6 * s, w, h - 6 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 6 * s, w, h - 6 * s);

  // glass window
  g.fillStyle(0xeaeaea, 0.95);
  g.fillRect(px + s, py + 7 * s, w - 2 * s, 9 * s);
  g.lineStyle(0.5 * s, lineC, 0.8);
  g.strokeRect(px + s, py + 7 * s, w - 2 * s, 9 * s);

  // text lines inside window
  g.lineStyle(0.5 * s, lineC, 0.85);
  g.lineBetween(px + 2 * s, py + 9 * s,  px + w - 2 * s, py + 9 * s);
  g.lineBetween(px + 2 * s, py + 11 * s, px + w - 2 * s, py + 11 * s);
  g.lineBetween(px + 2 * s, py + 13 * s, px + w - 4 * s, py + 13 * s);

  // coin slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + w / 2 - 2 * s, py + h - 5 * s, 4 * s, s);

  // header bar
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(px - s, py + 2 * s, w + 2 * s, 4 * s);
  g.lineStyle(lineW * 0.9, lineC, 0.95);
  g.strokeRect(px - s, py + 2 * s, w + 2 * s, 4 * s);

  // feet
  g.lineStyle(lineW, lineC, 0.9);
  g.lineBetween(px + 2 * s,     py + h, px + 2 * s,     py + h + 3 * s);
  g.lineBetween(px + w - 2 * s, py + h, px + w - 2 * s, py + h + 3 * s);
}

// ─── 消防栓 ──────────────────────────────────────────────────────────────────
// 世界单位: 高15, 宽8

function drawHydrant(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // base flange
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(x - 4 * s, y - 2 * s, 8 * s, 2 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 4 * s, y - 2 * s, 8 * s, 2 * s);

  // body
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(x - 3 * s, y - 10 * s, 6 * s, 8 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 3 * s, y - 10 * s, 6 * s, 8 * s);

  // dome top
  g.fillStyle(0xa0a0a0, 1);
  g.beginPath();
  g.moveTo(x - 2 * s, y - 13 * s);
  g.lineTo(x + 2 * s, y - 13 * s);
  g.lineTo(x + 3 * s, y - 10 * s);
  g.lineTo(x - 3 * s, y - 10 * s);
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();

  // cap bolt
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(x - s, y - 14 * s, 2 * s, 1.5 * s);

  // side outlets
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 6 * s, y - 8 * s, 3 * s, 2 * s);
  g.fillRect(x + 3 * s, y - 8 * s, 3 * s, 2 * s);
  g.lineStyle(0.5 * s, lineC, 0.85);
  g.strokeRect(x - 6 * s, y - 8 * s, 3 * s, 2 * s);
  g.strokeRect(x + 3 * s, y - 8 * s, 3 * s, 2 * s);
}

// ─── 邮筒 ────────────────────────────────────────────────────────────────────
// 世界单位: 高32, 宽14

function drawMailbox(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // post
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(x, y, x, y - 10 * s);

  // box body
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(x - 7 * s, y - 22 * s, 14 * s, 12 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 7 * s, y - 22 * s, 14 * s, 12 * s);

  // cap
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 8 * s, y - 24 * s, 16 * s, 3 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 8 * s, y - 24 * s, 16 * s, 3 * s);

  // mail slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(x - 5 * s, y - 18 * s, 10 * s, 2 * s);

  // flag
  g.lineStyle(0.5 * s, 0xfafafa, 0.85);
  g.lineBetween(x - 3 * s, y - 14 * s, x, y - 13 * s);
  g.lineBetween(x, y - 13 * s, x + 3 * s, y - 14 * s);
}

// ─── 花坛 ────────────────────────────────────────────────────────────────────
// 世界单位: 高12, 宽从 p.width 读

function drawPlanter(g, p) {
  const s     = p.scale ?? 1;
  const w     = (p.width ?? 20) * s;
  const h     = 12 * s;
  const px    = p.x - w / 2;
  const py    = p.y - h;
  const lineW = depthLineWidth(p.y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(p.y, { light: 0x40, dark: 0x10 });

  // rim
  g.fillStyle(0xb4b4b4, 1);
  g.fillRect(px, py + 3 * s, w, h - 3 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 3 * s, w, h - 3 * s);

  // divider seams
  g.lineStyle(0.4 * s, lineC, 0.6);
  const segs = Math.max(2, Math.floor(w / (8 * s)));
  for (let i = 1; i < segs; i++) {
    const lx = px + (w * i / segs);
    g.lineBetween(lx, py + 3 * s, lx, py + h);
  }

  // plant clumps
  const clumps = Math.max(2, Math.floor(w / (9 * s)));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 4 * s + i * (w - 8 * s) / Math.max(1, clumps - 1);
    const cy = py + 2 * s;
    g.lineStyle(lineW * 0.9, lineC, 0.85);
    g.lineBetween(cx, cy + 2 * s, cx, cy - 4 * s);
    g.lineBetween(cx, cy - 2 * s, cx - 3 * s, cy - 5 * s);
    g.lineBetween(cx, cy - 2 * s, cx + 3 * s, cy - 5 * s);
    g.lineBetween(cx, cy - 4 * s, cx - 2 * s, cy - 6 * s);
    g.lineBetween(cx, cy - 4 * s, cx + 2 * s, cy - 6 * s);
  }
}

// ─── 井盖（地面贴片，仅水平缩放） ────────────────────────────────────────────
// 世界单位: 径14

function drawManhole(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const rx    = (p.width ?? 14) / 2 * s;
  const ry    = rx * 0.45;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });

  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + s, y + s, rx * 2.1, ry * 2.1);
  g.fillStyle(0x6a6a6a, 1);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(lineW, 0x101010, 0.92);
  g.strokeEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(0.5 * s, 0x1a1a1a, 0.8);
  g.strokeEllipse(x, y, rx * 1.55, ry * 1.55);

  // grate lines
  g.lineStyle(0.5 * s, 0x202020, 0.7);
  for (let i = -2; i <= 2; i++) {
    const ly   = y + i * (ry * 0.32);
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.lineBetween(x - half, ly, x + half, ly);
  }
}

// ─── 排水沟（地面贴片） ───────────────────────────────────────────────────────
// 世界单位: 长20, 宽6

function drawDrain(g, p) {
  const s     = p.scale ?? 1;
  const w     = (p.width ?? 20) * s;
  const h     = 6 * s;
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
  const slots = Math.max(3, Math.floor(w / (3 * s)));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.lineBetween(lx, py + s, lx, py + h - s);
  }
}

// ─── 椅子 ────────────────────────────────────────────────────────────────────
// 世界单位: 座高6, 靠背高14, 宽12

function drawChair(g, p) {
  const { x, y } = p;
  const s      = p.scale ?? 1;
  const d      = p.dir ?? 1;
  const seatH  = (p.seatH ?? 6) * s;
  const seatW  = 12 * s;
  const backH  = 14 * s;
  const seatY  = y - seatH;
  const seatX1 = x - seatW / 2;
  const seatX2 = x + seatW / 2;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x20, dark: 0x0a });

  // seat plank
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(seatX1, seatY, seatX2, seatY);

  // back rest (one side)
  const backX   = (d > 0) ? seatX1 : seatX2;
  const backTop = seatY - backH;
  g.lineBetween(backX, seatY, backX, backTop);
  g.lineBetween(backX - 2 * s * d, backTop, backX + 1 * s * d, backTop);

  // legs
  g.lineStyle(lw * 0.85, lc, 0.9);
  g.lineBetween(seatX1 + s, seatY, seatX1 + s, y);
  g.lineBetween(seatX2 - s, seatY, seatX2 - s, y);

  // seat highlight
  g.lineStyle(lw * 0.4, 0x303030, 0.6);
  g.lineBetween(seatX1 + s, seatY + s, seatX2 - s, seatY + s);
}

// ─── 棋桌 ────────────────────────────────────────────────────────────────────
// 世界单位: 高22, 面宽28

function drawChessTable(g, p) {
  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = (p.width ?? 28) * s;
  const topH = (p.topH ?? 22) * s;
  const th   = Math.min(8 * s, Math.max(5 * s, topH * 0.4));
  const topX = x - tw / 2;
  const topY = y - topH;
  const lw   = depthLineWidth(y);
  const lc   = depthLineColor(y, { light: 0x1a, dark: 0x0a });

  // table top face
  g.fillStyle(0xcfcfcf, 1);
  g.fillRect(topX, topY, tw, th);
  g.lineStyle(lw, lc, 0.95);
  g.strokeRect(topX, topY, tw, th);

  // highlight + grid on top
  g.lineStyle(lw * 0.5, 0xfafafa, 0.85);
  g.lineBetween(topX + s, topY + s, topX + tw - s, topY + s);
  g.lineStyle(lw * 0.55, lc, 0.85);
  for (let i = 1; i < 3; i++) {
    const lx = topX + (tw * i / 3);
    g.lineBetween(lx, topY + 2 * s, lx, topY + th - 2 * s);
  }
  for (let i = 1; i < 3; i++) {
    const ly = topY + 2 * s + (th - 4 * s) * i / 3;
    g.lineBetween(topX + 2 * s, ly, topX + tw - 2 * s, ly);
  }

  // legs
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(topX + s,       topY + th, topX + s,       y);
  g.lineBetween(topX + tw - s,  topY + th, topX + tw - s,  y);
  g.lineStyle(lw * 0.65, lc, 0.7);
  g.lineBetween(topX + tw * 0.3, topY + th, topX + tw * 0.3, y - s);
  g.lineBetween(topX + tw * 0.7, topY + th, topX + tw * 0.7, y - s);
}

// ─── 树木 ────────────────────────────────────────────────────────────────────
// 世界单位: crownR 从 p.crownR 读（默认35），trunk 从 y 向上延伸

function drawTree(g, p) {
  const { x, y } = p;
  const s       = p.scale ?? 1;
  const crownR  = (p.crownR ?? (p.width != null ? p.width / 2 : 35)) * s;
  const trunkH  = Math.max(2, 4 * s);   // minimal visible trunk below crown
  const lw      = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const c       = depthLineColor(y, { light: 0x78, dark: 0x24 });

  // ground shadow
  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x + crownR * 0.2, y + crownR * 0.3, crownR * 1.7, crownR * 0.6);

  // trunk stub
  g.lineStyle(Math.max(lw, 2 * s), c, 0.9);
  g.lineBetween(x, y, x, y - crownR * 0.4);

  // crown outline (lobed blob)
  const lobes = 6, steps = lobes * 4, pts = [];
  for (let i = 0; i < steps; i++) {
    const ang  = (i / steps) * Math.PI * 2;
    const lobe = 0.84 + 0.16 * Math.cos(ang * lobes);
    const nz   = 1 + 0.06 * Math.sin(x * 0.21 + i * 1.3);
    const rad  = crownR * lobe * nz;
    pts.push({ x: x + Math.cos(ang) * rad, y: (y - crownR * 0.5) + Math.sin(ang) * rad * 0.82 });
  }
  g.fillStyle(c, 0.08);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.fillPath();

  g.lineStyle(lw, c, 0.9);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.strokePath();

  // inner highlight lobe
  g.lineStyle(lw * 0.7, c, 0.5);
  g.strokeCircle(x - crownR * 0.3, (y - crownR * 0.5) - crownR * 0.15, crownR * 0.3);
}

// ─── 喷泉 ────────────────────────────────────────────────────────────────────
// 世界单位: 池径从 p.width 读（默认60）, 柱高30, 水盘宽20

function drawFountain(g, p) {
  const { x, y } = p;
  const s   = p.scale ?? 1;
  const rx  = (p.width ?? 60) / 2 * s;
  const ry  = rx * 0.42;
  const lw  = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const lc  = depthLineColor(y, { light: 0xbc, dark: 0x88 });

  // shadow
  g.fillStyle(0x000000, 0.04);
  g.fillEllipse(x, y + 4 * s, rx * 1.9, ry * 1.3);

  // pool rim
  g.fillStyle(0xe5e5e5, 1);
  g.fillEllipse(x, y, rx * 1.55, ry * 1.55);
  g.lineStyle(lw, lc, 0.7);
  g.strokeEllipse(x, y, rx * 1.2, ry * 1.2);

  // water surface
  g.fillStyle(0xd6d6d6, 0.9);
  g.fillEllipse(x + s, y - s, rx * 0.92, ry * 0.92);
  g.lineStyle(lw * 0.5, lc, 0.35);
  g.strokeEllipse(x - s, y, rx * 0.42, ry * 0.42);

  // center nozzle + water jet
  g.fillStyle(0xa8a8a8, 1);
  g.fillCircle(x, y - s, 2 * s);
  g.lineStyle(0.8 * s, 0xf0f0f0, 0.6);
  g.lineBetween(x, y - 2 * s, x, y - ry * 1.1);
}

// ─── 小摊 ────────────────────────────────────────────────────────────────────
// 世界单位: 宽从 p.width 读（默认100），棚高50，台面高25

function drawStall(g, p) {
  const { x, y } = p;
  const s       = p.scale ?? 1;
  const w       = (p.width ?? 100) * s;
  const roofH   = 50 * s;
  const ctrH    = 25 * s;
  const lineW   = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
  const lineC   = depthLineColor(y, { light: 0x38, dark: 0x08 });
  const px      = x - w / 2;
  const counterY = y - ctrH;

  // support poles
  g.lineStyle(lineW, lineC, 0.95);
  g.lineBetween(px + 2 * s, y, px + 2 * s, y - roofH);
  g.lineBetween(px + w - 2 * s, y, px + w - 2 * s, y - roofH);

  // awning
  const aY = y - roofH, aH = 6 * s;
  g.fillStyle(0x707070, 1);
  g.beginPath();
  g.moveTo(px, aY + aH); g.lineTo(px + w, aY + aH);
  g.lineTo(px + w + 3 * s, aY); g.lineTo(px - 3 * s, aY);
  g.closePath(); g.fillPath();
  g.lineStyle(lineW, lineC, 0.95); g.strokePath();

  // awning stripes
  g.lineStyle(0.5 * s, 0xdddddd, 0.7);
  for (let i = 1; i < Math.floor(w / (6 * s)); i++) {
    const sx = px - 3 * s + i * 6 * s;
    g.lineBetween(sx, aY, sx + 1.5 * s, aY + aH);
  }

  // counter surface
  g.fillStyle(0xc0c0c0, 1);
  g.fillRect(px + s, counterY, w - 2 * s, 4 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px + s, counterY, w - 2 * s, 4 * s);

  // items on counter
  g.fillStyle(0x9a9a9a, 1);
  const itemW = 4 * s, itemH = 3 * s;
  for (let i = 0; i < 3; i++) {
    const gx = px + 4 * s + i * ((w - 10 * s) / 2);
    g.fillRect(gx, counterY - itemH, itemW, itemH);
    g.lineStyle(0.4 * s, lineC, 0.85);
    g.strokeRect(gx, counterY - itemH, itemW, itemH);
  }
}

// ─── 自动售货机 ──────────────────────────────────────────────────────────────
// 世界单位: 宽从 p.width 读（默认20），高≈宽×2.75

function drawVending(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = (p.width ?? 20) * s;
  const h     = w * 2.75;
  const px    = x - w / 2, py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  // shadow
  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 4 * s);

  // cabinet
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(px, py, w, h);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py, w, h);

  // glass front
  const gx = px + 2 * s, gy = py + 2 * s, gw = w * 0.6, gh = h - 10 * s;
  g.fillStyle(0x3a3a3a, 0.6);
  g.fillRect(gx, gy, gw, gh);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(gx + s, gy + s, gw - 2 * s, gh * 0.4);
  g.lineStyle(0.5 * s, lineC, 0.8);
  g.strokeRect(gx, gy, gw, gh);

  // shelf lines
  g.lineStyle(0.4 * s, 0xcacaca, 0.6);
  for (let i = 1; i < 5; i++) {
    g.lineBetween(gx, gy + gh * i / 5, gx + gw, gy + gh * i / 5);
  }

  // side panel
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(px + gw + 3 * s, gy, w - gw - 5 * s, gh * 0.5);
  g.lineStyle(0.5 * s, lineC, 0.8);
  g.strokeRect(px + gw + 3 * s, gy, w - gw - 5 * s, gh * 0.5);

  // dispenser slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + 2 * s, py + h - 6 * s, w - 4 * s, 3 * s);
}

// ─── 电话亭 ──────────────────────────────────────────────────────────────────
// 世界单位: 宽从 p.width 读（默认20），高≈宽×3

function drawPhoneBooth(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = (p.width ?? 20) * s;
  const h     = w * 3;
  const px    = x - w / 2, py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  // shadow
  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 4 * s);

  // glass walls
  g.fillStyle(0x404040, 0.5);
  g.fillRect(px, py + 4 * s, w, h - 4 * s);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(px + s, py + 5 * s, w - 2 * s, (h - 4 * s) * 0.45);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 4 * s, w, h - 4 * s);

  // interior dividers
  g.lineStyle(0.5 * s, lineC, 0.7);
  g.lineBetween(px + w / 2, py + 5 * s, px + w / 2, y - s);
  g.lineBetween(px + 2 * s, py + (h - 4 * s) * 0.5 + 4 * s, px + w - 2 * s, py + (h - 4 * s) * 0.5 + 4 * s);

  // roof header
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(px - s, py, w + 2 * s, 5 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px - s, py, w + 2 * s, 5 * s);
  g.fillStyle(0xeaeaea, 0.9);
  g.fillRect(px + s, py + s, w - 2 * s, 2 * s);

  // handset silhouette
  g.fillStyle(0x202020, 0.7);
  g.fillRect(px + w - 5 * s, py + 10 * s, 2 * s, 6 * s);
}

// ─── 公交站顶棚（独立 PropEntity，参与 Y 排序）─────────────────────────────
// 几何为绝对坐标（roofTopY/pillarBottomY），旁边的尺寸乘 p.scale

function drawBusStopRoof(g, p) {
  const s  = p.scale ?? 1;
  const rX = p.x - p.roofW * s / 2;

  // roof panel
  g.fillStyle(0x686866, 1);
  g.fillRect(rX, p.roofTopY, p.roofW * s, p.roofH * s);
  g.lineStyle(1.6 * s, 0x181818, 1);
  g.strokeRect(rX, p.roofTopY, p.roofW * s, p.roofH * s);

  // support pillars
  const pillarT = p.roofTopY + p.roofH * s;
  g.lineStyle(2.5 * s, 0x282828, 1);
  g.lineBetween(p.x - p.pillarOffset * s, pillarT, p.x - p.pillarOffset * s, p.pillarBottomY);
  g.lineBetween(p.x + p.pillarOffset * s, pillarT, p.x + p.pillarOffset * s, p.pillarBottomY);
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
