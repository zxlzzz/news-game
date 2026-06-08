import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawChessTable(g, p) {
  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = 58 * s;
  const topH = 25 * s;
  const th   = 20 * s;
  const topX = x - tw / 2;
  const topY = y - topH;
  const lw   = depthLineWidth(y);
  const lc   = depthLineColor(y, { light: 0x1a, dark: 0x0a });

  // 桌面主体
  g.fillStyle(0xcfcfcf, 1);
  g.fillRect(topX, topY, tw, th);
  g.lineStyle(lw, lc, 0.95);
  g.strokeRect(topX, topY, tw, th);

  // 桌面内框装饰线
  g.lineStyle(lw * 0.5, 0x9a9a9a, 0.8);
  g.strokeRect(topX + 4 * s, topY + 4 * s, tw - 8 * s, th - 8 * s);

  // 桌面网格线（3x3）
  g.lineStyle(lw * 0.55, lc, 0.85);
  for (let i = 1; i < 3; i++) {
    const lx = topX + (tw * i / 3);
    g.lineBetween(lx, topY + 6 * s, lx, topY + th - 6 * s);
  }
  for (let i = 1; i < 3; i++) {
      const ly = topY + 4.5 * s + (3 + th - 12 * s) * i / 3;
      g.lineBetween(topX + 6 * s, ly, topX + tw - 6 * s, ly);
  }

  // 桌腿
  g.lineStyle(lw, lc, 0.95);
  g.lineBetween(topX + 3 * s,       topY + th, topX + 3 * s,       y);
  g.lineBetween(topX + tw - 3 * s,  topY + th, topX + tw - 3 * s,  y);
  g.lineStyle(lw * 0.65, lc, 0.7);
  g.lineBetween(topX + tw * 0.2, topY + th, topX + tw * 0.2, y - 3 * s);
  g.lineBetween(topX + tw * 0.8, topY + th, topX + tw * 0.8, y - 3 * s);
}
