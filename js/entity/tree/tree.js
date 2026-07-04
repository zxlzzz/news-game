import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawTree 的 trunkW≈20*s（平均 jitter≈1.0），半宽≈10*s */
export function footprint(e) {
  const ds = depthScale(e.y);
  return { rx: 10 * ds, ry: Math.max(3, 5 * ds) };
}