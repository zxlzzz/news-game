import { FILL_PAPER, FILL_LIGHT, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。报刊架 = 机身盒子 + 顶部檐口盒子（比机身两侧各宽 3*s，走 baseH
// 抬升到机身顶端），玻璃窗/报纸线/投币口留在正面细节。
export function drawNewsRack(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const w  = 70 * s, h = 86 * s;
  const depth = PROP_DEPTH.newsrack * s;

  const bodyH   = h - 17 * s;           // 机身高（原 bh）
  const headerH = 11 * s;               // 檐口厚（原 hh）

  drawObliqueBox(g, x, y, w, depth, bodyH, FILL_LIGHT);
  drawObliqueBox(g, x, y, w + 6 * s, depth + 6 * s, headerH, FILL_MID, bodyH);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  const w  = 70 * s, h = 86 * s;
  const px = x - w / 2, py = y - h;
  const bpx = px, bpy = py + 17 * s, bw = w, bh = h - 17 * s;

  // Glass window
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 0.5);
  g.drawRect(bpx + 3 * s, bpy + 3 * s, bw - 6 * s, 26 * s);
  g.endFill();

  // Body details（报纸折线）
  lenv(g, y, 0.6);
  g.moveTo(bpx + 6 * s,       bpy + 9 * s);  g.lineTo(bpx + bw - 6 * s,  bpy + 9 * s);
  g.moveTo(bpx + 6 * s,       bpy + 15 * s); g.lineTo(bpx + bw - 6 * s,  bpy + 15 * s);
  g.moveTo(bpx + 6 * s,       bpy + 21 * s); g.lineTo(bpx + bw - 11 * s, bpy + 21 * s);

  // 投币口
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(bpx + bw / 2 - 6 * s, bpy + bh - 14 * s, 11 * s, 3 * s);
  g.endFill();
}
