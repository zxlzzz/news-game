/** 落地接触面半宽/半深 — 对应 drawTrash 的 botW=30*s，半宽=15*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 15 * ds, ry: Math.max(3, 10 * ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawTrash } from './drawTrash.js';
registerProp('trash', { draw: drawTrash, footprint, obstacle: true });
