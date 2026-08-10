import {
  depthLineWidth, depthLineColor,
  FILL_SHADE, ENV_LINE_LIGHT, ENV_LINE_DARK, lenv,
} from '../../core/Layout.js';

export function drawDrain(g, p) {
  g.lineStyle(0);

  const s  = p.scale ?? 1;
  const w  = 58 * s;
  const h  = 27 * s;
  const px = p.x - w / 2;
  const py = p.y - h / 2;

  g.beginFill(FILL_SHADE, 1);
  g.drawRect(px, py, w, h);
  g.endFill();

  lenv(g, p.y);
  g.drawRect(px, py, w, h);

  lenv(g, p.y, 0.65);
  const slots = Math.max(3, Math.floor(w / (9 * s)));
  for (let i = 1; i < slots; i++) {
    const lx = px + (w * i / slots);
    g.moveTo(lx, py + 3 * s);
    g.lineTo(lx, py + h - 3 * s);
  }
}

// ─── 自注册（Z-2d propRegistry）──────────────────────────────────────────────
// 全部绘制在地面预通道，主通道无内容；visual = drawDrain 的 58×27 以 y 居中
import { registerProp } from '../../core/propRegistry.js';
registerProp('drain', { drawGround: drawDrain, visual: { hw: 29, up: 13.5, down: 13.5 } });
