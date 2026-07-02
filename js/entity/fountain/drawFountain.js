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

/** 贴地平面部分：池壁、池沿、水面、涟漪、轮廓 — 地面预通道调用 */
export function drawFountainPool(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const rx = 300 * s;
  const ry = rx * 0.5;

  const outerRx = rx * 0.775, outerRy = ry * 0.775;
  const rimRx   = rx * 0.70,  rimRy   = ry * 0.70;
  const waterRx = rx * 0.53,  waterRy = ry * 0.53;
  const ripRx   = rx * 0.21,  ripRy   = ry * 0.21;

  g.beginFill(FILL_MID, 1);
  g.drawEllipse(x, y, outerRx, outerRy);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawEllipse(x, y - 4 * s, rimRx, rimRy);
  g.endFill();

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawEllipse(x + 2 * s, y - 3 * s, waterRx, waterRy);
  g.endFill();

  lenv(g, y, 0.35);
  g.drawEllipse(x - 3 * s, y - 2 * s, ripRx, ripRy);

  lenv(g, y, 0.85);
  g.drawEllipse(x, y, outerRx, outerRy);
}

/** 立体部分：喷嘴 + 水柱 — 主 Y 排序通道调用（遮挡从后方经过的 NPC） */
export function drawFountainNozzle(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const outerRy = 300 * s * 0.5 * 0.775;

  g.beginFill(FILL_SHADE, 1);
  g.drawCircle(x, y - 2 * s, 8 * s);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawCircle(x, y - 4 * s, 6 * s);
  g.endFill();
  g.lineStyle(0);
  g.beginFill(FILL_LIGHT, 1);
  g.drawCircle(x, y - 7 * s, 3 * s);
  g.endFill();

  lenv(g, y - outerRy * 1.1, 0.5);
  g.moveTo(x, y - 8 * s); g.lineTo(x, y - outerRy * 1.1);
}
