import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT, FILL_MID,
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

export function drawChessTable(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = 58 * s, topH = 25 * s, th = 20 * s;
  const topX = x - tw / 2;
  const topY = y - topH;

  const D  = tw * 0.2, DY = D * 0.6;

  // 0. Ground shadow
  drawGroundShadow(g, x, y, tw / 2, tw / 2 * 0.3);

  // 1. Table legs (structural lines, behind fills)
  lenv(g, y, 1.0);
  g.moveTo(topX + 3 * s,       topY + th); g.lineTo(topX + 3 * s,       y);
  g.moveTo(topX + tw - 3 * s,  topY + th); g.lineTo(topX + tw - 3 * s,  y);
  lenv(g, y, 0.65);
  g.moveTo(topX + tw * 0.2, topY + th); g.lineTo(topX + tw * 0.2, y - 3 * s);
  g.moveTo(topX + tw * 0.8, topY + th); g.lineTo(topX + tw * 0.8, y - 3 * s);

  // 2. Table top — 浅色材质, side = FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(topX + tw,     topY);
  g.lineTo(topX + tw + D, topY - DY);
  g.lineTo(topX + tw + D, topY + th - DY);
  g.lineTo(topX + tw,     topY + th);
  g.closePath();
  g.endFill();

  // Front — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(topX, topY, tw, th);
  g.endFill();

  // Top — FILL_PAPER
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(topX,          topY);
  g.lineTo(topX + D,      topY - DY);
  g.lineTo(topX + tw + D, topY - DY);
  g.lineTo(topX + tw,     topY);
  g.closePath();
  g.endFill();

  // 3. Inner frame line (detail)
  lenv(g, y, 0.5);
  g.drawRect(topX + 4 * s, topY + 4 * s, tw - 8 * s, th - 8 * s);

  // 4. Grid lines (detail)
  lenv(g, y, 0.55);
  for (let i = 1; i < 3; i++) {
    const lx = topX + tw * i / 3;
    g.moveTo(lx, topY + 6 * s); g.lineTo(lx, topY + th - 6 * s);
  }
  for (let i = 1; i < 3; i++) {
    const ly = topY + 4.5 * s + (3 + th - 12 * s) * i / 3;
    g.moveTo(topX + 6 * s, ly); g.lineTo(topX + tw - 6 * s, ly);
  }

  // 5. Outline (last)
  lenv(g, y, 0.85);
  g.drawRect(topX, topY, tw, th);
}
