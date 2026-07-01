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
  const Dx  = boxW  * 0.2;   // lightbox side depth ≈ 5.6s
  const DxY = Dx * 0.6;

  // 0. Ground shadow
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, y, baseW / 2 * 1.1, baseW / 2 * 0.33);
  g.endFill();

  // 1. Structural lines (drawn before fills — appear behind)
  lenv(g, y, 1.25);
  g.moveTo(x, y - baseH); g.lineTo(x, topY);
  lenv(g, y, 1.0);
  g.moveTo(x, topY); g.lineTo(armTipX, armTipY);

  // 2. Base block — 深色材质 (top FILL_LIGHT, front FILL_MID, side FILL_SHADE)
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + baseW / 2,      y);
  g.lineTo(x + baseW / 2 + Db, y - DbY);
  g.lineTo(x + baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2,      y - baseH);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x - baseW / 2,      y - baseH);
  g.lineTo(x - baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2 + Db, y - baseH - DbY);
  g.lineTo(x + baseW / 2,      y - baseH);
  g.closePath();
  g.endFill();

  // 3. Light box — 浅色材质 (top FILL_PAPER, front FILL_LIGHT, side FILL_MID)
  const bx0 = armTipX - boxW;
  const bx1 = armTipX;
  const by0 = armTipY - boxH / 2;
  const by1 = armTipY + boxH / 2;

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.moveTo(bx1,      by0);
  g.lineTo(bx1 + Dx, by0 - DxY);
  g.lineTo(bx1 + Dx, by1 - DxY);
  g.lineTo(bx1,      by1);
  g.closePath();
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bx0, by0, boxW, boxH);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.moveTo(bx0,      by0);
  g.lineTo(bx0 + Dx, by0 - DxY);
  g.lineTo(bx1 + Dx, by0 - DxY);
  g.lineTo(bx1,      by0);
  g.closePath();
  g.endFill();

  // 4. Diffuser line (detail)
  lenv(g, armTipY, 0.35);
  g.moveTo(bx0 + 3 * s, armTipY);
  g.lineTo(bx1 - 3 * s, armTipY);

  // 5. Outline (last)
  lenv(g, y, 0.85);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);
  lenv(g, armTipY, 0.85);
  g.drawRect(bx0, by0, boxW, boxH);
}
