import {
  FAR_Y, NEAR_Y, GRAY_ROAD, GRAY_CURB, GRAY_NEAR_PAVE,
} from '../../core/Layout.js';
import { groundFaceGraphics } from '../../core/Projection.js';

// O-4：港湾停靠区的地面铺装，纯贴地元素，走地面代理（形状助手）——两个内部
// 函数体一行未改，只是入口把 g 换成代理，drawRect 自动变成投影后的平行四边形。
//
// ⚠ 目前**没有调用点**：SceneRenderer 不再调它。原因是 `stop.bayW` / `stop.bayD`
// 在 scene.json 的 `layout.busStops` 里从来没配置过（只有 x/direction/bench），
// 全是 undefined，画出来是一堆 NaN 矩形——同 O-4 第一批发现的 `stop.bayD`
// NaN 那批数据缺口。本函数已经转好，等补齐场景数据时接回来即可。

function _drawFarBusStop(g, stop) {
  g.lineStyle(0);
  const fy  = FAR_Y + 4;
  const sx  = stop.x;
  const BAY_W = stop.bayW;
  const BAY_D = stop.bayD;
  const bx0 = sx - BAY_W / 2;
  const bx1 = sx + BAY_W / 2;

  g.beginFill(GRAY_ROAD, 1);
  g.drawRect(bx0, fy - BAY_D, BAY_W, BAY_D);
  g.endFill();
  g.beginFill(GRAY_CURB, 1);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx1,     fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, BAY_W + 6, 3);
  g.endFill();
  g.beginFill(GRAY_NEAR_PAVE, 1);
  g.drawRect(bx0, fy - BAY_D - 2, BAY_W, 2);
  g.endFill();
}

function _drawNearBusStop(g, stop) {
  g.lineStyle(0);
  const ny  = NEAR_Y;
  const sx  = stop.x;
  const BAY_W = stop.bayW;
  const BAY_D = stop.bayD;
  const bx0 = sx - BAY_W / 2;
  const bx1 = sx + BAY_W / 2;

  g.beginFill(GRAY_ROAD, 1);
  g.drawRect(bx0, ny, BAY_W, BAY_D);
  g.endFill();
  g.beginFill(GRAY_CURB, 1);
  g.drawRect(bx0 - 3, ny,         3,         BAY_D + 3);
  g.drawRect(bx1,     ny,         3,         BAY_D + 3);
  g.drawRect(bx0 - 3, ny + BAY_D, BAY_W + 6, 3);
  g.endFill();
  g.beginFill(GRAY_NEAR_PAVE, 1);
  g.drawRect(bx0, ny + BAY_D, BAY_W, 2);
  g.endFill();
}

export function drawBusStopBays(g, busStops) {
  g.lineStyle(0);
  const gg = groundFaceGraphics(g);
  for (const stop of (busStops || [])) {
    if (stop.direction > 0) {
      _drawFarBusStop(gg, stop);
    } else {
      _drawNearBusStop(gg, stop);
    }
  }
}
