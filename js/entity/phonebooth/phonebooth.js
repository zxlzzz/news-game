import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawPhoneBooth 的 w=80*s，半宽=40*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 40 * ds, ry: halfDepth('phonebooth', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawPhoneBooth } from './drawPhoneBooth.js';
registerProp('phonebooth', {
  visual: { hw: 43, up: 173, down: 0 },  // drawPhoneBooth 檐口 w+6=86 宽；h=173
  draw: drawPhoneBooth, footprint, obstacle: true });
