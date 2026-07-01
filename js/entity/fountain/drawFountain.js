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

export function drawFountain(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const rx = 300 * s;
  const ry = rx * 0.5;

  const outerRx = rx * 0.775, outerRy = ry * 0.775;
  const rimRx   = rx * 0.70,  rimRy   = ry * 0.70;
  const waterRx = rx * 0.53,  waterRy = ry * 0.53;
  const ripRx   = rx * 0.21,  ripRy   = ry * 0.21;

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, outerRx * 1.1, outerRx * 0.33);
  g.endFill();

  // 1. Pool rim — 浅色材质, side = FILL_MID (outer ring visible at edges)
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawEllipse(x, y, outerRx, outerRy);
  g.endFill();

  // 2. Rim top — FILL_LIGHT (ring, shifted slightly up)
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawEllipse(x, y - 4 * s, rimRx, rimRy);
  g.endFill();

  // 3. Water surface — FILL_MID (inner pool face)
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawEllipse(x + 2 * s, y - 3 * s, waterRx, waterRy);
  g.endFill();

  // 4. Nozzle — 深色材质 (side FILL_SHADE, front FILL_MID, top FILL_LIGHT)
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawCircle(x, y - 2 * s, 8 * s);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawCircle(x, y - 4 * s, 6 * s);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawCircle(x, y - 7 * s, 3 * s);
  g.endFill();

  // 5. Ripple detail
  lenv(g, y, 0.35);
  g.drawEllipse(x - 3 * s, y - 2 * s, ripRx, ripRy);

  // 6. Water jet
  lenv(g, y - outerRy * 1.1, 0.5);
  g.moveTo(x, y - 8 * s); g.lineTo(x, y - outerRy * 1.1);

  // 7. Outline (last)
  lenv(g, y, 0.85);
  g.drawEllipse(x, y, outerRx, outerRy);
}
