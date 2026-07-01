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

export function drawSign(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const sw = 43 * s, sh = 35 * s;
  const sx = p.x - sw / 2;
  const sy = p.y - sh;

  const D  = sw * 0.2, DY = D * 0.6;

  // No ground shadow (wall-mounted)

  // 1. Side — 深色材质, FILL_SHADE
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(sx + sw,     sy);
  g.lineTo(sx + sw + D, sy - DY);
  g.lineTo(sx + sw + D, sy + sh - DY);
  g.lineTo(sx + sw,     sy + sh);
  g.closePath();
  g.endFill();

  // 2. Front — FILL_MID
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(sx, sy, sw, sh);
  g.endFill();

  // 3. Top — FILL_LIGHT
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(sx,           sy);
  g.lineTo(sx + D,       sy - DY);
  g.lineTo(sx + sw + D,  sy - DY);
  g.lineTo(sx + sw,      sy);
  g.closePath();
  g.endFill();

  // 4. Text lines — 0xffffff at low alpha (light marks on dark face)
  g.lineStyle(1.7 * s, 0xffffff, 0.7);
  g.moveTo(sx + 9 * s,       sy + sh * 0.35); g.lineTo(sx + sw - 9 * s,  sy + sh * 0.35);
  g.moveTo(sx + 14 * s,      sy + sh * 0.65); g.lineTo(sx + sw - 14 * s, sy + sh * 0.65);

  // 5. Hanger brackets (lenv)
  lenv(g, p.y, 0.75);
  g.moveTo(sx + 11 * s,      sy); g.lineTo(sx + 11 * s,      sy - 9 * s);
  g.moveTo(sx + sw - 11 * s, sy); g.lineTo(sx + sw - 11 * s, sy - 9 * s);

  // 6. Outline (last)
  lenv(g, p.y, 0.85);
  g.drawRect(sx, sy, sw, sh);
}
