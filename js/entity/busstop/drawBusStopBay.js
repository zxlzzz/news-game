import {
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
  FAR_Y, NEAR_Y, GRAY_ROAD,
} from '../../core/Layout.js';

function _drawSign(g, px, py) {
  const sw = 22, sh = 15;
  const sx = px - Math.round(sw / 2);

  g.beginFill(0x4a4a4a, 1);
  g.drawRect(sx, py, sw, sh);
  g.endFill();

  g.lineStyle(1, 0x1a1a1a, 1);
  g.drawRect(sx, py, sw, sh);

  g.beginFill(0xe8e8e8, 1);
  g.drawRect(sx + 2, py + 2, sw - 4, sh - 4);
  g.endFill();

  g.beginFill(0x5a5a5a, 0.9);
  g.drawRect(sx + 3, py + 3, sw - 6, 4);
  g.endFill();

  g.beginFill(0x6a6a6a, 0.7);
  g.drawRect(sx + 3, py + 8,  sw - 6, 1);
  g.drawRect(sx + 3, py + 10, sw - 6, 1);
  g.drawRect(sx + 3, py + 12, sw - 8, 1);
  g.endFill();
}

function _drawFarBusStop(g, stop) {
  const ft = BIKE_LANE_FAR_TOP;
  const fy = FAR_Y + 4;
  const sx      = stop.x;
  const BAY_W   = stop.bayW;
  const BAY_D   = stop.bayD;
  const bx0     = sx - BAY_W / 2;
  const bx1     = sx + BAY_W / 2;

  g.lineStyle(0);
  g.beginFill(GRAY_ROAD, 1);
  g.drawRect(bx0, fy - BAY_D, BAY_W, BAY_D);
  g.endFill();
  g.beginFill(0xd8d8d8, 1);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx1,     fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, BAY_W + 6, 3);
  g.endFill();
  g.beginFill(0xb2b2b0, 1);
  g.drawRect(bx0, fy - BAY_D - 2, BAY_W, 2);
  g.endFill();

  const roofT  = ft - 30;
  const poleX  = stop.x + stop.sign.dx;
  const poleTy = roofT + 10;
  const poleBy = fy - BAY_D - 2;
  const sf = 0.182;
  g.lineStyle(2.2 * sf, 0x2e2e2e, 1);
  g.moveTo(poleX, poleTy).lineTo(poleX, poleBy);
  _drawSign(g, poleX, poleTy);
}

function _drawNearBusStop(g, stop) {
  const ny = NEAR_Y;
  const sx      = stop.x;
  const BAY_W   = stop.bayW;
  const BAY_D   = stop.bayD;
  const bx0     = sx - BAY_W / 2;
  const bx1     = sx + BAY_W / 2;

  g.lineStyle(0);
  g.beginFill(GRAY_ROAD, 1);
  g.drawRect(bx0, ny, BAY_W, BAY_D);
  g.endFill();
  g.beginFill(0xd8d8d8, 1);
  g.drawRect(bx0 - 3, ny,             3,         BAY_D + 3);
  g.drawRect(bx1,     ny,             3,         BAY_D + 3);
  g.drawRect(bx0 - 3, ny + BAY_D,     BAY_W + 6, 3);
  g.endFill();
  g.beginFill(0xb2b2b0, 1);
  g.drawRect(bx0, ny + BAY_D, BAY_W, 2);
  g.endFill();

  const poleX  = stop.x + stop.sign.dx;
  const poleTy = BIKE_LANE_NEAR_BOTTOM + 10;
  const poleBy = BIKE_LANE_NEAR_BOTTOM + 50;
  const sn = 0.434;
  g.lineStyle(2.2 * sn, 0x2e2e2e, 1);
  g.moveTo(poleX, poleTy).lineTo(poleX, poleBy);
  _drawSign(g, poleX, poleTy);
}

export function drawBusStopBays(g, busStops) {
  for (const stop of (busStops || [])) {
    if (stop.direction > 0) {
      _drawFarBusStop(g, stop);
    } else {
      _drawNearBusStop(g, stop);
    }
  }
}
