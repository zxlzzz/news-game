import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawMailbox(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // 柱子加长量（比如增加 20*s）
  const extraHeight = 20 * s;  // 柱子额外伸长的长度

  // post（柱子）- 向下伸更长
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.lineBetween(x, y, x, y - 29 * s - extraHeight);  // 柱子从 y 向上画到更高的位置

  // box body - 整体向上平移 extraHeight
  g.fillStyle(0x8a8a8a, 1);
  g.fillRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 20 * s, y - 64 * s - extraHeight, 40 * s, 35 * s);

  // cap - 整体向上平移 extraHeight
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 23 * s, y - 72 * s - extraHeight, 46 * s, 9 * s);

  // mail slot - 整体向上平移 extraHeight
  g.fillStyle(0x101010, 0.9);
  g.fillRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);

  // flag - 整体向上平移 extraHeight
  g.lineStyle(1.5 * s, 0xfafafa, 0.85);
  g.lineBetween(x - 9 * s, y - 40 * s - extraHeight, x, y - 37 * s - extraHeight);
  g.lineBetween(x, y - 37 * s - extraHeight, x + 9 * s, y - 40 * s - extraHeight);
}
