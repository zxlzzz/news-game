import {
  depthLineWidth, depthLineColor,
  FILL_MID,
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

  // 1. Roof front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(rX, rY, rW, rH);
  g.endFill();

  // 2. Support pillars
  const pillarT = rY + rH;
  const pOff    = 325 * s;
  lenv(g, rY, 1.2);
  g.moveTo(p.x - pOff, pillarT); g.lineTo(p.x - pOff, p.pillarBottomY);
  g.moveTo(p.x + pOff, pillarT); g.lineTo(p.x + pOff, p.pillarBottomY);

  // 3. Outline (last)
  lenv(g, rY, 0.85);
  g.drawRect(rX, rY, rW, rH);
}
