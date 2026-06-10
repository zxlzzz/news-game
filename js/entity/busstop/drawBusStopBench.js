import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawBusStopBench(g, p) {
  const s     = p.scale ?? 1;
  const halfW = (p.width ?? 132) / 2;
  const benchW = halfW * 2;
  const { x, y } = p;

  g.lineStyle(0);
  g.beginFill(0x565654, 1);
  g.drawRect(x - halfW, y, benchW, 4 * s);
  g.endFill();

  g.lineStyle(0.8 * s, 0x181818, 0.7);
  g.drawRect(x - halfW, y, benchW, 4 * s);

  const legY0 = y + 4 * s;
  const legY1 = legY0 + 30 * s;
  g.lineStyle(1.5 * s, 0x303030, 0.9);
  g.moveTo(x - halfW + 10 * s, legY0);
  g.lineTo(x - halfW + 10 * s, legY1);
  g.moveTo(x + halfW - 10 * s, legY0);
  g.lineTo(x + halfW - 10 * s, legY1);
}
