import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawMailbox(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  const extraHeight = 20 * s;

  // post
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.moveTo(x, y); g.lineTo(x, y - 29 * s - extraHeight);

  // box body
  g.beginFill(0x8a8a8a, 1);
  g.drawRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);

  // cap
  g.beginFill(0x707070, 1);
  g.drawRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);
  g.endFill();
  g.lineStyle(lineW, lineC, 0.95);
  g.drawRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);

  // mail slot
  g.beginFill(0x101010, 0.9);
  g.drawRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  g.endFill();

  // flag
  g.lineStyle(1.5 * s, 0xfafafa, 0.85);
  g.moveTo(x - 9 * s, y - 40 * s - extraHeight); g.lineTo(x, y - 37 * s - extraHeight);
  g.moveTo(x, y - 37 * s - extraHeight); g.lineTo(x + 9 * s, y - 40 * s - extraHeight);
}
