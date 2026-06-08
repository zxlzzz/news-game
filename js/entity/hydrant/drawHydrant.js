import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawHydrant(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.9, wMax: 1.5 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x05 });

  // base flange（底部法兰）- 改宽度
  g.fillStyle(0x6a6a6a, 1);
  g.fillRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);  // 原 -11, 23, 6
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 15 * s, y - 8 * s, 30 * s, 8 * s);

  // body（主体）- 改宽度和高度
  g.fillStyle(0xb0b0b0, 1);
  g.fillRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);  // 原 -9, -29, 17, 23
  g.lineStyle(lineW, lineC, 0.95);
  g.strokeRect(x - 12 * s, y - 38 * s, 24 * s, 30 * s);

  // dome（顶部圆顶）- 改宽度和高度
  g.fillStyle(0xa0a0a0, 1);
  g.beginPath();
  g.moveTo(x - 8 * s, y - 50 * s);    // 原 -6, -38
  g.lineTo(x + 8 * s, y - 50 * s);    // 原 +6, -38
  g.lineTo(x + 12 * s, y - 38 * s);   // 原 +9, -29
  g.lineTo(x - 12 * s, y - 38 * s);   // 原 -9, -29
  g.closePath();
  g.fillPath();
  g.lineStyle(lineW, lineC, 0.95);
  g.strokePath();

  // cap bolt（顶部螺栓）- 改大小
  g.fillStyle(0x4a4a4a, 1);
  g.fillRect(x - 4 * s, y - 57 * s, 8 * s, 7 * s);  // 原 -3, -43, 6, 5

  // side outlets（侧面出水口）- 改位置和大小
  g.fillStyle(0x707070, 1);
  g.fillRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);  // 原 -20, -23, 9, 6
  g.fillRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);  // 原 +11, -23, 9, 6
  g.lineStyle(1.5 * s, lineC, 0.85);
  g.strokeRect(x - 26 * s, y - 30 * s, 12 * s, 8 * s);
  g.strokeRect(x + 14 * s, y - 30 * s, 12 * s, 8 * s);
}
