import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawHydrant(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // base flange
  g.beginFill(0x6a6a6a, 1);
  g.drawRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);

  // body
  g.beginFill(0xb0b0b0, 1);
  g.drawRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);

  // dome
  g.lineStyle(lineW, lineC, 0.95);
  g.beginFill(0xa0a0a0, 1);
  g.moveTo(x - 8 * s, y - 50 * s);
  g.lineTo(x + 8 * s, y - 50 * s);
  g.lineTo(x + 12 * s, y - 38 * s);
  g.lineTo(x - 12 * s, y - 38 * s);
  g.closePath();
  g.endFill();

  // cap bolt
  g.beginFill(0x4a4a4a, 1);
  g.drawRect(x - 4 * s, y - 57 * s, 8 * s, 7 * s);
  g.endFill();

  // side outlets
  g.beginFill(0x707070, 1);
  g.drawRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);
  g.drawRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);
  g.endFill();
  g.lineStyle(1.5 * s, lineC, 0.85);
  g.drawRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);
  g.drawRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);
}
