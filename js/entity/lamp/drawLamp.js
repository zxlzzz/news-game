import { FILL_LIGHT, FILL_MID, lenv } from '../../core/Layout.js';
import { drawObliqueBox, frontFaceGraphics } from '../../core/Projection.js';
import { PROP_DEPTH } from '../../core/propDefaults.js';

// O-4 第二批。路灯拆三个体块 + 一条悬臂线：
//   底座 → 贴地盒子；灯杆 → 细长盒子；灯箱 → 悬空盒子（baseH = 灯箱底离地高度）
//   悬臂本身是一条斜线（从杆顶伸向灯箱），不是体块，留在正面细节里。
export function drawLamp(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s = p.scale ?? 1;

  const poleH  = 300 * s;
  const armLen = 60  * s;
  const boxW   = 28  * s, boxH  = 28 * s;
  const baseW  = 22  * s, baseH = 22 * s;
  const depth  = PROP_DEPTH.lamp * s;
  const poleW  = Math.max(2 * s, depth * 0.35);

  // 悬臂线先画，后面的体块压住两端
  const fg = frontFaceGraphics(g, x, y);
  const topY    = y - poleH;
  const armTipX = x - armLen;
  const armTipY = topY + 28 * s;
  lenv(fg, y, 1.0);
  fg.moveTo(x, topY); fg.lineTo(armTipX, armTipY);

  drawObliqueBox(g, x, y, baseW, depth, baseH, FILL_MID);                     // 底座
  drawObliqueBox(g, x, y, poleW, poleW, poleH - baseH, FILL_MID, baseH);      // 灯杆
  // 灯箱：中心在悬臂末端左侧半个箱宽处，底面离地 = (y - armTipY) - boxH/2
  drawObliqueBox(g, armTipX - boxW / 2, y, boxW, depth, boxH, FILL_LIGHT,
                 (y - armTipY) - boxH / 2);

  // 灯箱漫射条（细节）
  lenv(fg, armTipY, 0.35);
  fg.moveTo(armTipX - boxW + 3 * s, armTipY);
  fg.lineTo(armTipX - 3 * s,        armTipY);
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
registerProp('lamp', { draw: drawLamp });
