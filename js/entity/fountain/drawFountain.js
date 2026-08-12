import { FILL_LIGHT, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { groundFaceGraphics, frontFaceGraphics } from '../../core/Projection.js';

/**
 * 喷泉（O-4 第三批）。本来就已经拆成"贴地水盘"和"立体喷嘴"两个函数，正好各走
 * 一个代理：水盘走地面代理（圆/椭圆自动压扁），喷嘴+水柱走正面代理（竖直量）。
 * 两个函数体都一行未改。
 *
 * `ry = rx * 0.5` 这个硬编码的扁平比例保留为**世界**竖向半轴（水盘在进深方向
 * 比横向短一半，是个椭圆水池），屏幕上的压扁由地面代理再乘 SIN_TILT 完成——
 * 不是把 0.5 当"俯视压扁系数"用（那是 O-1 时代的近似，见 tasks.md O-1 副作用 3）。
 */

/** 贴地平面部分：池壁、池沿、水面、涟漪、轮廓 — 地面预通道调用 */
export function drawFountainPool(g, p) {
  g.lineStyle(0);
  _pool(groundFaceGraphics(g), p);
}

function _pool(g, p) {
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
  _nozzle(frontFaceGraphics(g, p.x, p.y), p);
}

function _nozzle(g, p) {
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
