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

  // 几何参数
  const BW  = 30 * s;          // 底座宽
  const BH  = 8  * s;          // 底座高
  const W   = 24 * s;          // 主体宽
  const H   = 30 * s;          // 主体高
  const D   = W  * 0.2;        // 侧面深度（≈ 4.8s）
  const DY  = D  * 0.6;        // 侧面顶部缩进

  const yBot      = y;              // 地面
  const yBaseTop  = y - BH;         // 底座顶 = y-8s
  const yBodyTop  = y - BH - H;     // 主体顶 = y-38s
  const yDomeTop  = y - 50 * s;     // dome 顶 = y-50s
  const yCapBot   = y - 50 * s;     // 顶栓底 = dome 顶
  const yCapTop   = y - 57 * s;     // 顶栓顶 = y-57s
  const outY      = y - 30 * s;     // 出水口 Y（顶）
  const outH      = 8  * s;

  // 0. 地面阴影
  g.lineStyle(0);
  g.beginFill(0x000000, 0.12);
  g.drawEllipse(x, yBot, 15 * s * 1.1, 15 * s * 0.33);
  g.endFill();

  // 1. 侧面（FILL_SHADE）
  // 底座右侧
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + BW / 2,     yBot);
  g.lineTo(x + BW / 2 + D, yBot - DY);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);
  g.lineTo(x + BW / 2,     yBaseTop);
  g.closePath();
  g.endFill();

  // 主体右侧
  g.beginFill(FILL_SHADE, 1);
  g.moveTo(x + W / 2,     yBaseTop);
  g.lineTo(x + W / 2 + D, yBaseTop - DY);
  g.lineTo(x + W / 2 + D, yBodyTop - DY);
  g.lineTo(x + W / 2,     yBodyTop);
  g.closePath();
  g.endFill();

  // 2. 正面（FILL_MID）
  // 底座正面
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - BW / 2, yBaseTop, BW, BH);
  g.endFill();

  // 主体正面
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - W / 2, yBodyTop, W, H);
  g.endFill();

  // 出水口正面
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - 26 * s, outY, 12 * s, outH);
  g.drawRect(x + 14 * s, outY, 12 * s, outH);
  g.endFill();

  // 3. 顶面 — dome 梯形作顶面（FILL_LIGHT）
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.moveTo(x - 8  * s, yDomeTop);
  g.lineTo(x + 8  * s, yDomeTop);
  g.lineTo(x + 12 * s, yBodyTop);
  g.lineTo(x - 12 * s, yBodyTop);
  g.closePath();
  g.endFill();

  // 4. 细节 — 顶栓（FILL_SHADE）
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - 4 * s, yCapTop, 8 * s, 7 * s);
  g.endFill();

  // 5. 轮廓线（最后）
  lenv(g, y);
  // 底座正面
  g.drawRect(x - BW / 2, yBaseTop, BW, BH);
  // 主体正面
  g.drawRect(x - W / 2,  yBodyTop, W, H);
  // dome
  g.moveTo(x - 8  * s, yDomeTop);
  g.lineTo(x + 8  * s, yDomeTop);
  g.lineTo(x + 12 * s, yBodyTop);
  g.lineTo(x - 12 * s, yBodyTop);
  g.closePath();
  // 顶栓
  g.drawRect(x - 4 * s, yCapTop, 8 * s, 7 * s);

  // 出水口轮廓
  lenv(g, y, 0.8);
  g.drawRect(x - 26 * s, outY, 12 * s, outH);
  g.drawRect(x + 14 * s, outY, 12 * s, outH);

  // 侧面轮廓线
  lenv(g, y, 0.7);
  // 底座右侧竖边
  g.moveTo(x + BW / 2 + D, yBot - DY);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);
  // 底座顶 → 主体底（阶梯过渡）
  g.moveTo(x + BW / 2,     yBaseTop);
  g.lineTo(x + BW / 2 + D, yBaseTop - DY);
  // 主体右侧竖边
  g.moveTo(x + W / 2 + D,  yBaseTop - DY);
  g.lineTo(x + W / 2 + D,  yBodyTop - DY);
}
