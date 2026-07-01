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

function drawGroundShadow(g, cx, cy, rx, ry) {
  const ox = rx * 0.15, oy = ry * 0.25;
  const sx = cx + ox,   sy = cy + oy;
  g.lineStyle(0);
  g.beginFill(0x000000, 0.03); g.drawEllipse(sx, sy, rx * 1.6, ry * 1.6); g.endFill();
  g.beginFill(0x000000, 0.05); g.drawEllipse(sx, sy, rx * 1.3, ry * 1.3); g.endFill();
  g.beginFill(0x000000, 0.08); g.drawEllipse(sx, sy, rx,       ry);       g.endFill();
}

export function drawHydrant(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;

  const BW  = 30 * s;       // 底座宽
  const BH  = 8  * s;       // 底座高
  const W   = 24 * s;       // 主体宽
  const H   = 30 * s;       // 主体高
  const D   = W  * 0.2;     // 侧面深度 ≈ 4.8s
  const DY  = D  * 0.6;

  const yBaseTop = y - BH;
  const yBodyTop = y - BH - H;
  const yDomeTop = y - 50 * s;
  const yCapTop  = y - 57 * s;
  const outY     = y - 30 * s;
  const outH     = 8  * s;

  // 0. 地面阴影
  drawGroundShadow(g, x, y, 15 * s, 15 * s * 0.3);

  // === 底座 block ===
  // 侧面
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + BW / 2,     y);
  g.lineTo(x + BW / 2 + D, y - DY);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);
  g.lineTo(x + BW / 2,     yBaseTop);
  g.closePath();
  g.endFill();
  // 正面
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - BW / 2, yBaseTop, BW, BH);
  g.endFill();
  // 轮廓
  lenv(g, y);
  g.drawRect(x - BW / 2, yBaseTop, BW, BH);
  lenv(g, y, 0.7);
  g.moveTo(x + BW / 2 + D, y - DY);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);
  g.moveTo(x + BW / 2,     yBaseTop);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);

  // === 主体 block ===
  // 侧面
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + W / 2,     yBaseTop);
  g.lineTo(x + W / 2 + D, yBaseTop - DY);
  g.lineTo(x + W / 2 + D, yBodyTop - DY);
  g.lineTo(x + W / 2,     yBodyTop);
  g.closePath();
  g.endFill();
  // 正面
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - W / 2, yBodyTop, W, H);
  g.endFill();
  // 出水口（细节，嵌在主体）
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - 26 * s, outY, 12 * s, outH);
  g.drawRect(x + 14 * s, outY, 12 * s, outH);
  g.endFill();
  // 轮廓
  lenv(g, y);
  g.drawRect(x - W / 2, yBodyTop, W, H);
  lenv(g, y, 0.8);
  g.drawRect(x - 26 * s, outY, 12 * s, outH);
  g.drawRect(x + 14 * s, outY, 12 * s, outH);
  lenv(g, y, 0.7);
  g.moveTo(x + W / 2 + D,  yBaseTop - DY);
  g.lineTo(x + W / 2 + D,  yBodyTop - DY);

  // === Dome block（主体顶部收口） ===
  // 侧面 — 右边梯形条
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + 12 * s,     yBodyTop);
  g.lineTo(x + 12 * s + D, yBodyTop - DY);
  g.lineTo(x + 8  * s + D, yDomeTop - DY);
  g.lineTo(x + 8  * s,     yDomeTop);
  g.closePath();
  g.endFill();
  // 正面（dome 梯形 = FILL_LIGHT，作为顶面过渡）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x - 8  * s, yDomeTop);
  g.lineTo(x + 8  * s, yDomeTop);
  g.lineTo(x + 12 * s, yBodyTop);
  g.lineTo(x - 12 * s, yBodyTop);
  g.closePath();
  g.endFill();
  // 轮廓
  lenv(g, y);
  g.moveTo(x - 8  * s, yDomeTop);
  g.lineTo(x + 8  * s, yDomeTop);
  g.lineTo(x + 12 * s, yBodyTop);
  g.lineTo(x - 12 * s, yBodyTop);
  g.closePath();

  // === 顶栓 block（宽 8*s < 16*s，只填色 + 轮廓） ===
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - 4 * s, yCapTop, 8 * s, 7 * s);
  g.endFill();
  lenv(g, y);
  g.drawRect(x - 4 * s, yCapTop, 8 * s, 7 * s);
}
