import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawHydrant 的 baseW=30*s，半宽=15*s */
export function footprint(e) {
  return { rx: 15 * depthScale(e.y), ry: 8 };
}
