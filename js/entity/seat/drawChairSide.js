import { FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

/**
 * 棋桌折叠椅（O-4 第二批）。drawChairL / drawChairR 原本是两份逐字重复、只有
 * `d` 和 `backX` 取值不同的代码，转换时合并成这一个带 `d` 参数的实现——两份
 * 各自改一遍等于把同一个转换做两次，也更容易改出不一致。
 *
 * 椅子原版是纯线稿（座面一条线、靠背一条线、两条腿）。转换后座板和靠背各给
 * 一块薄板出体积，腿仍是线——折叠椅的腿本来就是细管，做成盒子反而变笨重。
 *
 * @param d -1 = 靠背在座面右侧（chair-l）；+1 = 靠背在座面左侧（chair-r）
 */
export function drawChairSide(g, p, d) {
  g.lineStyle(0);

  const { x, y } = p;
  const s     = p.scale ?? 1;
  const seatH = (p.seatH ?? 10) * s;
  const seatW = 25 * s;
  const backH = 20 * s;
  const depth = PROP_DEPTH['chair-l'] * s;
  const slabH = Math.max(1.5 * s, 2 * s);

  // 座板（悬空薄板）
  drawObliqueBox(g, x, y, seatW, depth, slabH, FILL_MID, seatH);
  // 靠背（立在座面一侧的薄板）——d=-1 时在 +x 侧，d=+1 时在 -x 侧
  const backX = x - d * (seatW / 2);
  drawObliqueBox(g, backX, y, slabH * 1.5, depth, backH, FILL_MID, seatH + slabH);

  // 腿（线）
  const fg = frontFaceGraphics(g, x, y);
  const seatX1 = x - seatW / 2, seatX2 = x + seatW / 2;
  lenv(fg, y, 0.85);
  fg.moveTo(seatX1 + 3 * s, y - seatH); fg.lineTo(seatX1 + 3 * s, y);
  fg.moveTo(seatX2 - 3 * s, y - seatH); fg.lineTo(seatX2 - 3 * s, y);
}
