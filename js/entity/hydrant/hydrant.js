import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawHydrant 的 baseW=30*s，半宽=15*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { rx: 15 * ds, ry: Math.max(3, 8 * ds) };
}