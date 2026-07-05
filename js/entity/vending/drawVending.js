import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawVending(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 80  * s;
  const h     = 158 * s;
  const px    = x - w / 2,  py = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x08 });

  g.lineStyle(0);
  g.beginFill(0x000000, 0.10);
  g.drawEllipse(x, y, w * 0.55, 5.5 * s);
  g.endFill();
  g.beginFill(0xb0b0b0, 1);
  g.drawRect(px, py, w, h);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(px, py, w, h);

  // glass front
  const gx = px + 6 * s, gy = py + 6 * s, gw = w * 0.6, gh = h - 29 * s;
  g.beginFill(0x3a3a3a, 0.6);
  g.drawRect(gx, gy, gw, gh);
  g.endFill();
  g.beginFill(0xffffff, 0.18);
  g.drawRect(gx + 3 * s, gy + 3 * s, gw - 6 * s, gh * 0.4);
  g.endFill();
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.drawRect(gx, gy, gw, gh);

  // shelf lines
  g.lineStyle(1.2 * s, 0xcacaca, 0.6);
  for (let i = 1; i < 5; i++) { g.moveTo(gx, gy + gh * i / 5); g.lineTo(gx + gw, gy + gh * i / 5); }

  // side panel
  g.beginFill(0x8a8a8a, 1);
  g.drawRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);
  g.endFill();
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.drawRect(px + gw + 9 * s, gy, w - gw - 14 * s, gh * 0.5);

  // dispenser slot
  g.beginFill(0x101010, 0.9);
  g.drawRect(px + 6 * s, py + h - 17 * s, w - 11 * s, 9 * s);
  g.endFill();
}
