import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawTree 的 trunkW≈20*s（平均 jitter≈1.0），半宽≈10*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 10 * ds, ry: halfDepth('tree', ds), blocks: true, sortDY: -e.height * 0.35 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawTree } from './drawTree.js';
registerProp('tree', {
  visual: { hw: 170, up: 340, down: 0 },  // drawTree r=150×jitter(≤1.15)；树冠横向≈0.98r、总高≈1.97r
  draw: drawTree, footprint, obstacle: true });
