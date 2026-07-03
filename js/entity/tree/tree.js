import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawTree 的 trunkW≈20*s（平均 jitter≈1.0），半宽≈10*s */
export function footprint(e) {
  return { rx: 10 * depthScale(e.y), ry: 5 };
}
