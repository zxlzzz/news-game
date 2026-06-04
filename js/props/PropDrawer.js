import { depthLineWidth, depthLineColor, NEAR_Y } from '../SceneConfig.js';

function toGrayBand(color, lightVal, darkVal) {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b =  color        & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const v   = Math.round(lightVal + (lum / 255) * (darkVal - lightVal));
  return (v << 16) | (v << 8) | v;
}

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

function drawLamp(g, p) {
  const { x, y } = p;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x6a, dark: 0x1f });
  if (y < NEAR_Y) {
    g.lineStyle(lw, lc, 0.95);
    g.lineBetween(x, y + 16, x, y - 35);
    g.lineStyle(lw * 0.85, lc, 0.9);
    g.lineBetween(x, y - 35, x + 18, y - 32);
    g.fillStyle(0xf0f0f0, 1);
    g.fillRect(x + 15, y - 34, 7, 7);
    g.lineStyle(lw * 0.75, 0x202020, 1);
    g.strokeRect(x + 15, y - 34, 7, 7);
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(x - 1.5, y + 14, 4, 4);
  } else {
    g.lineStyle(lw * 1.25, lc, 1);
    g.lineBetween(x, y - 66, x, y + 12);
    g.lineStyle(lw, lc, 1);
    g.lineBetween(x, y - 66, x - 24, y - 54);
    g.fillStyle(0xfafafa, 1);
    g.fillRect(x - 29, y - 58, 10, 10);
    g.lineStyle(lw * 0.8, 0x101010, 1);
    g.strokeRect(x - 29, y - 58, 10, 10);
    g.lineStyle(lw * 0.35, 0xa0a0a0, 0.85);
    g.lineBetween(x - 27, y - 53, x - 21, y - 53);
    g.fillStyle(0x101010, 1);
    g.fillRect(x - 3, y + 10, 6, 5);
  }
}

function drawBench(g, p) {
  const { x, y } = p;
  const f = p.facing || 'down';
  const L = p.width || 90;
  const half = L / 2;
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
    if (sw) { g.lineStyle(sw, lineC, 0.9); g.strokeRect(rx, ry, rw, rh); }
  };
  const line = (u0, w0, u1, w1, lw, al) => {
    const a = P(u0, w0), b = P(u1, w1);
    g.lineStyle(lw, lineC, al ?? 0.9);
    g.lineBetween(a[0], a[1], b[0], b[1]);
  };

  g.fillStyle(0x000000, 0.10);
  if (f === 'left' || f === 'right') g.fillEllipse(x, y, 12, L * 1.05);
  else                               g.fillEllipse(x, y, L * 1.05, 8);

  line(-(half - 5), -6, -(half - 5), 0, lineW, 0.95);
  line( (half - 5), -6,  (half - 5), 0, lineW, 0.95);
  line(-(half - 11), -6, -(half - 11), -0.5, lineW * 0.85, 0.85);
  line( (half - 11), -6,  (half - 11), -0.5, lineW * 0.85, 0.85);
  line(-(half - 5), -3, (half - 5), -3, lineW * 0.7, 0.8);

  const n = 4, sw = (L - 6) / n;
  for (let i = 0; i < n; i++) {
    const u0 = -half + 3 + i * sw;
    const shade = 0xe0e0e0 - i * 0x0a0a0a;
    rect(u0, -12, u0 + sw - 1.5, -6, shade, 0.95, lineW * 0.8);
  }

  rect(-half + 4, -24, half - 4, -20, 0xd2d2d2, 0.92, lineW * 0.85);
  for (let i = 0; i <= 4; i++) {
    const u = -half + 4 + (L - 8) * i / 4;
    line(u, -20, u + 2, -12, lineW * 0.7, 0.85);
  }

  for (const s of [-1, 1]) {
    const u = s * (half - 3);
    line(u, -13, u, -9, lineW * 0.85, 0.9);
    line(u, -9, u - s * 3, -7, lineW * 0.85, 0.9);
  }
}

function drawTrash(g, p) {
  const { x, y } = p;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x10 });
  const topW = 12, botW = 9, h = 13;
  const tx = x - topW / 2;
  const bx = x - botW / 2;
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
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(tx - 1, y - h - 1, tx + topW + 1, y - h - 1);
  g.lineStyle(0.5, lineC, 0.6);
  g.lineBetween(x - 2, y - h + 2, x - 2 + (botW - topW) * 0.3, y - 1);
  g.lineBetween(x + 2, y - h + 2, x + 2 - (botW - topW) * 0.3, y - 1);
}

function drawSign(g, p) {
  const sw = p.width;
  const sh = 14;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;
  const fill = toGrayBand(p.propColor, 0xa8, 0x60);
  g.fillStyle(fill, 0.95);
  g.fillRect(sx, sy, sw, sh);
  g.lineStyle(0.6, 0xfafafa, 0.8);
  g.lineBetween(sx + 3, sy + sh * 0.35, sx + sw - 3, sy + sh * 0.35);
  g.lineBetween(sx + 5, sy + sh * 0.65, sx + sw - 5, sy + sh * 0.65);
  g.lineStyle(0.8, 0x000000, 0.7);
  g.strokeRect(sx, sy, sw, sh);
  g.lineStyle(0.5, 0x303030, 0.7);
  g.lineBetween(sx + 4,      sy, sx + 4,      sy - 3);
  g.lineBetween(sx + sw - 4, sy, sx + sw - 4, sy - 3);
}

function drawNewsRack(g, p) {
  const { x, y } = p;
  const w = 12, h = 17;
  const px = x - w / 2;
  const py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
  g.fillStyle(0xb8b8b8, 0.95);
  g.fillRect(px, py + 4, w, h - 4);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 4, w, h - 4);
  g.fillStyle(0xeaeaea, 0.95);
  g.fillRect(px + 1, py + 5, w - 2, 6);
  g.lineStyle(0.5, lineC, 0.8);
  g.strokeRect(px + 1, py + 5, w - 2, 6);
  g.lineStyle(0.5, lineC, 0.85);
  g.lineBetween(px + 2, py + 7,  px + w - 2, py + 7);
  g.lineBetween(px + 2, py + 8.5, px + w - 2, py + 8.5);
  g.lineBetween(px + 2, py + 10, px + w - 4, py + 10);
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + w / 2 - 2, py + h - 4, 4, 1);
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(px - 1, py + 2, w + 2, 2);
  g.lineStyle(lineW * 0.9, lineC, 0.95);
  g.strokeRect(px - 1, py + 2, w + 2, 2);
  g.lineStyle(lineW, lineC, 0.9);
  g.lineBetween(px + 2,     py + h, px + 2,     py + h + 3);
  g.lineBetween(px + w - 2, py + h, px + w - 2, py + h + 3);
}

function drawHydrant(g, p) {
  const { x, y } = p;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(x - 4, y - 2, 8, 2);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 4, y - 2, 8, 2);
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(x - 3, y - 9, 6, 7);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 3, y - 9, 6, 7);
  g.fillStyle(0xa0a0a0, 1);
  g.beginPath();
  g.moveTo(x - 2, y - 12);
  g.lineTo(x + 2, y - 12);
  g.lineTo(x + 3, y - 9);
  g.lineTo(x - 3, y - 9);
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(x - 1, y - 13, 2, 1.5);
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 6, y - 7, 3, 2);
  g.fillRect(x + 3, y - 7, 3, 2);
  g.lineStyle(0.5, lineC, 0.85);
  g.strokeRect(x - 6, y - 7, 3, 2);
  g.strokeRect(x + 3, y - 7, 3, 2);
}

function drawMailbox(g, p) {
  const { x, y } = p;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(x, y, x, y - 8);
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(x - 6, y - 16, 12, 8);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 6, y - 16, 12, 8);
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 7, y - 18, 14, 2);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 7, y - 18, 14, 2);
  g.fillStyle(0x101010, 0.9);
  g.fillRect(x - 4, y - 13, 8, 1.5);
  g.lineStyle(0.5, 0xfafafa, 0.85);
  g.lineBetween(x - 3, y - 10.5, x, y - 9);
  g.lineBetween(x,     y - 9,    x + 3, y - 10.5);
}

function drawPlanter(g, p) {
  const w = p.width || 30;
  const h = 9;
  const px = p.x - w / 2;
  const py = p.y - h;
  const lineW = depthLineWidth(p.y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(p.y, { light: 0x40, dark: 0x10 });
  g.fillStyle(0xb4b4b4, 1);
  g.fillRect(px, py + 3, w, h - 3);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py + 3, w, h - 3);
  g.lineStyle(0.4, lineC, 0.6);
  const segs = Math.max(2, Math.floor(w / 8));
  for (let i = 1; i < segs; i++) {
    const lx = px + (w * i / segs);
    g.lineBetween(lx, py + 3, lx, py + h);
  }
  const clumps = Math.max(2, Math.floor(w / 9));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 4 + i * (w - 8) / Math.max(1, clumps - 1);
    const cy = py + 2;
    g.lineStyle(lineW * 0.9, lineC, 0.85);
    g.lineBetween(cx, cy + 2, cx, cy - 4);
    g.lineBetween(cx, cy - 2, cx - 3, cy - 5);
    g.lineBetween(cx, cy - 2, cx + 3, cy - 5);
    g.lineBetween(cx, cy - 4, cx - 2, cy - 6);
    g.lineBetween(cx, cy - 4, cx + 2, cy - 6);
  }
}

function drawManhole(g, p) {
  const { x, y } = p;
  const rx = (p.width || 18) / 2;
  const ry = rx * 0.45;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + 1, y + 1, rx * 2.1, ry * 2.1);
  g.fillStyle(0x6a6a6a, 1);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(lineW, 0x101010, 0.92);
  g.strokeEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(0.5, 0x1a1a1a, 0.8);
  g.strokeEllipse(x, y, rx * 1.55, ry * 1.55);
  g.lineStyle(0.5, 0x202020, 0.7);
  for (let i = -2; i <= 2; i++) {
    const ly = y + i * (ry * 0.32);
    const t  = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.lineBetween(x - half, ly, x + half, ly);
  }
}

function drawChair(g, p) {
  const x = p.x, y = p.y;
  const d = p.dir;
  const seatH = p.seatH ?? 14;
  const seatW = 14;
  const seatY = y - seatH;
  const seatX1 = x - seatW / 2;
  const seatX2 = x + seatW / 2;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x20, dark: 0x0a });
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(seatX1, seatY, seatX2, seatY);
  const backX = (d > 0) ? seatX1 : seatX2;
  const backTop = seatY - seatH * 0.7;
  g.lineBetween(backX, seatY, backX, backTop);
  g.lineBetween(backX - 2 * d, backTop, backX + 1 * d, backTop);
  g.lineStyle(lw * 0.85, lc, 0.9);
  g.lineBetween(seatX1 + 1, seatY, seatX1 + 1, y);
  g.lineBetween(seatX2 - 1, seatY, seatX2 - 1, y);
  g.lineStyle(lw * 0.4, 0x303030, 0.6);
  g.lineBetween(seatX1 + 1, seatY + 1, seatX2 - 1, seatY + 1);
}

function drawChessTable(g, p) {
  const tw = p.width || 22;
  const x = p.x, y = p.y;
  const topH = p.topH ?? 18;
  const th = Math.min(8, Math.max(5, topH * 0.4));
  const topX = x - tw / 2;
  const topY = y - topH;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x1a, dark: 0x0a });
  g.fillStyle(0xcfcfcf, 1);
  g.fillRect(topX, topY, tw, th);
  g.lineStyle(lw, lc, 0.95);
  g.strokeRect(topX, topY, tw, th);
  g.lineStyle(lw * 0.5, 0xfafafa, 0.85);
  g.lineBetween(topX + 1, topY + 1, topX + tw - 1, topY + 1);
  g.lineStyle(lw * 0.55, lc, 0.85);
  for (let i = 1; i < 3; i++) {
    const lx = topX + (tw * i / 3);
    g.lineBetween(lx, topY + 2, lx, topY + th - 2);
  }
  for (let i = 1; i < 3; i++) {
    const ly = topY + 2 + (th - 4) * i / 3;
    g.lineBetween(topX + 2, ly, topX + tw - 2, ly);
  }
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(topX + 1,      topY + th, topX + 1,      y);
  g.lineBetween(topX + tw - 1, topY + th, topX + tw - 1, y);
  g.lineStyle(lw * 0.65, lc, 0.7);
  g.lineBetween(topX + tw * 0.3, topY + th, topX + tw * 0.3, y - 1);
  g.lineBetween(topX + tw * 0.7, topY + th, topX + tw * 0.7, y - 1);
}

function drawTree(g, p) {
  const { x, y } = p;
  const r  = (p.width || 22) / 2;
  const lw = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const c  = depthLineColor(y, { light: 0x78, dark: 0x24 });
  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x + r * 0.2, y + r * 0.3, r * 1.7, r * 0.6);
  const lobes = 6, steps = lobes * 4, pts = [];
  for (let i = 0; i < steps; i++) {
    const ang  = (i / steps) * Math.PI * 2;
    const lobe = 0.84 + 0.16 * Math.cos(ang * lobes);
    const nz   = 1 + 0.06 * Math.sin(x * 0.21 + i * 1.3);
    const rad  = r * lobe * nz;
    pts.push({ x: x + Math.cos(ang) * rad, y: y + Math.sin(ang) * rad * 0.82 });
  }
  g.fillStyle(c, 0.08);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.fillPath();
  g.lineStyle(lw, c, 0.9);
  g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < steps; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath(); g.strokePath();
  g.lineStyle(lw * 0.7, c, 0.5);
  g.strokeCircle(x - r * 0.3, y - r * 0.15, r * 0.3);
  g.lineStyle(lw * 1.1, c, 0.9);
  g.lineBetween(x - 1.5, y, x + 1.5, y);
  g.lineBetween(x, y - 1.5, x, y + 1.5);
}

function drawDrain(g, p) {
  const w = p.width || 18;
  const h = 6;
  const px = p.x - w / 2;
  const py = p.y - h / 2;
  const lw = depthLineWidth(p.y, { wMin: 0.7, wMax: 1.4 });
  const lc = depthLineColor(p.y, { light: 0x10, dark: 0x08 });
  g.fillStyle(0x707070, 1);
  g.fillRect(px, py, w, h);
  g.lineStyle(lw, lc, 0.9);
  g.strokeRect(px, py, w, h);
  g.lineStyle(lw * 0.65, lc, 0.85);
  const slots = Math.max(3, Math.floor(w / 3));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.lineBetween(lx, py + 1, lx, py + h - 1);
  }
}

function drawFountain(g, p) {
  const { x, y } = p;
  const rx = (p.width || 60) / 2;
  const ry = rx * 0.42;
  const lw = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const lc = depthLineColor(y, { light: 0xbc, dark: 0x88 });
  g.fillStyle(0x000000, 0.04);
  g.fillEllipse(x, y + 4, rx * 1.9, ry * 1.3);
  g.fillStyle(0xe5e5e5, 1);
  g.fillEllipse(x, y, rx * 1.55, ry * 1.55);
  g.lineStyle(lw, lc, 0.7);
  g.strokeEllipse(x, y, rx * 1.2, ry * 1.2);
  g.fillStyle(0xd6d6d6, 0.9);
  g.fillEllipse(x + 1, y - 1, rx * 0.92, ry * 0.92);
  g.lineStyle(lw * 0.5, lc, 0.35);
  g.strokeEllipse(x - 1, y, rx * 0.42, ry * 0.42);
  g.fillStyle(0xa8a8a8, 1);
  g.fillCircle(x, y - 1, 2);
  g.lineStyle(0.8, 0xf0f0f0, 0.6);
  g.lineBetween(x, y - 2, x, y - ry * 1.1);
}

function drawVending(g, p) {
  const { x, y } = p;
  const w = p.width || 16, h = w * 1.7;
  const px = x - w / 2, py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });
  g.fillStyle(0x000000, 0.10); g.fillEllipse(x, y, w * 1.1, 4);
  g.fillStyle(0xb0b0b0, 1); g.fillRect(px, py, w, h);
  g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px, py, w, h);
  const gx = px + 2, gy = py + 2, gw = w * 0.6, gh = h - 10;
  g.fillStyle(0x3a3a3a, 0.6); g.fillRect(gx, gy, gw, gh);
  g.fillStyle(0xffffff, 0.18); g.fillRect(gx + 1, gy + 1, gw - 2, gh * 0.4);
  g.lineStyle(0.5, lineC, 0.8); g.strokeRect(gx, gy, gw, gh);
  g.lineStyle(0.4, 0xcacaca, 0.6);
  for (let i = 1; i < 5; i++) g.lineBetween(gx, gy + gh * i / 5, gx + gw, gy + gh * i / 5);
  g.fillStyle(0x8a8a8a, 1); g.fillRect(px + gw + 3, gy, w - gw - 5, gh * 0.5);
  g.lineStyle(0.5, lineC, 0.8); g.strokeRect(px + gw + 3, gy, w - gw - 5, gh * 0.5);
  g.fillStyle(0x101010, 0.9); g.fillRect(px + 2, py + h - 6, w - 4, 3);
}

function drawPhoneBooth(g, p) {
  const { x, y } = p;
  const w = p.width || 16, h = w * 2.1;
  const px = x - w / 2, py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });
  g.fillStyle(0x000000, 0.10); g.fillEllipse(x, y, w * 1.1, 4);
  g.fillStyle(0x404040, 0.5); g.fillRect(px, py + 4, w, h - 4);
  g.fillStyle(0xffffff, 0.16); g.fillRect(px + 1, py + 5, w - 2, (h - 4) * 0.45);
  g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px, py + 4, w, h - 4);
  g.lineStyle(0.5, lineC, 0.7);
  g.lineBetween(px + w / 2, py + 5, px + w / 2, y - 1);
  g.lineBetween(px + 2, py + (h - 4) * 0.5, px + w - 2, py + (h - 4) * 0.5);
  g.fillStyle(0x6a6a6a, 1); g.fillRect(px - 1, py, w + 2, 5);
  g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px - 1, py, w + 2, 5);
  g.fillStyle(0xeaeaea, 0.9); g.fillRect(px + 1, py + 1, w - 2, 2);
  g.fillStyle(0x202020, 0.7); g.fillRect(px + w - 5, py + 10, 2, 6);
}

// 公交站上半部分（顶棚 + 柱子，独立 PropEntity，参与 Y 排序，遮挡后方 NPC）。
// 几何为绝对坐标：roofTopY 顶棚顶边、pillarBottomY 柱子底端，远/近端画法一致。
function drawBusStopRoof(g, p) {
  const rX = p.x - p.roofW / 2;
  // 顶棚
  g.fillStyle(0x686866, 1);
  g.fillRect(rX, p.roofTopY, p.roofW, p.roofH);
  g.lineStyle(1.6, 0x181818, 1);
  g.strokeRect(rX, p.roofTopY, p.roofW, p.roofH);
  // 柱子
  const pillarT = p.roofTopY + p.roofH;
  g.lineStyle(2.5, 0x282828, 1);
  g.lineBetween(p.x - p.pillarOffset, pillarT, p.x - p.pillarOffset, p.pillarBottomY);
  g.lineBetween(p.x + p.pillarOffset, pillarT, p.x + p.pillarOffset, p.pillarBottomY);
}

function drawStall(g, p) {
  const { x, y } = p;
  const w = p.width || 36;
  const h = w * 0.78;
  const lineW = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
  const lineC = depthLineColor(y, { light: 0x38, dark: 0x08 });
  const px = x - w / 2;
  const counterY = y - h * 0.42;
  g.lineStyle(lineW, lineC, 0.95);
  g.lineBetween(px + 2, y, px + 2, y - h);
  g.lineBetween(px + w - 2, y, px + w - 2, y - h);
  const aY = y - h, aH = 6;
  g.fillStyle(0x707070, 1);
  g.beginPath();
  g.moveTo(px, aY + aH); g.lineTo(px + w, aY + aH);
  g.lineTo(px + w + 3, aY); g.lineTo(px - 3, aY);
  g.closePath(); g.fillPath();
  g.lineStyle(lineW, lineC, 0.95); g.strokePath();
  g.lineStyle(0.5, 0xdddddd, 0.7);
  for (let i = 1; i < Math.floor(w / 6); i++) {
    const sx = px - 3 + i * 6; g.lineBetween(sx, aY, sx + 1.5, aY + aH);
  }
  g.fillStyle(0xc0c0c0, 1); g.fillRect(px + 1, counterY, w - 2, 4);
  g.lineStyle(lineW, lineC, 0.95); g.strokeRect(px + 1, counterY, w - 2, 4);
  g.fillStyle(0x9a9a9a, 1);
  for (let i = 0; i < 3; i++) {
    const gx = px + 4 + i * ((w - 10) / 2);
    g.fillRect(gx, counterY - 3, 4, 3);
    g.lineStyle(0.4, lineC, 0.85); g.strokeRect(gx, counterY - 3, 4, 3);
  }
}
