import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawTrash(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const topW = 40 * s, botW = 30 * s, h = 50 * s;
  const tx   = x - topW / 2;
  const bx   = x - botW / 2;

  // Lid dimensions
  const lidX0 = tx - 3 * s, lidX1 = tx + topW + 3 * s;
  const lidY  = y - h - 3 * s;

  // 1. Front — FILL_LIGHT (main trapezoid face)
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(tx,          y - h);
  g.lineTo(tx + topW,   y - h);
  g.lineTo(bx + botW,   y);
  g.lineTo(bx,          y);
  g.closePath();
  g.endFill();

  // 2. Lid front — FILL_LIGHT (thin overhang strip)
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(lidX0, lidY, lidX1 - lidX0, 3 * s);
  g.endFill();

  // 3. Groove details
  lenv(g, y, 0.5);
  g.moveTo(x - 6 * s,                        y - h + 6 * s);
  g.lineTo(x - 6 * s + (botW - topW) * 0.3,  y - 3 * s);
  g.moveTo(x + 6 * s,                        y - h + 6 * s);
  g.lineTo(x + 6 * s - (botW - topW) * 0.3,  y - 3 * s);

  // 4. Outlines (last)
  lenv(g, y, 0.85);
  g.moveTo(tx,        y - h);
  g.lineTo(tx + topW, y - h);
  g.lineTo(bx + botW, y);
  g.lineTo(bx,        y);
  g.closePath();
  lenv(g, y, 1.0);
  g.moveTo(lidX0, lidY); g.lineTo(lidX1, lidY);
}
