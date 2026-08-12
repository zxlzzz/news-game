import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawNewsRack 的 w=70*s，半宽=35*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 35 * ds, ry: halfDepth('newsrack', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawNewsRack } from './drawNewsRack.js';
registerProp('newsrack', {
  visual: { hw: 38, up: 86, down: 0 },  // drawNewsRack 檐口 w+6=76 宽；h=86
  draw: drawNewsRack, footprint, obstacle: true });
