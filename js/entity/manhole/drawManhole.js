import {
  depthLineWidth, depthLineColor,
  FILL_SHADE, ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawManhole(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const rx = 30 * s;
  const ry = rx * 0.45;

  g.beginFill(FILL_SHADE, 1);
  g.drawEllipse(x, y, rx, ry);
  g.endFill();

  lenv(g, y);
  g.drawEllipse(x, y, rx, ry);

  lenv(g, y, 0.6);
  g.drawEllipse(x, y, rx * 0.775, ry * 0.775);

  lenv(g, y, 0.55);
  for (let i = -2; i <= 2; i++) {
    const ly   = y + i * (ry * 0.32);
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.moveTo(x - half, ly);
    g.lineTo(x + half, ly);
  }
}
