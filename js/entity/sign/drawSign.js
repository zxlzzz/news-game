import { FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。挂墙招牌是块薄板（PROP_DEPTH.sign 只有 0.06m），走盒子模板出一点
// 侧面厚度即可；p.y 是板下沿（不是地面——招牌挂在墙上），沿用原约定不动。
export function drawSign(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const sw = 43 * s, sh = 35 * s;
  const depth = PROP_DEPTH.sign * s;

  drawObliqueBox(g, p.x, p.y, sw, depth, sh, FILL_MID);

  _frontDetail(frontFaceGraphics(g, p.x, p.y), p.x, p.y, s);
}

function _frontDetail(g, x, y, s) {
  const sw = 43 * s, sh = 35 * s;
  const sx = x - sw / 2;
  const sy = y - sh;

  // Text lines — 0xffffff at low alpha
  g.lineStyle(1.7 * s, 0xffffff, 0.7);
  g.moveTo(sx + 9 * s,       sy + sh * 0.35); g.lineTo(sx + sw - 9 * s,  sy + sh * 0.35);
  g.moveTo(sx + 14 * s,      sy + sh * 0.65); g.lineTo(sx + sw - 14 * s, sy + sh * 0.65);

  // Hanger brackets
  lenv(g, y, 0.75);
  g.moveTo(sx + 11 * s,      sy); g.lineTo(sx + 11 * s,      sy - 9 * s);
  g.moveTo(sx + sw - 11 * s, sy); g.lineTo(sx + sw - 11 * s, sy - 9 * s);
}
