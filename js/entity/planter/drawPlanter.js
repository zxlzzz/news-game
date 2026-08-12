import { FILL_LIGHT, FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。花箱本体走盒子；枝叶是有机形状（一簇圆），同 drawTree 的树冠——
// 走 frontFaceGraphics 广告牌，原算法一行未改。
export function drawPlanter(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;
  const w = 80 * s, h = 20 * s;
  const bh = h - 9 * s;                  // 箱体高（原 bh = 11*s）
  const depth = PROP_DEPTH.planter * s;

  drawObliqueBox(g, x, y, w, depth, bh, FILL_LIGHT);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  const w   = 80 * s, h = 20 * s;
  const px  = x - w / 2;
  const py  = y - h;
  const bpy = py + 9 * s;
  const bh  = h - 9 * s;

  // 2. Seam lines (detail)
  lenv(g, y, 0.6);
  const segs = Math.max(2, Math.floor(w / (23 * s)));
  for (let i = 1; i < segs; i++) {
    const lx = px + w * i / segs;
    g.moveTo(lx, bpy); g.lineTo(lx, bpy + bh);
  }

  // 3. Plant foliage — FILL_MID + FILL_LIGHT circles over stem lines
  const clumps = Math.max(2, Math.floor(w / (26 * s)));
  for (let i = 0; i < clumps; i++) {
    const cx = px + 11 * s + i * (w - 23 * s) / Math.max(1, clumps - 1);
    const cy = py + 6 * s;

    lenv(g, y, 0.9);
    g.moveTo(cx, cy + 6 * s); g.lineTo(cx, cy - 11 * s);
    g.moveTo(cx, cy - 6 * s); g.lineTo(cx - 9 * s, cy - 14 * s);
    g.moveTo(cx, cy - 6 * s); g.lineTo(cx + 9 * s, cy - 14 * s);

    g.lineStyle(0);
    g.beginFill(FILL_MID, 0.85);
    g.drawCircle(cx,          cy - 11 * s, 7 * s);
    g.drawCircle(cx - 9 * s,  cy - 14 * s, 5 * s);
    g.drawCircle(cx + 9 * s,  cy - 14 * s, 5 * s);
    g.endFill();

    g.beginFill(FILL_LIGHT, 0.75);
    g.drawCircle(cx,          cy - 14 * s, 5 * s);
    g.drawCircle(cx - 9 * s,  cy - 17 * s, 3 * s);
    g.drawCircle(cx + 9 * s,  cy - 17 * s, 3 * s);
    g.endFill();
  }
}
