import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

function drawGroundShadow(g, cx, cy, rx, ry) {
  const ox = rx * 0.15, oy = ry * 0.25;
  const sx = cx + ox,   sy = cy + oy;
  g.lineStyle(0);
  g.beginFill(0x000000, 0.03); g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6); g.endFill();
  g.beginFill(0x000000, 0.05); g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3); g.endFill();
  g.beginFill(0x000000, 0.08); g.drawEllipse(sx, sy, rx,       ry);       g.endFill();
}

export function drawNewsRack(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 70 * s, h = 86 * s;
  const px = x - w / 2, py = y - h;

  // Body block
  const bpx = px, bpy = py + 17 * s, bw = w, bh = h - 17 * s;
  const Db  = bw * 0.2, DbY = Db * 0.6;

  // Header block
  const hpx = px - 3 * s, hpy = py + 6 * s, hw = w + 6 * s, hh = 11 * s;
  const Dh  = hw * 0.2, DhY = Dh * 0.6;

  // 0. Ground shadow
  drawGroundShadow(g, x, y, w / 2, w / 2 * 0.3);

  // === Body block — 浅色材质 ===
  // Side
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(bpx + bw,      bpy);
  g.lineTo(bpx + bw + Db, bpy - DbY);
  g.lineTo(bpx + bw + Db, bpy + bh - DbY);
  g.lineTo(bpx + bw,      bpy + bh);
  g.closePath();
  g.endFill();

  // Side texture — shelf/paper edge lines
  lenv(g, y, 0.35);
  for (let i = 1; i <= 3; i++) {
    const t   = i / 4;
    const yFr = bpy + bh * t;
    const yBk = yFr - DbY * (1 - t);
    g.moveTo(bpx + bw,      yFr);
    g.lineTo(bpx + bw + Db, yBk);
  }

  // Front
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bpx, bpy, bw, bh);
  g.endFill();

  // Glass window — FILL_PAPER at low alpha
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.5);
  g.drawRect(bpx + 3 * s, bpy + 3 * s, bw - 6 * s, 26 * s);
  g.endFill();

  // Top
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(bpx,            bpy);
  g.lineTo(bpx + Db,       bpy - DbY);
  g.lineTo(bpx + bw + Db,  bpy - DbY);
  g.lineTo(bpx + bw,       bpy);
  g.closePath();
  g.endFill();

  // Body details
  lenv(g, y, 0.6);
  g.moveTo(bpx + 6 * s,       bpy + 9 * s);  g.lineTo(bpx + bw - 6 * s,  bpy + 9 * s);
  g.moveTo(bpx + 6 * s,       bpy + 15 * s); g.lineTo(bpx + bw - 6 * s,  bpy + 15 * s);
  g.moveTo(bpx + 6 * s,       bpy + 21 * s); g.lineTo(bpx + bw - 11 * s, bpy + 21 * s);

  g.lineStyle(0);
  g.beginFill(0x000000, 0.6);
  g.drawRect(bpx + bw / 2 - 6 * s, bpy + bh - 14 * s, 11 * s, 3 * s);
  g.endFill();

  lenv(g, y, 0.9);
  g.moveTo(bpx + 6 * s,      y); g.lineTo(bpx + 6 * s,      y + 9 * s);
  g.moveTo(bpx + bw - 6 * s, y); g.lineTo(bpx + bw - 6 * s, y + 9 * s);

  // Body outline
  lenv(g, y, 0.85);
  g.drawRect(bpx, bpy, bw, bh);

  // === Header block — 深色材质 ===
  // Side
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(hpx + hw,      hpy);
  g.lineTo(hpx + hw + Dh, hpy - DhY);
  g.lineTo(hpx + hw + Dh, hpy + hh - DhY);
  g.lineTo(hpx + hw,      hpy + hh);
  g.closePath();
  g.endFill();

  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(hpx, hpy, hw, hh);
  g.endFill();

  // Top
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(hpx,            hpy);
  g.lineTo(hpx + Dh,       hpy - DhY);
  g.lineTo(hpx + hw + Dh,  hpy - DhY);
  g.lineTo(hpx + hw,       hpy);
  g.closePath();
  g.endFill();

  // Header outline
  lenv(g, hpy, 0.85);
  g.drawRect(hpx, hpy, hw, hh);
}
