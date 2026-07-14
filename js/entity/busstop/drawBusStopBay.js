import {
  BIKE_LANE_NEAR_BOTTOM,
  FAR_Y, NEAR_Y, GRAY_ROAD, GRAY_CURB, GRAY_NEAR_PAVE,
} from '../../core/Layout.js';

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
  for (const stop of (busStops || [])) {
    if (stop.direction > 0) {
      _drawFarBusStop(g, stop);
    } else {
      _drawNearBusStop(g, stop);
    }
  }
}
