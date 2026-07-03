import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawStall 的 w=290*s，极点跨度 ±145*s */
export function footprint(e) {
  return { rx: 145 * depthScale(e.y), ry: 14 };
}
