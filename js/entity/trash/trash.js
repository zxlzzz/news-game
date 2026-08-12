import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawTrash 的 botW=30*s，半宽=15*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 15 * ds, ry: halfDepth('trash', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawTrash } from './drawTrash.js';
registerProp('trash', {
  visual: { hw: 23, up: 53, down: 0 },  // drawTrash 桶盖 topW+6=46 宽、桶身 50 高 + 盖 3
  draw: drawTrash, footprint, obstacle: true });
