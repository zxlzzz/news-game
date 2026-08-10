import {
  FILL_PAPER,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

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
