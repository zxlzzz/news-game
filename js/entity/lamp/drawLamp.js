import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT, FILL_MID,
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

  // 1. Structural lines (drawn before fills)
  lenv(g, y, 1.25);
  g.moveTo(x, y - baseH); g.lineTo(x, topY);
  lenv(g, y, 1.0);
  g.moveTo(x, topY); g.lineTo(armTipX, armTipY);

  // 2. Base block — front only
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);
  g.endFill();
  // outline
  lenv(g, y, 0.85);
  g.drawRect(x - baseW / 2, y - baseH, baseW, baseH);

  // 3. Light box — front only (hangs LEFT of armTip)
  const bx0 = armTipX - boxW;
  const bx1 = armTipX;
  const by0 = armTipY - boxH / 2;
  const by1 = armTipY + boxH / 2;

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawRect(bx0, by0, boxW, boxH);
  g.endFill();
  // diffuser line (detail)
  lenv(g, armTipY, 0.35);
  g.moveTo(bx0 + 3 * s, armTipY);
  g.lineTo(bx1 - 3 * s, armTipY);
  // outline
  lenv(g, armTipY, 0.85);
  g.drawRect(bx0, by0, boxW, boxH);
}
