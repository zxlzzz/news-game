import { halfDepth } from '../../core/propDefaults.js';
/** 落地接触面半宽/半深 — 对应 drawStall 的 w=290*s，极点跨度 ±145*s */
export function footprint(e) {
  const ds = e.scale ?? 1;
  return { shape: 'rect', rx: 145 * ds, ry: halfDepth('stall', ds), blocks: true, sortDY: 0 };
}
// ─── 自注册（Z-2d propRegistry）────────────────────────────────────────────────
import { registerProp } from '../../core/propRegistry.js';
import { drawStall } from './drawStall.js';
registerProp('stall', {
  draw: drawStall,
  footprint,
  obstacle: true,
  // drawStall: w=290, roofH=200；down=footprint ry
  visual: { hw: 145, up: 200, down: 14 },
});
