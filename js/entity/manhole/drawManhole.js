import {
  depthLineWidth, depthLineColor,
  FILL_SHADE, ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

export function drawManhole(g, p) {
  g.lineStyle(0);

  const { x, y } = p;
  const s  = p.scale ?? 1;
  const rx = 30 * s;
  const ry = rx * 0.45;

  g.beginFill(FILL_SHADE, 1);
  g.drawEllipse(x, y, rx, ry);
  g.endFill();

  lenv(g, y);
  g.drawEllipse(x, y, rx, ry);

  lenv(g, y, 0.6);
  g.drawEllipse(x, y, rx * 0.775, ry * 0.775);

  lenv(g, y, 0.55);
  for (let i = -2; i <= 2; i++) {
    const ly   = y + i * (ry * 0.32);
    const t    = 1 - Math.pow(i / 2.8, 2);
    const half = Math.sqrt(Math.max(0, t)) * rx * 0.78;
    g.moveTo(x - half, ly);
    g.lineTo(x + half, ly);
  }
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
// 全部绘制在地面预通道，主通道无内容
import { registerProp } from '../../core/propRegistry.js';
registerProp('manhole', { drawGround: drawManhole });
