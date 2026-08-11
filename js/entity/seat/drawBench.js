import {
  depthLineWidth, depthLineColor,
  FILL_PAPER, FILL_LIGHT,
  ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-3 样板之一：小盒子 + 正面保留原有细节。盒子本身（三面）走 drawObliqueBox；
// 正面的腿/座板/靠背/扶手细节完全是老代码（_frontDetail，一行没改），只是
// 通过 frontFaceGraphics 代理接到投影后的正面——正面不受 shear 影响，这层
// 代理数学上只是 scale+translate，详见 Projection.js 文件头。
export function drawBench(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s     = p.scale ?? 1;
  const L     = 300 * s;
  const legH  = 23 * s;
  const seatT = 17 * s;
  const backH = 40 * s;
  const h     = legH + seatT + backH;
  const depth = PROP_DEPTH.bench * s;

  drawObliqueBox(g, x, y, L, depth, h, FILL_PAPER);

  const fg = frontFaceGraphics(g, x, y);
  _frontDetail(fg, x, y, s);
}

// 老版本 drawBench 的函数体，未改动任何一行绘制逻辑——只是把 (x,y,s) 从
// p 上的隐式读取改成显式参数，g 现在是 frontFaceGraphics 代理。
function _frontDetail(g, x, y, s) {
  g.lineStyle(0);

  const L     = 300 * s;
  const half  = L / 2;
  const legH  = 23 * s;
  const seatT = 17 * s;
  const backH = 40 * s;

  const P = (u, w) => [x + u, y + w];

  const rect = (u0, w0, u1, w1, fill, fa, wScale) => {
    const a = P(u0, w0), b = P(u1, w1);
    const rx = Math.min(a[0], b[0]), ry = Math.min(a[1], b[1]);
    const rw = Math.abs(a[0] - b[0]), rh = Math.abs(a[1] - b[1]);
    if (fill != null) { g.lineStyle(0); g.beginFill(fill, fa ?? 1); g.drawRect(rx, ry, rw, rh); g.endFill(); }
    if (wScale != null) { lenv(g, y, wScale); g.drawRect(rx, ry, rw, rh); }
  };

  const line = (u0, w0, u1, w1, wScale) => {
    const a = P(u0, w0), b = P(u1, w1);
    lenv(g, y, wScale ?? 1.0);
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  };

  // outer + inner legs
  const li = 14 * s;
  line(-(half - li), -legH, -(half - li), 0, 1.0);
  line( (half - li), -legH,  (half - li), 0, 1.0);
  line(-(half - 32 * s), -legH, -(half - 32 * s), 0, 0.85);
  line( (half - 32 * s), -legH,  (half - 32 * s), 0, 0.85);
  // horizontal mid-brace
  line(-(half - li), -legH * 0.5, (half - li), -legH * 0.5, 0.7);

  // seat slats (FILL_PAPER / FILL_LIGHT alternating)
  const SLATS = [FILL_PAPER, FILL_LIGHT, FILL_PAPER, FILL_LIGHT];
  const n = 4, sw_u = (L - 17 * s) / n;
  for (let i = 0; i < n; i++) {
    const u0 = -half + 9 * s + i * sw_u;
    rect(u0, -(legH + seatT), u0 + sw_u - 4 * s, -legH, SLATS[i], 0.95, 0.8);
  }

  // back plank + connecting posts
  const by2 = -(legH + seatT);
  const by3 = -(legH + seatT + backH);
  const plkT = 11 * s;
  rect(-half + 11 * s, by3 + plkT, half - 11 * s, by3, FILL_LIGHT, 0.92, 0.85);
  for (let i = 0; i <= 4; i++) {
    const u = -half + 11 * s + (L - 22 * s) * i / 4;
    line(u, by2, u + s, by3 + plkT, 0.7);
  }

  // armrest stubs
  for (const dir of [-1, 1]) {
    const u = dir * (half - 9 * s);
    line(u, by2 - 3 * s, u, -(legH + 9 * s), 0.85);
    line(u, -(legH + 9 * s), u - dir * 9 * s, -(legH + 3 * s), 0.85);
  }
}
