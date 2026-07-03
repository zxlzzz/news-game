import { depthScale } from '../../core/Layout.js';

/** 落地接触面半宽/半深 — 对应 drawMailbox 的箱体 bw=40*s，半宽=20*s */
export function footprint(e) {
  return { rx: 20 * depthScale(e.y), ry: 6 };
}
