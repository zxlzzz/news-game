import { FILL_LIGHT, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。桶身原本是上宽下窄的梯形（topW 40 → botW 30）；盒子模板只画矩形
// 截面，梯形要绕开模板自己算三面几何，与 O-3「不要自己算三面/斜切几何」的铁律
// 冲突（同 drawStall 雨棚的取舍）。改成等宽桶身取 topW，收腰的观感由正面细节里
// 那两道斜凹槽线保留。桶盖是独立的悬空薄盒（baseH = 桶身高），保留原来的外挑。
export function drawTrash(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s    = p.scale ?? 1;
  const topW = 40 * s, h = 50 * s;
  const depth = PROP_DEPTH.trash * s;

  drawObliqueBox(g, x, y, topW, depth, h, FILL_LIGHT);
  drawObliqueBox(g, x, y, topW + 6 * s, depth + 6 * s, 3 * s, FILL_LIGHT, h);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  const topW = 40 * s, botW = 30 * s, h = 50 * s;

  // Groove details（原第 3 步，未改）
  lenv(g, y, 0.5);
  g.moveTo(x - 6 * s,                        y - h + 6 * s);
  g.lineTo(x - 6 * s + (botW - topW) * 0.3,  y - 3 * s);
  g.moveTo(x + 6 * s,                        y - h + 6 * s);
  g.lineTo(x + 6 * s - (botW - topW) * 0.3,  y - 3 * s);
}
