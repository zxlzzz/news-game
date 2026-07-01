import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

function drawGroundShadow(g, cx, cy, rx, ry) {
  const ox = rx * 0.15, oy = ry * 0.25;
  const sx = cx + ox,   sy = cy + oy;
  g.lineStyle(0);
  g.beginFill(0x000000, 0.03); g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6); g.endFill();
  g.beginFill(0x000000, 0.05); g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3); g.endFill();
  g.beginFill(0x000000, 0.08); g.drawEllipse(sx, sy, rx,       ry);       g.endFill();
}

export function drawLamp(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;

  const poleH   = 300 * s;
  const armLen  = 60  * s;
  const boxW    = 28  * s, boxH  = 28 * s;
  const baseW   = 22  * s, baseH = 22 * s;
  const topY    = y - poleH;
  const armTipX = x - armLen;
  const armTipY = topY + 28 * s;

  const Db  = baseW * 0.2;   // base side depth ≈ 4.4s
  const DbY = Db * 0.6;
  const Dx  = boxW  * 0.2;   // lightbox top depth ≈ 5.6s
  const DxY = Dx * 0.6;

  // 0. Ground shadow — sized to base footprint
  drawGroundShadow(g, x, y, baseW / 2, baseW / 2 * 0.3);

  // 1. Structural lines (drawn before fills — appear behind)
  lenv(g, y, 1.25);
  g.moveTo(x, y - baseH); g.lineTo(x, topY);
  lenv(g, y, 1.0);
  g.moveTo(x, topY); g.lineTo(armTipX, armTipY);

  // 2. Base block — 深色材质
  // side
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + baseW / 2,      y);
  g.lineTo(x + baseW / 2 + Db, y - DbY);
  g.lineTo(x + baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2,      y - baseH);
  g.closePath();
  g.endFill();
  // front
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);
  g.endFill();
  // top
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x - baseW / 2,      y - baseH);
  g.lineTo(x - baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2,      y - baseH);
  g.closePath();
  g.endFill();
  // outline
  lenv(g, y, 0.85);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);

  // 3. Light box — 浅色材质 (no right-side face; box hangs LEFT of armTip)
  const bx0 = armTipX - boxW;
  const bx1 = armTipX;
  const by0 = armTipY - boxH / 2;
  const by1 = armTipY + boxH / 2;

  // front
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bx0, by0, boxW, boxH);
  g.endFill();
  // top
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(bx0,      by0);
  g.lineTo(bx0 + Dx, by0 - DxY);
  g.lineTo(bx1 + Dx, by0 - DxY);
  g.lineTo(bx1,      by0);
  g.closePath();
  g.endFill();
  // diffuser line (detail)
  lenv(g, armTipY, 0.35);
  g.moveTo(bx0 + 3 * s, armTipY);
  g.lineTo(bx1 - 3 * s, armTipY);
  // outline
  lenv(g, armTipY, 0.85);
  g.drawRect(bx0, by0, boxW, boxH);
}
