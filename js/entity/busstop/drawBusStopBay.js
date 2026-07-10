import {
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM,
  FAR_Y, NEAR_Y, GRAY_ROAD, GRAY_CURB, GRAY_NEAR_PAVE,
  FILL_PAPER, FILL_MID, FILL_SHADE,
  depthLineWidth, depthLineColor,
  ENV_LINE_LIGHT, ENV_LINE_DARK,
} from '../../core/Layout.js';

function lenv(g, baseY, wScale = 1.0) {
  const lw = depthLineWidth(baseY, { wMin: 0.5, wMax: 1.3 }) * wScale;
  const lc = depthLineColor(baseY, { light: ENV_LINE_LIGHT, dark: ENV_LINE_DARK });
  g.lineStyle(lw, lc, 1);
  return lc;
}

function _drawSign(g, px, py, baseY) {
  const sw = 22, sh = 15;
  const sx = px - Math.round(sw / 2);

  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(sx, py, sw, sh);
  g.endFill();

  lenv(g, baseY, 0.7);
  g.drawRect(sx, py, sw, sh);

  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawRect(sx + 2, py + 2, sw - 4, sh - 4);
  g.endFill();

  g.beginFill(FILL_SHADE, 0.6);
  g.drawRect(sx + 3, py + 3, sw - 6, 4);
  g.endFill();

  g.beginFill(FILL_MID, 0.7);
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
  g.beginFill(GRAY_CURB, 1);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx1,     fy - BAY_D - 3, 3,         BAY_D + 3);
  g.drawRect(bx0 - 3, fy - BAY_D - 3, BAY_W + 6, 3);
  g.endFill();
  g.beginFill(GRAY_NEAR_PAVE, 1);
  g.drawRect(bx0, fy - BAY_D - 2, BAY_W, 2);
  g.endFill();

  const roofT  = ft - 30;
  const poleX  = stop.x + stop.sign.dx;
  const poleTy = roofT + 10;
  const poleBy = fy - BAY_D - 2;
  lenv(g, FAR_Y, 1.1);
  g.moveTo(poleX, poleTy).lineTo(poleX, poleBy);
  _drawSign(g, poleX, poleTy, FAR_Y);
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
  g.beginFill(GRAY_CURB, 1);
  g.drawRect(bx0 - 3, ny,             3,         BAY_D + 3);
  g.drawRect(bx1,     ny,             3,         BAY_D + 3);
  g.drawRect(bx0 - 3, ny + BAY_D,     BAY_W + 6, 3);
  g.endFill();
  g.beginFill(GRAY_NEAR_PAVE, 1);
  g.drawRect(bx0, ny + BAY_D, BAY_W, 2);
  g.endFill();

  const poleX  = stop.x + stop.sign.dx;
  const poleTy = BIKE_LANE_NEAR_BOTTOM + 10;
  const poleBy = BIKE_LANE_NEAR_BOTTOM + 50;
  lenv(g, BIKE_LANE_NEAR_BOTTOM, 1.1);
  g.moveTo(poleX, poleTy).lineTo(poleX, poleBy);
  _drawSign(g, poleX, poleTy, BIKE_LANE_NEAR_BOTTOM);
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
