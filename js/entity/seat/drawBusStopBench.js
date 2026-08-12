import { FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。候车亭长椅：座板是块悬空薄板（baseH = 座面离地高），腿是两条线。
export function drawBusStopBench(g, p) {
  g.lineStyle(0);

  const s      = p.scale ?? 1;
  const halfW  = 66;
  const benchW = 132;
  const { x, y } = p;

  // y = 腿底部（地面）；原版座面上沿 y-34s、下沿 y-30s，即 4s 厚的板
  const seatH  = 30 * s;      // 座板底面离地
  const slabH  = 4 * s;       // 座板厚
  const depth  = PROP_DEPTH['busstop-bench'] * s;

  drawObliqueBox(g, x, y, benchW, depth, slabH, FILL_SHADE, seatH);

  const fg = frontFaceGraphics(g, x, y);
  lenv(fg, y, 0.9);
  fg.moveTo(x - halfW + 10 * s, y - seatH);
  fg.lineTo(x - halfW + 10 * s, y);
  fg.moveTo(x + halfW - 10 * s, y - seatH);
  fg.lineTo(x + halfW - 10 * s, y);
}
