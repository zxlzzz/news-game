import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawFountain(g, p) {
  const { x, y } = p;
  const s   = p.scale ?? 1;
  const rx  = 300 * s;
  const ry  = rx * 0.5;
  const lw  = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const lc  = depthLineColor(y, { light: 0xbc, dark: 0x88 });

  // shadow
  g.beginFill(0x000000, 0.04);
  g.drawEllipse(x, y + 11 * s, rx * 0.95, ry * 0.9);
  g.endFill();
  // pool rim
  g.beginFill(0xe5e5e5, 1);
  g.drawEllipse(x, y, rx * 0.775, ry * 0.775);
  g.endFill();
  g.lineStyle(lw, lc, 0.7);
  g.drawEllipse(x, y, rx * 0.6, ry * 0.6);
  // water surface
  g.beginFill(0xd6d6d6, 0.9);
  g.drawEllipse(x + 3 * s, y - 3 * s, rx * 0.46, ry * 0.46);
  g.endFill();
  g.lineStyle(lw * 0.5, lc, 0.35);
  g.drawEllipse(x - 3 * s, y, rx * 0.21, ry * 0.21);
  // nozzle + jet
  g.beginFill(0xa8a8a8, 1);
  g.drawCircle(x, y - 3 * s, 6 * s);
  g.endFill();
  g.lineStyle(2.3 * s, 0xf0f0f0, 0.6);
  g.moveTo(x, y - 6 * s); g.lineTo(x, y - ry * 1.1);
}
