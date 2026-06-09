import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawLamp(g, p) {
  const { x, y } = p;
  const s  = p.scale ?? 1;
  const lw = depthLineWidth(y);
  const lc = depthLineColor(y, { light: 0x6a, dark: 0x1f });

  const poleH  = 300 * s;
  const armLen = 60  * s;
  const boxW   = 28  * s,  boxH  = 28 * s;
  const baseW  = 22  * s,  baseH = 22 * s;
  const topY    = y - poleH;
  const armTipX = x - armLen;
  const armTipY = topY + 28 * s;

  // base block
  g.beginFill(0x101010, 1);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);
  g.endFill();
  // pole
  g.lineStyle(lw * 1.25, lc, 1);
  g.moveTo(x, y - baseH); g.lineTo(x, topY);
  // arm
  g.lineStyle(lw, lc, 1);
  g.moveTo(x, topY); g.lineTo(armTipX, armTipY);
  // light box
  g.beginFill(0xfafafa, 1);
  g.drawRect(armTipX - boxW, armTipY - boxH / 2, boxW, boxH);
  g.endFill();
  g.lineStyle(lw * 0.8, 0x101010, 1);
  g.drawRect(armTipX - boxW, armTipY - boxH / 2, boxW, boxH);
  // diffuser line
  g.lineStyle(lw * 0.35, 0xa0a0a0, 0.85);
  g.moveTo(armTipX - boxW + 3 * s, armTipY); g.lineTo(armTipX - 3 * s, armTipY);
}
