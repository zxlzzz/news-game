import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawFountain(g, p) {
  const { x, y } = p;
  const s   = p.scale ?? 1;
  const rx  = 300 * s;   // pool half-diameter
  const ry  = rx * 0.5;
  const lw  = depthLineWidth(y, { wMin: 0.7, wMax: 1.5 });
  const lc  = depthLineColor(y, { light: 0xbc, dark: 0x88 });

  // shadow
  g.fillStyle(0x000000, 0.04);
  g.fillEllipse(x, y + 11 * s, rx * 1.9, ry * 1.8);
  // pool rim
  g.fillStyle(0xe5e5e5, 1);
  g.fillEllipse(x, y, rx * 1.55, ry * 1.55);
  g.lineStyle(lw, lc, 0.7);
  g.strokeEllipse(x, y, rx * 1.2, ry * 1.2);
  // water surface
  g.fillStyle(0xd6d6d6, 0.9);
  g.fillEllipse(x + 3 * s, y - 3 * s, rx * 0.92, ry * 0.92);
  g.lineStyle(lw * 0.5, lc, 0.35);
  g.strokeEllipse(x - 3 * s, y, rx * 0.42, ry * 0.42);
  // nozzle + jet
  g.fillStyle(0xa8a8a8, 1);
  g.fillCircle(x, y - 3 * s, 6 * s);
  g.lineStyle(2.3 * s, 0xf0f0f0, 0.6);
  g.lineBetween(x, y - 6 * s, x, y - ry * 1.1);
}
