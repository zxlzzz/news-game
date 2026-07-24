import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawStall 的 w=290*s，极点跨度 ±145*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { shape: 'rect', rx: 145 * ds, ry: Math.max(3, 14 * ds), blocks: true, sortDY: 0 };
}