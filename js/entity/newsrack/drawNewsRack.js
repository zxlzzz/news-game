import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawNewsRack(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 70 * s,  h = 86 * s;
  const px    = x - w / 2;
  const py    = y - h;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  g.beginFill(0xb8b8b8, 0.95);
  g.drawRect(px, py + 17 * s, w, h - 17 * s);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(px, py + 17 * s, w, h - 17 * s);

  // glass window
  g.beginFill(0xeaeaea, 0.95);
  g.drawRect(px + 3 * s, py + 20 * s, w - 6 * s, 26 * s);
  g.endFill();
  g.lineStyle(1.5 * s, lineC, 0.8);
  g.drawRect(px + 3 * s, py + 20 * s, w - 6 * s, 26 * s);

  // text lines
  g.lineStyle(1.5 * s, lineC, 0.85);
  g.moveTo(px + 6 * s, py + 26 * s); g.lineTo(px + w - 6 * s, py + 26 * s);
  g.moveTo(px + 6 * s, py + 32 * s); g.lineTo(px + w - 6 * s, py + 32 * s);
  g.moveTo(px + 6 * s, py + 38 * s); g.lineTo(px + w - 11 * s, py + 38 * s);

  // coin slot
  g.beginFill(0x101010, 0.9);
  g.drawRect(px + w / 2 - 6 * s, py + h - 14 * s, 11 * s, 3 * s);
  g.endFill();

  // header bar
  g.beginFill(0x4a4a4a, 1);
  g.drawRect(px - 3 * s, py + 6 * s, w + 6 * s, 11 * s);
  g.endFill();
  g.lineStyle(lineW * 0.9, lineC, 0.95);
  g.drawRect(px - 3 * s, py + 6 * s, w + 6 * s, 11 * s);

  // feet
  g.lineStyle(lineW, lineC, 0.9);
  g.moveTo(px + 6 * s,     py + h); g.lineTo(px + 6 * s,     py + h + 9 * s);
  g.moveTo(px + w - 6 * s, py + h); g.lineTo(px + w - 6 * s, py + h + 9 * s);
}
