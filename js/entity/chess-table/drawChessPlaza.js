import { FILL_PAPER, FILL_MID } from '../../core/Layout.js';

export function drawChessPlaza(g, config) {
  const { cx, cy, rx, ry } = config;
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.45);
  g.drawEllipse(cx, cy, rx, ry);
  g.endFill();
  g.lineStyle(1, FILL_MID, 0.9);
  g.drawEllipse(cx, cy, rx, ry);
  g.lineStyle(0.5, FILL_MID, 0.30);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
}
