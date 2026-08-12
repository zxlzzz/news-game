import { FILL_PAPER, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第一批。原版把电话亭拆成"机身块 + 顶部檐口块"两个矩形，檐口比机身两侧
// 各宽 3*s（一圈小挑檐）。转盒子时机身走 drawObliqueBox 出体积；檐口那 3*s 的
// 外挑只有 0.035m，做成第二个盒子不值当（还要处理两个盒子的顶/侧面互相穿插），
// 直接留在正面细节里画成扁矩形——俯视角下这点挑檐本来也几乎看不见。
export function drawPhoneBooth(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;
  const w = 80 * s, h = 173 * s;
  const depth = PROP_DEPTH.phonebooth * s;

  drawObliqueBox(g, x, y, w, depth, h, FILL_MID);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  g.lineStyle(0);

  const w  = 80 * s, h = 173 * s;
  const px = x - w / 2, py = y - h;

  // Body block dimensions
  const bpx = px, bpy = py + 11 * s, bw = w, bh = h - 11 * s;

  // Header block dimensions
  const hpx = px - 3 * s, hpy = py, hw = w + 6 * s, hh = 14 * s;

  // === Body details ===
  lenv(g, y, 0.6);
  g.moveTo(bpx + bw / 2, bpy + 3 * s); g.lineTo(bpx + bw / 2, y - 3 * s);
  g.moveTo(bpx + 6 * s,  bpy + bh * 0.5); g.lineTo(bpx + bw - 6 * s, bpy + bh * 0.5);
  g.lineStyle(0);
  g.beginFill(FILL_SHADE, 1);
  g.drawRect(bpx + bw - 14 * s, bpy + 18 * s, 6 * s, 17 * s);
  g.endFill();

  // === Header block ===
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(hpx, hpy, hw, hh);
  g.endFill();
  // Sign strip
  g.lineStyle(0);
  g.beginFill(FILL_PAPER, 1);
  g.drawRect(hpx + 3 * s, hpy + 3 * s, hw - 6 * s, 6 * s);
  g.endFill();
  // Header outline
  lenv(g, hpy, 0.85);
  g.drawRect(hpx, hpy, hw, hh);
}
