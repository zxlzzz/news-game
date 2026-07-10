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

export function drawSign(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const sw = 43 * s, sh = 35 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;

  // No shadow (wall-mounted), no side/top (thin flat panel)

  // Front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(sx, sy, sw, sh);
  g.endFill();

  // Text lines — 0xffffff at low alpha
  g.lineStyle(1.7 * s, 0xffffff, 0.7);
  g.moveTo(sx + 9 * s,       sy + sh * 0.35); g.lineTo(sx + sw - 9 * s,  sy + sh * 0.35);
  g.moveTo(sx + 14 * s,      sy + sh * 0.65); g.lineTo(sx + sw - 14 * s, sy + sh * 0.65);

  // Hanger brackets
  lenv(g, p.y, 0.75);
  g.moveTo(sx + 11 * s,      sy); g.lineTo(sx + 11 * s,      sy - 9 * s);
  g.moveTo(sx + sw - 11 * s, sy); g.lineTo(sx + sw - 11 * s, sy - 9 * s);

  // Outline
  lenv(g, p.y, 0.85);
  g.drawRect(sx, sy, sw, sh);
}
