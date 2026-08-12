import { FILL_LIGHT, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第三批里唯一不贴地的一个：棋桌是有腿的家具，走盒子模板。
// 桌面是块悬空薄板（baseH = 桌面底离地高），四条腿仍是线。
export function drawChessTable(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const tw   = 58 * s, topH = 18 * s, th = 5 * s;
  const depth = PROP_DEPTH['chess-table'] * s;

  // 腿先画，桌面后画压住腿顶
  const fg = frontFaceGraphics(g, x, y);
  const topX = x - tw / 2;
  const legTop = y - (topH - th);        // 桌面底面所在高度
  lenv(fg, y, 1.0);
  fg.moveTo(topX + 3 * s,      legTop); fg.lineTo(topX + 3 * s,      y);
  fg.moveTo(topX + tw - 3 * s, legTop); fg.lineTo(topX + tw - 3 * s, y);
  lenv(fg, y, 0.65);
  fg.moveTo(topX + tw * 0.2, legTop); fg.lineTo(topX + tw * 0.2, y - 3 * s);
  fg.moveTo(topX + tw * 0.8, legTop); fg.lineTo(topX + tw * 0.8, y - 3 * s);

  drawObliqueBox(g, x, y, tw, depth, th, FILL_LIGHT, topH - th);

  // 桌面正面的分格线（细节）
  lenv(fg, y, 0.55);
  for (let i = 1; i < 3; i++) {
    const lx = topX + tw * i / 3;
    fg.moveTo(lx, y - topH);      fg.lineTo(lx, y - topH + th);
  }
}
