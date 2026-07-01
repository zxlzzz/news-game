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

export function drawMailbox(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s           = p.scale ?? 1;
  const extraHeight = 20 * s;

  // 0. Ground shadow
  drawGroundShadow(g, x, y, 20 * s, 20 * s * 0.3);

  // Post (structural line, behind fills)
  lenv(g, y, 1.1);
  g.moveTo(x, y); g.lineTo(x, y - 29 * s - extraHeight);

  // === Box body block — 深色材质 ===
  const bw = 40 * s, bh = 35 * s;
  const bx = x - bw / 2, by = y - 64 * s - extraHeight;
  const Db = bw * 0.2, DbY = Db * 0.6;

  // Side
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(bx + bw,      by);
  g.lineTo(bx + bw + Db, by - DbY);
  g.lineTo(bx + bw + Db, by + bh - DbY);
  g.lineTo(bx + bw,      by + bh);
  g.closePath();
  g.endFill();
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(bx, by, bw, bh);
  g.endFill();
  // Mail slot (detail on front)
  g.lineStyle(0);
  g.beginFill(0x000000, 0.6);
  g.drawRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  g.endFill();
  // Top
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(bx,           by);
  g.lineTo(bx + Db,      by - DbY);
  g.lineTo(bx + bw + Db, by - DbY);
  g.lineTo(bx + bw,      by);
  g.closePath();
  g.endFill();
  // Outline
  lenv(g, y, 0.85);
  g.drawRect(bx, by, bw, bh);

  // === Cap block — 浅色材质 ===
  const cw = 46 * s, ch = 9 * s;
  const cx = x - cw / 2, cy = y - 72 * s - extraHeight;
  const Dc = cw * 0.15, DcY = Dc * 0.6;   // reduced depth (0.15 instead of 0.2)

  // Side
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(cx + cw,      cy);
  g.lineTo(cx + cw + Dc, cy - DcY);
  g.lineTo(cx + cw + Dc, cy + ch - DcY);
  g.lineTo(cx + cw,      cy + ch);
  g.closePath();
  g.endFill();
  // Front
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(cx, cy, cw, ch);
  g.endFill();
  // Top
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(cx,           cy);
  g.lineTo(cx + Dc,      cy - DcY);
  g.lineTo(cx + cw + Dc, cy - DcY);
  g.lineTo(cx + cw,      cy);
  g.closePath();
  g.endFill();
  // Outline
  lenv(g, cy, 0.85);
  g.drawRect(cx, cy, cw, ch);

  // Flag detail
  lenv(g, y, 0.6);
  g.moveTo(x - 9 * s, y - 40 * s - extraHeight);
  g.lineTo(x,         y - 37 * s - extraHeight);
  g.moveTo(x,         y - 37 * s - extraHeight);
  g.lineTo(x + 9 * s, y - 40 * s - extraHeight);
}
