import {
  FILL_PAPER,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawChessPlaza(g, config) {
  const { cx, cy, rx, ry } = config;
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.45);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  lenv(g, cy, 1.0);
  g.drawEllipse(cx, cy, rx, ry);
  lenv(g, cy, 0.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
}
