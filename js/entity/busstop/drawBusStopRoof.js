import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawBusStopRoof(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const rW = 800 * s, rH = 30 * s;
  const rX = p.x - rW / 2;
  const rY = p.roofTopY;

  const D  = 20 * s, DY = D * 0.6;   // capped depth

  // No ground shadow (elevated structure)

  // 1. Roof side — 深色材质, FILL_SHADE
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(rX + rW,     rY);
  g.lineTo(rX + rW + D, rY - DY);
  g.lineTo(rX + rW + D, rY + rH - DY);
  g.lineTo(rX + rW,     rY + rH);
  g.closePath();
  g.endFill();

  // 2. Roof front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(rX, rY, rW, rH);
  g.endFill();

  // 3. Roof top — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(rX,          rY);
  g.lineTo(rX + D,      rY - DY);
  g.lineTo(rX + rW + D, rY - DY);
  g.lineTo(rX + rW,     rY);
  g.closePath();
  g.endFill();

  // 4. Support pillars (lenv lines)
  const pillarT = rY + rH;
  const pOff    = 325 * s;
  lenv(g, rY, 1.2);
  g.moveTo(p.x - pOff, pillarT); g.lineTo(p.x - pOff, p.pillarBottomY);
  g.moveTo(p.x + pOff, pillarT); g.lineTo(p.x + pOff, p.pillarBottomY);

  // 5. Outline (last)
  lenv(g, rY, 0.85);
  g.drawRect(rX, rY, rW, rH);
}
