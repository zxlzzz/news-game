import { depthLineWidth } from '../../Layout.js';

export function drawManhole(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const rx    = 30 * s;
  const ry    = rx * 0.45;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });

  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + 3 * s, y + 3 * s, rx * 2.1, ry * 2.1);
  g.fillStyle(0x6a6a6a, 1);
  g.fillEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(lineW, 0x101010, 0.92);
  g.strokeEllipse(x, y, rx * 2, ry * 2);
  g.lineStyle(1.5 * s, 0x1a1a1a, 0.8);
  g.strokeEllipse(x, y, rx * 1.55, ry * 1.55);

  // grate lines
  g.lineStyle(1.5 * s, 0x202020, 0.7);
  for (let i = -2; i <= 2; i++) {
    const ly   = y + i * (ry * 0.32);
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.lineBetween(x - half, ly, x + half, ly);
  }
}
