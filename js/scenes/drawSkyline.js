/**
 * drawSkyline — 远景天际线平贴层（O-6）
 *
 * **本文件不 import Projection.js，这是 O-6 的验收条件之一。** 天际线是画面
 * 上半截的背景板，不参与斜投影：它画在 `skyContainer` 里（该容器只吃 zoom +
 * 一个比 `worldContainer` 慢的横向视差系数 0.45，见 StreetScene `_applyCamera`）。
 * 纯正面立面图，无顶面/侧面——远到那个距离已经看不出体积了，画三面反而穿帮。
 *
 * **单位是屏幕像素，y=0 就是楼基线（地平线）。** 这是 O-7 修的对齐 bug：
 * 原来天空层在"未投影的世界单位"里作画、把楼基线放在 y=BUILDING_BASE_Y(700)，
 * 而世界里的楼基线投影后是 y=0——两者差了整整 700px，且天空层还吃了 0.45 的
 * **纵向**视差，所以怎么滚都对不齐（Hsinlung 实机反馈"背景远处的房屋位置没
 * 对齐"）。现在天空层与 worldContainer 共用同一个竖直原点（`_applyCamera` 里
 * 天空只吃横向视差、纵向跟随），y=0 处天际线的脚就正好踩在楼基线上。
 *
 * 楼的宽高序列走 `scene.json` 的 `layout.skyline`（`back` / `front` 两排），
 * **不在代码里随机生成**——随机生成会让每次刷新的天际线都不一样。
 * 历史：O-6 之前这段在 `SceneRenderer._drawFarSkyline` 里用 `Math.sin` 伪随机
 * 现算。那个公式本身是确定性的（刷新不变），但序列长度写死成 48/32 段，
 * 覆盖到屏幕 x≈2240 就没了——O-1 把世界拉长（WORLD_WIDTH 2000→10588）之后
 * 没有跟着加长，相机往右滚到一定程度天际线就断了。现在的数据是用同一个 seed
 * 公式加长到覆盖整个视差范围（≈2560px）后固化下来的。O-7 一并按"屏幕像素"
 * 重报了尺寸：近景楼 facadeH 476 单位 ≈ 185px 高，远景天际线取 45~110px，
 * 明显更小才读得出"远"（旧数据是未换算的世界单位，偏大约 2.57 倍）。
 */

import { SKYLINE_BACK, SKYLINE_FRONT, SKYLINE_LINE } from '../core/Layout.js';

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
  const base  = 0;   // 楼基线 = 投影后的地平线，见文件头

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
