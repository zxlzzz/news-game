import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawMailbox 的箱体 bw=40*s，半宽=20*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { shape: 'rect', rx: 20 * ds, ry: Math.max(3, 6 * ds), blocks: true, sortDY: 0 };
}