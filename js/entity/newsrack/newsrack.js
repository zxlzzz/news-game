import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawNewsRack 的 w=70*s，半宽=35*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { rx: 35 * ds, ry: Math.max(3, 10 * ds) };
}