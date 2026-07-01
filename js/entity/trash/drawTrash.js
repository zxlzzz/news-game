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

export function drawTrash(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const topW = 40 * s, botW = 30 * s, h = 50 * s;
  const tx   = x - topW / 2;
  const bx   = x - botW / 2;

  const D  = topW * 0.2;   // 8*s
  const DY = D * 0.6;      // 4.8*s

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, (topW / 2 + 3 * s) * 1.1, (topW / 2 + 3 * s) * 0.33);
  g.endFill();

  // 1. Side — FILL_MID (right edge trapezoid strip)
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(tx + topW,     y - h);
  g.lineTo(tx + topW + D, y - h - DY);
  g.lineTo(bx + botW + D, y      - DY);
  g.lineTo(bx + botW,     y);
  g.closePath();
  g.endFill();

  // 2. Front — FILL_LIGHT (main trapezoid face)
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(tx,          y - h);
  g.lineTo(tx + topW,   y - h);
  g.lineTo(bx + botW,   y);
  g.lineTo(bx,          y);
  g.closePath();
  g.endFill();

  // 3. Lid top — FILL_PAPER (parallelogram along lid top edge)
  const lidX0 = tx - 3 * s, lidX1 = tx + topW + 3 * s;
  const lidY  = y - h - 3 * s;
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(lidX0,      lidY);
  g.lineTo(lidX0 + D,  lidY - DY);
  g.lineTo(lidX1 + D,  lidY - DY);
  g.lineTo(lidX1,      lidY);
  g.closePath();
  g.endFill();

  // 4. Lid front — FILL_LIGHT (thin strip)
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(lidX0, lidY, lidX1 - lidX0, 3 * s);
  g.endFill();

  // 5. Groove details
  lenv(g, y, 0.5);
  g.moveTo(x - 6 * s,                        y - h + 6 * s);
  g.lineTo(x - 6 * s + (botW - topW) * 0.3,  y - 3 * s);
  g.moveTo(x + 6 * s,                        y - h + 6 * s);
  g.lineTo(x + 6 * s - (botW - topW) * 0.3,  y - 3 * s);

  // 6. Outlines (last)
  lenv(g, y, 0.85);
  g.moveTo(tx,        y - h);
  g.lineTo(tx + topW, y - h);
  g.lineTo(bx + botW, y);
  g.lineTo(bx,        y);
  g.closePath();
  lenv(g, y, 1.0);
  g.moveTo(lidX0, lidY); g.lineTo(lidX1, lidY);
}
