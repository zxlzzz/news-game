import { depthLineWidth, depthLineColor } from '../../core/Layout.js';

export function drawStall(g, p) {
  const { x, y } = p;
  const s        = p.scale ?? 1;
  const w        = 290 * s;
  const roofH    = 200 * s;
  const ctrH     = 72  * s;
  const lineW    = depthLineWidth(y, { wMin: 1, wMax: 1.7 });
  const lineC    = depthLineColor(y, { light: 0x38, dark: 0x08 });
  const px       = x - w / 2;
  const counterY = y - ctrH;

  // support poles
  g.lineStyle(lineW, lineC, 0.95);
  g.moveTo(px + 6 * s, y); g.lineTo(px + 6 * s, y - roofH);
  g.moveTo(px + w - 6 * s, y); g.lineTo(px + w - 6 * s, y - roofH);

  // awning (fill + stroke)
  const aY = y - roofH, aH = 17 * s;
  g.lineStyle(lineW, lineC, 0.95);
  g.beginFill(0x707070, 1);
  g.moveTo(px,           aY + aH); g.lineTo(px + w,         aY + aH);
  g.lineTo(px + w + 9 * s, aY);   g.lineTo(px - 9 * s,     aY);
  g.closePath();
  g.endFill();
  // awning stripes
  g.lineStyle(1.5 * s, 0xdddddd, 0.7);
  for (let i = 1; i < Math.floor(w / (17 * s)); i++) {
    const sx = px - 9 * s + i * 17 * s;
    g.moveTo(sx, aY); g.lineTo(sx + 4 * s, aY + aH);
  }

  // counter top (fill + stroke)
  g.lineStyle(lineW, lineC, 0.95);
  g.beginFill(0xc0c0c0, 1);
  g.drawRect(px + 3 * s, counterY, w - 6 * s, 11 * s);
  g.endFill();
  g.drawRect(px + 3 * s, counterY, w - 6 * s, 11 * s);

  // items on counter (batch fill, then stroke loop)
  const itemW = 11 * s, itemH = 9 * s;
  g.lineStyle(1.2 * s, lineC, 0.85);
  g.beginFill(0x9a9a9a, 1);
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, counterY - itemH, itemW, itemH);
  }
  g.endFill();
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, counterY - itemH, itemW, itemH);
  }
}
