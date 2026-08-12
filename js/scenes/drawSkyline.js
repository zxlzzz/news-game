/**
 * drawSkyline — 远景天际线平贴层（O-6）
 *
 * **本文件不 import Projection.js，这是 O-6 的验收条件之一。** 天际线是画面
 * 上半截的背景板，不参与斜投影：它画在 `skyContainer` 里（该容器只吃 zoom +
 * 一个比 `worldContainer` 慢的横向视差系数 0.45，见 StreetScene `_applyCamera`），
 * 坐标就是未投影的屏幕像素，`y` 固定贴在楼基线 `BUILDING_BASE_Y` 上。
 * 纯正面立面图，无顶面/侧面——远到那个距离已经看不出体积了，画三面反而穿帮。
 *
 * 楼的宽高序列走 `scene.json` 的 `layout.skyline`（`back` / `front` 两排），
 * **不在代码里随机生成**——随机生成会让每次刷新的天际线都不一样。
 * 历史：O-6 之前这段在 `SceneRenderer._drawFarSkyline` 里用 `Math.sin` 伪随机
 * 现算。那个公式本身是确定性的（刷新不变），但序列长度写死成 48/32 段，
 * 覆盖到屏幕 x≈2240 就没了——O-1 把世界拉长（WORLD_WIDTH 2000→10588）之后
 * 没有跟着加长，相机往右滚到一定程度天际线就断了。现在的数据是用同一个 seed
 * 公式加长到覆盖整个视差范围（≈2720）后固化下来的，所以观感与旧版一致。
 */

import { BUILDING_BASE_Y, SKYLINE_BACK, SKYLINE_FRONT, SKYLINE_LINE } from '../core/Layout.js';

function _need(v, what) {
  if (v == null) throw new Error(`drawSkyline: scene config 缺 ${what}`);
  return v;
}

/**
 * @param g        skyGraphics（skyContainer 里的图层）
 * @param skyline  sceneData.layout.skyline —— { back: [{x,w,h}], front: [{x,w,h}] }
 */
export function drawSkyline(g, skyline) {
  const cfg   = _need(skyline,       'layout.skyline');
  const back  = _need(cfg.back,      'layout.skyline.back');
  const front = _need(cfg.front,     'layout.skyline.front');
  const base  = BUILDING_BASE_Y;

  // 后排：整排一次性填充，不描边（远处只留剪影）
  g.lineStyle(0);
  g.beginFill(SKYLINE_BACK, 1);
  for (const b of back) g.drawRect(b.x, base - b.h, b.w, b.h);
  g.endFill();

  // 前排：逐栋填充 + 轮廓 + 两条竖向分格线（暗示窗列，不画真窗）
  for (const b of front) {
    g.lineStyle(0);
    g.beginFill(SKYLINE_FRONT, 1);
    g.drawRect(b.x, base - b.h, b.w, b.h);
    g.endFill();

    g.lineStyle(0.5, SKYLINE_LINE, 0.5);
    g.drawRect(b.x, base - b.h, b.w, b.h);

    g.lineStyle(0.4, SKYLINE_LINE, 0.4);
    for (let k = 1; k < 3; k++) {
      const lx = b.x + b.w * k / 3;
      g.moveTo(lx, base - b.h + 6);
      g.lineTo(lx, base - 4);
    }
  }
}
