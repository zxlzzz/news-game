/** 落地接触面半宽/半深 — 对应 drawNewsRack 的 w=70*s，半宽=35*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 35 * ds, ry: Math.max(3, 10 * ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawNewsRack } from './drawNewsRack.js';
registerProp('newsrack', { draw: drawNewsRack, footprint, obstacle: true });
