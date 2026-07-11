import {
  BIKE_LANE_FAR_TOP, BIKE_LANE_NEAR_BOTTOM, FAR_Y,
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

function _drawSignPanel(g, px, py, baseY) {
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

/** p.x = pole x; p.y = pole bottom (ground contact); p.dir > 0 = far side */
export function drawBusStopSign(g, p) {
  const far = p.dir > 0;
  if (far) {
    const poleTy = BIKE_LANE_FAR_TOP - 20;
    lenv(g, FAR_Y, 1.1);
    g.moveTo(p.x, poleTy).lineTo(p.x, p.y);
    _drawSignPanel(g, p.x, poleTy, FAR_Y);
  } else {
    const poleTy = BIKE_LANE_NEAR_BOTTOM + 10;
    lenv(g, BIKE_LANE_NEAR_BOTTOM, 1.1);
    g.moveTo(p.x, poleTy).lineTo(p.x, p.y);
    _drawSignPanel(g, p.x, poleTy, BIKE_LANE_NEAR_BOTTOM);
  }
}
