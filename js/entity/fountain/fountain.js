import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawFountainPool 的 outerRx/outerRy */
export function footprint(e) {
  const rx = 300 * depthScale(e.y) * 0.775;
  return { rx, ry: rx * 0.5 };
}
