import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawPlanter 的 w=80*s，半宽=40*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { shape: 'rect', rx: 40 * ds, ry: Math.max(3, 8 * ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawPlanter } from './drawPlanter.js';
registerProp('planter', { draw: drawPlanter, footprint, obstacle: true });
