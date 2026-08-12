import { FILL_LIGHT, FILL_MID, FILL_SHADE, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。消防栓 = 底座 + 主体 + 圆顶 + 顶栓，外加两侧出水口。
// 圆顶原本是个上窄下宽的梯形，同 drawTrash 桶身/drawStall 雨棚的取舍——盒子
// 模板只画矩形截面，梯形要自己算三面几何（违反 O-3 铁律），改成等宽薄盒；
// 出水口是两个小挂件，留在正面细节里画。
export function drawHydrant(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;

  const baseW = 30 * s, baseH = 8 * s;
  const bodyW = 24 * s, bodyH = 30 * s;
  const domeH = 12 * s;
  const capH  = 7 * s, capW = 8 * s;
  const depth = PROP_DEPTH.hydrant * s;

  drawObliqueBox(g, x, y, baseW, depth, baseH, FILL_MID);
  drawObliqueBox(g, x, y, bodyW, depth * 0.8, bodyH, FILL_LIGHT, baseH);
  drawObliqueBox(g, x, y, 24 * s, depth * 0.7, domeH, FILL_MID, baseH + bodyH);
  drawObliqueBox(g, x, y, capW, capW, capH, FILL_SHADE, baseH + bodyH + domeH);

  _frontDetail(frontFaceGraphics(g, x, y), x, y, s);
}

function _frontDetail(g, x, y, s) {
  const baseH = 8 * s;
  const outW = 12 * s, outH = 8 * s;
  const outY = y - baseH - 20 * s;

  // === 出水口 ===
  g.lineStyle(0);
  g.beginFill(FILL_MID, 1);
  g.drawRect(x - 26 * s, outY, outW, outH);
  g.drawRect(x + 14 * s, outY, outW, outH);
  g.endFill();
  lenv(g, y, 0.8);
  g.drawRect(x - 26 * s, outY, outW, outH);
  g.drawRect(x + 14 * s, outY, outW, outH);
}
