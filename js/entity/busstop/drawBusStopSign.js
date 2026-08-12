import { FILL_PAPER, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

/**
 * 站牌：一根杆 + 顶端一块牌子。O-4 第一批转换，同时修掉几何表达方式——
 *
 * 旧版拿 Y 分带常量当杆顶（`poleTy = BIKE_LANE_FAR_TOP - 20`），杆高靠
 * "杆顶世界 y 与柱脚世界 y 相减"得到，同 drawBusStopRoof 那套扁平写法；
 * 现在改成 `p.y` = 杆脚落地点 + `POLE_H` 杆高（平长度）。牌面尺寸原来是
 * 22×15 且不乘 scale（O-1 单位重标时漏掉的一处裸旧世界像素——本文件在
 * 当前场景里没有实例，`stop.sign` 未配置，所以一直没被发现），一并按现实
 * 尺寸重报成骨架单位。
 *
 * 杆走细长盒子、牌面走悬空盒子（baseH），牌面上的排版细节走正面代理。
 */
const POLE_H  = 220; // 2.6m，站牌杆高（骨架单位）
const PANEL_W = 34;  // 0.40m
const PANEL_H = 51;  // 0.60m

export function drawBusStopSign(g, p) {
  g.lineStyle(0);
  const s     = p.scale ?? 1;
  const depth = PROP_DEPTH['busstop-sign'] * s;
  const poleH = POLE_H * s;
  const panelH = PANEL_H * s;

  // 杆（细长方柱）
  drawObliqueBox(g, p.x, p.y, Math.max(2, depth), depth, poleH - panelH, FILL_SHADE);
  // 牌面（悬空）
  drawObliqueBox(g, p.x, p.y, PANEL_W * s, depth, panelH, FILL_SHADE, poleH - panelH);

  _panelDetail(frontFaceGraphics(g, p.x, p.y), p.x, p.y, s);
}

// 牌面上的排版（底板 + 标题条 + 三行线路），沿用老版本的相对布局，
// 只是把裸数字换成按 PANEL_W/PANEL_H 的比例，且统一乘 scale。
function _panelDetail(g, x, y, s) {
  const sw = PANEL_W * s, sh = PANEL_H * s;
  const sx = x - sw / 2;
  const py = y - POLE_H * s;   // 牌面顶端

  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawRect(sx + 3 * s, py + 3 * s, sw - 6 * s, sh - 6 * s);
  g.endFill();

  g.beginFill(FILL_SHADE, 0.6);
  g.drawRect(sx + 5 * s, py + 5 * s, sw - 10 * s, 12 * s);
  g.endFill();

  g.beginFill(FILL_MID, 0.7);
  g.drawRect(sx + 5 * s, py + 24 * s, sw - 10 * s, 3 * s);
  g.drawRect(sx + 5 * s, py + 31 * s, sw - 10 * s, 3 * s);
  g.drawRect(sx + 5 * s, py + 38 * s, sw - 14 * s, 3 * s);
  g.endFill();

  lenv(g, y, 0.7);
  g.drawRect(sx, py, sw, sh);
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
registerProp('busstop-sign', {
  draw: drawBusStopSign,
  bounds: (e, s) => ({
    x: e.x - (PANEL_W / 2) * s,
    y: e.y - POLE_H * s,
    width: PANEL_W * s,
    height: POLE_H * s,
  }),
});
