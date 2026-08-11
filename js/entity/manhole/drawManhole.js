import {
  depthLineWidth, depthLineColor,
  FILL_SHADE, ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';
import { toScreen, toScreenLength, circleToEllipseRy } from '../../core/Projection.js';

// O-3：纯地面元素，不走盒子，走 Projection 的圆→椭圆形状助手（tasks.md O-3
// 样板之一）。老版本自己拍了个 ry = rx*0.45 的扁平化近似，现在有真投影了，
// 直接用 circleToEllipseRy(rx) 换算——内圈/弦线等细节的相对比例不变。
export function drawManhole(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const rx = 30 * s;

  const base = toScreen(x, y);
  const srx  = toScreenLength(rx);
  const sry  = circleToEllipseRy(rx);

  g.beginFill(FILL_SHADE, 1);
  g.drawEllipse(base.x, base.y, srx, sry);
  g.endFill();

  lenv(g, y);
  g.drawEllipse(base.x, base.y, srx, sry);

  lenv(g, y, 0.6);
  g.drawEllipse(base.x, base.y, srx * 0.775, sry * 0.775);

  lenv(g, y, 0.55);
  for (let i = -2; i <= 2; i++) {
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * srx * 0.78;
    const ly   = base.y + i * (sry * 0.32);
    g.moveTo(base.x - half, ly);
    g.lineTo(base.x + half, ly);
  }
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
// 全部绘制在地面预通道，主通道无内容
import { registerProp } from '../../core/propRegistry.js';
registerProp('manhole', { drawGround: drawManhole });
