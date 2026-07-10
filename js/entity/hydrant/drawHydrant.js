import {
  depthLineWidth, depthLineColor,
  FILL_LIGHT, FILL_MID, FILL_SHADE,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

export function drawHydrant(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;

  const baseW = 30 * s, baseH = 8 * s;
  const bodyW = 24 * s, bodyH = 30 * s;
  const domeTopY = y - baseH - bodyH - 12 * s;
  const domeBotY = y - baseH - bodyH;
  const capH = 7 * s, capW = 8 * s;

  const outW = 12 * s, outH = 8 * s;
  const outY = y - baseH - 20 * s;

  function drawCylinder(cx, topY, w, h, leftFill, rightFill) {
    g.lineStyle(0);
    g.beginFill(leftFill, 1);
    g.drawRect(cx - w/2, topY, w/2, h);
    g.endFill();
    g.beginFill(rightFill, 1);
    g.drawRect(cx, topY, w/2, h);
    g.endFill();
  }

  // === 底座 ===
  drawCylinder(x, y - baseH, baseW, baseH, FILL_LIGHT, FILL_MID);
  lenv(g, y, 0.85);
  g.drawRect(x - baseW/2, y - baseH, baseW, baseH);
  lenv(g, y, 0.5);
  g.moveTo(x - baseW/2, y - baseH);
  g.lineTo(x + baseW/2, y - baseH);

  // === 主体 ===
  drawCylinder(x, y - baseH - bodyH, bodyW, bodyH, FILL_LIGHT, FILL_MID);
  lenv(g, y, 0.85);
  g.drawRect(x - bodyW/2, y - baseH - bodyH, bodyW, bodyH);

  // === Dome ===
  const domeLeftW = 8 * s;
  const domeRightW = 12 * s;
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x, domeTopY);
  g.lineTo(x - domeLeftW, domeTopY);
  g.lineTo(x - domeRightW, domeBotY);
  g.lineTo(x, domeBotY);
  g.closePath();
  g.endFill();
  g.beginFill(FILL_MID, 1);
  g.moveTo(x, domeTopY);
  g.lineTo(x + domeLeftW, domeTopY);
  g.lineTo(x + domeRightW, domeBotY);
  g.lineTo(x, domeBotY);
  g.closePath();
  g.endFill();
  lenv(g, y, 0.85);
  g.moveTo(x - domeLeftW, domeTopY);
  g.lineTo(x + domeLeftW, domeTopY);
  g.lineTo(x + domeRightW, domeBotY);
  g.lineTo(x - domeRightW, domeBotY);
  g.closePath();

  // === 出水口 ===
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - 26 * s, outY, outW, outH);
  g.drawRect(x + 14 * s, outY, outW, outH);
  g.endFill();
  lenv(g, y, 0.8);
  g.drawRect(x - 26 * s, outY, outW, outH);
  g.drawRect(x + 14 * s, outY, outW, outH);

  // === 顶栓 ===
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - capW/2, domeTopY - capH, capW, capH);
  g.endFill();
  lenv(g, y, 1.0);
  g.drawRect(x - capW/2, domeTopY - capH, capW, capH);

  // === 金属高光线（例外：0xffffff 低 alpha） ===
  const hAlpha = 0.2;
  const hWidth = 1.5 * s;
  g.lineStyle(hWidth, 0xffffff, hAlpha);
  g.moveTo(x - bodyW/2, y - baseH - bodyH);
  g.lineTo(x - bodyW/2, y - baseH);
  g.moveTo(x - baseW/2, y - baseH);
  g.lineTo(x - baseW/2, y);
  g.moveTo(x - 26 * s, outY);
  g.lineTo(x - 26 * s, outY + outH);
  g.moveTo(x + 14 * s, outY);
  g.lineTo(x + 14 * s, outY + outH);
  g.moveTo(x - domeRightW, domeBotY);
  g.lineTo(x - domeLeftW, domeTopY);
}
