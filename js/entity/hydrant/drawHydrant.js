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

// 多层软边椭圆阴影 —— 圆形物体适用
function drawGroundShadow(g, cx, cy, rx, ry) {
  const ox = rx * 0.15, oy = ry * 0.25;
  const sx = cx + ox,   sy = cy + oy;
  g.lineStyle(0);
  g.beginFill(0x000000, 0.03); g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6); g.endFill();
  g.beginFill(0x000000, 0.05); g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3); g.endFill();
  g.beginFill(0x000000, 0.08); g.drawEllipse(sx, sy, rx,       ry);       g.endFill();
}

export function drawHydrant(g, p) {
  g.lineStyle(0);                     // 铁律

  const { x, y } = p;
  const s = p.scale ?? 1;

  // 尺寸（圆柱体，宽度即直径）
  const baseW = 30 * s, baseH = 8 * s;      // 底座
  const bodyW = 24 * s, bodyH = 30 * s;     // 主体
  const domeTopY = y - baseH - bodyH - 12 * s; // dome 顶部 Y
  const domeBotY = y - baseH - bodyH;          // dome 底部 Y
  const capH = 7 * s, capW = 8 * s;            // 顶栓

  // 出水口
  const outW = 12 * s, outH = 8 * s;
  const outY = y - baseH - 20 * s;             // 出水口 Y 位置（主体中部偏上）

  // 0. 地面阴影（圆形物体，椭圆合理）
  drawGroundShadow(g, x, y, baseW / 2, baseW / 2 * 0.5);   // ry = rx * 0.5

  // ------------------------------------------------------------
  // 辅助：圆柱体正面矩形，左亮右暗，无侧面/顶面
  // ------------------------------------------------------------
  function drawCylinder(cx, topY, w, h, leftFill, rightFill) {
    // 左半（亮）
    g.lineStyle(0);
    g.beginFill(leftFill, 1);
    g.drawRect(cx - w/2, topY, w/2, h);
    g.endFill();
    // 右半（暗）
    g.beginFill(rightFill, 1);
    g.drawRect(cx, topY, w/2, h);
    g.endFill();
  }

  // === 底座 ===
  drawCylinder(x, y - baseH, baseW, baseH, FILL_LIGHT, FILL_MID);
  // 底座轮廓
  lenv(g, y, 0.85);
  g.drawRect(x - baseW/2, y - baseH, baseW, baseH);
  // 顶部弧线暗示圆形截面（可选细节）
  lenv(g, y, 0.5);
  g.moveTo(x - baseW/2, y - baseH);
  g.lineTo(x + baseW/2, y - baseH);   // 简单直线，或用弧线，此处保持线稿感

  // === 主体 ===
  drawCylinder(x, y - baseH - bodyH, bodyW, bodyH, FILL_LIGHT, FILL_MID);
  // 主体轮廓
  lenv(g, y, 0.85);
  g.drawRect(x - bodyW/2, y - baseH - bodyH, bodyW, bodyH);

  // === Dome（梯形收口，保持圆柱感：左右分色） ===
  const domeLeftW = 8 * s;   // 顶部半宽
  const domeRightW = 12 * s; // 底部半宽
  // 左半梯形（亮）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x, domeTopY);
  g.lineTo(x - domeLeftW, domeTopY);
  g.lineTo(x - domeRightW, domeBotY);
  g.lineTo(x, domeBotY);
  g.closePath();
  g.endFill();
  // 右半梯形（暗）
  g.beginFill(FILL_MID, 1);
  g.moveTo(x, domeTopY);
  g.lineTo(x + domeLeftW, domeTopY);
  g.lineTo(x + domeRightW, domeBotY);
  g.lineTo(x, domeBotY);
  g.closePath();
  g.endFill();
  // Dome 轮廓
  lenv(g, y, 0.85);
  g.moveTo(x - domeLeftW, domeTopY);
  g.lineTo(x + domeLeftW, domeTopY);
  g.lineTo(x + domeRightW, domeBotY);
  g.lineTo(x - domeRightW, domeBotY);
  g.closePath();

  // === 出水口（纯矩形，简化，左右各一） ===
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - 26 * s, outY, outW, outH);   // 左侧
  g.drawRect(x + 14 * s, outY, outW, outH);   // 右侧
  g.endFill();
  // 出水口轮廓
  lenv(g, y, 0.8);
  g.drawRect(x - 26 * s, outY, outW, outH);
  g.drawRect(x + 14 * s, outY, outW, outH);

  // === 顶栓（宽度 < 16*s，线条 + 单色） ===
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - capW/2, domeTopY - capH, capW, capH);
  g.endFill();
  lenv(g, y, 1.0);
  g.drawRect(x - capW/2, domeTopY - capH, capW, capH);

  // === 金属高光线（例外：0xffffff 低 alpha） ===
  const hAlpha = 0.2;
  const hWidth = 1.5 * s;
  // 主体左边缘
  g.lineStyle(hWidth, 0xffffff, hAlpha);
  g.moveTo(x - bodyW/2, y - baseH - bodyH);
  g.lineTo(x - bodyW/2, y - baseH);
  // 底座左边缘
  g.moveTo(x - baseW/2, y - baseH);
  g.lineTo(x - baseW/2, y);
  // 出水口左边缘
  g.moveTo(x - 26 * s, outY);
  g.lineTo(x - 26 * s, outY + outH);
  g.moveTo(x + 14 * s, outY);
  g.lineTo(x + 14 * s, outY + outH);
  // dome 左侧斜边
  g.moveTo(x - domeRightW, domeBotY);
  g.lineTo(x - domeLeftW, domeTopY);
}