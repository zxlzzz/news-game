import { FILL_LIGHT, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。邮筒 = 立柱 + 悬空箱体 + 顶盖，箱体和顶盖都走 baseH 抬升。
export function drawMailbox(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s           = p.scale ?? 1;
  const extraHeight = 20 * s;
  const depth       = PROP_DEPTH.mailbox * s;

  const bw = 40 * s, bh = 35 * s;                  // 箱体
  const cw = 46 * s, ch = 9 * s;                   // 顶盖
  const boxBaseH = (64 - 35) * s + extraHeight;    // 箱体底离地（原 by = y-64s-extra，箱高 35s）
  const capBaseH = 72 * s + extraHeight - ch;      // 顶盖底离地（原 cy = y-72s-extra）
  const postW = Math.max(2 * s, depth * 0.3);

  drawObliqueBox(g, x, y, postW, postW, boxBaseH, FILL_MID);            // 立柱
  drawObliqueBox(g, x, y, bw, depth, bh, FILL_MID, boxBaseH);           // 箱体
  drawObliqueBox(g, x, y, cw, depth + 6 * s, ch, FILL_LIGHT, capBaseH); // 顶盖

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s, extraHeight);
}

function _frontDetail(g, x, y, s, extraHeight) {
  // Mail slot
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(x - 14 * s, y - 52 * s - extraHeight, 29 * s, 6 * s);
  g.endFill();

  // Flag detail
  lenv(g, y, 0.6);
  g.moveTo(x - 9 * s, y - 40 * s - extraHeight);
  g.lineTo(x,         y - 37 * s - extraHeight);
  g.moveTo(x,         y - 37 * s - extraHeight);
  g.lineTo(x + 9 * s, y - 40 * s - extraHeight);
}
