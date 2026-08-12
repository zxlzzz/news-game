import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawHydrant 的 baseW=30*s，半宽=15*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 15 * ds, ry: halfDepth('hydrant', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawHydrant } from './drawHydrant.js';
registerProp('hydrant', {
  visual: { hw: 15, up: 57, down: 0 },  // drawHydrant baseW=30；底座8+主体30+圆顶12+顶栓7
  draw: drawHydrant, footprint, obstacle: true });
