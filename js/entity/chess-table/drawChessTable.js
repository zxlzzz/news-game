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

export function drawChessTable(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = 58 * s, topH = 18 * s, th = 5 * s;   // th=5*s → ~20*s leg visible
  const topX = x - tw / 2;
  const topY = y - topH;

  // 1. Table legs (~20*s visible below table face)
  lenv(g, y, 1.0);
  g.moveTo(topX + 3 * s,       topY + th); g.lineTo(topX + 3 * s,       y);
  g.moveTo(topX + tw - 3 * s,  topY + th); g.lineTo(topX + tw - 3 * s,  y);
  lenv(g, y, 0.65);
  g.moveTo(topX + tw * 0.2, topY + th); g.lineTo(topX + tw * 0.2, y - 3 * s);
  g.moveTo(topX + tw * 0.8, topY + th); g.lineTo(topX + tw * 0.8, y - 3 * s);

  // 2. Table top face — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(topX, topY, tw, th);
  g.endFill();

  // 3. Grid lines (detail — 2 vertical dividers across thin face)
  lenv(g, y, 0.55);
  for (let i = 1; i < 3; i++) {
    const lx = topX + tw * i / 3;
    g.moveTo(lx, topY); g.lineTo(lx, topY + th);
  }

  // 4. Outline (last)
  lenv(g, y, 0.85);
  g.drawRect(topX, topY, tw, th);
}
