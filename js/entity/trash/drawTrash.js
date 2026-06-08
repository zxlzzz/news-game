import { depthLineWidth, depthLineColor } from '../../Layout.js';

export function drawTrash(g, p) {
  const { x, y } = p;
  const s     = p.scale ?? 1;
  const lineW = depthLineWidth(y, { wMin: 0.8, wMax: 1.6 });
  const lineC = depthLineColor(y, { light: 0x40, dark: 0x10 });
  const topW  = 40 * s,  botW = 30 * s,  h = 50 * s;
  const tx    = x - topW / 2;
  const bx    = x - botW / 2;

  g.lineStyle(lineW, lineC, 0.95);
  g.beginFill(0xc0c0c0, 0.92);
  g.moveTo(tx,          y - h);
  g.lineTo(tx + topW,   y - h);
  g.lineTo(bx + botW,   y);
  g.lineTo(bx,          y);
  g.closePath();
  g.endFill();
  // lid
  g.lineStyle(lineW * 1.1, lineC, 0.95);
  g.moveTo(tx - 3 * s, y - h - 3 * s); g.lineTo(tx + topW + 3 * s, y - h - 3 * s);
  // grooves
  g.lineStyle(0.5 * s, lineC, 0.6);
  g.moveTo(x - 6 * s, y - h + 6 * s); g.lineTo(x - 6 * s + (botW - topW) * 0.3, y - 3 * s);
  g.moveTo(x + 6 * s, y - h + 6 * s); g.lineTo(x + 6 * s - (botW - topW) * 0.3, y - 3 * s);
}
