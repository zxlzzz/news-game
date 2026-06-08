import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawVending(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 80  * s;
  const h     = 158 * s;
  const px    = x - w / 2,  py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  g.fillStyle(0x000000, 0.10);
  g.fillEllipse(x, y, w * 1.1, 11 * s);
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(px, py, w, h);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(px, py, w, h);

  // glass front
  const gx = px + 6 * s, gy = py + 6 * s, gw = w * 0.6, gh = h - 29 * s;
  g.fillStyle(0x3a3a3a, 0.6);
  g.fillRect(gx, gy, gw, gh);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(gx + 3 * s, gy + 3 * s, gw - 6 * s, gh * 0.4);
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.strokeRect(gx, gy, gw, gh);

  // shelf lines
  g.lineStyle(1.2 * s, 0xcacaca, 0.6);
  for (let i = 1; i < 5; i++) g.lineBetween(gx, gy + gh * i / 5, gx + gw, gy + gh * i / 5);

  // side panel
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.strokeRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);

  // dispenser slot
  g.fillStyle(0x101010, 0.9);
  g.fillRect(px + 6 * s, py + h - 17 * s, w - 11 * s, 9 * s);
}
