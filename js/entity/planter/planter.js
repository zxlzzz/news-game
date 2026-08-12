import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawPlanter 的 w=80*s，半宽=40*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 40 * ds, ry: halfDepth('planter', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawPlanter } from './drawPlanter.js';
registerProp('planter', {
  visual: { hw: 40, up: 34, down: 0 },  // drawPlanter w=80；枝叶顶端约 y-34
  draw: drawPlanter, footprint, obstacle: true });
