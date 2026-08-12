import { FILL_LIGHT, FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第一批。摊位是两个体块 + 中间的支柱：
//   柜台 → 贴地盒子（drawObliqueBox，baseH=0）
//   雨棚 → 悬空盒子（drawObliqueBox 的 baseH = 棚底离地高度）
// 原版雨棚是个上宽下窄的梯形（两侧各外挑 9*s），盒子模板只画矩形截面；那点
// 外挑做成梯形要绕开模板自己算三面几何，跟 O-3「新增/转换 draw 函数一律走这
// 三个函数，不要自己算三面/斜切几何」的铁律冲突，所以改成等宽棚顶，外挑的
// 观感由棚沿描边在正面细节里保留。支柱和台面小货品仍是正面细节。
export function drawStall(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s     = p.scale ?? 1;
  const w     = 290 * s;
  const roofH = 200 * s;         // 棚顶离地高度（棚底）
  const ctrH  = 72  * s;         // 柜台高度
  const aH    = 17  * s;         // 棚板厚度
  const depth = PROP_DEPTH.stall * s;

  // 支柱：画在体块之前（原版也是最先画，让填充压住柱脚）
  const fg = frontFaceGraphics(g, x, y);
  _poles(fg, x, y, s, w, roofH);

  // 柜台（贴地）
  drawObliqueBox(g, x, y, w - 6 * s, depth, ctrH, FILL_LIGHT);

  // 台面货品：夹在柜台和雨棚之间，仍走正面细节
  _counterItems(fg, x, y, s, w, ctrH);

  // 雨棚（悬空）——最后画，盖住柱子顶端
  drawObliqueBox(g, x, y, w, depth, aH, FILL_MID, roofH);
}

function _poles(g, x, y, s, w, roofH) {
  const px = x - w / 2;
  lenv(g, y, 1.0);
  g.moveTo(px + 6 * s,     y); g.lineTo(px + 6 * s,     y - roofH);
  g.moveTo(px + w - 6 * s, y); g.lineTo(px + w - 6 * s, y - roofH);
}

// 老版本第 4/5 步（台面货品 + 其描边），绘制逻辑未改。
function _counterItems(g, x, y, s, w, ctrH) {
  const px = x - w / 2;
  const counterY = y - ctrH;
  const itemW = 11 * s, itemH = 9 * s;

  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, counterY - itemH, itemW, itemH);
  }
  g.endFill();

  lenv(g, y, 0.7);
  for (let i = 0; i < 3; i++) {
    const gx = px + 11 * s + i * ((w - 29 * s) / 2);
    g.drawRect(gx, counterY - itemH, itemW, itemH);
  }
}
